import { SnapshotTable } from '@/types/server-entities/workbook';
import { useMemo } from 'react';
import { useWorkbookEditorUIStore } from '../stores/workbook-editor-store';
import { isSnapshotTableId } from '../types/server-entities/ids';
import { useWorkbook, UseWorkbookReturn } from './use-workbook';

interface UseActiveWorkbookReturn extends UseWorkbookReturn {
  activeTable: SnapshotTable | undefined;
}

/**
 * Hook for the active snapshot and table in the Editor.
 *
 * UI state is managed in the SnapshotEditorUIStore. This wraps that to provide the data from SWR that is referenced
 * by the UI state.
 */
export const useActiveWorkbook = (): UseActiveWorkbookReturn => {
  const workbookId = useWorkbookEditorUIStore((state) => state.workbookId);
  const activeTab = useWorkbookEditorUIStore((state) => state.activeTab);

  const hookResult = useWorkbook(workbookId);

  // If the workbook table list changes we need to recalculate the active table and make sure we are
  // using the latest version of the SnapshotTable object
  const activeTable = useMemo(
    () =>
      isSnapshotTableId(activeTab)
        ? hookResult?.workbook?.snapshotTables?.find((table) => table.id === activeTab)
        : undefined,
    [activeTab, hookResult?.workbook?.snapshotTables],
  );

  return {
    ...hookResult,
    activeTable,
  };
};
