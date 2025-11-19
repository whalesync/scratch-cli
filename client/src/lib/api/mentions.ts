import { SnapshotTableId, WorkbookId } from '@/types/server-entities/ids';
import { RecordMentionEntity, ResourceMentionEntity } from '@/types/server-entities/mentions';
import { API_CONFIG } from './config';
import { checkForApiError } from './error';

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
    const res = await fetch(`${API_CONFIG.getApiUrl()}/mentions/search/resources`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    await checkForApiError(res, 'Failed to search resource mentions');
    return res.json();
  },

  searchRecords: async (request: MentionsSearchRecordsRequestDto): Promise<RecordMentionEntity[]> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/mentions/search/records`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    await checkForApiError(res, 'Failed to search record mentions');
    return res.json();
  },
};
