import { isUnauthorizedError } from '@/lib/api/error';
import { SWR_KEYS } from '@/lib/api/keys';
import { workbookApi } from '@/lib/api/workbook';
import { CreateDataFolderDto, DataFolder, UpdateWorkbookDto, Workbook, WorkbookId } from '@spinner/shared-types';
import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { dataFolderApi } from '../lib/api/data-folder';

export interface UseWorkbookReturn {
  workbook: Workbook | undefined;
  isLoading: boolean;
  error: Error | undefined;
  refreshWorkbook: () => Promise<void>;
  updateWorkbook: (updateDto: UpdateWorkbookDto) => Promise<void>;
  addLinkedDataFolder: (tableId: string[], folderName: string, connectorAccountId: string) => Promise<DataFolder>;
}

export const useWorkbook = (id: WorkbookId | null): UseWorkbookReturn => {
  const { data, error, isLoading, mutate } = useSWR(
    id ? SWR_KEYS.workbook.detail(id) : null,
    () => (id ? workbookApi.detail(id) : undefined),
    {
      revalidateOnFocus: false,
    },
  );

  const { mutate: globalMutate } = useSWRConfig();

  const refreshWorkbook = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  const updateWorkbook = useCallback(
    async (updateDto: UpdateWorkbookDto): Promise<void> => {
      if (!id) {
        return;
      }
      await workbookApi.update(id, updateDto);
      globalMutate(SWR_KEYS.workbook.list());
      globalMutate(SWR_KEYS.workbook.detail(id));
    },
    [globalMutate, id],
  );

  const addLinkedDataFolder = useCallback(
    async (tableId: string[], folderName: string, connectorAccountId: string): Promise<DataFolder> => {
      if (!id) {
        throw new Error('Workbook not found');
      }

      const dto: CreateDataFolderDto = { tableId, workbookId: id, name: folderName, connectorAccountId };
      const dataFolder = await dataFolderApi.create(dto);
      await mutate();
      return dataFolder;
    },
    [id, mutate],
  );

  return {
    workbook: data,
    isLoading,
    error: displayError,
    // publish,
    refreshWorkbook,
    updateWorkbook,
    addLinkedDataFolder,
  };
};
