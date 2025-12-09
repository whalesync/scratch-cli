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
    }
  },
};
