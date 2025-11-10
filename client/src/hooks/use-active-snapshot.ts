import { SnapshotTable } from '@/types/server-entities/snapshot';
import { useSnapshotEditorUIStore } from '../stores/snapshot-editor-store';
import { isSnapshotTableId } from '../types/server-entities/ids';
import { useSnapshot, UseSnapshotReturn } from './use-snapshot';

interface UseActiveSnapshotReturn extends UseSnapshotReturn {
  activeTable: SnapshotTable | undefined;
}

/**
 * Hook for the active snapshot and table in the Editor.
 *
 * UI state is managed in the SnapshotEditorUIStore. This wraps that to provide the data from SWR that is referenced
 * by the UI state.
 */
export const useActiveSnapshot = (): UseActiveSnapshotReturn => {
  const snapshotId = useSnapshotEditorUIStore((state) => state.snapshotId);
  const activeTab = useSnapshotEditorUIStore((state) => state.activeTab);

  const snapshot = useSnapshot(snapshotId);
  const activeTable = isSnapshotTableId(activeTab)
    ? snapshot?.snapshot?.snapshotTables?.find((table) => table.id === activeTab)
    : undefined;

  return {
    ...snapshot,
    activeTable,
  };
};
