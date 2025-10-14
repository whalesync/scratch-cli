/**
 * Configuration and tuning flags that are system-wide and not user-scoped.
 */
export enum SystemFlag {
  USE_JOBS = 'USE_JOBS',
}

/**
 * User-scoped feature flags
 */
export enum UserExperimentFlag {
  DEV_TOOLBOX = 'DEV_TOOLBOX',
  REQUIRE_SUBSCRIPTION = 'REQUIRE_SUBSCRIPTION',
}
