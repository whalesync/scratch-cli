import { SWR_KEYS } from '@/lib/api/keys';
import { dataFolderApi } from '@/lib/api/data-folder';
import { DataFolder, DataFolderId } from '@spinner/shared-types';
import { useCallback } from 'react';
import useSWR from 'swr';

export interface UseDataFolderReturn {
  dataFolder: DataFolder | undefined;
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching a single data folder by ID.
 * Uses SWR for caching and automatic revalidation.
 */
export const useDataFolder = (dataFolderId: DataFolderId | null): UseDataFolderReturn => {
  const { data, error, isLoading, mutate } = useSWR(
    dataFolderId ? SWR_KEYS.dataFolders.detail(dataFolderId) : null,
    () => (dataFolderId ? dataFolderApi.findOne(dataFolderId) : undefined),
    {
      revalidateOnFocus: false,
    },
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    dataFolder: data,
    isLoading,
    error,
    refresh,
  };
};
