import { CreateSnapshotDto, Snapshot } from "@/types/server-entities/snapshot";
import { API_CONFIG } from "./config";

export const snapshotApi = {
  list: async (connectorAccountId: string): Promise<Snapshot[]> => {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot?connectorAccountId=${connectorAccountId}`,
      {
        method: "GET",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to fetch snapshots");
    }
    return res.json();
  },

  detail: async (id: string): Promise<Snapshot> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/snapshot/${id}`, {
      method: "GET",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to fetch snapshot");
    }
    return res.json();
  },

  create: async (dto: CreateSnapshotDto): Promise<Snapshot> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/snapshot`, {
      method: "POST",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...dto }),
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to create snapshot");
    }
    return res.json();
  },

  update: async (id: string): Promise<Snapshot> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/snapshot/${id}`, {
      method: "PATCH",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to update snapshot");
    }
    return res.json();
  },
};
