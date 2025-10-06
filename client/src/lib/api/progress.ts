import { API_CONFIG } from './config';
import { JobEntity } from '../../types/server-entities/job';

export const progressApi = {
  getJobProgress: async (jobId: string): Promise<JobEntity> => {
    const response = await fetch(`${API_CONFIG.getApiUrl()}/jobs/${jobId}/progress`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch job progress: ${response.statusText}`);
    }

    return response.json();
  },

  cancelJob: async (jobId: string): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_CONFIG.getApiUrl()}/jobs/${jobId}/cancel`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel job: ${response.statusText}`);
    }

    return response.json();
  },
};
