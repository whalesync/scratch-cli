/**
 * State for a single onboarding step
 */
export interface OnboardingStepState {
  completed: boolean;
  collapsed: boolean;
}

/**
 * Default state for a new onboarding step
 */
export const DEFAULT_STEP_STATE: OnboardingStepState = {
  completed: false,
  collapsed: false,
};

/**
 * Step keys for GettingStartedV1 flow
 */
export type GettingStartedV1StepKey =
  | 'dataSourceConnected'
  | 'contentEditedWithAi'
  | 'suggestionsAccepted'
  | 'dataPublished';

/**
 * GettingStartedV1 onboarding flow state
 * Each step has completed and collapsed properties
 */
export type GettingStartedV1 = {
  [K in GettingStartedV1StepKey]: OnboardingStepState;
};

/**
 * Default state for GettingStartedV1 flow
 */
export const DEFAULT_GETTING_STARTED_V1: GettingStartedV1 = {
  dataSourceConnected: { completed: false, collapsed: false },
  contentEditedWithAi: { completed: false, collapsed: false },
  suggestionsAccepted: { completed: false, collapsed: false },
  dataPublished: { completed: false, collapsed: false },
};

/**
 * UserOnboarding - tracks user progress through various onboarding flows
 * Each key is a flow code and the value is the flow-specific state
 */
export interface UserOnboarding {
  gettingStartedV1?: GettingStartedV1;
}
