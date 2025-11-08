import { create } from 'zustand';
import { Snapshot } from '../types/server-entities/snapshot';

export interface SnapshotEditorUIState {
  // The real entities are available with useActiveSnapshot() hook.
  snapshotId: string | null;
  activeTableId: string | null;
  activeCells: ActiveCells | null;
  recordDetailsVisible: boolean;

  tabs: {
    type: 'table';
    tableId: string;
  }[];
}

export interface ActiveCells {
  recordId: string | undefined;
  columnId: string | undefined;
}

type Actions = {
  openSnapshot: (params: { snapshotId: string; tableId?: string; recordId?: string; columnId?: string }) => void;
  closeSnapshot: () => void;
  reconcileWithSnapshot: (snapshot: Snapshot) => void;

  setActiveTableId: (activeTableId: string | null) => void;
  setActiveCells: (activeCells: ActiveCells | null) => void;
};

type SnapshotEditorUIStore = SnapshotEditorUIState & Actions;

const INITIAL_STATE: SnapshotEditorUIState = {
  snapshotId: null,
  activeTableId: null,
  activeCells: null,
  recordDetailsVisible: false,
  tabs: [],
};

export const useSnapshotEditorUIStore = create<SnapshotEditorUIStore>((set, get) => ({
  ...INITIAL_STATE,
  openSnapshot: (params: { snapshotId: string; tableId?: string; recordId?: string; columnId?: string }) =>
    set({
      snapshotId: params.snapshotId,
      activeTableId: params.tableId ?? null,
      activeCells: params.recordId ? { recordId: params.recordId, columnId: params.columnId } : null,
    }),
  closeSnapshot: () => set({ ...INITIAL_STATE }),
  setActiveTableId: (activeTableId: string | null) => set({ activeTableId }),
  setActiveCells: (activeCells: ActiveCells | null) =>
    set({ activeCells, recordDetailsVisible: !!activeCells?.recordId }),

  /**
   * This is called every time the snapshot is updated from the server.
   * Any state that has a dependency on the snapshot's data should be updated here, to clean up any stale state.
   */
  reconcileWithSnapshot: (snapshot: Snapshot) => {
    const current = get();
    const result: Partial<SnapshotEditorUIState> = {};

    if (snapshot.id !== current.snapshotId) {
      return;
    }

    const tablesToRemoveFromTabs = current.tabs
      .map((tab) => ({
        tableId: tab.tableId,
        tableInSnapshot: snapshot.snapshotTables?.find((table) => table.id === tab.tableId),
      }))
      .filter(({ tableInSnapshot }) => tableInSnapshot && tableInSnapshot.hidden === false)
      .map(({ tableId }) => tableId);
    const tablesToAddToTabs = (snapshot.snapshotTables ?? [])
      ?.filter((table) => table.hidden === false && !current.tabs.find((tab) => tab.tableId === table.id))
      .map((t) => t.id);
    if (tablesToRemoveFromTabs.length > 0 || tablesToAddToTabs.length > 0) {
      result['tabs'] = [
        ...current.tabs.filter((tab) => !tablesToRemoveFromTabs.includes(tab.tableId)),
        ...tablesToAddToTabs.map((tableId) => ({ type: 'table' as const, tableId })),
      ];
    }

    // Ensure a table is selected.
    if (!current.activeTableId) {
      const firstTable = snapshot.snapshotTables?.find((table) => table.hidden === false)?.id;
      if (firstTable) {
        result['activeTableId'] = firstTable;
      }
    }

    if (Object.keys(result).length > 0) {
      set(result);
    }
  },
}));
