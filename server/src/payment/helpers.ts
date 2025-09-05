import { Subscription } from '@prisma/client';

export function getActiveSubscriptions(subscriptions: Subscription[]): Subscription[] {
  const currentDate = new Date();
  return subscriptions.filter((sub) => sub.expiration >= currentDate);
}
