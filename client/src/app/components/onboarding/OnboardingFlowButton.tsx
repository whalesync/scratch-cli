import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { Tooltip } from '@mantine/core';
import { HelpCircle } from 'lucide-react';
import { FC, useMemo, useState } from 'react';
import { ButtonSecondaryOutline } from '../base/buttons';
import { gettingStartedFlowUI } from './getting-started/getting-started';
import { OnboardingFlowContent } from './OnboardingFlowContent';
import { FlowTooltipBehavior } from './types';

export const OnboardingFlowButton: FC = () => {
  const { user } = useScratchPadUser();
  const [isCollapsed, setIsCollapsed] = useState(true);

  // TODO: when we need to support a second onboarding flow we should
  // make the code down from here more generic
  const gettingStartedState = user?.onboarding?.gettingStartedV1;

  // Get the current step's tooltip behavior
  const tooltipBehavior = useMemo((): FlowTooltipBehavior => {
    if (!gettingStartedState) return 'collapsable';

    // Find the first non-completed step using the order defined in gettingStartedFlowUI
    const stepOrder = gettingStartedFlowUI.steps.map((step) => step.stepKey);
    let currentStepKey: string | null = null;

    for (const stepKey of stepOrder) {
      const stepState = gettingStartedState[stepKey as keyof typeof gettingStartedState];
      if (!stepState?.completed) {
        currentStepKey = stepKey;
        break;
      }
    }

    if (!currentStepKey) return 'collapsable';

    const currentStepUI = gettingStartedFlowUI.steps.find((step) => step.stepKey === currentStepKey);
    return currentStepUI?.flowTooltipBehavior ?? 'collapsable';
  }, [gettingStartedState]);

  // Determine if tooltip should be shown based on behavior and collapse state
  const shouldShowTooltip = useMemo(() => {
    switch (tooltipBehavior) {
      case 'alwaysShow':
        return true;
      case 'alwaysHide':
        return false;
      case 'collapsable':
      default:
        return !isCollapsed;
    }
  }, [tooltipBehavior, isCollapsed]);

  // Don't render if user is not in the gettingStartedV1 flow
  if (!gettingStartedState) {
    return null;
  }

  const handleButtonClick = () => {
    if (tooltipBehavior === 'collapsable') {
      setIsCollapsed((prev) => !prev);
    }
  };

  return (
    <Tooltip
      data-onboarding-tooltip
      label={<OnboardingFlowContent gettingStartedV1={gettingStartedState} />}
      data-always-dark
      opened={shouldShowTooltip}
      events={{ hover: false, focus: false, touch: false }}
    >
      <ButtonSecondaryOutline
        size="compact-xs"
        leftSection={<StyledLucideIcon Icon={HelpCircle} size="sm" />}
        onClick={handleButtonClick}
      >
        Getting Started
      </ButtonSecondaryOutline>
    </Tooltip>
  );
};
