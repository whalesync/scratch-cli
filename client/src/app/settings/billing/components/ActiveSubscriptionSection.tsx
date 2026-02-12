import { ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { Text13Book, Text13Regular } from '@/app/components/base/text';
import { ConfigSection } from '@/app/components/ConfigSection';
import { usePayments } from '@/hooks/use-payments';
import { useSubscription } from '@/hooks/use-subscription';
import { RouteUrls } from '@/utils/route-urls';
import { Center, Group, Stack } from '@mantine/core';
import { ArrowUpRightIcon } from 'lucide-react';

export const ActiveSubscriptionSection = () => {
  const { subscription, isFreePlan } = useSubscription();
  const { redirectToManageSubscription, portalRedirectInProgress } = usePayments();
  let content = null;
  content = (
    <Group px="12px" py="10px" justify="space-between" align="flex-start">
      <Stack gap="2px">
        <Text13Regular>{subscription.planDisplayName} plan</Text13Regular>
        <Text13Book c="dimmed">${subscription.costUSD} per month</Text13Book>
        {subscription.status === 'payment_failed' && (
          <Text13Regular c="dimmed">Payment failed - please update your payment method.</Text13Regular>
        )}
        {subscription.status === 'expired' && (
          <Text13Regular c="dimmed">Expired - Your subscription has expired.</Text13Regular>
        )}
        {subscription.isCancelled && (
          <Text13Regular c="dimmed">
            Cancelled - your account will revert to the Free plan on the next billing cycle, in{' '}
            {subscription.daysRemaining} days.
          </Text13Regular>
        )}
      </Stack>
      {!isFreePlan && subscription.canManageSubscription && (
        <ButtonSecondaryOutline
          component="a"
          target="_blank"
          onClick={() => redirectToManageSubscription(RouteUrls.billingPageUrl)}
          leftSection={<ArrowUpRightIcon size={16} />}
          loading={portalRedirectInProgress}
        >
          Manage
        </ButtonSecondaryOutline>
      )}
      {!subscription.canManageSubscription && (
        <Center maw={200}>
          <Text13Regular c="dimmed">This subscription is managed by another user in your organization</Text13Regular>
        </Center>
      )}
    </Group>
  );

  return (
    <ConfigSection title="Subscription" description="Manage your subscription">
      {content}
    </ConfigSection>
  );
};
