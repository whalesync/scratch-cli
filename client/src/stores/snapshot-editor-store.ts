import { create } from 'zustand';
import { SnapshotTableId } from '../types/server-entities/ids';
import { Snapshot } from '../types/server-entities/snapshot';

export interface SnapshotEditorUIState {
  // The real entities are available with useActiveSnapshot() hook.
  snapshotId: string | null;
  activeTab: 'new-tab' | SnapshotTableId | null;
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
  openSnapshot: (params: {
    snapshotId: string;
    tableId?: SnapshotTableId;
    recordId?: string;
    columnId?: string;
  }) => void;
  closeSnapshot: () => void;
  reconcileWithSnapshot: (snapshot: Snapshot) => void;

  setActiveTab: (activeTab: 'new-tab' | SnapshotTableId) => void;
  setActiveCells: (activeCells: ActiveCells | null) => void;
};

type SnapshotEditorUIStore = SnapshotEditorUIState & Actions;

const INITIAL_STATE: SnapshotEditorUIState = {
  snapshotId: null,
  activeTab: null, // Will pick an initial tab in reconcileWithSnapshot.
  activeCells: null,
  recordDetailsVisible: false,
  tabs: [],
};

export const useSnapshotEditorUIStore = create<SnapshotEditorUIStore>((set, get) => ({
  ...INITIAL_STATE,
  openSnapshot: (params: { snapshotId: string; tableId?: SnapshotTableId; recordId?: string; columnId?: string }) =>
    set({
      snapshotId: params.snapshotId,
      activeTab: params.tableId ?? null,
      activeCells: params.recordId ? { recordId: params.recordId, columnId: params.columnId } : null,
    }),
  closeSnapshot: () => set({ ...INITIAL_STATE }),
  setActiveTab: (activeTab: 'new-tab' | SnapshotTableId) => set({ activeTab }),
  setActiveCells: (activeCells: ActiveCells | null) =>
    set({ activeCells, recordDetailsVisible: !!activeCells?.recordId }),

  /**
   * This is called every time the snapshot is updated from the server.
   * Any state that has a dependency on the snapshot's data should be updated here, to clean up any stale state.
   */
  reconcileWithSnapshot: (snapshot: Snapshot) => {
    const current = get();
    const changes: Partial<SnapshotEditorUIState> = {};

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
      changes['tabs'] = [
        ...current.tabs.filter((tab) => !tablesToRemoveFromTabs.includes(tab.tableId)),
        ...tablesToAddToTabs.map((tableId) => ({ type: 'table' as const, tableId })),
      ];
    }

    // Ensure a tab is selected.
    if (!current.activeTab) {
      const firstTab = snapshot.snapshotTables?.find((table) => table.hidden === false);
      changes['activeTab'] = firstTab?.id ?? 'new-tab';
    }

    if (Object.keys(changes).length > 0) {
      set(changes);
    }
  },
}));
