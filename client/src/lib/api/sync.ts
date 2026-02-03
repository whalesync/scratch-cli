import { CreateSyncDto, Sync, WorkbookId } from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

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
};
