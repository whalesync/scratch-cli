import { Subscription } from '@prisma/client';
import _ from 'lodash';

export function getActiveSubscriptions(subscriptions: Subscription[]): Subscription[] {
  const currentDate = new Date();
  return subscriptions.filter((sub) => sub.expiration >= currentDate);
}

export function getLastestExpiringSubscription(subscriptions: Subscription[]): Subscription | null {
  return _.maxBy(subscriptions, (s) => s.expiration) ?? null;
}
