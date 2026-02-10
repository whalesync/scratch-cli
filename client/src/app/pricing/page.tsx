'use client';

import { Alert, Box, Center, SimpleGrid, Stack } from '@mantine/core';
import { CreditCardIcon } from 'lucide-react';
import { useState } from 'react';
import { usePayments } from '../../hooks/use-payments';
import { PlanCard } from '../settings/billing/components/PlanCard';
import { Text16Regular, TextTitle1 } from '../components/base/text';
import { FullPageLoader } from '../components/FullPageLoader';
import MainContent from '../components/layouts/MainContent';

export default function PricingPage() {
  const { plans, isLoading, error } = usePayments();
  const [planError, setPlanError] = useState<string | null>(null);
  if (isLoading) {
    return <FullPageLoader />;
  }

  return (
    <MainContent>
      <MainContent.BasicHeader title="Pricing" Icon={CreditCardIcon} />
      <MainContent.Body>
        <Stack gap="xl" align="center" py="xl">
          <Box style={{ textAlign: 'center', maxWidth: 600 }}>
            <TextTitle1 mb="md">Plans & pricing</TextTitle1>
            <Text16Regular c="var(--fg-secondary)">Choose the plan that works best for you.</Text16Regular>
          </Box>

          {error && <Alert color="red">{error}</Alert>}
          {planError && <Alert color="red">{planError}</Alert>}
          <Center>
            <SimpleGrid cols={3} spacing="xs" maw={900}>
              {plans?.map((plan) => (
                <PlanCard key={plan.planType} plan={plan} onError={setPlanError} />
              ))}
            </SimpleGrid>
          </Center>
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
}
