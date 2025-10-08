import { API_CONFIG } from './config';
import { checkForApiError } from './error';

export interface CsvPreviewResponse {
  rows: string[][];
}

export interface CsvImportRequest {
  file: File;
  scratchpaperName: string;
  columnNames: string[];
  columnTypes: string[];
  firstRowIsHeader: boolean;
}

export interface CsvImportResponse {
  snapshotId: string;
  tableId: string;
}

export interface TemplateCreateRequest {
  scratchpaperName: string;
}

export interface TemplateCreateResponse {
  snapshotId: string;
  tableId: string;
}

export const uploadsApi = {
  previewCsv: async (file: File): Promise<CsvPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_CONFIG.getApiUrl()}/uploads/preview-csv`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        // Don't set Content-Type header - let the browser set it with boundary for multipart
      },
      body: formData,
    });

    await checkForApiError(res, 'Failed to preview CSV');
    return res.json();
  },

  importCsv: async (request: CsvImportRequest): Promise<CsvImportResponse> => {
    const formData = new FormData();
    formData.append('file', request.file);
    formData.append('scratchpaperName', request.scratchpaperName);
    
    // Append each column name individually
    request.columnNames.forEach((name, index) => {
      formData.append(`columnNames[${index}]`, name);
    });
    
    // Append each column type individually
    request.columnTypes.forEach((type, index) => {
      formData.append(`columnTypes[${index}]`, type);
    });
    
    formData.append('firstRowIsHeader', request.firstRowIsHeader.toString());

    const res = await fetch(`${API_CONFIG.getApiUrl()}/uploads/import-csv`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        // Don't set Content-Type header - let the browser set it with boundary for multipart
      },
      body: formData,
    });

    await checkForApiError(res, 'Failed to import CSV');
    return res.json();
  },

  createTemplate: async (request: TemplateCreateRequest): Promise<TemplateCreateResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/uploads/create-template`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    await checkForApiError(res, 'Failed to create template');
    return res.json();
  },
};
