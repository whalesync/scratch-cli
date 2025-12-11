import { CornerBoxedBadge } from '@/app/components/CornerBoxedBadge';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { HelpCircle } from 'lucide-react';
import { FC, useMemo } from 'react';
import { gettingStartedFlowUI } from './getting-started/getting-started';
import { OnboardingFlowContent } from './OnboardingFlowContent';

export const OnboardingFlowBadge: FC = () => {
  const { user } = useScratchPadUser();

  // TODO: when we need to support a second onboarding flow we should
  // make the code down from here more generic
  const gettingStartedState = user?.onboarding?.gettingStartedV1;

  // Check if the current step has hideFlowTooltip set to true
  const shouldHideTooltip = useMemo(() => {
    if (!gettingStartedState) return false;

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

    if (!currentStepKey) return false;

    const currentStepUI = gettingStartedFlowUI.steps.find((step) => step.stepKey === currentStepKey);
    return currentStepUI?.hideFlowTooltip === true;
  }, [gettingStartedState]);

  // Don't render if user is not in the gettingStartedV1 flow
  if (!gettingStartedState) {
    return null;
  }

  return (
    <CornerBoxedBadge
      label="Getting Started"
      icon={<StyledLucideIcon Icon={HelpCircle} size="sm" />}
      tooltip={shouldHideTooltip ? undefined : <OnboardingFlowContent gettingStartedV1={gettingStartedState} />}
      tooltipAlwaysVisible={!shouldHideTooltip}
    />
  );
};
