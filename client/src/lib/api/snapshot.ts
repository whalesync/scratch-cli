import { CreateSnapshotDto, Snapshot } from "@/types/server-entities/snapshot";

const API_URL = process.env.API_URL || "http://localhost:3000";

export const snapshotApi = {
  list: async (connectorAccountId: string): Promise<Snapshot[]> => {
    const res = await fetch(
      `${API_URL}/snapshot?connectorAccountId=${connectorAccountId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to fetch snapshots");
    }
    return res.json();
  },

  detail: async (id: string): Promise<Snapshot> => {
    const res = await fetch(`${API_URL}/snapshot/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to fetch snapshot");
    }
    return res.json();
  },

  create: async (dto: CreateSnapshotDto): Promise<Snapshot> => {
    const res = await fetch(`${API_URL}/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dto }),
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to create snapshot");
    }
    return res.json();
  },

  update: async (id: string): Promise<Snapshot> => {
    const res = await fetch(`${API_URL}/snapshot/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to update snapshot");
    }
    return res.json();
  },
};
