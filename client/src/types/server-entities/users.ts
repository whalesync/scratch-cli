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
}

/** User-scoped feature flag settings provided by the server */
export interface UserExperimentFlags {
  DEV_TOOLBOX: boolean;
}