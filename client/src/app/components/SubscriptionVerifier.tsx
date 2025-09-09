'use client';

import { useSubscriptionStatus } from '@/hooks/use-subscription-status';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { isExperimentEnabled } from '@/types/server-entities/users';
import { RouteUrls } from '@/utils/route-urls';
import { usePathname } from 'next/navigation';
import { JSX, ReactNode } from 'react';
import { NoSubscriptionDetectedModal } from './NoSubscriptionDetectedModal';

export const SubscriptionVerifier = ({ children }: { children: ReactNode }): JSX.Element => {
  const pathname = usePathname();
  const { status } = useSubscriptionStatus();
  const { user } = useScratchPadUser();

  const subscriptionRequired = isExperimentEnabled('REQUIRE_SUBSCRIPTION', user);
  const showSubscriptionModal = subscriptionRequired && RouteUrls.isSubscribedOnlyRoute(pathname) && status === 'none';

  // render subscription modal for pages which requires subscription
  if (showSubscriptionModal) {
    return (
      <>
        <NoSubscriptionDetectedModal />
        {children}
      </>
    );
  }

  return <>{children}</>;
};
