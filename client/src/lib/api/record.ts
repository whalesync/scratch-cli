import { AcceptAllSuggestionsResult, RejectAllSuggestionsResult, SnapshotRecord,  } from '@/types/server-entities/workbook';
import { SnapshotTableId, WorkbookId } from '@spinner/shared-types';
import { BulkUpdateRecordsDto, ListRecordsResponse, SetTableViewStateDto } from '../../types/server-entities/records';
import { API_CONFIG } from './config';
import { handleAxiosError, ScratchpadApiError } from './error';

export const recordApi = {
  async listRecords(
    workbookId: WorkbookId,
    tableId: SnapshotTableId,
    skip?: number,
    take?: number,
    useStoredSkip?: boolean,
  ): Promise<ListRecordsResponse> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<ListRecordsResponse>(`/workbook/${workbookId}/tables/${tableId}/records`, {
        params: {
          skip,
          take,
          useStoredSkip: useStoredSkip ? 'true' : undefined,
        },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to list records');
    }
  },

  async getRecord(workbookId: WorkbookId, tableId: SnapshotTableId, recordId: string): Promise<SnapshotRecord> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<SnapshotRecord>(`/workbook/${workbookId}/tables/${tableId}/records/${recordId}`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to get record');
    }
  },

  async setActiveRecordsFilter(
    workbookId: WorkbookId,
    tableId: SnapshotTableId,
    sqlWhereClause?: string,
  ): Promise<void> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.post(`/workbook/${workbookId}/tables/${tableId}/set-active-records-filter`, { sqlWhereClause });
    } catch (error) {
      handleAxiosError(error, 'Failed to set active records filter');
    }
  },

  async clearActiveRecordFilter(workbookId: WorkbookId, tableId: SnapshotTableId): Promise<void> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.post(`/workbook/${workbookId}/tables/${tableId}/clear-active-record-filter`);
    } catch (error) {
      handleAxiosError(error, 'Failed to clear active record filter');
    }
  },

  async setTableViewState(workbookId: WorkbookId, tableId: SnapshotTableId, dto: SetTableViewStateDto): Promise<void> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.patch(`/workbook/${workbookId}/tables/${tableId}/view-state`, dto);
    } catch (error) {
      handleAxiosError(error, 'Failed to set table view state');
    }
  },

  async bulkUpdateRecords(workbookId: WorkbookId, tableId: SnapshotTableId, dto: BulkUpdateRecordsDto): Promise<void> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.post(`/workbook/${workbookId}/tables/${tableId}/records/bulk`, dto);
    } catch (error) {
      // Special error handling for bulk updates to extract validation errors
      if (error && typeof error === 'object' && 'isAxiosError' in error && error.isAxiosError) {
        const axiosError = error as {
          response?: {
            status: number;
            data?: {
              errors?: Array<{ id: string; field: string; message: string }>;
              message?: string;
            };
          };
        };

        if (axiosError.response?.status === 400) {
          const errorBody = axiosError.response.data;
          const firstError = errorBody?.errors?.[0];
          if (firstError) {
            throw new Error(`Record ${firstError.id}, field ${firstError.field}: ${firstError.message}`);
          }
          if (errorBody?.message) {
            throw new Error(errorBody.message);
          }
        }
        throw new ScratchpadApiError(
          'Failed to bulk update records',
          axiosError.response?.status || 0,
          'Failed to bulk update records',
        );
      }
      throw error;
    }
  },

  async acceptCellValues(
    workbookId: WorkbookId,
    tableId: SnapshotTableId,
    items: { wsId: string; columnId: string }[],
  ): Promise<{ recordsUpdated: number }> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<{ recordsUpdated: number }>(
        `/workbook/${workbookId}/tables/${tableId}/accept-cell-values`,
        { items },
      );
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to accept cell values');
    }
  },

  async rejectCellValues(
    workbookId: WorkbookId,
    tableId: SnapshotTableId,
    items: { wsId: string; columnId: string }[],
  ): Promise<{ recordsUpdated: number }> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<{ recordsUpdated: number }>(
        `/workbook/${workbookId}/tables/${tableId}/reject-values`,
        { items },
      );
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to reject cell values');
    }
  },

  async acceptAllSuggestions(workbookId: WorkbookId, tableId: SnapshotTableId): Promise<AcceptAllSuggestionsResult> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<AcceptAllSuggestionsResult>(
        `/workbook/${workbookId}/tables/${tableId}/accept-all-suggestions`,
      );
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to accept all suggestions');
    }
  },

  async rejectAllSuggestions(workbookId: WorkbookId, tableId: SnapshotTableId): Promise<RejectAllSuggestionsResult> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<RejectAllSuggestionsResult>(
        `/workbook/${workbookId}/tables/${tableId}/reject-all-suggestions`,
      );
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to reject all suggestions');
    }
  },

  async importSuggestions(
    workbookId: WorkbookId,
    tableId: SnapshotTableId,
    file: File,
  ): Promise<{ recordsProcessed: number; suggestionsCreated: number }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<{ recordsProcessed: number; suggestionsCreated: number }>(
        `/workbook/${workbookId}/tables/${tableId}/import-suggestions`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to import suggestions');
    }
  },

  async deepFetchRecords(
    workbookId: WorkbookId,
    tableId: SnapshotTableId,
    recordIds: string[],
    fields?: string[] | null,
  ): Promise<{ records: SnapshotRecord[]; totalCount: number }> {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<{ records: SnapshotRecord[]; totalCount: number }>(
        `/workbook/${workbookId}/tables/${tableId}/records/deep-fetch`,
        { recordIds, fields },
      );
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to deep fetch records');
    }
  },
};
