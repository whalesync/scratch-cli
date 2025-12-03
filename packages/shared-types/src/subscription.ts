export enum ScratchPlanType {
  FREE_PLAN = 'FREE_PLAN',
  PRO_PLAN = 'PRO_PLAN',
  MAX_PLAN = 'MAX_PLAN',
}

export interface SubscriptionPlanFeatures {
  availableModels: string[];
  publishingLimit: number;
  creditLimit: number;
  allowPersonalKeys: boolean;
  dataSourcePerServiceLimit: number;
}

export interface SubscriptionInfo {
  status: 'valid' | 'expired' | 'payment_failed' | 'none';
  planDisplayName: string;
  planType: ScratchPlanType;
  costUSD: number;
  daysRemaining: number;
  isTrial: boolean;
  isCancelled: boolean;
  canManageSubscription: boolean;
  ownerId: string;
  features: SubscriptionPlanFeatures;
}

export interface SubscriptionPlan {
  planType: ScratchPlanType;
  displayName: string;
  popular: boolean;
  costUSD: number;
  features: SubscriptionPlanFeatures;
}
