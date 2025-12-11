import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { GettingStartedV1StepKey, UserOnboarding } from '@spinner/shared-types';
import { useCallback, useMemo } from 'react';

// Step key types for each flow
type FlowStepKeys = {
  gettingStartedV1: GettingStartedV1StepKey;
};

// Step order for each flow (used to determine which step is "current")
const FLOW_STEP_ORDER: Record<keyof UserOnboarding, string[]> = {
  gettingStartedV1: ['dataSourceConnected', 'contentEditedWithAi', 'suggestionsAccepted', 'dataPublished'],
};

/**
 * Hook for reading onboarding state.
 * Use shouldShowStep to check if a tooltip should be displayed for a step (isCurrentStep && not collapsed).
 * Use isCurrentStep to check if a step is the current active one in the flow.
 */
export const useOnboarding = () => {
  const { user } = useScratchPadUser();

  const onboarding = useMemo(() => user?.onboarding, [user?.onboarding]);

  // Check if the step is collapsed
  const isCollapsed = useCallback(
    <F extends keyof UserOnboarding>(flow: F, step: FlowStepKeys[F]): boolean => {
      const flowState = onboarding?.[flow];
      if (!flowState) return false;

      const stepState = (flowState as Record<string, { completed: boolean; collapsed: boolean }>)[step];
      return stepState?.collapsed ?? false;
    },
    [onboarding],
  );

  // The specified flow is present, and the step is the first non-completed one
  const isCurrentStep = useCallback(
    <F extends keyof UserOnboarding>(flow: F, step: FlowStepKeys[F]): boolean => {
      const flowState = onboarding?.[flow];
      if (!flowState) return false;

      const stepOrder = FLOW_STEP_ORDER[flow];

      // Find the first non-completed step in the flow order
      for (const stepKey of stepOrder) {
        const stepState = (flowState as Record<string, { completed: boolean; collapsed: boolean }>)[stepKey];
        if (!stepState?.completed) {
          return stepKey === step;
        }
      }

      return false;
    },
    [onboarding],
  );

  // The step is active and not collapsed - use this for showing tooltips
  const shouldShowStep = useCallback(
    <F extends keyof UserOnboarding>(flow: F, step: FlowStepKeys[F]): boolean => {
      return isCurrentStep(flow, step) && !isCollapsed(flow, step);
    },
    [isCurrentStep, isCollapsed],
  );

  // Check if a step is pending (not yet completed)
  const isStepPending = useCallback(
    <F extends keyof UserOnboarding>(flow: F, step: FlowStepKeys[F]): boolean => {
      const flowState = onboarding?.[flow];
      if (!flowState) return false;

      const stepState = (flowState as Record<string, { completed: boolean; collapsed: boolean }>)[step];
      return !stepState?.completed;
    },
    [onboarding],
  );

  return { isCurrentStep, shouldShowStep, isStepPending };
};
