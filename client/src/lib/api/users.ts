import { User } from "@/types/server-entities/users";
import { API_CONFIG } from "./base";

// TODO: These all need auth for the current user from middleware. Temoparily faking it on the server.
export const usersApi = {
  activeUser: async (): Promise<User> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/api/users/current`, {
      method: "GET",
      headers: {
        ...API_CONFIG.getDefaultHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new Error("Failed to fetch active user");
    return res.json();
  },
};
