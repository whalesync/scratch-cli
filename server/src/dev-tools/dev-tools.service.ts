import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { StripePaymentService } from 'src/payment/stripe-payment.service';
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
   * Change a user's organization. Optionally mark the old organization as deleted
   * if no other users are associated with it.
   */
  async changeUserOrganization(
    userId: string,
    newOrganizationId: string,
    deleteOldOrganization?: boolean,
  ): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newOrganization = await this.dbService.client.organization.findUnique({
      where: { id: newOrganizationId },
    });
    if (!newOrganization) {
      throw new NotFoundException('Organization not found');
    }
    if (newOrganization.deleted) {
      throw new BadRequestException('Target organization is marked for deletion');
    }

    const oldOrganizationId = user.organizationId;

    await this.dbService.client.user.update({
      where: { id: userId },
      data: { organizationId: newOrganizationId },
    });

    if (deleteOldOrganization && oldOrganizationId) {
      const userCountInOldOrg = await this.dbService.client.user.count({
        where: { organizationId: oldOrganizationId },
      });
      if (userCountInOldOrg === 0) {
        await this.dbService.client.organization.update({
          where: { id: oldOrganizationId },
          data: { deleted: true },
        });
      }
    }
  }
}
