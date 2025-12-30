import {
  CreateFileDto,
  FileDetailsResponseDto,
  ListFilesResponseDto,
  UpdateFileDto,
  WorkbookId,
} from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

/**
 * File API endpoints for file-based workbook operations
 * All operations now use full file paths instead of IDs
 */
export const filesApi = {
  /**
   * List files and folders in a directory (tree structure)
   * GET /workbooks/:workbookId/files/list?path=path/to/folder
   */
  listFilesAndFolders: async (workbookId: WorkbookId, folderPath?: string): Promise<ListFilesResponseDto> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const params = folderPath ? { path: folderPath } : {};
      const res = await axios.get<ListFilesResponseDto>(`/workbooks/${workbookId}/files/list`, { params });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to list files and folders');
    }
  },

  /**
   * Get a single file by path
   * GET /workbooks/:workbookId/files/file?path=path/to/file.md
   */
  getFile: async (workbookId: WorkbookId, filePath: string): Promise<FileDetailsResponseDto> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<FileDetailsResponseDto>(`/workbooks/${workbookId}/files/file`, {
        params: { path: filePath },
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch file');
    }
  },

  /**
   * Create a new file
   * POST /workbooks/:workbookId/files with path in body
   */
  createFile: async (workbookId: WorkbookId, dto: CreateFileDto): Promise<{ path: string }> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<{ path: string }>(`/workbooks/${workbookId}/files`, dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to create file');
    }
  },

  /**
   * Update an existing file by path
   * PATCH /workbooks/:workbookId/files/file?path=path/to/file.md
   */
  updateFile: async (workbookId: WorkbookId, filePath: string, dto: UpdateFileDto): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.patch(`/workbooks/${workbookId}/files/file`, dto, {
        params: { path: filePath },
      });
    } catch (error) {
      handleAxiosError(error, 'Failed to update file');
    }
  },

  /**
   * Delete a file by path
   * DELETE /workbooks/:workbookId/files/file?path=path/to/file.md
   */
  deleteFile: async (workbookId: WorkbookId, filePath: string): Promise<void> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      await axios.delete(`/workbooks/${workbookId}/files/file`, {
        params: { path: filePath },
      });
    } catch (error) {
      handleAxiosError(error, 'Failed to delete file');
    }
  },

  /**
   * Rename a folder and update all files within it
   * POST /workbooks/:workbookId/files/rename-folder
   */
  renameFolder: async (workbookId: WorkbookId, oldPath: string, newPath: string): Promise<{ filesUpdated: number }> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<{ filesUpdated: number }>(`/workbooks/${workbookId}/files/rename-folder`, {
        oldPath,
        newPath,
      });
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to rename folder');
    }
  },
};
