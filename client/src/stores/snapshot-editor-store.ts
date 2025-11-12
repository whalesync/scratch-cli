import { create } from 'zustand';
import { SnapshotId, SnapshotTableId } from '../types/server-entities/ids';
import { Snapshot, SnapshotTable } from '../types/server-entities/snapshot';

// Transient ID for a tab that doesn't have a table yet.
// This isn't persisted or saved between sessions.
export type NewTabId = `new-tab-${string}`;

export type NewTabState = {
  type: 'new-tab';
  id: NewTabId;
  // TODO Add the current state of the UI in the tab.
};

export type TableTabState = {
  type: 'table';
  id: SnapshotTableId;
  // TODO Add all current state of the UI in the tab that's not stored in the snapshot.
};

export type TabId = NewTabId | SnapshotTableId;
export type TabState = NewTabState | TableTabState;

export type ActiveCells = {
  recordId: string | undefined;
  columnId: string | undefined;
};

export interface SnapshotEditorUIState {
  // The real entities are available with useActiveSnapshot() hook.
  snapshotId: SnapshotId | null;
  activeTab: TabId | null;
  activeCells: ActiveCells | null;
  recordDetailsVisible: boolean;

  tabs: (TableTabState | NewTabState)[];
}

type Actions = {
  openSnapshot: (params: {
    snapshotId: SnapshotId;
    tableId?: SnapshotTableId;
    recordId?: string;
    columnId?: string;
  }) => void;
  closeSnapshot: () => void;
  reconcileWithSnapshot: (snapshot: Snapshot) => void;

  setActiveTab: (activeTab: TabId) => void;
  setActiveCells: (activeCells: ActiveCells | null) => void;

  openNewBlankTab: () => void;
  closeTab: (id: TabId) => void;
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
  openSnapshot: (params: { snapshotId: SnapshotId; tableId?: SnapshotTableId; recordId?: string; columnId?: string }) =>
    set({
      snapshotId: params.snapshotId,
      activeTab: params.tableId ?? null,
      activeCells: params.recordId ? { recordId: params.recordId, columnId: params.columnId } : null,
    }),
  closeSnapshot: () => set({ ...INITIAL_STATE }),
  setActiveTab: (activeTab: TabId) => set({ activeTab }),
  setActiveCells: (activeCells: ActiveCells | null) =>
    set({ activeCells, recordDetailsVisible: !!activeCells?.recordId }),
  openNewBlankTab: () => {
    const newTab = newBlankTab();
    set({ tabs: [...get().tabs, newTab], activeTab: newTab.id });
  },
  closeTab: (id: TabId) => {
    set({ ...closeTabAndFixActiveTab(id, get().tabs, get().activeTab) });
  },

  /**
   * This is called every time the snapshot is updated from the server.
   * Any state that has a dependency on the snapshot's data should be updated here, to clean up any stale state.
   */
  reconcileWithSnapshot: (snapshot: Snapshot) => {
    const current = get();

    if (snapshot.id !== current.snapshotId) {
      return;
    }

    const changes: Partial<SnapshotEditorUIState> = reconcileOpenTabs(
      current.tabs,
      snapshot.snapshotTables ?? [],
      current.activeTab,
    );

    set(changes);
  },
}));

function reconcileOpenTabs(
  tabs: TabState[],
  snapshotTables: SnapshotTable[],
  activeTab: TabId | null,
): { tabs: TabState[]; activeTab: TabId | null } {
  let result = { tabs: [...tabs], activeTab };

  // Close tabs that no longer exist in the snapshot.
  for (const existingTab of result.tabs) {
    if (
      existingTab.type === 'table' &&
      !snapshotTables.find((table) => table.id === existingTab.id && table.hidden === false)
    ) {
      result = closeTabAndFixActiveTab(existingTab.id, result.tabs, result.activeTab);
    }
  }

  // Add tabs that exist in the snapshot but not in the current tabs.
  const missingTables = snapshotTables.filter(
    (table) => table.hidden === false && !result.tabs.find((tab) => tab.id === table.id),
  );
  result.tabs = result.tabs.concat(missingTables.map((table) => ({ type: 'table' as const, id: table.id })));

  // Add a new blank tab if there are no tables open.
  if (result.tabs.length === 0) {
    const newTab = newBlankTab();
    result = { tabs: [newTab], activeTab: newTab.id };
  }
  return { tabs: result.tabs, activeTab: result.activeTab };
}

function newBlankTab(): TabState {
  return { type: 'new-tab', id: `new-tab-${Date.now()}` };
}

function closeTabAndFixActiveTab(
  id: TabId,
  tabs: TabState[],
  activeTab: TabId | null,
): { tabs: TabState[]; activeTab: TabId | null } {
  let newActiveTab = activeTab;
  if (activeTab === id) {
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index !== -1) {
      newActiveTab = tabs[index + 1]?.id ?? tabs[index - 1]?.id ?? null;
    }
  }
  return { tabs: tabs.filter((tab) => tab.id !== id), activeTab: newActiveTab };
}
