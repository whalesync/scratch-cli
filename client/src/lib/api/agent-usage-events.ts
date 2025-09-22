import { AgentUsageEvent, UsageSummary } from "@/types/server-entities/agent-usage-events";
import { API_CONFIG } from "./config";
import { ScratchpadApiError } from "./error";

export const agentUsageEventsApi = {
  list: async (cursor?: string, take?: number): Promise<AgentUsageEvent[]> => {
    const url = new URL(`${API_CONFIG.getApiUrl()}/agent-token-usage/events`);
    if (cursor) {
        url.searchParams.append("cursor", cursor);
      }
      if (take) {
        url.searchParams.append("take", take.toString());
      }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new ScratchpadApiError("Failed to fetch agent usage events", res.status, res.statusText);
    return res.json();
  },

  summary: async (): Promise<UsageSummary > => {
    const url = new URL(`${API_CONFIG.getApiUrl()}/agent-token-usage/stats/summary`);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new ScratchpadApiError("Failed to fetch agent usage summary", res.status, res.statusText);
    return res.json();
  },
};