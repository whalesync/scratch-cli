import { create } from 'zustand';

interface SnapshotEditorUIState {
  // The real entities are available with useActiveSnapshot() hook.
  snapshotId: string | null;
  activeTableId: string | null;
  activeCells: ActiveCells | null;
  recordDetailsVisible: boolean;
}

export interface ActiveCells {
  recordId: string | undefined;
  columnId: string | undefined;
}

type Actions = {
  openSnapshot: (params: { snapshotId: string; tableId?: string; recordId?: string; columnId?: string }) => void;
  closeSnapshot: () => void;
  setActiveTableId: (activeTableId: string | null) => void;
  setActiveCells: (activeCells: ActiveCells | null) => void;
};

type SnapshotEditorUIStore = SnapshotEditorUIState & Actions;

const INITIAL_STATE: SnapshotEditorUIState = {
  snapshotId: null,
  activeTableId: null,
  activeCells: null,
  recordDetailsVisible: false,
};

export const useSnapshotEditorUIStore = create<SnapshotEditorUIStore>((set) => ({
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

  // TODO: Method to reconcile with new Snapshot.
}));
