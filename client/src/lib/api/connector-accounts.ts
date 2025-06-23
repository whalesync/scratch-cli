import {
  ConnectorAccount,
  CreateConnectorAccountDto,
  TestConnectionResponse,
  UpdateConnectorAccountDto,
} from "@/types/server-entities/connector-accounts";
import { API_CONFIG } from "./config";
import { TableList } from "../../types/server-entities/table-list";

// TODO: These all need auth for the current user from middleware. Temoparily faking it on the server.
export const connectorAccountsApi = {
  list: async (): Promise<ConnectorAccount[]> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/connector-accounts`, {
      method: "GET",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to fetch connections");
    }
    return res.json();
  },

  // GET a single connection
  detail: async (id: string): Promise<ConnectorAccount> => {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/connector-accounts/${id}`,
      {
        method: "GET",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to fetch connection");
    }
    return res.json();
  },

  // POST a new connection
  create: async (dto: CreateConnectorAccountDto): Promise<ConnectorAccount> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/connector-accounts`, {
      method: "POST",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...dto }),
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to create connection");
    }
    return res.json();
  },

  // PATCH an existing connection
  update: async (
    id: string,
    dto: UpdateConnectorAccountDto
  ): Promise<ConnectorAccount> => {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/connector-accounts/${id}`,
      {
        method: "PATCH",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...dto }),
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to update connection");
    }
    return res.json();
  },

  // DELETE a connection
  delete: async (id: string): Promise<void> => {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/connector-accounts/${id}`,
      {
        method: "DELETE",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
    if (res.status !== 204) {
      throw new Error(res.statusText ?? "Failed to delete connection");
    }
  },

  // POST to list tables for a connection
  listTables: async (id: string): Promise<TableList> => {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/connector-accounts/${id}/tables`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to list tables");
    }
    return res.json();
  },

  // POST to test a connection
  test: async (id: string): Promise<TestConnectionResponse> => {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/connector-accounts/${id}/test`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to test connection");
    }
    return res.json();
  },
};
