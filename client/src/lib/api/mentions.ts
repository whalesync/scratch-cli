import { RecordMentionEntity, ResourceMentionEntity } from '@/types/server-entities/mentions';
import { SnapshotTableId, WorkbookId } from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

export type MentionsSearchRecordsRequestDto = {
  text: string;
  workbookId: WorkbookId;
  tableId: SnapshotTableId;
};

export type MentionsSearchResourcesRequestDto = {
  text: string;
};

export const mentionsApi = {
  searchResources: async (request: MentionsSearchResourcesRequestDto): Promise<ResourceMentionEntity[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<ResourceMentionEntity[]>('/mentions/search/resources', request);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to search resource mentions');
    }
  },

  searchRecords: async (request: MentionsSearchRecordsRequestDto): Promise<RecordMentionEntity[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<RecordMentionEntity[]>('/mentions/search/records', request);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to search record mentions');
    }
  },
};
