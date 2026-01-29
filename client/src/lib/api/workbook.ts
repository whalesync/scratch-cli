import {} from '@/types/server-entities/workbook';
import {
  AddTableToWorkbookDto,
  CreateWorkbookDto,
  DataFolderGroup,
  SnapshotTable,
  SnapshotTableId,
  UpdateColumnSettingsDto,
  UpdateWorkbookDto,
  Workbook,
  WorkbookId,
} from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

export type WorkbookSortBy = 'name' | 'createdAt' | 'updatedAt';
export type WorkbookSortOrder = 'asc' | 'desc';

export interface GitFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
}

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

  setContentColumn: async (id: WorkbookId, tableId: SnapshotTableId, columnId: string): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.patch(`/workbook/${id}/tables/${tableId}/content-column`, { columnId });
    } catch (error) {
      handleAxiosError(error, 'Failed to set content column');
    }
  },

  async downloadFiles(id: WorkbookId, snapshotTableIds?: string[]): Promise<{ jobId: string }> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<{ jobId: string }>(`/workbook/${id}/download-files`, { snapshotTableIds });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to start files download');
    }
  },

  async publishFiles(id: WorkbookId, snapshotTableIds?: string[]): Promise<{ jobId: string }> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<{ jobId: string }>(`/workbook/${id}/publish-files`, { snapshotTableIds });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to start publish files');
    }
  },
  async getOperationCountsFiles(
    id: WorkbookId,
  ): Promise<{ tableId: string; creates: number; updates: number; deletes: number }[]> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<{ tableId: string; creates: number; updates: number; deletes: number }[]>(
        `/workbook/${id}/operation-counts-files`,
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

  moveFolder: async (workbookId: WorkbookId, folderId: string, parentFolderId: string | null): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.patch(`/workbook/${workbookId}/folders/${folderId}`, { parentFolderId });
    } catch (error) {
      handleAxiosError(error, 'Failed to move folder');
    }
  },

  listDataFolders: async (workbookId: WorkbookId): Promise<DataFolderGroup[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<DataFolderGroup[]>(`/workbook/${workbookId}/data-folders/list`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to list data folders');
    }
  },

  backupWorkbookToRepo: async (workbookId: WorkbookId): Promise<{ success: boolean; message: string }> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<{ success: boolean; message: string }>(`/scratch-git/${workbookId}/backup`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to backup workbook');
      throw error;
    }
  },
  listRepoFiles: async (workbookId: WorkbookId, branch = 'main', folder = ''): Promise<GitFile[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<GitFile[]>(`/scratch-git/${workbookId}/list`, {
        params: { branch, folder },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to list repository files');
      throw error;
    }
  },
  getRepoFile: async (workbookId: WorkbookId, path: string, branch = 'main'): Promise<{ content: string }> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<{ content: string }>(`/scratch-git/${workbookId}/file`, {
        params: { branch, path },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to get file content');
      throw error;
    }
  },
};
