import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { Text13Book, Text13Medium, Text13Regular, Text16Medium } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import customBordersClasses from '@/app/components/theme/custom-borders.module.css';
import { useSubscription } from '@/hooks/use-subscription';
import { RouteUrls } from '@/utils/route-urls';
import { Badge, Box, Group, Stack } from '@mantine/core';
import { ScratchPlanType, SubscriptionPlan } from '@spinner/shared-types';
import { Check } from 'lucide-react';
import { useCallback } from 'react';
import { usePayments } from '../../../hooks/use-payments';

interface PlanCardProps {
  plan: SubscriptionPlan;
}

export const PlanCard = ({ plan }: PlanCardProps) => {
  const { subscription } = useSubscription();
  const { redirectToUpdateSubscription, portalRedirectInProgress } = usePayments();
  const isCurrentPlan = subscription.planType === plan.planType;

  const handleDowngrade = useCallback(() => {
    // TODO: Implement downgrade
    console.log('downgrade to ', plan.planType);
  }, [plan.planType]);

  const handleSwitchToPlan = useCallback(() => {
    redirectToUpdateSubscription(plan.planType, RouteUrls.billingPageUrl);
  }, [plan.planType, redirectToUpdateSubscription]);

  let actionButton = null;
  if (isCurrentPlan) {
    actionButton = <ButtonSecondaryOutline disabled>Current Plan</ButtonSecondaryOutline>;
  } else if (!isCurrentPlan && plan.planType !== ScratchPlanType.FREE_PLAN) {
    actionButton = (
      <ButtonPrimaryLight onClick={handleSwitchToPlan} loading={portalRedirectInProgress}>
        {subscription.costUSD > plan.costUSD ? 'Switch' : 'Upgrade'}
      </ButtonPrimaryLight>
    );
  } else if (!isCurrentPlan && plan.planType === ScratchPlanType.FREE_PLAN) {
    actionButton = (
      <ButtonPrimaryLight onClick={handleDowngrade} loading={portalRedirectInProgress}>
        Downgrade
      </ButtonPrimaryLight>
    );
  }

  return (
    <Box px={12} py={10} className={customBordersClasses.cornerBorders} style={{ position: 'relative' }}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Text13Medium>{plan.displayName}</Text13Medium>
          {plan.popular && !isCurrentPlan && (
            <Badge color="blue" size="sm" w="fit-content">
              Popular
            </Badge>
          )}
        </Group>
        <Group gap="2px">
          <Text16Medium>${plan.costUSD}</Text16Medium>
          <Text13Book c="dimmed">/month</Text13Book>
        </Group>
        {actionButton}

        {/* Features list */}
        <Stack gap="xs" mt="xs">
          <Text13Book c="dimmed">Features:</Text13Book>
          <FeatureLineItem
            id="availableModels"
            label={
              plan.features.availableModels.length > 0 ? `${plan.features.availableModels.length} models` : 'Any model'
            }
          />
          <FeatureLineItem
            id="publishingLimit"
            label={
              plan.features.publishingLimit > 0
                ? `${plan.features.publishingLimit} publishing actions`
                : 'Unlimited publishing'
            }
          />
          {plan.planType === ScratchPlanType.FREE_PLAN && (
            <FeatureLineItem id="creditLimit" label="Enough tokens for occasional use" />
          )}
          {plan.planType === ScratchPlanType.PRO_PLAN && (
            <FeatureLineItem id="creditLimit" label="Enough tokens for most use cases" />
          )}
          {plan.planType === ScratchPlanType.MAX_PLAN && (
            <FeatureLineItem id="creditLimit" label="Enough tokens for heavier use cases" />
          )}
          {plan.features.allowPersonalKeys && (
            <FeatureLineItem id="allowPersonalKeys" label="Bring your own OpenRouter API key" />
          )}
          {plan.features.dataSourcePerServiceLimit === 0 ? (
            <FeatureLineItem id="dataSourcePerServiceLimit" label="Multiple accounts per external service" />
          ) : (
            <FeatureLineItem id="dataSourcePerServiceLimit" label="Single account per external service" />
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

const FeatureLineItem = ({ id, label }: { id: string; label: string }) => {
  return (
    <Group id={id} gap="xs" align="flex-start" justify="flex-start" wrap="nowrap">
      <StyledLucideIcon Icon={Check} size={16} c="gray" />
      <Text13Regular>{label}</Text13Regular>
    </Group>
  );
};
