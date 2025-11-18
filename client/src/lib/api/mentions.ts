import { API_CONFIG } from './config';
import { checkForApiError } from './error';

export interface MentionsSearchRequest {
  text: string;
  tableId?: string;
}

export interface ResourceMentionEntity {
  id: string;
  title: string;
  preview: string;
}

export interface RecordMentionEntity {
  id: string;
  title: string;
  tableId: string;
}

export interface MentionsSearchResponse {
  resources: ResourceMentionEntity[];
  records: RecordMentionEntity[];
}

export const mentionsApi = {
  searchResources: async (request: MentionsSearchRequest): Promise<ResourceMentionEntity[]> => {
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

  searchRecords: async (request: MentionsSearchRequest): Promise<RecordMentionEntity[]> => {
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
