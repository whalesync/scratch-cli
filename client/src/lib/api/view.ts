import { ColumnView, ViewConfig } from '@/types/server-entities/view';
import { API_CONFIG } from './config';
import { ScratchpadApiError } from './error';

export const viewApi = {
  getBySnapshot: async (snapshotId: string): Promise<ColumnView[]> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/views/snapshot/${snapshotId}`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to get views by snapshot', res.status, res.statusText);
    }
    return res.json();
  },

  upsert: async (data: {
    id?: string;
    name?: string;
    snapshotId: string;
    config: ViewConfig;
  }): Promise<ColumnView> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/views`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...API_CONFIG.getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to upsert view', res.status, res.statusText);
    }
    return res.json();
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/views/${id}`, {
      method: 'DELETE',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to delete view', res.status, res.statusText);
    }
  },
}; 