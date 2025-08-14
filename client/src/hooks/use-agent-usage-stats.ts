import { agentUsageEventsApi } from "@/lib/api/agent-usage-events";
import { SWR_KEYS } from "@/lib/api/keys";
import useSWR from "swr";

export const useAgentTokenUsage = () => {
    const { data: events, isLoading: isEventsLoading, mutate } = useSWR(
      SWR_KEYS.agentUsage.list(undefined, 20),
      () => agentUsageEventsApi.list()
    );

    const { data: summary, isLoading: isSummaryLoading, mutate: mutateSummary } = useSWR(
      SWR_KEYS.agentUsage.summary(),
      () => agentUsageEventsApi.summary()
    );
      
    return {
      events,
      summary,
      isLoading: isEventsLoading || isSummaryLoading,
      reload: () => {
        mutate();
        mutateSummary();
      },
    };
  };