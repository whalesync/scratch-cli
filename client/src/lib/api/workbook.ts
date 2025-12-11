import { PublishSummary } from '@/types/server-entities/publish-summary';
import type {
  AddScratchColumnDto,
  AddTableToWorkbookDto,
  CreateWorkbookDto,
  DownloadWorkbookResult,
  DownloadWorkbookWithoutJobResult,
  RemoveScratchColumnDto,
  SnapshotTable,
  UpdateColumnSettingsDto,
  UpdateWorkbookDto,
  Workbook,
} from '@/types/server-entities/workbook';
import { SnapshotTableId, WorkbookId } from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

export type WorkbookSortBy = 'name' | 'createdAt' | 'updatedAt';
export type WorkbookSortOrder = 'asc' | 'desc';

export const workbookApi = {
  list: async (
    connectorAccountId?: string,
    sortBy: WorkbookSortBy = 'createdAt',
    sortOrder: WorkbookSortOrder = 'desc',
  ): Promise<Workbook[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<Workbook[]>('/workbook', {
        params: {
          connectorAccountId,
          sortBy,
          sortOrder,
        },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch workbooks');
    }
  },

  detail: async (id: WorkbookId): Promise<Workbook> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<Workbook>(`/workbook/${id}`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch workbook');
    }
  },

  async create(dto: CreateWorkbookDto): Promise<Workbook> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<Workbook>('/workbook', dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to create a workbook');
    }
  },

  update: async (id: WorkbookId, updateDto: UpdateWorkbookDto): Promise<Workbook> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.patch<Workbook>(`/workbook/${id}`, updateDto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to update workbook');
    }
  },

  addTable: async (id: WorkbookId, dto: AddTableToWorkbookDto): Promise<SnapshotTable> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<SnapshotTable>(`/workbook/${id}/add-table`, dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to add table to workbook');
    }
  },

  addSampleTable: async (id: WorkbookId): Promise<SnapshotTable> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<SnapshotTable>(`/workbook/${id}/add-sample-table`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to add sample table to workbook');
    }
  },

  hideTable: async (workbookId: WorkbookId, tableId: SnapshotTableId, hidden: boolean): Promise<Workbook> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.patch<Workbook>(`/workbook/${workbookId}/tables/${tableId}/hide`, { hidden });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to hide/unhide table');
    }
  },

  deleteTable: async (workbookId: WorkbookId, tableId: SnapshotTableId): Promise<Workbook> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.delete<Workbook>(`/workbook/${workbookId}/tables/${tableId}`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to delete table');
    }
  },

  updateColumnSettings: async (
    id: WorkbookId,
    tableId: SnapshotTableId,
    dto: UpdateColumnSettingsDto,
  ): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.patch(`/workbook/${id}/tables/${tableId}/column-settings`, dto);
    } catch (error) {
      handleAxiosError(error, 'Failed to update column contexts');
    }
  },

  setTitleColumn: async (id: WorkbookId, tableId: SnapshotTableId, columnId: string): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.patch(`/workbook/${id}/tables/${tableId}/title-column`, { columnId });
    } catch (error) {
      handleAxiosError(error, 'Failed to set title column');
    }
  },

  async downloadWithoutJob(id: WorkbookId): Promise<DownloadWorkbookWithoutJobResult> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<DownloadWorkbookWithoutJobResult>(`/workbook/${id}/download-without-job`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to start download');
    }
  },

  async download(id: WorkbookId, snapshotTableIds?: string[]): Promise<DownloadWorkbookResult> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<DownloadWorkbookResult>(`/workbook/${id}/download`, { snapshotTableIds });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to start download');
    }
  },

  async publish(id: WorkbookId, snapshotTableIds?: string[]): Promise<{ jobId: string }> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<{ jobId: string }>(`/workbook/${id}/publish`, { snapshotTableIds });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to start publish');
    }
  },

  async getPublishSummary(id: WorkbookId, snapshotTableIds?: string[]): Promise<PublishSummary> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<PublishSummary>(`/workbook/${id}/publish-summary`, { snapshotTableIds });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to get publish summary');
    }
  },

  async getOperationCounts(
    id: WorkbookId,
  ): Promise<{ tableId: string; creates: number; updates: number; deletes: number }[]> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<{ tableId: string; creates: number; updates: number; deletes: number }[]>(
        `/workbook/${id}/operation-counts`,
      );
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to get operation counts');
    }
  },

  async delete(id: WorkbookId): Promise<void> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.delete(`/workbook/${id}`);
    } catch (error) {
      handleAxiosError(error, 'Failed to delete workbook');
    }
  },

  async addScratchColumn(workbookId: WorkbookId, tableId: SnapshotTableId, dto: AddScratchColumnDto): Promise<void> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.post(`/workbook/${workbookId}/tables/${tableId}/add-scratch-column`, dto);
    } catch (error) {
      handleAxiosError(error, 'Failed to add scratch column');
    }
  },

  async removeScratchColumn(
    workbookId: WorkbookId,
    tableId: SnapshotTableId,
    dto: RemoveScratchColumnDto,
  ): Promise<void> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.post(`/workbook/${workbookId}/tables/${tableId}/remove-scratch-column`, dto);
    } catch (error) {
      handleAxiosError(error, 'Failed to remove scratch column');
    }
  },

  async hideColumn(workbookId: WorkbookId, tableId: SnapshotTableId, columnId: string): Promise<void> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.post(`/workbook/${workbookId}/tables/${tableId}/hide-column`, { columnId });
    } catch (error) {
      handleAxiosError(error, 'Failed to hide column');
    }
  },

  async unhideColumn(workbookId: WorkbookId, tableId: SnapshotTableId, columnId: string): Promise<void> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.post(`/workbook/${workbookId}/tables/${tableId}/unhide-column`, { columnId });
    } catch (error) {
      handleAxiosError(error, 'Failed to unhide column');
    }
  },

  async clearHiddenColumns(workbookId: WorkbookId, tableId: SnapshotTableId): Promise<void> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.post(`/workbook/${workbookId}/tables/${tableId}/clear-hidden-columns`);
    } catch (error) {
      handleAxiosError(error, 'Failed to clear hidden columns');
    }
  },

  exportAsCSV: async (
    workbook: Workbook,
    tableId: SnapshotTableId,
    tableName: string,
    filteredOnly: boolean,
  ): Promise<void> => {
    // Use public endpoint that doesn't require authentication
    // Security relies on snapshot IDs being unguessable

    const url = `${API_CONFIG.getApiUrl()}/workbook/public/${workbook.id}/export-as-csv?tableId=${tableId}&filteredOnly=${filteredOnly}`;
    const filename = `${workbook.name || 'snapshot'}_${tableName}.csv`;

    // Create a hidden anchor element and click it to trigger download
    // Set the download attribute with the filename to avoid browser using page title
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
  },
};
