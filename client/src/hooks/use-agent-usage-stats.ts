import { agentUsageEventsApi } from '@/lib/api/agent-usage-events';
import { SWR_KEYS } from '@/lib/api/keys';
import { useState } from 'react';
import useSWR from 'swr';

const DEFAULT_PAGE_SIZE = 1000;

export const useAgentTokenUsage = () => {
  const [credentialFilter, setCredentialFilter] = useState<string | undefined>(undefined);
  const [monthFilter, setMonthFilter] = useState<string | undefined>(undefined);

  const {
    data: summary,
    isLoading: isSummaryLoading,
    mutate: mutateSummary,
  } = useSWR(SWR_KEYS.agentUsage.summary(credentialFilter, monthFilter), () =>
    agentUsageEventsApi.summary(credentialFilter, monthFilter),
  );

  const {
    data: events,
    isLoading: isEventsLoading,
    mutate: mutateEvents,
  } = useSWR(SWR_KEYS.agentUsage.list(undefined, DEFAULT_PAGE_SIZE, credentialFilter, monthFilter), () =>
    agentUsageEventsApi.list(undefined, DEFAULT_PAGE_SIZE, credentialFilter, monthFilter),
  );

  return {
    summary,
    events,
    isLoading: isSummaryLoading || isEventsLoading,
    reload: () => {
      mutateSummary();
      mutateEvents();
    },
    credentialFilter,
    monthFilter,
    setCredentialFilter,
    setMonthFilter,
  };
};
