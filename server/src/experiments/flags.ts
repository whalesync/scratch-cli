import { FlagDataType } from './types';

/**
 * Configuration and tuning flags that are system-wide and not scoped to a specific user.
 */
export enum SystemFeatureFlag {
  SAMPLE_SYSTEM_FLAG = 'sample_system_flag',
}

/**
 * User-scoped feature flags.
 * These flags are scoped to a specific user and are used to control the behavior of the system for that user.
 */
export enum UserFlag {
  DEV_TOOLBOX = 'DEV_TOOLBOX',
  REQUIRE_SUBSCRIPTION = 'REQUIRE_SUBSCRIPTION',
  USE_JOBS = 'USE_JOBS',
  SAMPLE_USER_FLAG = 'sample_user_flag',
  CONNECTOR_LIST = 'CONNECTOR_LIST',
}

/**
 * Enapsulates all the feature flags that are available to the system.
 */
export type AllFeatureFlags = SystemFeatureFlag | UserFlag;

/**
 * The keys and data types for all the flags that are exposed to the client via the /users/current endpoint
 *
 * For a flag to be exposed to the client, it must be added to this object.
 *
 * Make sure to add the flag to the UserExperimentFlags interface in the client types.
 */
export const ClientUserFlags: Record<UserFlag, FlagDataType> = {
  // Special flags based on system flags or user role
  [UserFlag.DEV_TOOLBOX]: 'boolean',
  [UserFlag.REQUIRE_SUBSCRIPTION]: 'boolean',
  [UserFlag.USE_JOBS]: 'boolean',
  [UserFlag.CONNECTOR_LIST]: 'array',
  // User-scoped feature flags
  [UserFlag.SAMPLE_USER_FLAG]: 'boolean',
};
