import { Service } from '@/types/server-entities/connector-accounts';
import { ScratchpadPlanType, SubscriptionInfo } from '@spinner/shared-types';
import { useCallback, useMemo } from 'react';
import { useConnectorAccounts } from './use-connector-account';
import { useScratchPadUser } from './useScratchpadUser';

export interface UseSubscriptionReturn {
  subscription: SubscriptionInfo;
  isFreePlan: boolean;
  canPublishWorkbook: boolean;
  canCreateDataSource: (service: Service) => boolean;
  canCreateCredentials: boolean;
}

const UNKNOWN_SUBSCRIPTION_STATUS: UseSubscriptionReturn = {
  subscription: {
    status: 'none',
    planDisplayName: 'No Plan',
    planType: ScratchpadPlanType.FREE_PLAN,
    costUSD: 0,
    daysRemaining: 0,
    isTrial: false,
    isCancelled: false,
    canManageSubscription: false,
    ownerId: '',
    features: {
      availableModels: ['none'],
      creditLimit: -1,
      allowPersonalKeys: false,
      dataSourcePerServiceLimit: -1,
      publishingLimit: -1,
    },
  },
  isFreePlan: false,
  canPublishWorkbook: false,
  canCreateDataSource: () => false,
  canCreateCredentials: false,
};

/**
 * This is a bit thin right now, but more will be added as we integrate subscription evaluation into the UI.
 *
 * For now I am extracting the subscription out of the user, but this will get swapped into a new endpoint that we can refresh from the server.
 *
 * TODO: add utilities to test which features are available and if the user can perform actions based on the subscription
 */
export function useSubscription(): UseSubscriptionReturn {
  const { user } = useScratchPadUser();
  const { connectorAccounts } = useConnectorAccounts();

  const canPublishWorkbook = useMemo(() => {
    if (!user) return false;
    if (!user.subscription) return false;

    if (user.subscription.status !== 'valid') {
      return false;
    }

    const limit = user.subscription.features.publishingLimit ?? 10;

    if (limit === 0) {
      return true;
    }

    // TODO: get org monthly publishing count
    const monthlyPublishCount = 0;

    return monthlyPublishCount < limit;
  }, [user]);

  const canCreateDataSource = useCallback(
    (service: Service) => {
      if (!user) return false;
      if (!connectorAccounts) return false;
      if (!user.subscription) return false;

      if (user.subscription.status !== 'valid') {
        return false;
      }

      const limit = user.subscription.features.dataSourcePerServiceLimit ?? 1;

      if (limit === 0) {
        // no limit, so always allow
        return true;
      }

      const dataSourcesForService = connectorAccounts.filter((ca) => ca.service === service).length ?? 0;
      return dataSourcesForService < limit;
    },
    [user, connectorAccounts],
  );

  const canCreateCredentials = useMemo(() => {
    if (!user) return false;
    if (!user.subscription) return false;

    if (user.subscription.status !== 'valid') {
      return false;
    }

    return user.subscription.features.allowPersonalKeys ?? false;
  }, [user]);

  if (!user) {
    return UNKNOWN_SUBSCRIPTION_STATUS;
  }

  if (!user.subscription) {
    return UNKNOWN_SUBSCRIPTION_STATUS;
  }

  return {
    subscription: user.subscription,
    isFreePlan: user.subscription.planType === ScratchpadPlanType.FREE_PLAN,
    canPublishWorkbook,
    canCreateDataSource,
    canCreateCredentials,
  };
}
