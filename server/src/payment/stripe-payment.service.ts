import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { UserCluster } from 'src/db/cluster-types';
import { DbService } from 'src/db/db.service';
import { WSLogger } from 'src/logger';
import { PostHogService } from 'src/posthog/posthog.service';
import { createInvoiceResultId, createSubscriptionId } from 'src/types/ids';
import {
  AsyncResult,
  badRequestError,
  ErrorCode,
  errResult,
  isErr,
  ok,
  Result,
  stripeLibraryError,
  unauthorizedError,
  unexpectedError,
} from 'src/types/results';
import { UsersService } from 'src/users/users.service';
import Stripe from 'stripe';
import { getActiveSubscriptions } from './helpers';
import { PRODUCTION_PRODUCTS, ScratchpadProductType, TEST_PRODUCTS } from './products';

/**
 * The version of the API we are expecting, from: https://stripe.com/docs/api/versioning
 * For upgrading this, see: https://stripe.com/docs/upgrades#api-versions
 */
const STRIPE_API_VERSION = '2025-08-27.basil';
const TRIAL_PERIOD_DAYS = 7;
type StripeWebhookResult = 'success' | 'ignored';

/**
 * Metadata we add to all subscriptions created by Scratchpad.
 */
export interface StripeSubscriptionMetadata {
  application?: 'scratchpad';
  productType?: ScratchpadProductType;
}

export interface StripeSubscriptionItemMetadata {
  application?: 'scratchpad';
  productType?: ScratchpadProductType;
}

@Injectable()
export class StripePaymentService {
  private stripe: Stripe;
  private stripeWebhookSecret: string;

  constructor(
    private readonly configService: ScratchpadConfigService,
    private readonly dbService: DbService,
    private readonly usersService: UsersService,
    private readonly postHogService: PostHogService,
  ) {
    this.stripe = new Stripe(this.configService.getStripeApiKey(), {
      apiVersion: STRIPE_API_VERSION,
    });
    this.stripeWebhookSecret = this.configService.getStripeWebhookSecret();
  }

  async generateNewCustomerId(user: User): AsyncResult<string> {
    WSLogger.debug({
      source: StripePaymentService.name,
      message: `Generating new customer ID for user ${user.id}`,
    });

    let response: Stripe.Customer;
    try {
      // Keep it mostly empty to create a blank customer.
      response = await this.stripe.customers.create({ name: user.name ?? '', email: user.email ?? undefined });
      WSLogger.debug({
        source: StripePaymentService.name,
        message: `New customer created with ID ${response.id} for user ${user.id}`,
      });
    } catch (err) {
      WSLogger.error({
        source: StripePaymentService.name,
        message: `Failed to generate new customer for user ${user.id}`,
        error: err,
      });
      return errResult(ErrorCode.StripeLibraryError, `Failed to generate new customer: ${err}`);
    }
    return ok(response.id);
  }

  async createCustomerPortalUrl(user: UserCluster.User): AsyncResult<string> {
    WSLogger.debug({
      source: StripePaymentService.name,
      message: `Creating customer portal URL for user ${user.id}`,
    });

    const stripeCustomerId = await this.upsertStripeCustomerId(user);
    if (isErr(stripeCustomerId)) {
      return stripeCustomerId;
    }

    const portalSession = await this.stripe.billingPortal.sessions.create(
      {
        customer: stripeCustomerId.v,
        return_url: ScratchpadConfigService.getClientBaseUrl(),
      },
      {
        apiVersion: STRIPE_API_VERSION,
      },
    );

    WSLogger.debug({
      source: StripePaymentService.name,
      message: `Generated customer portal URL for user ${user.id}`,
      url: portalSession.url,
    });
    return ok(portalSession.url);
  }

  async generateCheckoutUrl(user: UserCluster.User, productType: ScratchpadProductType): AsyncResult<string> {
    WSLogger.debug({
      source: StripePaymentService.name,
      message: `Generating checkout URL for user ${user.id}, product ${productType}`,
    });

    // Never allow someone to checkout again if they already have a current subscription.
    // Instead send them to manage the existing one.
    if (getActiveSubscriptions(user.subscriptions).length > 0) {
      return this.createCustomerPortalUrl(user);
    }

    const stripePriceId = this.getDefaultPriceId(productType);
    if (!stripePriceId) {
      return unexpectedError(`No stripe product id for ${productType}`);
    }

    const stripeCustomerId = await this.upsertStripeCustomerId(user);
    if (isErr(stripeCustomerId)) {
      return stripeCustomerId;
    }

    const clientBaseUrl = ScratchpadConfigService.getClientBaseUrl();

    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        customer: stripeCustomerId.v,

        subscription_data: {
          trial_period_days: TRIAL_PERIOD_DAYS,
          metadata: {
            application: 'scratchpad',
            productType: productType,
          },
        },

        // We must enable this to properly auto-collect taxes for customers based on their location.
        automatic_tax: { enabled: true },
        customer_update: { address: 'auto', name: 'auto' },

        // In event of either success or failure, send them back to the dashboard root page to sort things
        // out. It has logic to redirect to an appropriate sub-view afterwards.
        success_url: `${clientBaseUrl}/?welcome`,
        cancel_url: `${clientBaseUrl}`,

        // Allows the customer to enter their tax ID number.
        tax_id_collection: { enabled: true },
      },
      {
        apiVersion: STRIPE_API_VERSION,
      },
    );

    if (session.url) {
      WSLogger.debug({
        source: StripePaymentService.name,
        message: `Generated checkout URL for user ${user.id}`,
        url: session.url,
      });
      return ok(session.url);
    } else {
      return stripeLibraryError('No URL returned from Stripe');
    }
  }

  /**
   * Returns the Stripe customer ID for a user. If the user doesn't have one yet, it creates one and updates the user in
   * the database.
   */
  private async upsertStripeCustomerId(user: UserCluster.User): AsyncResult<string> {
    if (user.stripeCustomerId) {
      return ok(user.stripeCustomerId);
    }

    // We need to generate one and save it on the user.
    const result = await this.generateNewCustomerId(user);
    if (isErr(result)) {
      return result;
    }

    const newStripeCustomerId = result.v;
    try {
      await this.usersService.upsertStripeCustomerId(user, newStripeCustomerId);
    } catch (err) {
      return unexpectedError('There was a problem with saving the Stripe ID on the user', { cause: err as Error });
    }
    return ok(newStripeCustomerId);
  }

  async handleWebhookCallback(requestBody: string, signatureHeader: string): AsyncResult<StripeWebhookResult> {
    WSLogger.debug({
      source: StripePaymentService.name,
      message: `Starting to handle webhook callback`,
    });

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(requestBody, signatureHeader, this.stripeWebhookSecret);
    } catch (err) {
      const error = err as Error;
      WSLogger.error({
        source: StripePaymentService.name,
        message: `⚠️  Webhook signature verification failed`,
        error: { name: error.name, message: error.message, stack: error.stack },
      });
      return unauthorizedError('Webhook signature verification failed');
    }

    WSLogger.debug({
      source: StripePaymentService.name,
      message: `Processing Stripe webhook event`,
      eventType: event.type,
    });

    let result: Result<StripeWebhookResult>;
    switch (event.type) {
      case 'checkout.session.completed':
        // Initial payment is successful and the subscription is created.
        result = await this.handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // A subscription changed (switching from one plan to another, or changing the status from trial to active).
        result = await this.handleCustomerSubscriptionUpdated(event);
        break;
      case 'invoice.paid':
        // A charge has gone through successfully.
        result = await this.handleInvoicePaid(event.data.object);
        break;
      case 'invoice.payment_failed':
        // The payment failed or the customer does not have a valid payment method.
        // The subscription becomes past_due.
        result = await this.handleInvoiceFailed(event.data.object);
        break;
      default:
        // NOTE! There's a bunch more that would let us know more about when it's getting ready to expire.
        // If you add more you need to add them to:
        // Staging: https://dashboard.stripe.com/test/webhooks/we_1KhNmyB3kcxQq5fuTyvOImPi
        // and Production: https://dashboard.stripe.com/webhooks/we_1KhNqVB3kcxQq5fuVE6hGARg
        // Seen events: invoice.created, invoice.finalized, invoice.payment_succeeded
        WSLogger.debug({
          source: StripePaymentService.name,
          message: `Unhandled Stripe webhook event type: ${event.type}`,
        });

        result = ok('success');
    }

    WSLogger.info({
      source: StripePaymentService.name,
      message: 'Finished processing Stripe webhook callback',
      result: result,
    });

    return result;
  }
  /*
  Stripe webhookevent handlers
  */
  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): AsyncResult<StripeWebhookResult> {
    WSLogger.debug({
      source: StripePaymentService.name,
      message: `Handling checkout session completed`,
      sessionId: session.id,
    });

    const stripeSubscriptionId = session.subscription as string;
    if (!stripeSubscriptionId) {
      return badRequestError('checkout.session.completed missing subscription field');
    }

    return this.upsertSubscription(stripeSubscriptionId, undefined);
  }

  private async handleCustomerSubscriptionUpdated(event: Stripe.Event): AsyncResult<StripeWebhookResult> {
    const subscription = event.data.object as Stripe.Subscription;
    const eventType = event.type;

    WSLogger.debug({
      source: StripePaymentService.name,
      message: `Handling customer subscription updated`,
      eventType: eventType,
      subscriptionId: subscription.id,
    });

    const stripeSubscriptionId = subscription.id;
    if (!stripeSubscriptionId) {
      return badRequestError('customer.subscription.updated missing id field');
    }

    return this.upsertSubscription(stripeSubscriptionId, undefined);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): AsyncResult<StripeWebhookResult> {
    WSLogger.debug({
      source: StripePaymentService.name,
      message: `Handling invoice paid`,
      invoiceId: invoice.id,
    });

    let updateCount = 0;

    for (const line of invoice.lines.data) {
      const stripeSubscriptionId = line.subscription as string;
      if (!stripeSubscriptionId) {
        WSLogger.error({
          source: StripePaymentService.name,
          message: `invoice.paid stripe webhook contains non-subscription items`,
        });
        continue; // In case there's something that's not a subcription on the invoice.
      }
      const result = await this.upsertSubscription(stripeSubscriptionId, true);
      if (isErr(result)) {
        return unexpectedError('Subscription could not update', { cause: result.cause });
      } else if (result.v === 'success') {
        updateCount++;
      }
    }

    if (updateCount > 0) {
      // Only log invoice results if we actually updated a subscription
      const user = await this.usersService.getUserFromStripeCustomerId(invoice.customer as string);
      if (user) {
        try {
          await this.dbService.client.invoiceResult.create({
            data: {
              id: createInvoiceResultId(),
              userId: user.id,
              invoiceId: invoice.id as string,
              succeeded: true,
            },
          });
        } catch (err) {
          WSLogger.error({
            source: StripePaymentService.name,
            message: `Failed to create invoice result`,
            invoiceId: invoice.id,
            error: err,
          });
        }
      }
    }
    return ok('success');
  }

  private async handleInvoiceFailed(invoice: Stripe.Invoice): AsyncResult<StripeWebhookResult> {
    WSLogger.debug({
      source: StripePaymentService.name,
      message: `Handling invoice failed`,
      invoiceId: invoice.id,
    });

    let updateCount = 0;

    // there could be multiple items on the invoice but normally it should just be one subscription
    for (const line of invoice.lines.data) {
      const stripeSubscriptionId = line.subscription as string;
      if (!stripeSubscriptionId) {
        WSLogger.error({
          source: StripePaymentService.name,
          message: `invoice.payment_failed stripe webhook contains non-subscription items`,
        });
        continue; // In case there's something that's not a subcription on the invoice.
      }

      const subscription = await this.getSubscriptionFromStripe(stripeSubscriptionId);
      if (isErr(subscription)) {
        WSLogger.error({
          source: StripePaymentService.name,
          message: `Failed to get subscription`,
          error: subscription.cause,
          subscriptionId: stripeSubscriptionId,
        });
        continue;
      }

      if (!this.isScratchpadSubscription(subscription.v)) {
        WSLogger.debug({
          source: StripePaymentService.name,
          message: `Skipping upsert for non-scratchpad subscription`,
          subscriptionId: stripeSubscriptionId,
        });
        continue;
      }

      try {
        await this.dbService.client.subscription.update({
          where: { stripeSubscriptionId },
          data: { lastInvoicePaid: false },
        });
        updateCount++;
      } catch (err) {
        WSLogger.error({
          source: StripePaymentService.name,
          message: `Failed to update subscription with no invoice paid`,
          error: err,
          subscriptionId: stripeSubscriptionId,
        });
      }
    }

    return ok(updateCount > 0 ? 'success' : 'ignored');
  }

  private async getSubscriptionFromStripe(stripeSubscriptionId: string): AsyncResult<Stripe.Subscription> {
    try {
      return ok(await this.stripe.subscriptions.retrieve(stripeSubscriptionId));
    } catch (err) {
      return stripeLibraryError(`Failed to retrieve subscription: ${err}`, { context: { stripeSubscriptionId } });
    }
  }

  private isScratchpadSubscription(subscription: Stripe.Subscription): boolean {
    const metadata = subscription.metadata as StripeSubscriptionMetadata;

    const productType = this.getProductTypeFromSubscription(subscription);

    return metadata.application === 'scratchpad' && productType !== null;
  }

  /**
   * Create or update a subscription we've been notified has changed.
   * Polls Stripe to get the latest data for the subscription, then looks up the subscription handling.
   *
   * If the user changes the plan they are on, it keeps the same subcriptionId and will update in place here.
   */
  public async upsertSubscription(
    stripeSubscriptionId: string,
    lastInvoicePaid: boolean | undefined,
  ): AsyncResult<'success' | 'ignored'> {
    WSLogger.debug({
      source: StripePaymentService.name,
      message: `Upserting subscription`,
      subscriptionId: stripeSubscriptionId,
    });

    const getSubscriptionResult = await this.getSubscriptionFromStripe(stripeSubscriptionId);
    if (isErr(getSubscriptionResult)) {
      return getSubscriptionResult;
    }
    const subscription = getSubscriptionResult.v;

    if (!this.isScratchpadSubscription(subscription)) {
      WSLogger.debug({
        source: StripePaymentService.name,
        message: `Skipping upsert for non-scratchpad subscription`,
        subscriptionId: stripeSubscriptionId,
      });
      return ok('ignored');
    }

    // Search for the first item with a plan we recognize, so we can record what plan they are on.
    // We currently only expect there to be one plan per subscription, but that's not guaranteed.
    const productType = this.getProductTypeFromSubscription(subscription);
    if (!productType) {
      return unexpectedError('No subscription item attached with plan we recognized.', {
        context: { stripeSubscriptionId },
      });
    }

    const stripeCustomerId = subscription.customer as string;
    const expiration = this.findExpirationFromSubscription(subscription);
    const priceInDollars = this.findPriceInDollarsForSubscription(subscription);

    // Ignore payloads for an unknown user in staging and test instances.
    // Our preprod environments all share a stripe developer account, so they both receive notifications for each
    // other's users. In prod, we want to return a failure to the webhook if the payload doesn't match our database, but
    // that is a regular occurence on the dev account. If we regularly return failures, it will get our webhooks
    // disabled.
    const wsEnv = this.configService.getScratchpadEnvironment();
    if (wsEnv === 'staging' || wsEnv === 'test') {
      const isKnown = await this.isKnownStripeCustomerId(stripeCustomerId);
      if (isKnown === false) {
        // It's okay, this is just the wrong instance.
        return ok('success');
      }
    }

    // This should always be an insert, except if the same message is delivered twice accidentally.
    try {
      await this.dbService.client.subscription.upsert({
        where: { stripeSubscriptionId },
        create: {
          id: createSubscriptionId(),
          user: { connect: { stripeCustomerId } },
          stripeSubscriptionId,
          expiration,
          productType,
          priceInDollars,
          lastInvoicePaid,
        },
        update: {
          expiration,
          productType,
          priceInDollars,
          lastInvoicePaid,
        },
      });
    } catch (err) {
      WSLogger.error({
        source: StripePaymentService.name,
        message: `Failed to upsert subscription`,
        subscriptionId: stripeSubscriptionId,
        error: err,
      });
      return unexpectedError('Failed to upsert subscription', { cause: err as Error });
    }
    WSLogger.debug({
      source: StripePaymentService.name,
      message: `Successfully upserted subscription`,
      subscriptionId: stripeSubscriptionId,
    });
    return ok('success');
  }

  /*
   * Common Utility Functions
   */

  private findExpirationFromSubscription(subscription: Stripe.Subscription): Date {
    if (subscription.ended_at) {
      return new Date(subscription.ended_at * 1000);
    }
    return new Date(subscription.items.data[0].current_period_end * 1000);
  }

  private async isKnownStripeCustomerId(stripeCustomerId: string): Promise<boolean> {
    const user = await this.usersService.getUserFromStripeCustomerId(stripeCustomerId);
    if (user) {
      return true;
    }
    return false;
  }

  private getDefaultPriceId(productType: ScratchpadProductType): string | null {
    const products =
      this.configService.getScratchpadEnvironment() === 'production' ? PRODUCTION_PRODUCTS : TEST_PRODUCTS;

    for (const product of products) {
      if (product.productType === productType) {
        return product.stripePriceId;
      }
    }

    return null;
  }

  private getProductTypeFromPriceId(priceId: string): ScratchpadProductType | null {
    const products =
      this.configService.getScratchpadEnvironment() === 'production' ? PRODUCTION_PRODUCTS : TEST_PRODUCTS;

    for (const product of products) {
      if (product.stripePriceId === priceId) {
        return product.productType;
      }
    }

    return null;
  }

  private getProductTypeFromSubscription(subscription: Stripe.Subscription): string | null {
    WSLogger.verbose({
      source: StripePaymentService.name,
      message: `Getting product id from subscription`,
      subscriptionId: subscription.id,
    });
    const firstItem = subscription.items?.data[0];

    if (!firstItem) {
      return null;
    }

    const priceId = firstItem.price?.id;
    const metadata = firstItem.metadata as StripeSubscriptionMetadata;

    if (!priceId || metadata.application !== 'scratchpad') {
      return null;
    }

    WSLogger.verbose({
      source: StripePaymentService.name,
      message: `Got price id from subscription`,
      priceId,
      metadata,
    });

    const productType = this.getProductTypeFromPriceId(priceId);
    if (!productType) {
      WSLogger.warn({
        source: StripePaymentService.name,
        message: `No product type found for price id`,
        priceId,
      });
    }

    return productType;
  }

  private findPriceInDollarsForSubscription(subscription: Stripe.Subscription): number | undefined {
    for (const subscriptionItem of subscription.items.data) {
      const price = subscriptionItem.plan.amount;
      if (price && subscriptionItem.plan.currency === 'usd') {
        // Value comes in cents! We want to store dollars.
        return Math.floor(price / 100);
      }
    }
    return undefined;
  }
}
