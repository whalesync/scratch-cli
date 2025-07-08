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

export interface ExecuteDeleteRecordRequest {
  function: string;
  recordId: string;
  apiKey: string;
}

export const generatePollRecords = async (prompt: string): Promise<string> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/api-import/generate-poll-records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate poll records function');
  }

  return response.text();
};

export const executePollRecords = async (functionString: string, apiKey: string): Promise<unknown> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/api-import/execute-poll-records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ function: functionString, apiKey }),
  });

  if (!response.ok) {
    throw new Error('Failed to execute poll records function');
  }

  return response.json();
};

export const generateDeleteRecord = async (prompt: string): Promise<string> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/api-import/generate-delete-record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate delete record function');
  }

  return response.text();
};

export const executeDeleteRecord = async (
  functionString: string,
  recordId: string,
  apiKey: string,
): Promise<unknown> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/api-import/execute-delete-record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ functionString, recordId, apiKey }),
  });

  if (!response.ok) {
    throw new Error('Failed to execute delete record function');
  }

  return response.json();
};

export const generateCreateRecord = async (prompt: string): Promise<string> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/api-import/generate-create-record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate create record function');
  }

  return response.text();
};

export const executeCreateRecord = async (
  functionString: string,
  recordData: Record<string, unknown>,
  apiKey: string,
): Promise<unknown> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/api-import/execute-create-record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ functionString, recordData, apiKey }),
  });

  if (!response.ok) {
    throw new Error('Failed to execute create record function');
  }

  return response.json();
};

export const generateUpdateRecord = async (prompt: string): Promise<string> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/api-import/generate-update-record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate update record function');
  }

  return response.text();
};

export const executeUpdateRecord = async (
  functionString: string,
  recordId: string,
  recordData: Record<string, unknown>,
  apiKey: string,
): Promise<unknown> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/api-import/execute-update-record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ functionString, recordId, recordData, apiKey }),
  });

  if (!response.ok) {
    throw new Error('Failed to execute update record function');
  }

  return response.json();
};

 