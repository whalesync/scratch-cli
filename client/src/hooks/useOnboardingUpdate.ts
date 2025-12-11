import { SWR_KEYS } from '@/lib/api/keys';
import { usersApi } from '@/lib/api/users';
import { User } from '@/types/server-entities/users';
import { GettingStartedV1StepKey, UserOnboarding } from '@spinner/shared-types';
import { useCallback } from 'react';
import { useSWRConfig } from 'swr';

// Step key types for each flow
type FlowStepKeys = {
  gettingStartedV1: GettingStartedV1StepKey;
};

/**
 * Hook for optimistically updating onboarding state.
 * Use this to mark onboarding steps as completed or collapsed.
 */
export const useOnboardingUpdate = () => {
  const { mutate } = useSWRConfig();

  /**
   * Optimistically mark an onboarding step as completed
   */
  const markStepCompleted = useCallback(
    async <F extends keyof UserOnboarding>(flow: F, stepKey: FlowStepKeys[F]) => {
      // Optimistically update the user state
      mutate(
        SWR_KEYS.users.activeUser(),
        (currentUser: User | undefined) => {
          const flowState = currentUser?.onboarding?.[flow];
          if (!flowState) return currentUser;
          // Already completed, no need to update
          const stepState = (flowState as Record<string, { completed: boolean; collapsed: boolean }>)[stepKey];
          if (stepState?.completed) return currentUser;
          return {
            ...currentUser,
            onboarding: {
              ...currentUser.onboarding,
              [flow]: {
                ...flowState,
                [stepKey]: {
                  ...stepState,
                  completed: true,
                },
              },
            },
          };
        },
        false, // Don't revalidate immediately
      );

      // The server will mark steps as completed automatically based on user actions,
      // so we don't need to make an API call here - the next user fetch will sync the state
    },
    [mutate],
  );

  /**
   * Optimistically mark an onboarding step as collapsed (dismissed)
   */
  const markStepCollapsed = useCallback(
    async <F extends keyof UserOnboarding>(flow: F, stepKey: FlowStepKeys[F]) => {
      // Optimistically update the user state
      mutate(
        SWR_KEYS.users.activeUser(),
        (currentUser: User | undefined) => {
          const flowState = currentUser?.onboarding?.[flow];
          if (!flowState) return currentUser;
          const stepState = (flowState as Record<string, { completed: boolean; collapsed: boolean }>)[stepKey];
          return {
            ...currentUser,
            onboarding: {
              ...currentUser.onboarding,
              [flow]: {
                ...flowState,
                [stepKey]: {
                  ...stepState,
                  collapsed: true,
                },
              },
            },
          };
        },
        false, // Don't revalidate immediately
      );

      // Make the API call to persist the collapsed state
      await usersApi.collapseOnboardingStep(flow, stepKey, true);
    },
    [mutate],
  );

  /**
   * Optimistically remove an entire onboarding flow (used when flow is completed)
   */
  const completeFlow = useCallback(
    <F extends keyof UserOnboarding>(flow: F) => {
      // Optimistically update the user state by removing the flow
      mutate(
        SWR_KEYS.users.activeUser(),
        (currentUser: User | undefined) => {
          if (!currentUser?.onboarding?.[flow]) return currentUser;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [flow]: _removed, ...remainingOnboarding } = currentUser.onboarding;
          return {
            ...currentUser,
            onboarding: remainingOnboarding,
          };
        },
        false, // Don't revalidate immediately - server already deleted the flow
      );
    },
    [mutate],
  );

  return {
    markStepCompleted,
    markStepCollapsed,
    completeFlow,
  };
};
