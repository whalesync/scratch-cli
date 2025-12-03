'use client';

import { Alert, Divider, SimpleGrid, Stack } from '@mantine/core';
import { CreditCardIcon } from 'lucide-react';
import { usePayments } from '../../hooks/use-payments';
import { FullPageLoader } from '../components/FullPageLoader';
import MainContent from '../components/layouts/MainContent';
import { ActiveSubscriptionSection } from './components/ActiveSubscriptionSection';
import { BillingDevTools } from './components/BillingDevTools';
import { BillingSection } from './components/BillingSection';
import { PlanCard } from './components/PlanCard';
import { TokenUsageSection } from './components/TokenUsageSection';

const BillingPage = () => {
  const { plans, isLoading, error, portalRedirectError } = usePayments();

  if (isLoading) {
    return <FullPageLoader />;
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
                <PlanCard key={plan.planType} plan={plan} />
              ))}
            </SimpleGrid>
          </BillingSection>
          <BillingDevTools />
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
};

export default BillingPage;
