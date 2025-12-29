import { RouteUrls } from '@/utils/route-urls';
import { SnapshotTable, SnapshotTableId, Workbook, WorkbookId } from '@spinner/shared-types';
import { create } from 'zustand';

// Transient ID for a tab that doesn't have a table yet.
// This isn't persisted or saved between sessions.
export type NewTabId = `new-tab-${string}` | 'new';

export type NewTabState = {
  type: 'new-tab';
  id: NewTabId;
  // TODO Add the current state of the UI in the tab.
};

export type TableTabState = {
  type: 'table';
  id: SnapshotTableId;
  // TODO Add all current state of the UI in the tab that's not stored in the workbook.
};

export type TabId = NewTabId | SnapshotTableId;
export type TabState = NewTabState | TableTabState;

export type RecordViewType = 'details' | 'md';

export type ActiveCells = {
  recordId: string | undefined;
  columnId: string | undefined;
  viewType?: RecordViewType;
};

export enum WorkbookModals {
  CREATE_SCRATCH_COLUMN = 'create_scratch_column',
  KEYBOARD_SHORTCUT_HELP = 'keyboard_shortcut_help',
  RENAME_WORKBOOK = 'rename_workbook',
  CONFIRM_DELETE = 'confirm-delete',
  CONFIRM_REFRESH_SOURCE = 'confirm-refresh-source',
}

export type WorkbookModalParams =
  | { type: WorkbookModals.CREATE_SCRATCH_COLUMN; tableId: SnapshotTableId }
  | { type: WorkbookModals.KEYBOARD_SHORTCUT_HELP }
  | { type: WorkbookModals.RENAME_WORKBOOK }
  | {
      type: WorkbookModals.CONFIRM_DELETE;
      workbookId: WorkbookId /** Provide explicitly to be safe from race conditions */;
    }
  | {
      type: WorkbookModals.CONFIRM_REFRESH_SOURCE;
    };

export interface WorkbookEditorUIState {
  // The real entities are available with useActiveWorkbook() hook.
  workbookId: WorkbookId | null;
  activeTab: TabId | null;
  activeCells: ActiveCells | null;
  recordDetailsVisible: boolean;

  tabs: (TableTabState | NewTabState)[];

  // UI state for the dev tools panel.
  devToolsOpen: boolean;

  // UI state for the chat panel.
  chatOpen: boolean;

  // UI state for the publish confirmation modal.
  publishConfirmationOpen: boolean;

  activeModal: WorkbookModalParams | null;
}

type Actions = {
  openWorkbook: (params: {
    workbookId: WorkbookId;
    tableId?: SnapshotTableId;
    recordId?: string;
    columnId?: string;
  }) => void;
  closeWorkbook: () => void;
  reconcileWithWorkbook: (workbook: Workbook) => void;

  setActiveTab: (activeTab: TabId) => void;
  setActiveCells: (activeCells: ActiveCells | null) => void;

  openNewBlankTab: () => void;
  closeTab: (id: TabId) => void;
  closeNewTabs: () => void;

  openDevTools: () => void;
  closeDevTools: () => void;

  openChat: () => void;
  closeChat: () => void;

  openPublishConfirmation: () => void;
  closePublishConfirmation: () => void;

  showModal: (modal: WorkbookModalParams) => void;
  dismissModal: (modalType: WorkbookModalParams['type']) => void;
};

type WorkbookEditorUIStore = WorkbookEditorUIState & Actions;

const INITIAL_STATE: WorkbookEditorUIState = {
  workbookId: null,
  activeTab: null, // Will pick an initial tab in reconcileWithWorkbook.
  activeCells: null,
  recordDetailsVisible: false,
  tabs: [],
  devToolsOpen: false,
  chatOpen: true,
  publishConfirmationOpen: false,
  activeModal: null,
};

export const useWorkbookEditorUIStore = create<WorkbookEditorUIStore>((set, get) => ({
  ...INITIAL_STATE,
  openWorkbook: (params: { workbookId: WorkbookId; tableId?: TabId; recordId?: string; columnId?: string }) => {
    set({
      workbookId: params.workbookId,
      activeTab: params.tableId ?? null,
      activeCells: params.recordId ? { recordId: params.recordId, columnId: params.columnId } : null,
    });
  },
  closeWorkbook: () => {
    set({ ...INITIAL_STATE });
  },
  setActiveTab: (activeTab: TabId) => {
    set({ activeTab });
    RouteUrls.updateWorkbookPath(get().workbookId ?? '', activeTab);
  },
  setActiveCells: (activeCells: ActiveCells | null) => {
    const current = get();
    set({ activeCells, recordDetailsVisible: !!activeCells?.recordId });
    RouteUrls.updateWorkbookPath(
      current.workbookId ?? '',
      current.activeTab || undefined,
      activeCells?.recordId,
      activeCells?.columnId,
    );
  },
  openNewBlankTab: () => {
    const newTab = newBlankTab();
    set({ tabs: [...get().tabs, newTab], activeTab: newTab.id });
    RouteUrls.updateWorkbookPath(get().workbookId ?? '', newTab.id);
  },
  closeTab: (id: TabId) => {
    const fixedTabs = closeTabAndFixActiveTab(id, get().tabs, get().activeTab);
    set({ ...fixedTabs });
    RouteUrls.updateWorkbookPath(get().workbookId ?? '', fixedTabs.activeTab || undefined);
  },
  closeNewTabs: () => {
    const tabs = get().tabs.filter((tab) => tab.type !== 'new-tab');
    set({ tabs });
    RouteUrls.updateWorkbookPath(get().workbookId ?? '', tabs.length > 0 ? tabs[0].id : undefined);
  },

  openDevTools: () => set({ devToolsOpen: true }),
  closeDevTools: () => set({ devToolsOpen: false }),

  openChat: () => set({ chatOpen: true }),
  closeChat: () => set({ chatOpen: false }),

  openPublishConfirmation: () => set({ publishConfirmationOpen: true }),
  closePublishConfirmation: () => set({ publishConfirmationOpen: false }),

  showModal: (modal: WorkbookModalParams) => set({ activeModal: modal }),
  dismissModal: (modalType: WorkbookModalParams['type'] | null) => {
    if (modalType && modalType !== get().activeModal?.type) {
      return;
    }
    set({ activeModal: null });
  },
  /**
   * This is called every time the workbook is updated from the server.
   * Any state that has a dependency on the workbook's data should be updated here, to clean up any stale state.
   */
  reconcileWithWorkbook: (workbook: Workbook) => {
    const current = get();

    if (workbook.id !== current.workbookId) {
      return;
    }

    const changes: Partial<WorkbookEditorUIState> = reconcileOpenTabs(
      workbook.id,
      current.tabs,
      workbook.snapshotTables ?? [],
      current.activeTab,
    );

    set(changes);
  },
}));

function reconcileOpenTabs(
  workbookId: WorkbookId,
  tabs: TabState[],
  snapshotTables: SnapshotTable[],
  activeTab: TabId | null,
): { tabs: TabState[]; activeTab: TabId | null } {
  let result = { tabs: [...tabs], activeTab };

  // Close tabs that no longer exist in the workbook.
  for (const existingTab of result.tabs) {
    if (
      existingTab.type === 'table' &&
      !snapshotTables.find((table) => table.id === existingTab.id && table.hidden === false)
    ) {
      result = closeTabAndFixActiveTab(existingTab.id, result.tabs, result.activeTab);
    }
  }

  // Add tabs that exist in the workbook but not in the current tabs.
  const missingTables = snapshotTables.filter(
    (table) => table.hidden === false && !result.tabs.find((tab) => tab.id === table.id),
  );
  result.tabs = result.tabs.concat(missingTables.map((table) => ({ type: 'table' as const, id: table.id })));

  // Add a new blank tab if there are no tables open.
  if (result.tabs.length === 0) {
    const newTab = newBlankTab();
    result = { tabs: [newTab], activeTab: newTab.id };
  } else if (activeTab === 'new') {
    // external link to a new tab
    const newTab = newBlankTab();
    result = { tabs: [...result.tabs, newTab], activeTab: newTab.id };
  }

  // Ensure there is a valid active tab.
  if (!result.activeTab || !result.tabs.find((tab) => tab.id === result.activeTab)) {
    result.activeTab = result.tabs[0]?.id ?? null;
    // set the path to the first tab
    RouteUrls.updateWorkbookPath(workbookId, result.activeTab || undefined);
  }

  return result;
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
