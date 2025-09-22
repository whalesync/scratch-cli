import { AcceptAllSuggestionsResult, CreateSnapshotDto, DownloadSnapshotResult, RejectAllSuggestionsResult, Snapshot, SnapshotRecord, UpdateSnapshotDto } from "@/types/server-entities/snapshot";
import {
  BulkUpdateRecordsDto,
  ListRecordsResponse,
} from "../../types/server-entities/records";
import { API_CONFIG } from "./config";
import { ScratchpadApiError } from "./error";

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
      throw new ScratchpadApiError(res.statusText ?? "Failed to fetch snapshots", res.status, res.statusText);
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
      throw new ScratchpadApiError(res.statusText ?? "Failed to fetch snapshot", res.status, res.statusText);
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
      throw new ScratchpadApiError("Failed to create snapshot", res.status, res.statusText);
    }
    return res.json();
  },

  update: async (id: string, updateDto: UpdateSnapshotDto): Promise<Snapshot> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/snapshot/${id}`, {
      method: "PATCH",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateDto),
    });
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? "Failed to update snapshot", res.status, res.statusText);
    }
    return res.json();
  },

  async download(id: string): Promise<DownloadSnapshotResult> {
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
      throw new ScratchpadApiError(res.statusText ?? "Failed to start download", res.status, res.statusText);
    }
    return res.json();
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
      throw new ScratchpadApiError(res.statusText ?? "Failed to start publish", res.status, res.statusText);
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
      throw new ScratchpadApiError(res.statusText ?? "Failed to delete snapshot", res.status, res.statusText);
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
      throw new ScratchpadApiError(res.statusText ?? "Failed to list records", res.status, res.statusText);
    }
    return res.json();
  },

  async getRecord(
    snapshotId: string,
    tableId: string,
    recordId: string
  ): Promise<SnapshotRecord> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/records/${recordId}`,
      {
        method: "GET",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
        },
      }
    );
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? "Failed to get record", res.status, res.statusText);
    }
    return res.json();
  },

  async setActiveRecordsFilter(
    snapshotId: string,
    tableId: string,
    sqlWhereClause?: string
  ): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/set-active-records-filter`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sqlWhereClause }),
      }
    );
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMessage = errorData.message || res.statusText || "Failed to set active records filter";
      throw new ScratchpadApiError(errorMessage, res.status, res.statusText);
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
      throw new ScratchpadApiError(res.statusText ?? "Failed to clear active record filter", res.status, res.statusText);
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
      throw new ScratchpadApiError(res.statusText ?? "Failed to list records", res.status, res.statusText);
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
            `Record ${firstError.id}, field ${firstError.field}: ${firstError.message}`,
          );
        }
        if (errorBody.message) {
          throw new Error(errorBody.message);
        }
      }
      throw new ScratchpadApiError(res.statusText ?? "Failed to bulk update records", res.status, res.statusText);
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
      throw new ScratchpadApiError(res.statusText ?? "Failed to accept cell values", res.status, res.statusText);
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
      throw new ScratchpadApiError(res.statusText ?? "Failed to reject cell values", res.status, res.statusText);
    }
  },


  async acceptAllSuggestions(
    snapshotId: string,
    tableId: string,
    viewId?: string,
  ): Promise<AcceptAllSuggestionsResult> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/accept-all-suggestions`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
        },
        body: JSON.stringify({ viewId }),
      }
    );
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? "Failed to accept all suggestions", res.status, res.statusText);
    }
    return res.json();
  },

  async rejectAllSuggestions(
    snapshotId: string,
    tableId: string,
    viewId?: string,
  ): Promise<RejectAllSuggestionsResult> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/reject-all-suggestions`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
        },
        body: JSON.stringify({ viewId }),
      }
    );
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? "Failed to reject all suggestions", res.status, res.statusText);
    }
    return res.json();
  },

  async deepFetchRecords(
    snapshotId: string,
    tableId: string,
    recordIds: string[],
    fields?: string[] | null
  ): Promise<{ records: SnapshotRecord[]; totalCount: number }> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/records/deep-fetch`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recordIds, fields }),
      }
    );
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? "Failed to deep fetch records", res.status, res.statusText);
    }
    return res.json();
  },
};
