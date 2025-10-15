import { API_CONFIG } from './config';
import { checkForApiError } from './error';

export type CsvPreviewRow =
  | {
      type: 'success';
      values: string[];
    }
  | {
      type: 'error';
      error: string[];
    };

export type CsvPreviewResponse = {
  rows: CsvPreviewRow[];
};

export interface MdFieldValue {
  value: unknown;
  type: string;
}

export interface MdPreviewResponse {
  data: Record<string, MdFieldValue>; // Front matter with type info
  PAGE_CONTENT: string; // Markdown content
}

export interface CsvUploadRequest {
  file: File;
  uploadName: string;
  columnNames: string[];
  columnTypes: string[];
  columnIndices: number[]; // Original column indices in the CSV (for handling IGNORE columns)
  firstRowIsHeader: boolean;
}

export interface CsvUploadResponse {
  uploadId: string;
  tableId: string;
  rowCount: number;
}

export interface MdUploadResponse {
  uploadId: string;
  mdUploadId: string;
  frontMatterKeys: string[];
}

export interface Upload {
  id: string;
  userId: string;
  name: string;
  type: string; // 'CSV' | 'MD'
  typeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListUploadsResponse {
  uploads: Upload[];
}

export interface CsvDataResponse {
  rows: Record<string, unknown>[];
  total: number;
}

export interface MdDataResponse {
  id: string;
  PAGE_CONTENT: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Legacy imports (deprecated - for snapshot CSV imports)
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
  // CSV Preview
  previewCsv: async (file: File): Promise<CsvPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_CONFIG.getApiUrl()}/uploads/csv/preview`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
      body: formData,
    });

    await checkForApiError(res, 'Failed to preview CSV');
    return res.json();
  },

  // Markdown Preview
  previewMarkdown: async (file: File): Promise<MdPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_CONFIG.getApiUrl()}/uploads/md/preview`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
      body: formData,
    });

    await checkForApiError(res, 'Failed to preview Markdown');
    return res.json();
  },

  // Upload CSV
  uploadCsv: async (request: CsvUploadRequest): Promise<CsvUploadResponse> => {
    const formData = new FormData();
    formData.append('file', request.file);
    formData.append('uploadName', request.uploadName);

    request.columnNames.forEach((name, index) => {
      formData.append(`columnNames[${index}]`, name);
    });

    request.columnTypes.forEach((type, index) => {
      formData.append(`columnTypes[${index}]`, type);
    });

    request.columnIndices.forEach((colIndex, index) => {
      formData.append(`columnIndices[${index}]`, colIndex.toString());
    });

    formData.append('firstRowIsHeader', request.firstRowIsHeader.toString());

    const res = await fetch(`${API_CONFIG.getApiUrl()}/uploads/csv`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
      body: formData,
    });

    await checkForApiError(res, 'Failed to upload CSV');
    return res.json();
  },

  // Upload Markdown
  uploadMarkdown: async (file: File): Promise<MdUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_CONFIG.getApiUrl()}/uploads/md`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
      body: formData,
    });

    await checkForApiError(res, 'Failed to upload Markdown');
    return res.json();
  },

  // List all uploads
  listUploads: async (): Promise<ListUploadsResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/uploads`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });

    await checkForApiError(res, 'Failed to list uploads');
    return res.json();
  },

  // Get CSV data
  getCsvData: async (uploadId: string, limit = 100, offset = 0): Promise<CsvDataResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/uploads/csv/${uploadId}/data?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });

    await checkForApiError(res, 'Failed to get CSV data');
    return res.json();
  },

  // Get Markdown data
  getMdData: async (uploadId: string): Promise<MdDataResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/uploads/md/${uploadId}/data`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });

    await checkForApiError(res, 'Failed to get Markdown data');
    return res.json();
  },

  // Delete upload
  deleteUpload: async (uploadId: string): Promise<void> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/uploads/${uploadId}`, {
      method: 'DELETE',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });

    await checkForApiError(res, 'Failed to delete upload');
  },

  // Download CSV upload - triggers download without opening a new window
  downloadCsv: async (uploadId: string, uploadName: string): Promise<void> => {
    // Use public endpoint that doesn't require authentication
    // Security relies on upload IDs being unguessable
    const url = `${API_CONFIG.getApiUrl()}/uploads/public/csv/${uploadId}/download`;
    
    // Create a hidden anchor element and click it to trigger download
    // Set the download attribute with the filename to avoid browser using page title
    const a = document.createElement('a');
    a.href = url;
    a.download = uploadName; // Set the filename explicitly
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    

  },

  // Create scratchpaper from CSV upload
  createScratchpaperFromCsv: async (uploadId: string, name: string): Promise<{ snapshotId: string; tableId: string }> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/uploads/csv/${uploadId}/create-scratchpaper`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    await checkForApiError(res, 'Failed to create scratchpaper from CSV');
    return res.json();
  },

  createTemplate: async (request: TemplateCreateRequest): Promise<TemplateCreateResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/snapshot/create-template`, {
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
