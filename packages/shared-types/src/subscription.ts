export enum ScratchpadPlanType {
  STARTER_PLAN = 'STARTER_PLAN',
}

export interface SubscriptionInfo {
  status: 'valid' | 'expired' | 'payment_failed';
  planDisplayName: string;
  planType: ScratchpadPlanType;
  daysRemaining: number;
  isTrial: boolean;
  canManageSubscription: boolean;
  ownerId: string;
}
