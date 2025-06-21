import {
  CreateEditSessionDto,
  EditSession,
  UpdateEditSessionDto,
} from "@/types/server-entities/edit-session";

const API_URL = process.env.API_URL || "http://localhost:3000";

export const editSessionsApi = {
  list: async (connectorAccountId: string): Promise<EditSession[]> => {
    const res = await fetch(
      `${API_URL}/edit-sessions?connectorAccountId=${connectorAccountId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to fetch edit sessions");
    }
    return res.json();
  },

  detail: async (id: string): Promise<EditSession> => {
    const res = await fetch(`${API_URL}/edit-sessions/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to fetch edit session");
    }
    return res.json();
  },

  create: async (dto: CreateEditSessionDto): Promise<EditSession> => {
    const res = await fetch(`${API_URL}/edit-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dto }),
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to create edit session");
    }
    return res.json();
  },

  update: async (
    id: string,
    dto: UpdateEditSessionDto
  ): Promise<EditSession> => {
    const res = await fetch(`${API_URL}/edit-sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dto }),
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to update edit session");
    }
    return res.json();
  },
};
