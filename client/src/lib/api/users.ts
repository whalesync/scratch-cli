import { User } from "@/types/server-entities/users";
import { API_CONFIG } from "./config";
import { ScratchpadApiError } from "./error";

// TODO: These all need auth for the current user from middleware. Temoparily faking it on the server.
export const usersApi = {
  activeUser: async (): Promise<User> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/users/current`, {
      method: "GET",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new ScratchpadApiError("Failed to fetch active user", res.status, res.statusText);
    return res.json();
  },
};
