import { UserCluster } from 'src/db/cluster-types';
import { getLastestExpiringSubscription } from 'src/payment/helpers';
import { getFreePlan, getPlan, getPlanTypeFromString } from 'src/payment/plans';
import { SubscriptionStatus } from './types';

export function isSubscriptionActive(subscriptionStatus: SubscriptionStatus): boolean {
  return subscriptionStatus?.status === 'active';
}

export function canCreateDataSource(
  subscriptionStatus: SubscriptionStatus | undefined,
  existingDataSources: number,
): boolean {
  if (!subscriptionStatus || !isSubscriptionActive(subscriptionStatus)) {
    return false;
  }

  const plan = getPlan(subscriptionStatus.planType);

  const limit = plan?.features.dataSourcePerServiceLimit ?? 1;

  if (limit === 0) {
    return true;
  }

  return existingDataSources < limit;
}

export function canCreatePersonalAgentCredentials(subscriptionStatus: SubscriptionStatus | undefined): boolean {
  if (!subscriptionStatus || !isSubscriptionActive(subscriptionStatus)) {
    return false;
  }

  const plan = getPlan(subscriptionStatus.planType);

  return plan?.features.allowPersonalKeys ?? false;
}

/**
 * Get the list of allowed models for a user based on their subscription.
 * Returns empty array if all models are allowed (paid plans),
 * or a specific list of model IDs if restricted (free plan).
 */
export function getAvailableModelsForUser(user: UserCluster.User): string[] {
  const subscriptions = user.organization?.subscriptions ?? [];
  const latestSubscription = getLastestExpiringSubscription(subscriptions);

  if (!latestSubscription) {
    // No subscription = free plan
    return getFreePlan().features.availableModels;
  }

  const planType = getPlanTypeFromString(latestSubscription.planType);
  if (!planType) {
    return getFreePlan().features.availableModels;
  }

  const plan = getPlan(planType);
  if (!plan) {
    return getFreePlan().features.availableModels;
  }

  return plan.features.availableModels;
}
