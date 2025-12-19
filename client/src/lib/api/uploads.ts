import { ColumnSpec, SnapshotTableId, WorkbookId } from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

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

export interface CsvAdvancedSettings {
  relaxColumnCount?: boolean;
}

export interface CsvUploadRequest {
  file: File;
  uploadName: string;
  columnNames: string[];
  columnTypes: string[];
  columnIndices: number[]; // Original column indices in the CSV (for handling IGNORE columns)
  firstRowIsHeader: boolean;
  advancedSettings?: CsvAdvancedSettings;
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
  workbookId: WorkbookId;
  tableId: SnapshotTableId;
}

export interface TemplateCreateRequest {
  scratchpaperName: string;
}

export interface TemplateCreateResponse {
  workbookId: WorkbookId;
  tableId: SnapshotTableId;
}

export const uploadsApi = {
  // CSV Preview
  previewCsv: async (file: File): Promise<CsvPreviewResponse> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<CsvPreviewResponse>('/uploads/csv/preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to preview CSV');
    }
  },

  // Markdown Preview
  previewMarkdown: async (file: File): Promise<MdPreviewResponse> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<MdPreviewResponse>('/uploads/md/preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to preview Markdown');
    }
  },

  // Upload CSV
  uploadCsv: async (request: CsvUploadRequest): Promise<CsvUploadResponse> => {
    try {
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

      if (request.advancedSettings) {
        formData.append('advancedSettings', JSON.stringify(request.advancedSettings));
      }

      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<CsvUploadResponse>('/uploads/csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to upload CSV');
    }
  },

  // Upload Markdown
  uploadMarkdown: async (file: File): Promise<MdUploadResponse> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<MdUploadResponse>('/uploads/md', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to upload Markdown');
    }
  },

  // List all uploads
  listUploads: async (): Promise<ListUploadsResponse> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<ListUploadsResponse>('/uploads');
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to list uploads');
    }
  },

  // Get CSV data
  getCsvData: async (uploadId: string, limit = 100, offset = 0): Promise<CsvDataResponse> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<CsvDataResponse>(`/uploads/csv/${uploadId}/data`, {
        params: { limit, offset },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to get CSV data');
    }
  },

  getCsvColumns: async (uploadId: string): Promise<ColumnSpec[]> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<ColumnSpec[]>(`/uploads/csv/${uploadId}/columns`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to get CSV columns');
    }
  },

  // Get Markdown data
  getMdData: async (uploadId: string): Promise<MdDataResponse> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<MdDataResponse>(`/uploads/md/${uploadId}/data`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to get Markdown data');
    }
  },

  // Delete upload
  deleteUpload: async (uploadId: string): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.delete(`/uploads/${uploadId}`);
    } catch (error) {
      handleAxiosError(error, 'Failed to delete upload');
    }
  },

  // Download CSV upload - triggers download without opening a new window
  // NOTE: This uses a public endpoint that doesn't require authentication.
  // Security relies on upload IDs being unguessable.
  downloadCsv: async (uploadId: string, uploadName: string): Promise<void> => {
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

  // Create workbook from CSV upload
  createWorkbookFromCsv: async (
    uploadId: string,
    name: string,
    titleColumnRemoteId?: string[],
  ): Promise<{ workbookId: WorkbookId; tableId: SnapshotTableId }> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<{ workbookId: WorkbookId; tableId: SnapshotTableId }>(
        `/uploads/csv/${uploadId}/create-scratchpaper`,
        { name, titleColumnRemoteId },
      );
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to create workbook from CSV');
    }
  },

  createTemplate: async (request: TemplateCreateRequest): Promise<TemplateCreateResponse> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<TemplateCreateResponse>('/workbook/create-template', request);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to create template');
    }
  },
};
