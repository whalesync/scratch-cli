import { SWR_KEYS } from '@/lib/api/keys';
import { workbookApi } from '@/lib/api/workbook';
import { DataFolderGroup, DataFolderId } from '@spinner/shared-types';
import { useCallback } from 'react';
import useSWR from 'swr';
import { dataFolderApi } from '../lib/api/data-folder';
import { useActiveWorkbook } from './use-active-workbook';

export interface UseDataFoldersReturn {
  dataFolders: DataFolderGroup[];
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => Promise<void>;
  deleteFolder: (dataFolderId: DataFolderId) => Promise<void>;
}

/**
 * Hook for fetching data folders for the active workbook.
 * Uses SWR for caching and automatic revalidation.
 */
export const useDataFolders = (): UseDataFoldersReturn => {
  const { workbook } = useActiveWorkbook();
  const workbookId = workbook?.id ?? null;

  const { data, error, isLoading, mutate } = useSWR(
    workbookId ? SWR_KEYS.dataFolders.list(workbookId) : null,
    () => (workbookId ? workbookApi.listDataFolders(workbookId) : undefined),
    {
      revalidateOnFocus: false,
    },
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const deleteFolder = useCallback(
    async (dataFolderId: DataFolderId) => {
      if (!workbookId) return;
      await dataFolderApi.delete(dataFolderId);
      await mutate();
    },
    [workbookId, mutate],
  );

  return {
    dataFolders: data ?? [],
    isLoading,
    error,
    refresh,
    deleteFolder,
  };
};
