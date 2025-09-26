import {
  AiAgentCredential,
  CreateAiAgentCredentialDto,
  CreditUsage,
  UpdateAiAgentCredentialDto,
} from '@/types/server-entities/agent-credentials';
import { API_CONFIG } from './config';
import { ScratchpadApiError } from './error';

export const agentCredentialsApi = {
  list: async (): Promise<AiAgentCredential[]> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/user/credentials`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new ScratchpadApiError('Failed to fetch agent credentials', res.status, res.statusText);
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

    if (!res.ok) throw new ScratchpadApiError('Failed to update agent credential', res.status, res.statusText);
    return res.json();
  },
  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/user/credentials/${id}`, {
      method: 'DELETE',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    if (!res.ok) throw new ScratchpadApiError('Failed to delete agent credential', res.status, res.statusText);
  },
  getCreditUsage: async (id: string): Promise<CreditUsage> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/user/credentials/${id}/credits`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    if (!res.ok) throw new ScratchpadApiError('Failed to get credit usage', res.status, res.statusText);
    return res.json();
  },
};
