import { UpdateSettingsDto, User } from '@/types/server-entities/users';
import { API_CONFIG } from './config';
import { checkForApiError } from './error';

export const usersApi = {
  activeUser: async (): Promise<User> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/users/current`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to fetch active user');
    return res.json();
  },

  updateSettings: async (dto: UpdateSettingsDto): Promise<void> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/users/current/settings`, {
      method: 'PATCH',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
    await checkForApiError(res, 'Failed to update user settings');
  },
};
