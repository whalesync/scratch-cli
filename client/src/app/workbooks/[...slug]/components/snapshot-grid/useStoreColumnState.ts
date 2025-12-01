import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { ColumnState, GridApi } from 'ag-grid-community';
import { useCallback, useEffect, useState } from 'react';

export const useStoreColumnState = (
  workbookId: string,
  tableId: string,
  gridApi: GridApi<ProcessedSnapshotRecord> | null,
) => {
  const [columnState, setColumnState] = useState<ColumnState[]>([]);
  const [mounted, setMounted] = useState(false);
  const storageKey = `ag-grid-column-state-${workbookId}-${tableId}`;

  useEffect(() => {
    setMounted(true);

    // Load saved column state from localStorage
    const savedState = localStorage.getItem(storageKey);
    if (savedState) {
      try {
        const parsedState: ColumnState[] = JSON.parse(savedState);
        setColumnState(parsedState);
      } catch (error) {
        console.warn('Failed to parse saved column state:', error);
      }
    }
  }, [storageKey]);

  // Save column state to localStorage when it changes
  const onColumnStateChanged = useCallback(() => {
    if (gridApi) {
      const newState = gridApi.getColumnState();
      localStorage.setItem(storageKey, JSON.stringify(newState));
    }
  }, [gridApi, storageKey]);

  // Clear column state from localStorage and reset grid
  const clearColumnState = useCallback(() => {
    localStorage.removeItem(storageKey);
    setColumnState([]);
    if (gridApi) {
      gridApi.resetColumnState();
    }
  }, [gridApi, storageKey]);

  return { columnState, setColumnState, mounted, onColumnStateChanged, clearColumnState };
};
