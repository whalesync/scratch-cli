import { SnapshotTableId, WorkbookId } from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

export const recordApi = {
  async clearActiveRecordFilter(workbookId: WorkbookId, tableId: SnapshotTableId): Promise<void> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.post(`/workbook/${workbookId}/tables/${tableId}/clear-active-record-filter`);
    } catch (error) {
      handleAxiosError(error, 'Failed to clear active record filter');
    }
  },
};
