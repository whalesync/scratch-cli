import { workbookApi } from '@/lib/api/workbook';
import { WorkbookId } from '@/types/server-entities/ids';
import { useCallback, useState } from 'react';

export type OperationCounts = {
  tableId: string;
  creates: number;
  updates: number;
  deletes: number;
}[];

export const useOperationCounts = (workbookId: WorkbookId | null) => {
  const [operationCounts, setOperationCounts] = useState<OperationCounts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!workbookId) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await workbookApi.getOperationCounts(workbookId);
      setOperationCounts(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [workbookId]);

  return {
    operationCounts,
    isLoading,
    error,
    fetchCounts,
  };
};
