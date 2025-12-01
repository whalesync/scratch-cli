import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { Text13Book, Text13Regular } from '@/app/components/base/text';
import { useSubscription } from '@/hooks/use-subscription';
import { RouteUrls } from '@/utils/route-urls';
import { Group, Stack } from '@mantine/core';
import { ArrowUpRightIcon } from 'lucide-react';
import { usePayments } from '../../../hooks/use-payments';
import { BillingSection } from './BillingSection';

export const ActiveSubscriptionSection = () => {
  const { subscription, isFreePlan } = useSubscription();
  const { redirectToManageSubscription, portalRedirectInProgress } = usePayments();
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
            onClick={() => redirectToManageSubscription(RouteUrls.billingPageUrl)}
            leftSection={<ArrowUpRightIcon size={16} />}
            disabled={!subscription.canManageSubscription}
            loading={portalRedirectInProgress}
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
          onClick={() => redirectToManageSubscription(RouteUrls.billingPageUrl)}
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
