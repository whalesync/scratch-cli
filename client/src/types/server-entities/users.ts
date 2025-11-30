import { SubscriptionInfo } from '@spinner/shared-types';

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

export type { SubscriptionInfo } from '@spinner/shared-types';

/** User-scoped feature flag settings provided by the server */
export interface UserExperimentFlags {
  DEV_TOOLBOX: boolean;
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

export type UserSettingValue = string | number | boolean;

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
