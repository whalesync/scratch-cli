import { API_CONFIG } from "./config";
import { checkForApiError } from "./error";

export interface MentionsSearchRequest {
  text: string;
  snapshotId: string;
  tableId?: string;
}

export interface ResourceMention {
  id: string;
  title: string;
  preview: string;
}

export interface RecordMention {
  id: string;
  title: string;
  tableId: string;
}

export interface MentionsSearchResponse {
  resources: ResourceMention[];
  records: RecordMention[];
}

export const mentionsApi = {
  search: async (request: MentionsSearchRequest): Promise<MentionsSearchResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/mentions/search`, {
      method: "POST",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    await checkForApiError(res, "Failed to search mentions");
    return res.json();
  },
};
