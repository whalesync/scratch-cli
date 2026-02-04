import { JobEntity } from '../../types/server-entities/job';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

export const jobApi = {
  getJobs: async (limit?: number, offset?: number): Promise<JobEntity[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<JobEntity[]>('/jobs', {
        params: { limit, offset },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch jobs');
      return [];
    }
  },

  getJobProgress: async (jobId: string): Promise<JobEntity> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<JobEntity>(`/jobs/${jobId}/progress`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch job progress');
      throw error;
    }
  },

  getJobsStatus: async (jobIds: string[]): Promise<JobEntity[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<JobEntity[]>('/jobs/bulk-status', { jobIds });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch bulk job status');
      return [];
    }
  },

  getJobRaw: async (jobId: string): Promise<object> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<object>(`/jobs/${jobId}/raw`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch raw job data');
      throw error;
    }
  },
};
