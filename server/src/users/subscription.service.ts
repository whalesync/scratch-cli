import { Injectable } from '@nestjs/common';
import { ActionType, Subscription } from '@prisma/client';
import { SubscriptionId } from '@spinner/shared-types';
import { DbService } from 'src/db/db.service';

@Injectable()
export class SubscriptionService {
  constructor(private readonly db: DbService) {}

  async findForUser(userId: string): Promise<Subscription[]> {
    return this.db.client.subscription.findMany({ where: { userId } });
  }

  async delete(subscriptionId: SubscriptionId): Promise<number> {
    const result = await this.db.client.subscription.deleteMany({ where: { id: subscriptionId } });
    return result.count;
  }

  /**
   * Count the number of publish actions performed by an organization in the current month.
   * Used for enforcing monthly publishing limits.
   */
  async countMonthlyPublishActions(organizationId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return this.db.client.action.count({
      where: {
        organizationId,
        actionType: ActionType.PUBLISH,
        createdAt: {
          gte: startOfMonth,
        },
      },
    });
  }
}
