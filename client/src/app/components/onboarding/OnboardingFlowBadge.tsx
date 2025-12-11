import { CornerBoxedBadge } from '@/app/components/CornerBoxedBadge';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { HelpCircle } from 'lucide-react';
import { FC } from 'react';
import { OnboardingFlowContent } from './OnboardingFlowContent';

export const OnboardingFlowBadge: FC = () => {
  const { user } = useScratchPadUser();

  // TODO: when we need to support a second onboarding flow we should
  // make the code down from here more generic
  const gettingStartedState = user?.onboarding?.gettingStartedV1;

  // Don't render if user is not in the gettingStartedV1 flow
  if (!gettingStartedState) {
    return null;
  }

  return (
    <CornerBoxedBadge
      label="Getting Started"
      icon={<StyledLucideIcon Icon={HelpCircle} size="sm" />}
      tooltip={<OnboardingFlowContent gettingStartedV1={gettingStartedState} />}
      tooltipAlwaysVisible
    />
  );
};
