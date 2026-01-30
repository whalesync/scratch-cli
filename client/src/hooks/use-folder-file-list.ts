import { isUnauthorizedError } from '@/lib/api/error';
import { filesApi } from '@/lib/api/files';
import { SWR_KEYS } from '@/lib/api/keys';
import { DataFolderId, FileOrFolderRefEntity, WorkbookId } from '@spinner/shared-types';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

export interface UseFolderFileListReturn {
  files: FileOrFolderRefEntity[];
  isLoading: boolean;
  error: Error | undefined;
  refreshFiles: () => Promise<void>;
}

/**
 * Hook for getting all the file contents for a folder
 * @param workbookId - The workbook ID to scope the file operations to
 * @param path - path of the root folder to get files from
 */
export const useFolderFileList = (
  workbookId: WorkbookId | null,
  folderId: DataFolderId | null,
): UseFolderFileListReturn => {
  const { data, error, isLoading, mutate } = useSWR(
    workbookId && folderId ? SWR_KEYS.files.listByFolder(workbookId, folderId) : null,
    () => (workbookId && folderId ? filesApi.listFilesByFolder(workbookId, folderId) : undefined),
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
    files: data?.items ?? [],
    isLoading,
    error: displayError,
    refreshFiles,
  };
};
