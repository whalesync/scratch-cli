import { ScratchpadPlanType } from './payment';

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
  name?: string;
  email?: string;
  stripeCustomerId?: string;
  organization?: Organization;
  settings?: Record<string, string | number | boolean>;
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

/** User-scoped feature flag settings provided by the server */
export interface UserExperimentFlags {
  DEV_TOOLBOX: boolean;
  REQUIRE_SUBSCRIPTION: boolean;
  USE_JOBS: boolean;
  CONNECTOR_LIST: string[];
}

export function isExperimentEnabled(experiment: keyof UserExperimentFlags, user: User | null): boolean {
  return user?.experimentalFlags?.[experiment] === true;
}

export interface Organization {
  id: string;
  clerkId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserSetting {
  DEFAULT_LLM_MODEL = 'default_llm_model',
}

export interface UpdateSettingsDto {
  /**
   * Only keys present in the map will be updated, other keys will be left unchanged.
   * null values will remove the key from the settings object
   */
  updates: Record<string, string | number | boolean | null>;
}
