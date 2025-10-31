'use client';
import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { TextSmRegular } from '@/app/components/base/text';
import { PROJECT_NAME } from '@/constants';
import { useSubscriptionStatus } from '@/hooks/use-subscription-status';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { ScratchpadPlanType } from '@/types/server-entities/payment';
import { RouteUrls } from '@/utils/route-urls';
import { CreditCardIcon } from 'lucide-react';
import pluralize from 'pluralize';
import { SettingsPanel } from './SettingsPanel';

export const SubscriptionCard = () => {
  const { user } = useScratchPadUser();
  const { isSubscribed, planDisplayName, daysRemaining, status, isTrial } = useSubscriptionStatus();

  if (!user?.experimentalFlags?.REQUIRE_SUBSCRIPTION) {
    return null;
  }

  const cardIcon = <CreditCardIcon size={16} />;

  let content = null;
  if (isSubscribed) {
    content = (
      <>
        <TextSmRegular>
          {planDisplayName} - {daysRemaining} {pluralize('day', daysRemaining)} remaining {isTrial ? ' in trial' : ''}
        </TextSmRegular>
        <ButtonSecondaryOutline
          size="xs"
          component="a"
          target="_blank"
          leftSection={cardIcon}
          href={RouteUrls.manageSubscriptionPage}
          disabled={!user?.subscription?.canManageSubscription}
        >
          Manage Subscription
        </ButtonSecondaryOutline>
      </>
    );
  } else if (status === 'expired' || status === 'payment_failed') {
    content = (
      <>
        <TextSmRegular>
          {planDisplayName} - {status}
        </TextSmRegular>
        <ButtonPrimaryLight
          size="xs"
          component="a"
          target="_blank"
          leftSection={cardIcon}
          href={RouteUrls.manageSubscriptionPage}
          disabled={!user?.subscription?.canManageSubscription}
        >
          Manage subscription
        </ButtonPrimaryLight>
      </>
    );
  } else {
    content = (
      <>
        <TextSmRegular>Sign up for a 7 day free trial to {PROJECT_NAME}</TextSmRegular>
        <ButtonPrimaryLight
          size="xs"
          component="a"
          target="_blank"
          leftSection={cardIcon}
          href={RouteUrls.productCheckoutPage(ScratchpadPlanType.STARTER_PLAN)}
        >
          Subscribe
        </ButtonPrimaryLight>
      </>
    );
  }

  return (
    <SettingsPanel title="Subscription" subtitle="Manage your subscription.">
      {content}
    </SettingsPanel>
  );
};
