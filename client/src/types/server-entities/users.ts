import { Organization, SubscriptionInfo, UserOnboarding } from '@spinner/shared-types';

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
  onboarding?: UserOnboarding;
  onboardingWorkbookId?: string | null;
}

export type { SubscriptionInfo } from '@spinner/shared-types';

/** User-scoped feature flag settings provided by the server */
export interface UserExperimentFlags {
  DEV_TOOLBOX: boolean;
  CONNECTOR_LIST: string[];
  ENABLE_TOKEN_LIMIT_WARNINGS: boolean;
  ENABLE_WEBFLOW_OAUTH: boolean;
  ENABLE_CREATE_BUG_REPORT: boolean;
  DEFAULT_WORKBOOK_MODE: 'tables' | 'files';
}

export function isExperimentEnabled(experiment: keyof UserExperimentFlags, user: User | null): boolean {
  return user?.experimentalFlags?.[experiment] === true;
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
