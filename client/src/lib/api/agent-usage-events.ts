import { AgentUsageEvent, UsageSummary } from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

export const agentUsageEventsApi = {
  list: async (cursor?: string, take?: number, credentialId?: string, month?: string): Promise<AgentUsageEvent[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<AgentUsageEvent[]>('/agent-token-usage/events', {
        params: {
          cursor,
          credentialId,
          month,
          take,
        },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch token usage events');
    }
  },

  summary: async (credentialId?: string, month?: string): Promise<UsageSummary> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<UsageSummary>('/agent-token-usage/stats/summary', {
        params: {
          credentialId,
          month,
        },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch token usage summary');
    }
  },
};
