import { SWR_KEYS } from '@/lib/api/keys';
import { workbookApi } from '@/lib/api/workbook';
import { DataFolderPublishStatus, WorkbookId } from '@spinner/shared-types';
import useSWR from 'swr';

export const useDataFolderPublishStatus = (
  workbookId: WorkbookId | null,
): {
  publishStatus: DataFolderPublishStatus[] | undefined;
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => void;
} => {
  const { data, error, isLoading, mutate } = useSWR(
    workbookId ? SWR_KEYS.dataFolders.publishStatus(workbookId) : null,
    () => (workbookId ? workbookApi.getDataFoldersPublishStatus(workbookId) : undefined),
    {
      revalidateOnFocus: true,
    },
  );

  return {
    publishStatus: data,
    isLoading,
    error,
    refresh: () => mutate(),
  };
};
