import { UserOnboarding } from '@spinner/shared-types';
export type OnboardingFlowUI = {
  flowKey: keyof UserOnboarding;
  steps: OnboardingStepUI[];
};

export type OnboardingStepUI = {
  stepKey: string;
  hideFlowTooltip?: boolean;
  data: {
    title: string;
    description?: string;
    content?: () => React.ReactNode;
  };
};
