import { UserDetails } from '@/types/server-entities/dev-tools';
import { UpdateSettingsDto, User } from '@/types/server-entities/users';
import { API_CONFIG } from './config';
import { checkForApiError } from './error';

/**
 * API for developer tools
 */
export const devToolsApi = {
  searchUsers: async (query: string): Promise<User[]> => {
    const url = new URL(`${API_CONFIG.getApiUrl()}/dev-tools/users/search`);
    url.searchParams.set('query', query);
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: API_CONFIG.getAuthHeaders(),
    });
    await checkForApiError(res, 'Failed to search users with query: ' + query);
    return res.json();
  },
  getUserDetails: async (userId: string): Promise<UserDetails> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/dev-tools/users/${userId}/details`, {
      method: 'GET',
      headers: API_CONFIG.getAuthHeaders(),
    });
    await checkForApiError(res, 'Failed to get user info for user: ' + userId);
    return res.json();
  },
  updateUserSettings: async (userId: string, dto: UpdateSettingsDto): Promise<void> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/dev-tools/users/${userId}/settings`, {
      method: 'PATCH',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
    await checkForApiError(res, 'Failed to update user settings for user: ' + userId);
  },
};
