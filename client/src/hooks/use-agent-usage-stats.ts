import { agentUsageEventsApi } from "@/lib/api/agent-usage-events";
import { SWR_KEYS } from "@/lib/api/keys";
import useSWR from "swr";

export const useAgentTokenUsage = () => {
    const { data, isLoading, mutate } = useSWR(
      SWR_KEYS.agentUsage.list(undefined, 20),
      () => agentUsageEventsApi.list()
    );
      
    return {
      events: data,
      isLoading,
      reload: mutate,
    };
  };