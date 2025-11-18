import {
  CreateWorkbookDto,
  Workbook,
  SnapshotTableView,
} from "./types/snapshot.js";
import { API_CONFIG } from "./config.js";
import { BulkUpdateRecordsDto, ListRecordsResponse } from "./types/records.js";

export const workbookApi = {
  list: async (connectorAccountId?: string): Promise<Workbook[]> => {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/workbook${
        connectorAccountId ? `?connectorAccountId=${connectorAccountId}` : ""
      }`,
      {
        method: "GET",
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to fetch workbooks");
    }
    return res.json();
  },

  detail: async (id: string): Promise<Workbook> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${id}`, {
      method: "GET",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to fetch workbook");
    }
    return res.json();
  },

  async create(dto: CreateWorkbookDto): Promise<Workbook> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...API_CONFIG.getAuthHeaders(),
      },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      throw new Error("Failed to create workbook");
    }
    return res.json();
  },

  update: async (id: string): Promise<Workbook> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${id}`, {
      method: "PATCH",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to update workbook");
    }
    return res.json();
  },

  async download(id: string): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/workbook/${id}/download`,
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

  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${id}`, {
      method: "DELETE",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to delete workbook");
    }
  },

  async listRecords(
    workbookId: string,
    tableId: string,
    cursor?: string,
    take?: number,
    viewId?: string
  ): Promise<ListRecordsResponse> {
    const url = new URL(
      `${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/records`
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

  /**
   * List records for the active view of a table.
   */
  async listActiveViewRecords(
    workbookId: string,
    tableId: string,
    cursor?: string,
    take?: number
  ): Promise<ListRecordsResponse> {
    const url = new URL(
      `${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/records`
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
    workbookId: string,
    tableId: string,
    dto: BulkUpdateRecordsDto
  ): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/records/bulk`,
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

  async clearActiveView(workbookId: string, tableId: string): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/clear-activate-view`,
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
    workbookId: string,
    tableId: string
  ): Promise<SnapshotTableView[]> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/views`,
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
    workbookId: string,
    tableId: string,
    viewId: string
  ): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/views/${viewId}`,
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
    workbookId: string,
    tableId: string,
    viewId: string
  ): Promise<SnapshotTableView> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/views/${viewId}`,
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
