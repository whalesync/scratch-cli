'use client';
import { ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { FullPageLoader } from '@/app/components/FullPageLoader';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Info } from '@/app/components/InfoPanel';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { paymentApi } from '@/lib/api/payment';
import { trackClickManageSubscription } from '@/lib/posthog';
import { RouteUrls } from '@/utils/route-urls';
import { RotateCcw } from 'lucide-react';
import { JSX, useEffect, useState } from 'react';

/** Redirect to the stripe subscription management page. */
const ManageSubscriptionRedirect = (): JSX.Element => {
  const { user } = useScratchPadUser();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    const doRedirect = async () => {
      try {
        trackClickManageSubscription();
        const result = await paymentApi.createCustomerPortalUrl();
        window.location.replace(result.url);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    doRedirect();
  }, [user]);

  if (error) {
    return (
      <Info>
        <Info.ErrorIcon />
        <Info.Title>Unable to load Stripe billing portal.</Info.Title>
        <Info.StatusPageDescription />
        <Info.Actions>
          <ButtonSecondaryOutline
            href={RouteUrls.homePageUrl}
            leftSection={<StyledLucideIcon Icon={RotateCcw} />}
            component="a"
          >
            Return to Snapshots
          </ButtonSecondaryOutline>
        </Info.Actions>
      </Info>
    );
  }

  return <FullPageLoader />;
};

export default ManageSubscriptionRedirect;
