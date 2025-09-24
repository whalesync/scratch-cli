'use client';
import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { TextRegularSm, TextTitleSm } from '@/app/components/base/text';
import { PROJECT_NAME } from '@/constants';
import { useSubscriptionStatus } from '@/hooks/use-subscription-status';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { ScratchpadPlanType } from '@/types/server-entities/payment';
import { RouteUrls } from '@/utils/route-urls';
import { Box, Group } from '@mantine/core';
import { CreditCardIcon } from '@phosphor-icons/react';
import pluralize from 'pluralize';

export const SubscriptionCard = () => {
  const { user } = useScratchPadUser();
  const { isSubscribed, planDisplayName, daysRemaining, status, isTrial } = useSubscriptionStatus();

  if (!user?.experimentalFlags?.REQUIRE_SUBSCRIPTION) {
    return null;
  }

  let content = null;
  if (isSubscribed) {
    content = (
      <>
        <TextRegularSm>
          {planDisplayName} - {daysRemaining} {pluralize('day', daysRemaining)} remaining {isTrial ? ' in trial' : ''}
        </TextRegularSm>
        <SecondaryButton
          size="xs"
          component="a"
          target="_blank"
          leftSection={<CreditCardIcon />}
          href={RouteUrls.manageSubscriptionPage}
        >
          Manage Subscription
        </SecondaryButton>
      </>
    );
  } else if (status === 'expired' || status === 'payment_failed') {
    content = (
      <>
        <TextRegularSm>
          {planDisplayName} - {status}
        </TextRegularSm>
        <PrimaryButton
          size="xs"
          component="a"
          target="_blank"
          leftSection={<CreditCardIcon />}
          href={RouteUrls.manageSubscriptionPage}
        >
          Manage subscription
        </PrimaryButton>
      </>
    );
  } else {
    content = (
      <>
        <TextRegularSm>Sign up for a 7 day free trial to {PROJECT_NAME}</TextRegularSm>
        <PrimaryButton
          size="xs"
          component="a"
          target="_blank"
          leftSection={<CreditCardIcon />}
          href={RouteUrls.productCheckoutPage(ScratchpadPlanType.STARTER_PLAN)}
        >
          Subscribe
        </PrimaryButton>
      </>
    );
  }

  return (
    <Box>
      <TextTitleSm mb="xs">Subscription</TextTitleSm>
      <Group gap="xs" justify="space-between">
        {content}
      </Group>
    </Box>
  );
};
