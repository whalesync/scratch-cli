import {
  CreateDataFolderDto,
  DataFolder,
  DataFolderId,
  FileId,
  MoveDataFolderDto,
  RenameDataFolderDto,
  WorkbookId,
} from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

export const dataFolderApi = {
  create: async (dto: CreateDataFolderDto): Promise<DataFolder> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<DataFolder>('/data-folder/create', dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to create data folder');
    }
  },

  findOne: async (id: DataFolderId): Promise<DataFolder> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<DataFolder>(`/data-folder/${id}`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch data folder');
    }
  },

  delete: async (id: DataFolderId): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.delete(`/data-folder/${id}`);
    } catch (error) {
      handleAxiosError(error, 'Failed to delete data folder');
    }
  },

  rename: async (id: DataFolderId, dto: RenameDataFolderDto): Promise<DataFolder> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.patch<DataFolder>(`/data-folder/${id}/rename`, dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to rename data folder');
    }
  },

  move: async (id: DataFolderId, dto: MoveDataFolderDto): Promise<DataFolder> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.patch<DataFolder>(`/data-folder/${id}/move`, dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to move data folder');
    }
  },

  deleteFile: async (dataFolderId: DataFolderId, fileId: FileId): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.delete(`/data-folder/${dataFolderId}/files/${fileId}`);
    } catch (error) {
      handleAxiosError(error, 'Failed to delete file');
    }
  },

  /**
   * Publish multiple data folders in a single job.
   * This ensures all folders are tracked in one progress display.
   */
  publish: async (dataFolderIds: DataFolderId[], workbookId: WorkbookId): Promise<{ jobId: string }> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<{ jobId: string }>('/data-folder/publish', { workbookId, dataFolderIds });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to publish data folders');
    }
  },
};
