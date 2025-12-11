import { UpdateSettingsDto, User } from '@/types/server-entities/users';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

export const usersApi = {
  activeUser: async (): Promise<User> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<User>('/users/current');
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch active user');
    }
  },

  updateSettings: async (dto: UpdateSettingsDto): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.patch('/users/current/settings', dto);
    } catch (error) {
      handleAxiosError(error, 'Failed to update user settings');
    }
  },

  collapseOnboardingStep: async (flow: string, stepKey: string, collapsed: boolean): Promise<void> => {
    await fetch(`${API_CONFIG.getApiUrl()}/users/current/onboarding/collapse`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ flow, stepKey, collapsed }),
    });
  },
};
