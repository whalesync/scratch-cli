'use client';
import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { Text12Regular, Text13Regular } from '@/app/components/base/text';
import { useSubscription } from '@/hooks/use-subscription';
import { RouteUrls } from '@/utils/route-urls';
import { Group, Stack } from '@mantine/core';
import { CreditCardIcon } from 'lucide-react';
import pluralize from 'pluralize';
import { SettingsPanel } from './SettingsPanel';

export const SubscriptionCard = () => {
  const { subscription, isFreePlan } = useSubscription();

  const cardIcon = <CreditCardIcon size={16} />;

  let content = null;
  if (subscription.status === 'valid') {
    content = (
      <Group justify="space-between" align="flex-start">
        <Stack gap="2px">
          <Group gap="xs">
            <Text13Regular>{subscription.planDisplayName} plan</Text13Regular>
            {!isFreePlan && (
              <Text12Regular c="dimmed">
                {subscription.daysRemaining} {pluralize('day', subscription.daysRemaining)} remaining
              </Text12Regular>
            )}
          </Group>
          <Text13Regular>${subscription.costUSD} per month</Text13Regular>
        </Stack>
        {!isFreePlan && (
          <ButtonSecondaryOutline
            size="xs"
            component="a"
            target="_blank"
            leftSection={cardIcon}
            href={RouteUrls.manageSubscriptionPage}
            disabled={!subscription.canManageSubscription}
          >
            Manage
          </ButtonSecondaryOutline>
        )}
      </Group>
    );
  } else if (subscription.status === 'expired' || subscription.status === 'payment_failed') {
    content = (
      <>
        <Text13Regular>
          {subscription.planDisplayName} - {subscription.status}
        </Text13Regular>
        <ButtonPrimaryLight
          size="xs"
          component="a"
          target="_blank"
          leftSection={cardIcon}
          href={RouteUrls.manageSubscriptionPage}
          disabled={!subscription.canManageSubscription}
        >
          Manage
        </ButtonPrimaryLight>
      </>
    );
  } else {
    content = <Text13Regular>No plan configured</Text13Regular>;
  }

  return (
    <SettingsPanel title="Subscription" subtitle="Manage your subscription.">
      {content}
    </SettingsPanel>
  );
};
