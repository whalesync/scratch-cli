import { UserDetails } from '@/types/server-entities/dev-tools';
import { UpdateSettingsDto, User } from '@/types/server-entities/users';
import { ScratchPlanType } from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

/**
 * API for developer tools
 */
export const devToolsApi = {
  searchUsers: async (query: string): Promise<User[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<User[]>('/dev-tools/users/search', {
        params: { query },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to search users with query: ' + query);
    }
  },
  getUserDetails: async (userId: string): Promise<UserDetails> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<UserDetails>(`/dev-tools/users/${userId}/details`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to get user info for user: ' + userId);
    }
  },
  updateUserSettings: async (userId: string, dto: UpdateSettingsDto): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.patch(`/dev-tools/users/${userId}/settings`, dto);
    } catch (error) {
      handleAxiosError(error, 'Failed to update user settings for user: ' + userId);
    }
  },
  updateUserSubscription: async (newPlan: ScratchPlanType): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.post('/dev-tools/subscription/plan/update', { planType: newPlan });
    } catch (error) {
      handleAxiosError(error, 'Failed to update user subscription');
    }
  },
  forceExpireSubscription: async (): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.post('/dev-tools/subscription/plan/expire');
    } catch (error) {
      handleAxiosError(error, 'Failed to force expire subscription');
    }
  },
  forceCancelSubscription: async (): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.post('/dev-tools/subscription/plan/cancel');
    } catch (error) {
      handleAxiosError(error, 'Failed to force cancel subscription');
    }
  },
  resetUserOnboarding: async (userId: string): Promise<void> => {
    await fetch(`${API_CONFIG.getApiUrl()}/dev-tools/users/${userId}/onboarding/reset`, {
      method: 'POST',
      headers: API_CONFIG.getAuthHeaders(),
    });
  },
};
