import {
  CreateSyncDto,
  FieldMapType,
  PreviewRecordResponse,
  Sync,
  SyncId,
  UpdateSyncDto,
  WorkbookId,
} from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

interface RunSyncResponse {
  success: boolean;
  jobId: string;
  message: string;
}

export const syncApi = {
  create: async (workbookId: WorkbookId, dto: CreateSyncDto): Promise<Sync> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<Sync>(`/workbooks/${workbookId}/syncs`, dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to create sync');
    }
  },

  update: async (workbookId: WorkbookId, syncId: SyncId, dto: UpdateSyncDto): Promise<unknown> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.patch(`/workbooks/${workbookId}/syncs/${syncId}`, dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to update sync');
    }
  },

  list: async (workbookId: WorkbookId): Promise<Sync[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<Sync[]>(`/workbooks/${workbookId}/syncs`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to list syncs');
      return [];
    }
  },

  run: async (workbookId: WorkbookId, syncId: SyncId): Promise<RunSyncResponse> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<RunSyncResponse>(`/workbooks/${workbookId}/syncs/${syncId}/run`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to run sync');
    }
  },
  previewRecord: async (
    workbookId: WorkbookId,
    sourceId: string,
    filePath: string,
    fieldMap: FieldMapType,
  ): Promise<PreviewRecordResponse> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<PreviewRecordResponse>(`/workbooks/${workbookId}/syncs/preview-record`, {
        sourceId,
        filePath,
        fieldMap,
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to preview record');
    }
  },

  delete: async (workbookId: WorkbookId, syncId: string): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.delete(`/workbooks/${workbookId}/syncs/${syncId}`);
    } catch (error) {
      handleAxiosError(error, 'Failed to delete sync');
      throw error;
    }
  },
};
