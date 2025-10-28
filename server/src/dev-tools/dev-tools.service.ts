import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { UserCluster } from 'src/db/cluster-types';
import { DbService } from 'src/db/db.service';
import { WSLogger } from 'src/logger';
import { StripePaymentService } from 'src/payment/stripe-payment.service';
import { SubscriptionId } from 'src/types/ids';
import { isErr } from 'src/types/results';
import { SubscriptionService } from 'src/users/subscription.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class DevToolsService {
  constructor(
    private readonly dbService: DbService,
    private readonly usersService: UsersService,
    private readonly stripePaymentService: StripePaymentService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  /**
   * Temp function to reset the stripe customer and subscription for a user for migrating from one stripe account to a new one
   * See DEV-8698 in Linear
   * Remove after migration is complete
   * @param userId - The id of the user to reset the stripe customer and subscription for
   * @returns - A string with the result of the operation
   */
  async resetStripeCustomerForUser(userId: string): Promise<string> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    // Clear the stripe customer id on the user
    const updatedUser = await this.dbService.client.user.update({
      where: { id: userId },
      data: {
        stripeCustomerId: null,
      },
      include: UserCluster._validator.include,
    });

    WSLogger.info({
      source: DevToolsService.name,
      message: `Cleared stripe customer id for user ${userId}`,
    });

    // delete the current subscription
    let numDeleted = 0;
    for (const subscription of updatedUser.subscriptions) {
      numDeleted += await this.subscriptionService.delete(subscription.id as SubscriptionId);
    }

    WSLogger.info({
      source: DevToolsService.name,
      message: `Deleted ${numDeleted} subscriptions for user ${userId}`,
    });

    // generate a new trial subscription
    const result = await this.stripePaymentService.createTrialSubscription(updatedUser);
    if (isErr(result)) {
      WSLogger.error({
        source: DevToolsService.name,
        message: `Failed to create trial subscription for user ${userId}`,
        error: result.error,
      });
      throw new InternalServerErrorException('Failed to create trial subscription');
    }

    WSLogger.info({
      source: DevToolsService.name,
      message: `Created trial subscription for user ${userId}`,
    });

    return `Successfully reset stripe customer and subscription for user ${userId}. ${numDeleted} subscriptions deleted. 1 trial subscription created.`;
  }
}
