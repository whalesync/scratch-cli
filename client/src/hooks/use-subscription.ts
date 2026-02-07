import { ScratchPlanType, Service, SubscriptionInfo } from '@spinner/shared-types';
import { useCallback, useMemo } from 'react';
import { useScratchPadUser } from './useScratchpadUser';

export interface UseSubscriptionReturn {
  subscription: SubscriptionInfo;
  isFreePlan: boolean;
  canPublishWorkbook: boolean;
  canCreateDataSource: (service: Service) => boolean;
  canCreateCredentials: boolean;
  /** Raw list of allowed model IDs. Empty array means all models are allowed. */
  allowedModels: string[];
  /** Check if a specific model ID is allowed for the current subscription. */
  isModelAllowed: (modelId: string) => boolean;
}

const UNKNOWN_SUBSCRIPTION_STATUS: UseSubscriptionReturn = {
  subscription: {
    status: 'none',
    planDisplayName: 'No Plan',
    planType: ScratchPlanType.FREE_PLAN,
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
    billableActions: {
      monthlyPublishCount: 0,
    },
  },
  isFreePlan: false,
  canPublishWorkbook: false,
  canCreateDataSource: () => false,
  canCreateCredentials: false,
  allowedModels: ['none'],
  isModelAllowed: () => false,
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

    const monthlyPublishCount = user.subscription.billableActions?.monthlyPublishCount ?? 0;
    return monthlyPublishCount < limit;
  }, [user]);

  /**
   * Check if the subscription allows creating data sources for a given service.
   * The actual per-workbook limit enforcement is done server-side when creating the connection.
   */
  const canCreateDataSource = useCallback(
    // Service parameter kept for API compatibility - limit checking happens server-side
    (service: Service): boolean => {
      void service; // Acknowledge parameter for future use
      if (!user) return false;
      if (!user.subscription) return false;

      if (user.subscription.status !== 'valid') {
        return false;
      }

      // Return true if subscription allows data sources; server enforces actual limits
      return user.subscription.features.dataSourcePerServiceLimit !== undefined;
    },
    [user],
  );

  const canCreateCredentials = useMemo(() => {
    if (!user) return false;
    if (!user.subscription) return false;

    if (user.subscription.status !== 'valid') {
      return false;
    }

    return user.subscription.features.allowPersonalKeys ?? false;
  }, [user]);

  const allowedModels = useMemo(() => {
    if (!user?.subscription) return ['none'];
    return user.subscription.features.availableModels ?? [];
  }, [user]);

  const isModelAllowed = useCallback(
    (modelId: string): boolean => {
      if (!user?.subscription) return false;
      if (user.subscription.status !== 'valid') return false;

      const models = user.subscription.features.availableModels ?? [];
      // Empty array means all models are allowed (for paid plans)
      if (models.length === 0) return true;
      // Otherwise, check if the model is in the allowed list
      return models.includes(modelId);
    },
    [user],
  );

  if (!user) {
    return UNKNOWN_SUBSCRIPTION_STATUS;
  }

  if (!user.subscription) {
    return UNKNOWN_SUBSCRIPTION_STATUS;
  }

  return {
    subscription: user.subscription,
    isFreePlan: user.subscription.planType === ScratchPlanType.FREE_PLAN,
    canPublishWorkbook,
    canCreateDataSource,
    canCreateCredentials,
    allowedModels,
    isModelAllowed,
  };
}
