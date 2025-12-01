import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { Text13Book, Text13Regular } from '@/app/components/base/text';
import { useSubscription } from '@/hooks/use-subscription';
import { RouteUrls } from '@/utils/route-urls';
import { Group, Stack } from '@mantine/core';
import { ArrowUpRightIcon } from 'lucide-react';
import { BillingSection } from './BillingSection';

export const ActiveSubscriptionSection = () => {
  const { subscription, isFreePlan } = useSubscription();

  let content = null;
  if (subscription.status === 'valid') {
    content = (
      <Group px="12px" py="10px" justify="space-between">
        <Stack gap="2px">
          <Text13Regular>{subscription.planDisplayName} plan</Text13Regular>
          <Text13Book c="dimmed">${subscription.costUSD} per month</Text13Book>
        </Stack>
        {!isFreePlan && (
          <ButtonSecondaryOutline
            component="a"
            target="_blank"
            leftSection={<ArrowUpRightIcon size={16} />}
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
          leftSection={<ArrowUpRightIcon size={16} />}
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
    <BillingSection title="Subscription" subtitle="Manage your subscription">
      {content}
    </BillingSection>
  );
};
