import { dataFolderApi } from '@/lib/api/data-folder';
import { SWR_KEYS } from '@/lib/api/keys';
import { DataFolderFileRef, DataFolderId, FileId } from '@spinner/shared-types';
import { useCallback } from 'react';
import useSWR from 'swr';

export interface UseDataFolderFilesReturn {
  files: DataFolderFileRef[];
  totalCount: number;
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => Promise<void>;
  deleteFile: (fileId: FileId) => Promise<void>;
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

  const deleteFile = useCallback(
    async (fileId: FileId) => {
      if (!dataFolderId) return;
      await dataFolderApi.deleteFile(dataFolderId, fileId);
      mutate();
    },
    [dataFolderId, mutate],
  );

  return {
    files: data?.files ?? [],
    totalCount: data?.totalCount ?? 0,
    isLoading,
    error,
    refresh,
    deleteFile,
  };
};
