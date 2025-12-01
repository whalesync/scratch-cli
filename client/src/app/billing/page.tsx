'use client';

import { useDevTools } from '@/hooks/use-dev-tools';
import { Alert, Divider, SimpleGrid, Stack } from '@mantine/core';
import { CreditCardIcon } from 'lucide-react';
import { usePayments } from '../../hooks/use-payments';
import { FullPageLoader } from '../components/FullPageLoader';
import { Info } from '../components/InfoPanel';
import MainContent from '../components/layouts/MainContent';
import { ActiveSubscriptionSection } from './components/ActiveSubscriptionSection';
import { BillingSection } from './components/BillingSection';
import { PlanCard } from './components/PlanCard';
import { TokenUsageSection } from './components/TokenUsageSection';

const BillingPage = () => {
  const { isDevToolsEnabled } = useDevTools();
  const { plans, isLoading, error, portalRedirectError } = usePayments();

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
      <MainContent.BasicHeader title="Billing" Icon={CreditCardIcon} />
      <MainContent.Body>
        <Stack gap="20px" maw={800}>
          {error && <Alert color="red">{error}</Alert>}
          {portalRedirectError && <Alert color="red">{portalRedirectError}</Alert>}
          <ActiveSubscriptionSection />
          <Divider c="var(--mantine-color-gray-3)" />
          <TokenUsageSection />
          <Divider c="var(--mantine-color-gray-3)" />
          <BillingSection title="Plans" subtitle="Upgrade or change your plan" hasBorder={false} p="0">
            <SimpleGrid cols={3} spacing="xs">
              {plans?.map((plan) => (
                <PlanCard key={plan.productType} plan={plan} />
              ))}
            </SimpleGrid>
          </BillingSection>
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
};

export default BillingPage;
