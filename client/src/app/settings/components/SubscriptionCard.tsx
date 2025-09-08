'use client';
import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { TextRegularSm, TextTitleLg } from '@/app/components/base/text';
import { useSubscriptionStatus } from '@/hooks/use-subscription-status';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { ScratchpadPlanType } from '@/types/server-entities/payment';
import { RouteUrls } from '@/utils/route-urls';
import { Card, Group } from '@mantine/core';
import { CreditCardIcon } from '@phosphor-icons/react';
import pluralize from 'pluralize';

export const SubscriptionCard = () => {
  const { isAdmin } = useScratchPadUser();
  const { isSubscribed, planDisplayName, daysRemaining, status } = useSubscriptionStatus();

  if (!isAdmin) {
    return null;
  }

  let content = null;
  if (isSubscribed) {
    content = (
      <>
        <TextRegularSm>
          {planDisplayName} - {daysRemaining} {pluralize('day', daysRemaining)} remaining
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
        <SecondaryButton
          size="xs"
          component="a"
          target="_blank"
          leftSection={<CreditCardIcon />}
          href={RouteUrls.manageSubscriptionPage}
        >
          Manage subscription
        </SecondaryButton>
      </>
    );
  } else {
    content = (
      <>
        <TextRegularSm>Sign up for a 7 day free trial to Scratchpad</TextRegularSm>
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
    <Card shadow="sm" padding="sm" radius="md" withBorder>
      <TextTitleLg mb="xs">Subscription</TextTitleLg>
      <Group gap="xs" justify="space-between">
        {content}
      </Group>
    </Card>
  );
};
