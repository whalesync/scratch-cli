import { Badge } from '@/app/components/base/badge';
import { ButtonPrimaryLight } from '@/app/components/base/buttons';
import { Text13Book, Text13Medium, Text13Regular, Text16Medium } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import customBordersClasses from '@/app/components/theme/custom-borders.module.css';
import { usePayments } from '@/hooks/use-payments';
import { useSubscription } from '@/hooks/use-subscription';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { RouteUrls } from '@/utils/route-urls';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { useAuth } from '@clerk/nextjs';
import { Box, Center, Group, Stack, Tooltip } from '@mantine/core';
import { ScratchPlanType, SubscriptionPlan } from '@spinner/shared-types';
import { Check } from 'lucide-react';
import { redirect } from 'next/navigation';
import { useCallback, useEffect } from 'react';

interface PlanCardProps {
  plan: SubscriptionPlan;
  onError: (error: string | null) => void;
}

export const PlanCard = ({ plan, onError }: PlanCardProps) => {
  const { subscription, isFreePlan } = useSubscription();
  const user = useScratchPadUser();
  const workbookModeActiveFlag = user.user?.experimentalFlags?.DEFAULT_WORKBOOK_MODE;
  const workbookMode = useWorkbookEditorUIStore((state) => state.workbookMode);
  const { isSignedIn } = useAuth();
  const {
    redirectToUpdateSubscription,
    redirectToCancelSubscription,
    portalRedirectInProgress,
    redirectToPlanCheckout,
    portalRedirectError,
  } = usePayments();
  const isCurrentPlan = subscription.planType === plan.planType;
  const isComingSoon = plan.planType === ScratchPlanType.MAX_PLAN;

  useEffect(() => {
    onError(portalRedirectError);
  }, [portalRedirectError, onError]);

  const handleDowngrade = useCallback(() => {
    redirectToCancelSubscription(RouteUrls.billingPageUrl);
  }, [redirectToCancelSubscription]);

  const handleSignUp = useCallback(() => {
    redirect(RouteUrls.signUpPageUrl);
  }, []);

  const handleCheckout = useCallback(() => {
    if (isFreePlan) {
      // user doesn't have a subscription, so redirect to the checkout page
      console.debug('redirecting to checkout page for plan type: ', plan.planType);
      redirectToPlanCheckout(plan.planType);
    } else {
      console.debug('redirecting to update subscription page for plan type: ', plan.planType);
      redirectToUpdateSubscription(plan.planType, RouteUrls.billingPageUrl);
    }
  }, [plan.planType, redirectToUpdateSubscription, redirectToPlanCheckout, isFreePlan]);

  let actionButton = null;
  if (isComingSoon) {
    actionButton = (
      <Center w="100%" h="36px" bg="var(--bg-panel)" className={customBordersClasses.cornerBorders}>
        <Text13Regular c="dimmed">Coming soon</Text13Regular>
      </Center>
    );
  } else if (!isSignedIn) {
    actionButton = (
      <ButtonPrimaryLight onClick={handleSignUp} loading={portalRedirectInProgress}>
        Sign up
      </ButtonPrimaryLight>
    );
  } else if (isCurrentPlan) {
    actionButton = <ButtonPrimaryLight disabled={true}>Current Plan</ButtonPrimaryLight>;
  } else if (!isCurrentPlan && plan.planType !== ScratchPlanType.FREE_PLAN) {
    actionButton = (
      <ButtonPrimaryLight onClick={handleCheckout} loading={portalRedirectInProgress}>
        {subscription.costUSD > plan.costUSD ? 'Switch' : 'Upgrade'}
      </ButtonPrimaryLight>
    );
  } else if (!isCurrentPlan && plan.planType === ScratchPlanType.FREE_PLAN) {
    if (subscription.isCancelled) {
      actionButton = (
        <Tooltip
          label={`You have already cancelled your subscription, your account will switch to the ${plan.displayName} plan on the next billing cycle.`}
          multiline
          w={300}
        >
          <ButtonPrimaryLight onClick={handleDowngrade} disabled={true}>
            Downgrade
          </ButtonPrimaryLight>
        </Tooltip>
      );
    } else {
      actionButton = (
        <ButtonPrimaryLight onClick={handleDowngrade} loading={portalRedirectInProgress}>
          Downgrade
        </ButtonPrimaryLight>
      );
    }
  }

  const currentPlanStyle = isCurrentPlan ? { backgroundColor: 'var(--mantine-primary-color-light)' } : {};

  if (workbookModeActiveFlag === 'scratchsync' || workbookMode === 'scratchsync') {
    return (
      <Box
        px={12}
        py={10}
        className={customBordersClasses.cornerBorders}
        style={{ position: 'relative', ...currentPlanStyle }}
      >
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Text13Medium>{plan.displayName}</Text13Medium>
            {isComingSoon && <Badge w="fit-content">Coming soon</Badge>}
            {plan.popular && !isCurrentPlan && !isComingSoon && <Badge w="fit-content">Popular</Badge>}
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
              id="publishingLimit"
              label={
                plan.features.publishingLimit > 0
                  ? `${plan.features.publishingLimit} publishing actions`
                  : 'Unlimited publishing'
              }
            />
            {plan.features.dataSourcePerServiceLimit === 0 ? (
              <FeatureLineItem id="dataSourcePerServiceLimit" label="Multiple accounts per external service" />
            ) : (
              <FeatureLineItem id="dataSourcePerServiceLimit" label="Single account per external service" />
            )}
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      px={12}
      py={10}
      className={customBordersClasses.cornerBorders}
      style={{ position: 'relative', ...currentPlanStyle }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Text13Medium>{plan.displayName}</Text13Medium>
          {isComingSoon && <Badge w="fit-content">Coming soon</Badge>}
          {plan.popular && !isCurrentPlan && !isComingSoon && <Badge w="fit-content">Popular</Badge>}
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
            id="publishingLimit"
            label={
              plan.features.publishingLimit > 0
                ? `${plan.features.publishingLimit} publishing actions`
                : 'Unlimited publishing'
            }
          />
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
