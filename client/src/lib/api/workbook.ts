import { PublishSummary } from '@/types/server-entities/publish-summary';
import type {
  AcceptAllSuggestionsResult,
  AddScratchColumnDto,
  AddTableToWorkbookDto,
  CreateWorkbookDto,
  DownloadWorkbookResult,
  DownloadWorkbookWithoutJobResult,
  RejectAllSuggestionsResult,
  RemoveScratchColumnDto,
  SnapshotRecord,
  SnapshotTable,
  UpdateColumnSettingsDto,
  UpdateWorkbookDto,
  Workbook,
} from '@/types/server-entities/workbook';
import { SnapshotTableId, WorkbookId } from '../../types/server-entities/ids';
import { BulkUpdateRecordsDto, ListRecordsResponse } from '../../types/server-entities/records';
import { API_CONFIG } from './config';
import { checkForApiError, ScratchpadApiError } from './error';

export type WorkbookSortBy = 'name' | 'createdAt' | 'updatedAt';
export type WorkbookSortOrder = 'asc' | 'desc';

export const workbookApi = {
  list: async (
    connectorAccountId?: string,
    sortBy: WorkbookSortBy = 'createdAt',
    sortOrder: WorkbookSortOrder = 'desc',
  ): Promise<Workbook[]> => {
    const params = new URLSearchParams();
    if (connectorAccountId) {
      params.append('connectorAccountId', connectorAccountId);
    }
    params.append('sortBy', sortBy);
    params.append('sortOrder', sortOrder);

    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook?${params.toString()}`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to fetch workbooks');
    return res.json();
  },

  detail: async (id: WorkbookId): Promise<Workbook> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${id}`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to fetch workbook');
    return res.json();
  },

  async create(dto: CreateWorkbookDto): Promise<Workbook> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...API_CONFIG.getAuthHeaders(),
      },
      body: JSON.stringify(dto),
    });
    await checkForApiError(res, 'Failed to create a workbook');
    return res.json();
  },

  update: async (id: WorkbookId, updateDto: UpdateWorkbookDto): Promise<Workbook> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${id}`, {
      method: 'PATCH',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateDto),
    });
    await checkForApiError(res, 'Failed to update workbook');
    return res.json();
  },

  addTable: async (id: WorkbookId, dto: AddTableToWorkbookDto): Promise<SnapshotTable> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${id}/add-table`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
    await checkForApiError(res, 'Failed to add table to workbook');
    return res.json();
  },

  hideTable: async (workbookId: WorkbookId, tableId: SnapshotTableId, hidden: boolean): Promise<Workbook> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/hide`, {
      method: 'PATCH',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hidden }),
    });
    await checkForApiError(res, 'Failed to hide/unhide table');
    return res.json();
  },

  deleteTable: async (workbookId: WorkbookId, tableId: SnapshotTableId): Promise<Workbook> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}`, {
      method: 'DELETE',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to delete table');
    return res.json();
  },

  updateColumnSettings: async (
    id: WorkbookId,
    tableId: SnapshotTableId,
    dto: UpdateColumnSettingsDto,
  ): Promise<void> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${id}/tables/${tableId}/column-settings`, {
      method: 'PATCH',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
    await checkForApiError(res, 'Failed to update column contexts');
  },

  setTitleColumn: async (id: WorkbookId, tableId: SnapshotTableId, columnId: string): Promise<void> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${id}/tables/${tableId}/title-column`, {
      method: 'PATCH',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ columnId }),
    });
    await checkForApiError(res, 'Failed to set title column');
  },

  async downloadWithoutJob(id: WorkbookId): Promise<DownloadWorkbookWithoutJobResult> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${id}/download-without-job`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    await checkForApiError(res, 'Failed to start download');
    return res.json();
  },

  async download(id: WorkbookId, snapshotTableIds?: string[]): Promise<DownloadWorkbookResult> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${id}/download`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ snapshotTableIds }),
    });
    await checkForApiError(res, 'Failed to start download');
    return res.json();
  },

  async publish(id: WorkbookId, snapshotTableIds?: string[]): Promise<{ jobId: string }> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${id}/publish`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ snapshotTableIds }),
    });
    await checkForApiError(res, 'Failed to start publish');
    return res.json();
  },

  async getPublishSummary(id: WorkbookId, snapshotTableIds?: string[]): Promise<PublishSummary> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${id}/publish-summary`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ snapshotTableIds }),
    });
    await checkForApiError(res, 'Failed to get publish summary');
    return res.json();
  },

  async getOperationCounts(
    id: WorkbookId,
  ): Promise<{ tableId: string; creates: number; updates: number; deletes: number }[]> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${id}/operation-counts`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to get operation counts');
    return res.json();
  },

  async delete(id: WorkbookId): Promise<void> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${id}`, {
      method: 'DELETE',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    await checkForApiError(res, 'Failed to delete workbook');
  },

  async listRecords(
    workbookId: WorkbookId,
    tableId: SnapshotTableId,
    cursor?: string,
    take?: number,
  ): Promise<ListRecordsResponse> {
    const url = new URL(`${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/records`);
    if (cursor) {
      url.searchParams.append('cursor', cursor);
    }
    if (take) {
      url.searchParams.append('take', take.toString());
    }
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    await checkForApiError(res, 'Failed to list records');
    return res.json();
  },

  async getRecord(workbookId: WorkbookId, tableId: SnapshotTableId, recordId: string): Promise<SnapshotRecord> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/records/${recordId}`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    await checkForApiError(res, 'Failed to get record');
    return res.json();
  },

  async setActiveRecordsFilter(
    workbookId: WorkbookId,
    tableId: SnapshotTableId,
    sqlWhereClause?: string,
  ): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/set-active-records-filter`,
      {
        method: 'POST',
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sqlWhereClause }),
      },
    );
    await checkForApiError(res, 'Failed to set active records filter');
  },

  async clearActiveRecordFilter(workbookId: WorkbookId, tableId: SnapshotTableId): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/clear-active-record-filter`,
      {
        method: 'POST',
        headers: {
          ...API_CONFIG.getAuthHeaders(),
        },
      },
    );
    await checkForApiError(res, 'Failed to clear active record filter');
  },

  async setPageSize(workbookId: WorkbookId, tableId: SnapshotTableId, pageSize: number | null): Promise<void> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/page-size`, {
      method: 'PATCH',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pageSize }),
    });
    await checkForApiError(res, 'Failed to set page size');
  },

  async bulkUpdateRecords(workbookId: WorkbookId, tableId: SnapshotTableId, dto: BulkUpdateRecordsDto): Promise<void> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/records/bulk`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      if (res.status === 400) {
        const errorBody = await res.json();
        const firstError = errorBody.errors?.[0];
        if (firstError) {
          throw new Error(`Record ${firstError.id}, field ${firstError.field}: ${firstError.message}`);
        }
        if (errorBody.message) {
          throw new Error(errorBody.message);
        }
      }
      throw new ScratchpadApiError(res.statusText ?? 'Failed to bulk update records', res.status, res.statusText);
    }
  },

  async acceptCellValues(
    workbookId: WorkbookId,
    tableId: SnapshotTableId,
    items: { wsId: string; columnId: string }[],
  ): Promise<{ recordsUpdated: number }> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/accept-cell-values`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    });
    await checkForApiError(res, 'Failed to accept cell values');
    return res.json();
  },

  async rejectCellValues(
    workbookId: WorkbookId,
    tableId: SnapshotTableId,
    items: { wsId: string; columnId: string }[],
  ): Promise<{ recordsUpdated: number }> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/reject-values`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    });
    await checkForApiError(res, 'Failed to reject cell values');
    return res.json();
  },

  async acceptAllSuggestions(workbookId: WorkbookId, tableId: SnapshotTableId): Promise<AcceptAllSuggestionsResult> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/accept-all-suggestions`,
      {
        method: 'POST',
        headers: {
          ...API_CONFIG.getAuthHeaders(),
        },
      },
    );
    await checkForApiError(res, 'Failed to accept all suggestions');
    return res.json();
  },

  async rejectAllSuggestions(workbookId: WorkbookId, tableId: SnapshotTableId): Promise<RejectAllSuggestionsResult> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/reject-all-suggestions`,
      {
        method: 'POST',
        headers: {
          ...API_CONFIG.getAuthHeaders(),
        },
      },
    );
    await checkForApiError(res, 'Failed to reject all suggestions');
    return res.json();
  },

  async importSuggestions(
    workbookId: WorkbookId,
    tableId: SnapshotTableId,
    file: File,
  ): Promise<{ recordsProcessed: number; suggestionsCreated: number }> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/import-suggestions`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
      body: formData,
    });
    await checkForApiError(res, 'Failed to import suggestions');
    return res.json();
  },

  async deepFetchRecords(
    workbookId: WorkbookId,
    tableId: SnapshotTableId,
    recordIds: string[],
    fields?: string[] | null,
  ): Promise<{ records: SnapshotRecord[]; totalCount: number }> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/records/deep-fetch`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recordIds, fields }),
    });
    await checkForApiError(res, 'Failed to deep fetch records');
    return res.json();
  },

  async addScratchColumn(workbookId: WorkbookId, tableId: SnapshotTableId, dto: AddScratchColumnDto): Promise<void> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/add-scratch-column`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
    await checkForApiError(res, 'Failed to add scratch column');
  },

  async removeScratchColumn(
    workbookId: WorkbookId,
    tableId: SnapshotTableId,
    dto: RemoveScratchColumnDto,
  ): Promise<void> {
    const res = await fetch(
      `${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/remove-scratch-column`,
      {
        method: 'POST',
        headers: {
          ...API_CONFIG.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dto),
      },
    );
    await checkForApiError(res, 'Failed to remove scratch column');
  },

  async hideColumn(workbookId: WorkbookId, tableId: SnapshotTableId, columnId: string): Promise<void> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/hide-column`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ columnId }),
    });
    await checkForApiError(res, 'Failed to hide column');
  },

  async unhideColumn(workbookId: WorkbookId, tableId: SnapshotTableId, columnId: string): Promise<void> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/unhide-column`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ columnId }),
    });
    await checkForApiError(res, 'Failed to unhide column');
  },

  async clearHiddenColumns(workbookId: WorkbookId, tableId: SnapshotTableId): Promise<void> {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/workbook/${workbookId}/tables/${tableId}/clear-hidden-columns`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    await checkForApiError(res, 'Failed to clear hidden columns');
  },
};
