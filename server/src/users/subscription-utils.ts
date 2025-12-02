import { getPlan } from 'src/payment/plans';
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
