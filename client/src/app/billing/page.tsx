'use client';

import { useDevTools } from '@/hooks/use-dev-tools';
import { Alert, Stack } from '@mantine/core';
import { Text13Regular, TextTitle2 } from '../components/base/text';
import { FullPageLoader } from '../components/FullPageLoader';
import { Info } from '../components/InfoPanel';
import MainContent from '../components/layouts/MainContent';
import { SubscriptionCard } from '../settings/components/SubscriptionCard';
import { useBillingDetails } from './hooks/use-billing';

const BillingPage = () => {
  const { isDevToolsEnabled } = useDevTools();
  const { plans, isLoading, error } = useBillingDetails();

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
          <TextTitle2>Plans</TextTitle2>
          {plans?.map((plan) => (
            <Text13Regular key={plan.productType}>
              {plan.displayName} - {plan.productType}
            </Text13Regular>
          ))}
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
};

export default BillingPage;
