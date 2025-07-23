import { AppendFieldValueDto, CreateSnapshotDto, InjectFieldValueDto, Snapshot } from "@/types/server-entities/snapshot";
import {
  BulkUpdateRecordsDto,
  ListRecordsResponse,
} from "../../types/server-entities/records";
import { API_CONFIG } from "./config";

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
    const res = await fetch(`${API_CONFIG.getApiUrl()}/snapshot/${id}?includeFilters=true`, {
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

  async setActiveRecordsFilter(
    snapshotId: string,
    tableId: string,
    recordIds: string[]
  ): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/set-active-records-filter`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recordIds }),
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to set active records filter");
    }
  },

  async addRecordsToActiveFilter(
    snapshotId: string,
    tableId: string,
    recordIds: string[]
  ): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/add-records-to-active-filter`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recordIds }),
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to add records to active filter");
    }
  },

  async clearActiveRecordFilter(
    snapshotId: string,
    tableId: string
  ): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/clear-active-record-filter`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
        },
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to clear active record filter");
    }
  },

  /**
   * List records for the active view of a table.
   * @deprecated
   */
  async listActiveViewRecords(
    snapshotId: string,
    tableId: string,
    cursor?: string,
    take?: number,
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

  async acceptCellValues(
    snapshotId: string,
    tableId: string,
    items: { wsId: string; columnId: string }[]
  ): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/accept-cell-values`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items }),
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to accept cell values");
    }
  },

  async rejectCellValues(
    snapshotId: string,
    tableId: string,
    items: { wsId: string; columnId: string }[]
  ): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/reject-values`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items }),
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to reject cell values");
    }
  },

  async appendValue(
    snapshotId: string,
    tableId: string,
    dto: AppendFieldValueDto,
    viewId?: string
  ): Promise<void> {
    const url = new URL(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/records/append-value`
    );
    if (viewId) {
      url.searchParams.append("viewId", viewId);
    }
    
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to append value");
    }
  },

  async injectValue(
    snapshotId: string,
    tableId: string,
    dto: InjectFieldValueDto,
    viewId?: string
  ): Promise<void> {
    const url = new URL(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/records/inject-value`
    );
    if (viewId) {
      url.searchParams.append("viewId", viewId);
    }
    
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to inject value");
    }
  },


  
};
