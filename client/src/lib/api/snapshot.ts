import { PublishSummary } from '@/types/server-entities/publish-summary';
import { AcceptAllSuggestionsResult, CreateSnapshotDto, DownloadSnapshotResult, DownloadSnapshotWithouotJobResult, RejectAllSuggestionsResult, Snapshot, SnapshotRecord, UpdateSnapshotDto } from "@/types/server-entities/snapshot";
import {
  BulkUpdateRecordsDto,
  ListRecordsResponse,
} from "../../types/server-entities/records";
import { API_CONFIG } from "./config";
import { checkForApiError, ScratchpadApiError } from "./error";

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
    await checkForApiError(res, "Failed to fetch snapshots");
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
    await checkForApiError(res, "Failed to fetch snapshot");
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
    await checkForApiError(res, "Failed to create a scratchpaper");
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
    await checkForApiError(res, "Failed to update snapshot");
    return res.json();
  },

  async downloadWithoutJob(id: string): Promise<DownloadSnapshotWithouotJobResult> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${id}/download-without-job`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
        },
      }
    );
    await checkForApiError(res, "Failed to start download");
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
    await checkForApiError(res, "Failed to start download");
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
    await checkForApiError(res, "Failed to start publish");
  },

  async getPublishSummary(id: string): Promise<PublishSummary> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${id}/publish-summary`,
      {
        method: "GET",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
        },
      }
    );
    await checkForApiError(res, "Failed to get publish summary");
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/snapshot/${id}`, {
      method: "DELETE",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    await checkForApiError(res, "Failed to delete snapshot");
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
    await checkForApiError(res, "Failed to list records");
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
    await checkForApiError(res, "Failed to get record");
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
    await checkForApiError(res, "Failed to set active records filter");
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
    await checkForApiError(res, "Failed to clear active record filter");
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
    await checkForApiError(res, "Failed to accept cell values");
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
    await checkForApiError(res, "Failed to reject cell values");
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
    await checkForApiError(res, "Failed to accept all suggestions");
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
    await checkForApiError(res, "Failed to reject all suggestions");
    return res.json();
  },

  async importSuggestions(
    snapshotId: string,
    tableId: string,
    file: File
  ): Promise<{ recordsProcessed: number; suggestionsCreated: number }> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/snapshot/${snapshotId}/tables/${tableId}/import-suggestions`,
      {
        method: "POST",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
        },
        body: formData,
      }
    );
    await checkForApiError(res, "Failed to import suggestions");
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
    await checkForApiError(res, "Failed to deep fetch records");
    return res.json()
  },
};
