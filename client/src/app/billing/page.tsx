'use client';

import { useAgentCredentials } from '@/hooks/use-agent-credentials';
import { useDevTools } from '@/hooks/use-dev-tools';
import { useSubscription } from '@/hooks/use-subscription';
import { Alert, Group, Stack } from '@mantine/core';
import { BadgeOK } from '../components/base/badge';
import { Text13Regular, TextTitle2 } from '../components/base/text';
import { FullPageLoader } from '../components/FullPageLoader';
import { Info } from '../components/InfoPanel';
import MainContent from '../components/layouts/MainContent';
import { CredentialLimit } from '../settings/components/CredentialLimit';
import { SubscriptionCard } from '../settings/components/SubscriptionCard';
import { useBillingDetails } from './hooks/use-billing';

const BillingPage = () => {
  const { isDevToolsEnabled } = useDevTools();
  const { plans, isLoading, error } = useBillingDetails();
  const { subscription } = useSubscription();
  const { systemOpenRouterCredential } = useAgentCredentials(true);

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!isDevToolsEnabled) {
    // this is a work in progress, only exposed to developers for now
    return (
      <Info>
        <Info.ErrorIcon />
        <Info.Title>Access denied.</Info.Title>
        <Info.Description>You are not authorized to access this page.</Info.Description>
      </Info>
    );
  }
  return (
    <MainContent>
      <MainContent.BasicHeader title="Billing" />
      <MainContent.Body>
        <Stack gap={0} miw={800}>
          {error && <Alert color="red">{error}</Alert>}
          <SubscriptionCard />
          {systemOpenRouterCredential && (
            <Stack gap="xs">
              <Group>
                <Text13Regular>System OpenRouter credential</Text13Regular>
                <Text13Regular>{systemOpenRouterCredential.label}</Text13Regular>
              </Group>
              <CredentialLimit credential={systemOpenRouterCredential} />
            </Stack>
          )}
          <TextTitle2>Plans</TextTitle2>
          {plans?.map((plan) => (
            <Group key={plan.productType}>
              <Text13Regular key={plan.productType}>
                {plan.displayName} - ${plan.costUSD} per month
              </Text13Regular>
              {plan.popular && <BadgeOK>Popular</BadgeOK>}
              {subscription.planType === plan.productType && <BadgeOK>Active</BadgeOK>}
            </Group>
          ))}
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
};

export default BillingPage;
