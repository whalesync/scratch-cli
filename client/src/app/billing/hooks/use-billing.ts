import { isUnauthorizedError } from '@/lib/api/error';
import { SWR_KEYS } from '@/lib/api/keys';
import { paymentApi } from '@/lib/api/payment';
import { SubscriptionPlan } from '@spinner/shared-types';
import { useMemo } from 'react';
import useSWR from 'swr';

export const useBillingDetails = () => {
  const { data, error, isLoading } = useSWR<SubscriptionPlan[]>(SWR_KEYS.billing.plans(), () => paymentApi.listPlans());

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  return {
    plans: data,
    isLoading,
    error: displayError,
  };
};
