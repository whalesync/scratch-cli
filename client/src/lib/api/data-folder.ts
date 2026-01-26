import {
  CreateDataFolderDto,
  DataFolder,
  DataFolderId,
  ListDataFolderFilesResponseDto,
  MoveDataFolderDto,
  RenameDataFolderDto,
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

  listFiles: async (
    id: DataFolderId,
    limit?: number,
    offset?: number,
  ): Promise<ListDataFolderFilesResponseDto> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<ListDataFolderFilesResponseDto>(`/data-folder/${id}/files`, {
        params: { limit, offset },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to list data folder files');
    }
  },
};
