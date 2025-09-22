import { API_CONFIG } from './config';
import { ScratchpadApiError } from './error';

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

export const generatePollRecords = async (prompt: string, connectorId: string): Promise<string> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/custom-connector-builder/generate-poll-records/${connectorId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new ScratchpadApiError('Failed to generate poll records function', response.status, response.statusText);
  }

  const data = await response.json();
  return data.function;
};

export const executePollRecords = async (functionString: string, apiKey: string, tableId: string[]): Promise<unknown> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/custom-connector-builder/execute-poll-records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ function: functionString, apiKey, tableId }),
  });

  if (!response.ok) {
    throw new ScratchpadApiError('Failed to execute poll records function', response.status, response.statusText);
  }

  return response.json();
};

export const generateDeleteRecord = async (prompt: string, connectorId: string): Promise<string> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/custom-connector-builder/generate-delete-record/${connectorId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new ScratchpadApiError('Failed to generate delete record function', response.status, response.statusText);
  }

  const data = await response.json();
  return data.function;
};

export const executeDeleteRecord = async (
  functionString: string,
  recordId: string,
  apiKey: string,
  tableId: string[],
): Promise<unknown> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/custom-connector-builder/execute-delete-record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ functionString, recordId, apiKey, tableId }),
  });

  if (!response.ok) {
    throw new ScratchpadApiError('Failed to execute delete record function', response.status, response.statusText);
  }

  return response.json();
};

export const generateCreateRecord = async (prompt: string, connectorId: string): Promise<string> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/custom-connector-builder/generate-create-record/${connectorId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new ScratchpadApiError('Failed to generate create record function', response.status, response.statusText);
  }

  const data = await response.json();
  return data.function;
};

export const executeCreateRecord = async (
  functionString: string,
  recordData: Record<string, unknown>,
  apiKey: string,
  tableId: string[],
): Promise<unknown> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/custom-connector-builder/execute-create-record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ functionString, recordData, apiKey, tableId }),
  });

  if (!response.ok) {
    throw new ScratchpadApiError('Failed to execute create record function', response.status, response.statusText);
  }

  return response.json();
};

export const generateUpdateRecord = async (prompt: string, connectorId: string): Promise<string> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/custom-connector-builder/generate-update-record/${connectorId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new ScratchpadApiError('Failed to generate update record function', response.status, response.statusText);
  }

  const data = await response.json();
  return data.function;
};

export const executeUpdateRecord = async (
  functionString: string,
  recordId: string,
  recordData: Record<string, unknown>,
  apiKey: string,
  tableId: string[],
): Promise<unknown> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/custom-connector-builder/execute-update-record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ functionString, recordId, recordData, apiKey, tableId }),
  });

  if (!response.ok) {
    throw new ScratchpadApiError('Failed to execute update record function', response.status, response.statusText);
  }

  return response.json();
};

export const generateListTables = async (prompt: string, connectorId: string): Promise<string> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/custom-connector-builder/generate-list-tables/${connectorId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new ScratchpadApiError('Failed to generate list tables function', response.status, response.statusText);
  }

  const data = await response.json();
  return data.function;
};

export const executeListTables = async (functionString: string, apiKey: string): Promise<unknown> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/custom-connector-builder/execute-list-tables`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ functionString, apiKey }),
  });

  if (!response.ok) {
    throw new ScratchpadApiError('Failed to execute list tables function', response.status, response.statusText);
  }

  return response.json();
};

export const executeSchema = async (functionString: string, apiKey: string, tableId: string[]): Promise<unknown> => {
  const response = await fetch(`${API_CONFIG.getApiUrl()}/rest/custom-connector-builder/execute-schema`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_CONFIG.getAuthHeaders(),
    },
    body: JSON.stringify({ functionString, apiKey, tableId }),
  });

  if (!response.ok) {
    throw new ScratchpadApiError('Failed to execute schema function', response.status, response.statusText);
  }

  return response.json();
};

 