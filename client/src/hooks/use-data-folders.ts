import { SWR_KEYS } from '@/lib/api/keys';
import { workbookApi } from '@/lib/api/workbook';
import { DataFolderGroup } from '@spinner/shared-types';
import { useCallback } from 'react';
import useSWR from 'swr';
import { useActiveWorkbook } from './use-active-workbook';

export interface UseDataFoldersReturn {
  dataFolders: DataFolderGroup[];
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => Promise<void>;
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

  return {
    dataFolders: data ?? [],
    isLoading,
    error,
    refresh,
  };
};
