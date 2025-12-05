import { AgentUsageEvent, UsageSummary } from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { checkForApiError } from './error';

export const agentUsageEventsApi = {
  list: async (cursor?: string, take?: number, credentialId?: string, month?: string): Promise<AgentUsageEvent[]> => {
    const url = new URL(`${API_CONFIG.getApiUrl()}/agent-token-usage/events`);
    if (cursor) {
      url.searchParams.append('cursor', cursor);
    }
    if (credentialId) {
      url.searchParams.append('credentialId', credentialId);
    }
    if (month) {
      url.searchParams.append('month', month);
    }
    if (take) {
      url.searchParams.append('take', take.toString());
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to fetch token usage events');
    return res.json();
  },

  summary: async (credentialId?: string, month?: string): Promise<UsageSummary> => {
    const url = new URL(`${API_CONFIG.getApiUrl()}/agent-token-usage/stats/summary`);
    if (credentialId) {
      url.searchParams.append('credentialId', credentialId);
    }
    if (month) {
      url.searchParams.append('month', month);
    }
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to fetch token usage summary');
    return res.json();
  },
};
