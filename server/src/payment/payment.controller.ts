import {
  BadRequestException,
  ClassSerializerInterceptor,
  Controller,
  InternalServerErrorException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { isString } from 'lodash';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { ErrorCode, isErr } from 'src/types/results';
import { CreateCheckoutSessionResponse } from './dto/create-checkout-session-response';
import { CreateCustomerPortalUrlResponse } from './dto/create-portal-response';
import { getPlanTypeFromString } from './plans';
import { StripePaymentService } from './stripe-payment.service';

const STRIPE_PAGE_ERROR_USER_FACING_MESSAGE =
  'There was a problem navigating to the payment page. Please contact support.';

@UseInterceptors(ClassSerializerInterceptor)
@Controller('payment')
export class StripePaymentController {
  constructor(private readonly stripePaymentService: StripePaymentService) {}

  /**
   * Called by an authenticated user to get a link to their stripe page portal page.
   * This page is for managing their existing subscriptions.
   * Returns a URL that the user should be redirected to.
   */
  @UseGuards(ScratchpadAuthGuard)
  @Post('portal')
  async createCustomerPortalUrl(@Req() req: RequestWithUser): Promise<CreateCustomerPortalUrlResponse> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    const result = await this.stripePaymentService.createCustomerPortalUrl(req.user);
    if (isErr(result)) {
      throw new InternalServerErrorException({
        userFacingMessage: STRIPE_PAGE_ERROR_USER_FACING_MESSAGE,
      });
    }
    return { url: result.v };
  }

  /**
   * Called by an authenticated user to start a checkout session for them with stripe.
   * Returns a URL that the user should be redirected to.
   */
  @UseGuards(ScratchpadAuthGuard)
  @Post('checkout/:productType')
  async createCheckoutSession(
    @Req() req: RequestWithUser,
    @Param('productType') productType: string,
  ): Promise<CreateCheckoutSessionResponse> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    const productTypeEnum = getPlanTypeFromString(productType);

    // TODO validate the product type enum
    if (!productTypeEnum) {
      throw new BadRequestException({
        userFacingMessage: `Invalid product type: ${productType}`,
      });
    }

    const result = await this.stripePaymentService.generateCheckoutUrl(req.user, productTypeEnum);
    if (isErr(result)) {
      throw new InternalServerErrorException({
        userFacingMessage: STRIPE_PAGE_ERROR_USER_FACING_MESSAGE,
        debugMessage: `Encountered a problem generating stripe checkout URL: ${result.error}`,
      });
    }
    return { url: result.v };
  }

  /**
   * Handler for the webhook events Stripe triggers for us.
   *
   * There is no auth attached to the request, but it does include a signature header to validate origin.
   *
   * NOTE! Stripe webhooks requires access to the unparsed body to check its signature, so this method needs to be
   * parsed with `RawBodyMiddleware` in `AppModule`.
   */
  @Post('webhook')
  async handleWebhook(@Req() req: Request): Promise<{ result: string }> {
    // Require a signature on the data.

    const signature = req.headers['stripe-signature'] as string;
    if (!isString(signature)) {
      throw new BadRequestException({
        userFacingMessage: '"stripe-signature" header does not contain a string',
      });
    }

    if (!req.body) {
      throw new BadRequestException({
        userFacingMessage: 'request body is empty',
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const result = await this.stripePaymentService.handleWebhookCallback(req.body.toString(), signature);
    if (isErr(result)) {
      if (result.code === ErrorCode.UnauthorizedError || result.code === ErrorCode.StripeLibraryError) {
        throw new UnauthorizedException({
          userFacingMessage: 'stripe signature verification failed',
        });
      }

      if (result.code === ErrorCode.BadRequestError) {
        throw new BadRequestException({
          userFacingMessage: `stripe payload has problems: ${result.error}`,
        });
      }
      throw new InternalServerErrorException({
        userFacingMessage: `internal issue processing webhook: ${result.error}`,
      });
    }

    // What we return doesn't matter as long as the status is 200.
    return { result: 'ok' };
  }
}
