import { ButtonPrimaryLight } from '@/app/components/base/buttons';
import { Text13Book, Text13Medium, Text13Regular, Text16Medium } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import customBordersClasses from '@/app/components/theme/custom-borders.module.css';
import { useSubscription } from '@/hooks/use-subscription';
import { Badge, Box, Group, Stack } from '@mantine/core';
import { ScratchpadPlanType, SubscriptionPlan } from '@spinner/shared-types';
import { Check } from 'lucide-react';
import { useCallback } from 'react';

interface PlanCardProps {
  plan: SubscriptionPlan;
}

export const PlanCard = ({ plan }: PlanCardProps) => {
  const { subscription } = useSubscription();
  const isCurrentPlan = subscription.planType === plan.productType;

  const handleDowngrade = useCallback(() => {
    // TODO: Implement downgrade
    console.log('downgrade to ', plan.productType);
  }, [plan.productType]);

  const handleUpgrade = useCallback(() => {
    // TODO: Implement upgrade
    console.log('upgrade to ', plan.productType);
  }, [plan.productType]);

  let actionButton = null;
  if (isCurrentPlan) {
    actionButton = <ButtonPrimaryLight disabled>Current Plan</ButtonPrimaryLight>;
  }
  if (!isCurrentPlan && plan.productType !== ScratchpadPlanType.FREE_PLAN && plan.costUSD > subscription.costUSD) {
    actionButton = <ButtonPrimaryLight onClick={handleUpgrade}>Upgrade</ButtonPrimaryLight>;
  }
  if (!isCurrentPlan && plan.productType === ScratchpadPlanType.FREE_PLAN && plan.costUSD < subscription.costUSD) {
    actionButton = <ButtonPrimaryLight onClick={handleDowngrade}>Downgrade</ButtonPrimaryLight>;
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
            key="availableModels"
            label={
              plan.features.availableModels.length > 0 ? `${plan.features.availableModels.length} models` : 'Any model'
            }
          />
          <FeatureLineItem
            key="publishingLimit"
            label={
              plan.features.publishingLimit > 0
                ? `${plan.features.publishingLimit} publishing actions`
                : 'Unlimited publishing'
            }
          />
          {plan.productType === ScratchpadPlanType.FREE_PLAN && (
            <FeatureLineItem key="creditLimit" label="Enough tokens for occasional use" />
          )}
          {plan.productType === ScratchpadPlanType.PRO_PLAN && (
            <FeatureLineItem key="creditLimit" label="Enough tokens for most use cases" />
          )}
          {plan.productType === ScratchpadPlanType.MAX_PLAN && (
            <FeatureLineItem key="creditLimit" label="Enough tokens for heavier use cases" />
          )}
          {plan.features.allowPersonalKeys && (
            <FeatureLineItem key="allowPersonalKeys" label="Bring your own OpenRouter API key" />
          )}
          {plan.features.dataSourcePerServiceLimit === 0 ? (
            <FeatureLineItem key="dataSourcePerServiceLimit" label="Multiple accounts per external service" />
          ) : (
            <FeatureLineItem key="dataSourcePerServiceLimit" label="Single account per external service" />
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

const FeatureLineItem = ({ key, label }: { key: string; label: string }) => {
  return (
    <Group key={key} gap="xs" align="flex-start" justify="flex-start" wrap="nowrap">
      <StyledLucideIcon Icon={Check} size={16} c="gray" />
      <Text13Regular>{label}</Text13Regular>
    </Group>
  );
};
