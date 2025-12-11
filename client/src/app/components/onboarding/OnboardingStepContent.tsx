import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingUpdate } from '@/hooks/useOnboardingUpdate';
import { Group, Stack, Tooltip } from '@mantine/core';
import { GettingStartedV1StepKey, UserOnboarding } from '@spinner/shared-types';
import { FC, ReactNode, useCallback } from 'react';
import { ButtonSecondaryOutline } from '../base/buttons';
import { OnboardingStepLayout } from './OnboardingStepLayout';
import { OnboardingFlowUI, OnboardingStepUI } from './types';

interface Props {
  flow: OnboardingFlowUI;
  stepKey: string;
  hide?: boolean;
  onCollapsed?: () => void;
  children: ReactNode;
}

export const OnboardingStepContent: FC<Props> = ({ flow, stepKey, onCollapsed, children, hide }) => {
  const step = flow.steps.find((s) => s.stepKey === stepKey) as OnboardingStepUI | undefined;
  const { markStepCollapsed } = useOnboardingUpdate();
  const { shouldShowStep } = useOnboarding();

  const handleCollapse = useCallback(async () => {
    await markStepCollapsed(flow.flowKey as keyof UserOnboarding, stepKey as GettingStartedV1StepKey);
    onCollapsed?.();
  }, [flow.flowKey, stepKey, onCollapsed, markStepCollapsed]);

  const shouldShow = shouldShowStep(flow.flowKey, stepKey as GettingStartedV1StepKey);

  if (!step || hide || !shouldShow) {
    return children;
  }

  const tooltipContent = () => (
    <Stack gap={0}>
      <OnboardingStepLayout data={step.data} showDescription onClose={handleCollapse} />
      <Group justify="flex-end">
        <ButtonSecondaryOutline onClick={handleCollapse} mb="xs" mr={10} c="var(--fg-muted)">
          Close
        </ButtonSecondaryOutline>
      </Group>
    </Stack>
  );
  return (
    <Tooltip
      label={tooltipContent()}
      opened
      position="bottom"
      withArrow
      withinPortal
      events={{ hover: false, focus: false, touch: false }}
      data-always-dark
      data-onboarding-tooltip
    >
      {children}
    </Tooltip>
  );
};
