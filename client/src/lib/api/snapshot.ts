import { CreateSnapshotDto, Snapshot } from "@/types/server-entities/snapshot";
import { API_CONFIG } from "./config";
import {
  BulkUpdateRecordsDto,
  ListRecordsResponse,
} from "../../types/server-entities/records";
import { CreateSnapshotTableViewDto, SnapshotTableView } from "@/types/server-entities/snapshot";

export const snapshotApi = {
  list: async (connectorAccountId?: string): Promise<Snapshot[]> => {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot${connectorAccountId ? `?connectorAccountId=${connectorAccountId}` : ""}`,
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

  async create(dto: CreateSnapshotDto): Promise<Snapshot> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/snapshot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...API_CONFIG.getAuthHeaders(),
      },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      throw new Error("Failed to create snapshot");
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

  async download(id: string): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${id}/download`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
        },
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to start download");
    }
  },

  async publish(id: string): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${id}/publish`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
        },
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to start publish");
    }
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/snapshot/${id}`, {
      method: "DELETE",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to delete snapshot");
    }
  },

  async listRecords(
    snapshotId: string,
    tableId: string,
    cursor?: string,
    take?: number,
    viewId?: string
  ): Promise<ListRecordsResponse> {
    const url = new URL(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/records`
    );
    if (cursor) {
      url.searchParams.append("cursor", cursor);
    }
    if (take) {
      url.searchParams.append("take", take.toString());
    }
    if (viewId) {
      url.searchParams.append("viewId", viewId);
    }
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to list records");
    }
    return res.json();
  },

  async bulkUpdateRecords(
    snapshotId: string,
    tableId: string,
    dto: BulkUpdateRecordsDto
  ): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/records/bulk`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dto),
      }
    );
    if (!res.ok) {
      if (res.status === 400) {
        const errorBody = await res.json();
        const firstError = errorBody.errors?.[0];
        if (firstError) {
          throw new Error(
            `Record ${firstError.id}, field ${firstError.field}: ${firstError.message}`
          );
        }
        if (errorBody.message) {
          throw new Error(errorBody.message);
        }
      }
      throw new Error(res.statusText ?? "Failed to bulk update records");
    }
  },

  async activateView(
    snapshotId: string,
    tableId: string,
    dto: CreateSnapshotTableViewDto
  ): Promise<string> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/activate-view`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dto),
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to activate view");
    }

    const view = await res.json();
    return view.id;
  },

  async clearActiveView(
    snapshotId: string,
    tableId: string,
  ): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/clear-activate-view`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
    
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to clear filter view");
    }
  },


  async listViews(
    snapshotId: string,
    tableId: string
  ): Promise<SnapshotTableView[]> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/views`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to list views");
    }
    return res.json();
  },

  async deleteView(
    snapshotId: string,
    tableId: string,
    viewId: string
  ): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/views/${viewId}`,
      {
        method: "DELETE",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
        },
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to delete view");
    }
  },

  async getView(
    snapshotId: string,
    tableId: string,
    viewId: string
  ): Promise<SnapshotTableView> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/views/${viewId}`,
      {
        method: "GET",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
        },
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to get view");
    }
    return res.json();
  },
};
