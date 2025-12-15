import { UserOnboarding } from '@spinner/shared-types';

export type FlowTooltipBehavior = 'alwaysShow' | 'alwaysHide' | 'collapsable';

export type OnboardingFlowUI = {
  flowKey: keyof UserOnboarding;
  steps: OnboardingStepUI[];
};

export type OnboardingStepUI = {
  stepKey: string;
  /** Controls the flow tooltip visibility. Defaults to 'collapsable' if undefined. */
  flowTooltipBehavior?: FlowTooltipBehavior;
  data: {
    title: string;
    description?: string;
    content?: () => React.ReactNode;
  };
};
