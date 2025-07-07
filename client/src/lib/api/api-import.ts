import { API_CONFIG } from './config';

export interface GeneratePollRecordsRequest {
  prompt: string;
}

export interface GenerateDeleteRecordRequest {
  prompt: string;
}

export interface GeneratePollRecordsResponse {
  function: string;
}

export interface GenerateDeleteRecordResponse {
  function: string;
}

export const generatePollRecords = async (data: GeneratePollRecordsRequest): Promise<GeneratePollRecordsResponse> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/api-import/generate-poll-records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate poll records: ${response.statusText}`);
  }

  return response.json();
};

export const generateDeleteRecord = async (data: GenerateDeleteRecordRequest): Promise<GenerateDeleteRecordResponse> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/api-import/generate-delete-record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate delete record: ${response.statusText}`);
  }

  return response.json();
};

 