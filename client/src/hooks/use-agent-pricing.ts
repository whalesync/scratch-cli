import { agentPricingApi } from '@/lib/api/agent-pricing';
import { SWR_KEYS } from '@/lib/api/keys';
import { OpenRouterModel } from '@spinner/shared-types';
import useSWR from 'swr';

export const useAgentPricing = () => {
  const { data, error, isLoading } = useSWR(SWR_KEYS.agentPricing.list(), () => agentPricingApi.list());

  return {
    models: data as OpenRouterModel[] | undefined,
    isLoading,
    error,
  };
};
