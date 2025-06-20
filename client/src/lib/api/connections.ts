import {
  Connection,
  CreateConnectionDto,
  UpdateConnectionDto,
} from "@/types/server-entities/connections";

const API_URL = process.env.API_URL || "http://localhost:3000";

// TODO: These all need auth for the current user from middleware. Temoparily faking it on the server.
export const connectionsApi = {
  list: async (): Promise<Connection[]> => {
    const res = await fetch(`${API_URL}/connections`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to fetch connections");
    return res.json();
  },

  // GET a single connection
  detail: async (id: string): Promise<Connection> => {
    const res = await fetch(`${API_URL}/connections/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to fetch connection");
    return res.json();
  },

  // POST a new connection
  create: async (dto: CreateConnectionDto): Promise<Connection> => {
    const res = await fetch(`${API_URL}/connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dto }),
    });
    if (!res.ok) throw new Error("Failed to create connection");
    return res.json();
  },

  // PATCH an existing connection
  update: async (id: string, dto: UpdateConnectionDto): Promise<Connection> => {
    const res = await fetch(`${API_URL}/connections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dto }),
    });
    if (!res.ok) throw new Error("Failed to update connection");
    return res.json();
  },

  // DELETE a connection
  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/connections/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (res.status !== 204) {
      throw new Error("Failed to delete connection");
    }
  },
};
