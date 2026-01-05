import { isUnauthorizedError } from '@/lib/api/error';
import { filesApi } from '@/lib/api/files';
import { SWR_KEYS } from '@/lib/api/keys';
import { ListFilesDetailsResponseDto, WorkbookId } from '@spinner/shared-types';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

export interface UseFileDetailsListReturn {
  files: ListFilesDetailsResponseDto | undefined;
  isLoading: boolean;
  error: Error | undefined;
  refreshFiles: () => Promise<void>;
}

/**
 * Hook for managing file details list operations within a workbook
 * Returns files with full content, original content, and suggested content
 * @param workbookId - The workbook ID to scope the file operations to
 * @param folderPath - Optional folder path to list files from
 */
export const useFileDetailsList = (
  workbookId: WorkbookId | null,
  folderPath?: string,
): UseFileDetailsListReturn => {
  const { data, error, isLoading, mutate } = useSWR(
    workbookId ? SWR_KEYS.files.listDetails(workbookId, folderPath) : null,
    () => (workbookId ? filesApi.listFilesDetails(workbookId, folderPath) : undefined),
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

