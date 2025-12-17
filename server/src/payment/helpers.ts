import { Subscription } from '@prisma/client';
import { ScratchPlanType } from '@spinner/shared-types';
import _ from 'lodash';
import { UserCluster } from 'src/db/cluster-types';
import { getPlanTypeFromString } from './plans';

export function getActiveSubscriptions(subscriptions: Subscription[]): Subscription[] {
  const currentDate = new Date();
  return subscriptions.filter((sub) => sub.expiration >= currentDate && sub.stripeStatus !== 'canceled');
}

export function getLastestExpiringSubscription(subscriptions: Subscription[]): Subscription | null {
  // ignore cancelled subscriptions
  const validSubscriptions = subscriptions.filter((s) => s.stripeStatus !== 'canceled');
  if (validSubscriptions.length === 0) {
    return null;
  }
  return _.maxBy(validSubscriptions, (s) => s.expiration) ?? null;
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

export function getSubscriptionPlanType(user: UserCluster.User): ScratchPlanType {
  const latestSubscription = getLastestExpiringSubscription(user.organization?.subscriptions ?? []);
  if (!latestSubscription) {
    return ScratchPlanType.FREE_PLAN;
  }
  return getPlanTypeFromString(latestSubscription.planType) ?? ScratchPlanType.FREE_PLAN;
}
