import { SWR_KEYS } from '@/lib/api/keys';
import { dataFolderApi } from '@/lib/api/data-folder';
import { DataFolderId, DataFolderFileRef } from '@spinner/shared-types';
import { useCallback } from 'react';
import useSWR from 'swr';

export interface UseDataFolderFilesReturn {
  files: DataFolderFileRef[];
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching files within a data folder.
 * Uses SWR for caching and automatic revalidation.
 */
export const useDataFolderFiles = (
  dataFolderId: DataFolderId | null,
  limit?: number,
  offset?: number,
): UseDataFolderFilesReturn => {
  const { data, error, isLoading, mutate } = useSWR(
    dataFolderId ? SWR_KEYS.dataFolders.files(dataFolderId, limit, offset) : null,
    () => (dataFolderId ? dataFolderApi.listFiles(dataFolderId, limit, offset) : undefined),
    {
      revalidateOnFocus: false,
    },
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    files: data?.files ?? [],
    isLoading,
    error,
    refresh,
  };
};
