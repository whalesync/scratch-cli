import { useOnboarding } from '@/hooks/useOnboarding';
import { Box, Divider, Group, Stack } from '@mantine/core';
import { GettingStartedV1, GettingStartedV1StepKey } from '@spinner/shared-types';
import { FC, useMemo } from 'react';
import { Text13Book, Text13Medium } from '../base/text';
import { gettingStartedFlowUI } from './getting-started/getting-started';
import { OnboardingRow } from './OnboardingRow';
import { OnboardingStepLayout } from './OnboardingStepLayout';

interface Props {
  gettingStartedV1: GettingStartedV1;
}

export const OnboardingFlowContent: FC<Props> = ({ gettingStartedV1 }) => {
  const { isCurrentStep } = useOnboarding();

  // Build steps from the UI definition and the current state
  const steps = useMemo(() => {
    return gettingStartedFlowUI.steps.map((stepUI) => {
      const stepState = gettingStartedV1[stepUI.stepKey as GettingStartedV1StepKey];
      return {
        id: stepUI.stepKey as GettingStartedV1StepKey,
        data: stepUI.data,
        isCompleted: stepState?.completed ?? false,
      };
    });
  }, [gettingStartedV1]);

  // Count completed steps
  const completedCount = useMemo(() => {
    return steps.filter((step) => step.isCompleted).length;
  }, [steps]);

  const totalSteps = steps.length;

  return (
    <Stack gap={0}>
      {/* Header */}
      <OnboardingRow>
        <Group justify="space-between" align="center">
          <Group gap="xs" align="center">
            <Text13Medium c="var(--fg-primary)">Getting started</Text13Medium>
            <Text13Book c="var(--fg-muted)">{`${completedCount}/${totalSteps}`}</Text13Book>
          </Group>
        </Group>
      </OnboardingRow>

      <Divider c="var(--fg-muted)" />
      {/* Steps List */}
      <Stack gap={0}>
        {steps.map((step) => {
          const isCurrent = isCurrentStep('gettingStartedV1', step.id);
          return (
            <Box key={step.id}>
              <OnboardingStepLayout
                data={step.data}
                isCompleted={step.isCompleted}
                showDescription={isCurrent}
                showCheckbox
              />
              <Divider c="var(--fg-muted)" />
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
};
