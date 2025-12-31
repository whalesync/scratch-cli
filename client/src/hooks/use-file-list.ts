import { isUnauthorizedError } from '@/lib/api/error';
import { filesApi } from '@/lib/api/files';
import { SWR_KEYS } from '@/lib/api/keys';
import { ListFilesResponseDto, WorkbookId } from '@spinner/shared-types';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

export interface UseFileListReturn {
  files: ListFilesResponseDto | undefined;
  isLoading: boolean;
  error: Error | undefined;
  refreshFiles: () => Promise<void>;
  // Future: methods for moving files around the tree
}

/**
 * Hook for managing file list operations within a workbook
 * @param workbookId - The workbook ID to scope the file operations to
 * @param folderPath - Optional folder path to list files from
 */
export const useFileList = (workbookId: WorkbookId | null, folderPath?: string): UseFileListReturn => {
  const { data, error, isLoading, mutate } = useSWR(
    workbookId ? SWR_KEYS.files.list(workbookId, folderPath) : null,
    () => (workbookId ? filesApi.listFilesAndFolders(workbookId, folderPath) : undefined),
    {
      revalidateOnFocus: false,
    },
  );

  const refreshFiles = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  return {
    files: data,
    isLoading,
    error: displayError,
    refreshFiles,
  };
};
