export enum ScratchpadPlanType {
  STARTER_PLAN = 'STARTER_PLAN',
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
  planType: ScratchpadPlanType;
  costUSD: number;
  daysRemaining: number;
  isTrial: boolean;
  canManageSubscription: boolean;
  ownerId: string;
  features: SubscriptionPlanFeatures;
}

export interface SubscriptionPlan {
  productType: ScratchpadPlanType;
  displayName: string;
  popular: boolean;
  costUSD: number;
  features: SubscriptionPlanFeatures;
}
