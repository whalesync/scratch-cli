import { useOnboardingUpdate } from '@/hooks/useOnboardingUpdate';
import { Group, Stack } from '@mantine/core';
import { GettingStartedV1StepKey, UserOnboarding } from '@spinner/shared-types';
import { FC, useCallback } from 'react';
import { ButtonSecondaryOutline } from '../base/buttons';
import { OnboardingStepLayout } from './OnboardingStepLayout';
import { OnboardingFlowUI, OnboardingStepUI } from './types';

interface Props {
  flow: OnboardingFlowUI;
  stepKey: string;
  onCollapsed?: () => void;
}

export const OnboardingStepContent: FC<Props> = ({ flow, stepKey, onCollapsed }) => {
  const step = flow.steps.find((s) => s.stepKey === stepKey) as OnboardingStepUI | undefined;
  const { markStepCollapsed } = useOnboardingUpdate();

  const handleCollapse = useCallback(async () => {
    await markStepCollapsed(flow.flowKey as keyof UserOnboarding, stepKey as GettingStartedV1StepKey);
    onCollapsed?.();
  }, [flow.flowKey, stepKey, onCollapsed, markStepCollapsed]);

  if (!step) {
    return null;
  }

  return (
    <Stack p="xs" gap="md">
      <OnboardingStepLayout data={step.data} showDescription />
      <Group justify="flex-end">
        <ButtonSecondaryOutline onClick={handleCollapse} mt="xs">
          Close
        </ButtonSecondaryOutline>
      </Group>
    </Stack>
  );
};
