import { SnapshotTable } from '@/types/server-entities/snapshot';
import { useSnapshotEditorUIStore } from '../stores/snapshot-editor-store';
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
  const activeTableId = useSnapshotEditorUIStore((state) => state.activeTableId);

  const snapshot = useSnapshot(snapshotId);
  const activeTable = snapshot?.snapshot?.snapshotTables?.find((table) => table.id === activeTableId);

  return {
    ...snapshot,
    activeTable,
  };
};
