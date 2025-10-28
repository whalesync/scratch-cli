import { UserDetails } from "@/types/server-entities/dev-tools";
import { User } from "@/types/server-entities/users";
import { API_CONFIG } from "./config";
import { checkForApiError } from "./error";

/**
 * API for developer tools
 */
export const devToolsApi = {

  searchUsers: async (query: string): Promise<User[]> => {
    const url = new URL(`${API_CONFIG.getApiUrl()}/dev-tools/users/search`);
    url.searchParams.set('query', query);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: API_CONFIG.getAuthHeaders(),
    });
    await checkForApiError(res, "Failed to search users with query: " + query);
    return res.json();
  },
  getUserDetails: async (userId: string): Promise<UserDetails> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/dev-tools/users/${userId}/details`, {
      method: "GET",
      headers: API_CONFIG.getAuthHeaders(),
    });
    await checkForApiError(res, "Failed to get user info for user: " + userId);
    return res.json();
  },
  /**
   * Temporary endpoing to reset the stripe customer and subscription for a user for migrating from one stripe account to a new one
   * See DEV-8698 in Linear
   * Remove after migration is complete
   */
  resetStripeForUser: async (userId: string): Promise<string> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/dev-tools/users/${userId}/reset-stripe`, {
      method: "GET",
      headers: API_CONFIG.getAuthHeaders(),
    });
    await checkForApiError(res, "Failed to reset stripe for user: " + userId);
    return res.text();
  },
};
