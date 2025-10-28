import { Injectable } from '@nestjs/common';
import { Subscription } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import { SubscriptionId } from 'src/types/ids';

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
}
