import {
  CreateFileDto,
  CreateFolderDto,
  FileDetailsResponseDto,
  FileId,
  FileRefEntity,
  FolderId,
  FolderResponseDto,
  ListFilesDetailsResponseDto,
  ListFilesResponseDto,
  UpdateFileDto,
  UpdateFolderDto,
  WorkbookId,
} from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

/**
 * File API endpoints for file-based workbook operations
 * All operations now use IDs instead of paths
 */
export const filesApi = {
  /**
   * List all files and folders in a workbook
   * GET /workbooks/:workbookId/files/list
   */
  listFilesAndFolders: async (workbookId: WorkbookId): Promise<ListFilesResponseDto> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<ListFilesResponseDto>(`/workbooks/${workbookId}/files/list`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to list files and folders');
    }
  },

  /**
  /**
   * List all of the files in a folder including full file content.
   * GET /workbooks/:workbookId/files/list/details?folderId=...
   */
  listFilesDetails: async (workbookId: WorkbookId, folderId?: string | null): Promise<ListFilesDetailsResponseDto> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const params = folderId ? { folderId } : {};
      const res = await axios.get<ListFilesDetailsResponseDto>(`/workbooks/${workbookId}/files/list/details`, {
        params,
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to list files details');
    }
  },

  /**
   * Get a single file by ID
   * GET /workbooks/:workbookId/files/:fileId
   */
  getFile: async (workbookId: WorkbookId, fileId: FileId): Promise<FileDetailsResponseDto> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<FileDetailsResponseDto>(`/workbooks/${workbookId}/files/${fileId}`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch file');
    }
  },

  /**
   * Create a new file
   * POST /workbooks/:workbookId/files
   */
  createFile: async (workbookId: WorkbookId, dto: CreateFileDto): Promise<FileRefEntity> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<FileRefEntity>(`/workbooks/${workbookId}/files`, dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to create file');
    }
  },

  /**
   * Update an existing file by ID
   * PATCH /workbooks/:workbookId/files/:fileId
   */
  updateFile: async (workbookId: WorkbookId, fileId: FileId, dto: UpdateFileDto): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.patch(`/workbooks/${workbookId}/files/${fileId}`, dto);
    } catch (error) {
      handleAxiosError(error, 'Failed to update file');
    }
  },

  /**
   * Delete a file by ID
   * DELETE /workbooks/:workbookId/files/:fileId
   */
  deleteFile: async (workbookId: WorkbookId, fileId: FileId): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.delete(`/workbooks/${workbookId}/files/${fileId}`);
    } catch (error) {
      handleAxiosError(error, 'Failed to delete file');
    }
  },

  /**
   * Copy a file to a target folder
   * POST /workbooks/:workbookId/files/:fileId/copy
   */
  copyFile: async (workbookId: WorkbookId, fileId: FileId, targetFolderId: FolderId | null): Promise<FileRefEntity> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<FileRefEntity>(`/workbooks/${workbookId}/files/${fileId}/copy`, {
        targetFolderId,
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to copy file');
    }
  },
};

/**
 * Folder API endpoints for folder operations
 */
export const foldersApi = {
  /**
   * Create a new folder
   * POST /workbooks/:workbookId/folders
   */
  createFolder: async (workbookId: WorkbookId, dto: CreateFolderDto): Promise<FolderResponseDto> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<FolderResponseDto>(`/workbooks/${workbookId}/folders`, dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to create folder');
    }
  },

  /**
   * Update a folder by ID (rename or move)
   * PATCH /workbooks/:workbookId/folders/:folderId
   */
  updateFolder: async (
    workbookId: WorkbookId,
    folderId: FolderId,
    dto: UpdateFolderDto,
  ): Promise<FolderResponseDto> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.patch<FolderResponseDto>(`/workbooks/${workbookId}/folders/${folderId}`, dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to update folder');
    }
  },

  /**
   * Rename a folder by ID
   */
  renameFolder: async (workbookId: WorkbookId, folderId: FolderId, name: string): Promise<FolderResponseDto> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.patch<FolderResponseDto>(`/workbooks/${workbookId}/folders/${folderId}`, { name });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to rename folder');
    }
  },

  /**
   * Delete a folder by ID
   * DELETE /workbooks/:workbookId/folders/:folderId
   */
  deleteFolder: async (workbookId: WorkbookId, folderId: FolderId): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.delete(`/workbooks/${workbookId}/folders/${folderId}`);
    } catch (error) {
      handleAxiosError(error, 'Failed to delete folder');
    }
  },

  /**
   * Download a file as markdown (public endpoint, no auth required)
   * Security relies on workbook IDs being unguessable
   * GET /workbook/public/:workbookId/files/download?path=path/to/file.md
   */
  downloadFile: (workbookId: WorkbookId, fileId: FileId): void => {
    const url = `${API_CONFIG.getApiUrl()}/workbook/public/${workbookId}/files/download?fileId=${fileId}`;

    // Create a temporary link element to trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  /**
   * Download a folder as a zip file (public endpoint, no auth required)
   * GET /workbook/public/:workbookId/folders/download?folderId=...
   */
  downloadFolder: (workbookId: WorkbookId, folderId: FolderId): void => {
    const url = `${API_CONFIG.getApiUrl()}/workbook/public/${workbookId}/folders/download?folderId=${folderId}`;

    // Create a temporary link element to trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
};
