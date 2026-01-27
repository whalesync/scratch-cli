import { DataFolder, isDataFolderId, isSnapshotTableId, SnapshotTable } from '@spinner/shared-types';
import { useWorkbookEditorUIStore } from '../stores/workbook-editor-store';
import { useWorkbook, UseWorkbookReturn } from './use-workbook';

interface UseActiveWorkbookReturn extends UseWorkbookReturn {
  activeTable: SnapshotTable | DataFolder | undefined;
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

  const activeTable = isSnapshotTableId(activeTab)
    ? hookResult?.workbook?.snapshotTables?.find((table) => table.id === activeTab)
    : isDataFolderId(activeTab)
      ? hookResult?.workbook?.dataFolders?.find((folder) => folder.id === activeTab)
      : undefined;

  return {
    ...hookResult,
    activeTable,
  };
};
