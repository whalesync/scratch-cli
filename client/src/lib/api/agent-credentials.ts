import {
  AiAgentCredential,
  CreateAiAgentCredentialDto,
  CreditUsage,
  UpdateAiAgentCredentialDto,
} from '@/types/server-entities/agent-credentials';
import { API_CONFIG } from './config';
import { checkForApiError, ScratchpadApiError } from './error';

export const agentCredentialsApi = {
  list: async (): Promise<AiAgentCredential[]> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/user/credentials`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to fetch agent credentials');
    return res.json();
  },
  create: async (data: CreateAiAgentCredentialDto): Promise<AiAgentCredential> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/user/credentials/new`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new ScratchpadApiError('Failed to create agent credential', res.status, res.statusText);
    return res.json();
  },
  update: async (id: string, data: UpdateAiAgentCredentialDto): Promise<AiAgentCredential> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/user/credentials/${id}`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    await checkForApiError(res, 'Failed to update agent credential');
    return res.json();
  },
  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/user/credentials/${id}`, {
      method: 'DELETE',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    await checkForApiError(res, 'Failed to delete agent credential');
  },
  getCreditUsage: async (id: string): Promise<CreditUsage> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/user/credentials/${id}/credits`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    await checkForApiError(res, 'Failed to get credit usage');
    return res.json();
  },
};
