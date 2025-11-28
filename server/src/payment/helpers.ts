import { Subscription } from '@prisma/client';
import _ from 'lodash';

export function getActiveSubscriptions(subscriptions: Subscription[]): Subscription[] {
  const currentDate = new Date();
  return subscriptions.filter((sub) => sub.expiration >= currentDate);
}

export function getLastestExpiringSubscription(subscriptions: Subscription[]): Subscription | null {
  return _.maxBy(subscriptions, (s) => s.expiration) ?? null;
}

export function isActiveSubscriptionOwnedByUser(subscriptions: Subscription[], userId: string): boolean {
  const activeSub = getLastestExpiringSubscription(subscriptions);
  if (!activeSub) {
    return false;
  }
  return activeSub.userId === userId;
}

export function isSubscriptionExpired(subscription: Subscription): boolean {
  return subscription.expiration < new Date();
}
