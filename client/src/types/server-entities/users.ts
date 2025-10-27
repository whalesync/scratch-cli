import { ScratchpadPlanType } from "./payment";

export interface User {
  id: string;
  clerkId: string;
  createdAt: Date;
  updatedAt: Date;
  websocketToken?: string;
  isAdmin: boolean;
  agentJwt?: string;
  subscription?: SubscriptionInfo;
  experimentalFlags?: UserExperimentFlags;
}

export interface SubscriptionInfo {
  status: 'valid' | 'expired' | 'payment_failed';
  planDisplayName: string;
  planType: ScratchpadPlanType;
  daysRemaining: number;
  isTrial: boolean;
}

/** User-scoped feature flag settings provided by the server */
export interface UserExperimentFlags {
  DEV_TOOLBOX: boolean;
  REQUIRE_SUBSCRIPTION: boolean;
  USE_JOBS: boolean;
}

export function isExperimentEnabled(experiment: keyof UserExperimentFlags, user: User | null): boolean {
  return user?.experimentalFlags?.[experiment] === true;
}