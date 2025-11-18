import { isUnauthorizedError } from '@/lib/api/error';
import { SWR_KEYS } from '@/lib/api/keys';
import { workbookApi } from '@/lib/api/workbook';
import { CreateWorkbookDto, UpdateWorkbookDto, Workbook } from '@/types/server-entities/workbook';
import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { WorkbookId } from '../types/server-entities/ids';

export interface UseWorkbooksReturn {
  workbooks: Workbook[] | undefined;
  isLoading: boolean;
  error: Error | undefined;
  createWorkbook: (dto: CreateWorkbookDto) => Promise<Workbook>;
  updateWorkbook: (id: WorkbookId, updateDto: UpdateWorkbookDto) => Promise<Workbook>;
  deleteWorkbook: (id: WorkbookId) => Promise<void>;
  refreshWorkbooks: () => Promise<void>;
}

export const useWorkbooks = (connectorAccountId?: string): UseWorkbooksReturn => {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(SWR_KEYS.workbook.list(), () => workbookApi.list(connectorAccountId), {
    refreshInterval: 10000,
    revalidateOnReconnect: true,
  });

  const createWorkbook = useCallback(
    async (dto: CreateWorkbookDto): Promise<Workbook> => {
      const newWorkbook = await workbookApi.create(dto);
      mutate(SWR_KEYS.workbook.list());
      return newWorkbook;
    },
    [mutate],
  );

  const updateWorkbook = useCallback(
    async (id: WorkbookId, updateDto: UpdateWorkbookDto): Promise<Workbook> => {
      const updatedWorkbook = await workbookApi.update(id, updateDto);
      mutate(SWR_KEYS.workbook.list());
      mutate(SWR_KEYS.workbook.detail(id));
      return updatedWorkbook;
    },
    [mutate],
  );

  const deleteWorkbook = useCallback(
    async (id: WorkbookId): Promise<void> => {
      await workbookApi.delete(id);
      mutate(SWR_KEYS.workbook.list());
    },
    [mutate],
  );

  const refreshWorkbooks = useCallback(async () => {
    await mutate(SWR_KEYS.workbook.list());
  }, [mutate]);

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  return {
    workbooks: data,
    isLoading,
    error: displayError,
    createWorkbook,
    updateWorkbook,
    deleteWorkbook,
    refreshWorkbooks,
  };
};
