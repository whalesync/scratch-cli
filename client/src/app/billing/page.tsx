'use client';

import { Alert, Divider, SimpleGrid, Stack } from '@mantine/core';
import { CreditCardIcon } from 'lucide-react';
import { useState } from 'react';
import { usePayments } from '../../hooks/use-payments';
import { FullPageLoader } from '../components/FullPageLoader';
import MainContent from '../components/layouts/MainContent';
import { ActiveSubscriptionSection } from './components/ActiveSubscriptionSection';
import { BillingDevTools } from './components/BillingDevTools';
import { BillingSection } from './components/BillingSection';
import { PlanCard } from './components/PlanCard';
import { TokenUsageSection } from './components/TokenUsageSection';

const BillingPage = () => {
  const { plans, isLoading, error } = usePayments();
  const [planError, setPlanError] = useState<string | null>(null);

  if (isLoading) {
    return <FullPageLoader />;
  }

  return (
    <MainContent>
      <MainContent.BasicHeader title="Billing" Icon={CreditCardIcon} />
      <MainContent.Body>
        <Stack gap="20px" maw={800}>
          {error && <Alert color="red">{error}</Alert>}
          {planError && <Alert color="red">{planError}</Alert>}
          <ActiveSubscriptionSection />
          <Divider c="var(--mantine-color-gray-3)" />
          <TokenUsageSection />
          <Divider c="var(--mantine-color-gray-3)" />
          <BillingSection title="Plans" description="Upgrade or change your plan" hasBorder={false} p="0">
            <SimpleGrid cols={3} spacing="xs">
              {plans?.map((plan) => (
                <PlanCard key={plan.planType} plan={plan} onError={setPlanError} />
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
