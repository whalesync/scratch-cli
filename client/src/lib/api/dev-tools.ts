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

    /*
    Temporary endpoint to migrate old style snapshots to new Workbooks
  */
  listOldStyleSnapshots: async (): Promise<
    Array<{
      id: string;
      name: string | null;
      service: string;
      userId: string;
      createdAt: Date;
      updatedAt: Date;
      tableSpecsCount: number;
      snapshotTablesCount: number;
    }>
  > => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/dev-tools/snapshots/old-style-snapshots`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    await checkForApiError(res, 'Failed to list old-style snapshots');
    return res.json();
  },

  fixSnapshot: async (id: string): Promise<{ success: boolean; tablesCreated: number }> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/dev-tools/snapshots/fix-snapshot/${id}`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    await checkForApiError(res, 'Failed to fix snapshot');
    return res.json();
  },

};
