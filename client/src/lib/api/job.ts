import { API_CONFIG } from './config';
import { JobEntity } from '../../types/server-entities/job';

export const jobApi = {
  getJobs: async (limit?: number, offset?: number): Promise<JobEntity[]> => {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append('limit', limit.toString());
    if (offset !== undefined) params.append('offset', offset.toString());

    const response = await fetch(`${API_CONFIG.getApiUrl()}/jobs?${params.toString()}`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch jobs: ${response.statusText}`);
    }

    return response.json();
  },
};
