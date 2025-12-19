import { OpenRouterModel } from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

export const agentPricingApi = {
  list: async (): Promise<OpenRouterModel[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<OpenRouterModel[]>('/agent-pricing/list');
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch agent pricing models');
    }
  },
};
