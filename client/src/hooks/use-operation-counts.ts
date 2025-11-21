import { workbookApi } from '@/lib/api/workbook';
import { WorkbookId } from '@/types/server-entities/ids';
import useSWR from 'swr';
import { SWR_KEYS } from '../lib/api/keys';

export type OperationCounts = {
  tableId: string;
  creates: number;
  updates: number;
  deletes: number;
}[];

export const useOperationCounts = (
  workbookId: WorkbookId | null,
): {
  operationCounts: OperationCounts | undefined;
  isLoading: boolean;
  error: Error | undefined;
} => {
  const { data, error, isLoading } = useSWR(
    workbookId ? SWR_KEYS.operationCounts.get(workbookId) : null,
    () => (workbookId ? workbookApi.getOperationCounts(workbookId) : undefined),
    {
      revalidateOnFocus: true,
    },
  );

  return {
    operationCounts: data,
    isLoading,
    error,
  };
};
