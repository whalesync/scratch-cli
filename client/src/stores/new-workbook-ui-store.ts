import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NewWorkbookUIState {
  // Selection state is URL-driven (from route params), not stored here
  expandedNodes: Set<string>;
  sidebarWidth: number;
  tableFilters: Record<string, string>; // folderId -> filter text
}

type Actions = {
  toggleNode: (nodeId: string) => void;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  expandAll: (nodeIds: string[]) => void;
  collapseAll: () => void;
  setSidebarWidth: (width: number) => void;
  setTableFilter: (folderId: string, filter: string) => void;
  clearTableFilter: (folderId: string) => void;
  reset: () => void;
};

type NewWorkbookUIStore = NewWorkbookUIState & Actions;

const INITIAL_STATE: NewWorkbookUIState = {
  expandedNodes: new Set<string>(),
  sidebarWidth: 320,
  tableFilters: {},
};

export const useNewWorkbookUIStore = create<NewWorkbookUIStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      toggleNode: (nodeId: string) => {
        const { expandedNodes } = get();
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(nodeId)) {
          newExpanded.delete(nodeId);
        } else {
          newExpanded.add(nodeId);
        }
        set({ expandedNodes: newExpanded });
      },

      expandNode: (nodeId: string) => {
        const { expandedNodes } = get();
        const newExpanded = new Set(expandedNodes);
        newExpanded.add(nodeId);
        set({ expandedNodes: newExpanded });
      },

      collapseNode: (nodeId: string) => {
        const { expandedNodes } = get();
        const newExpanded = new Set(expandedNodes);
        newExpanded.delete(nodeId);
        set({ expandedNodes: newExpanded });
      },

      expandAll: (nodeIds: string[]) => {
        set({ expandedNodes: new Set(nodeIds) });
      },

      collapseAll: () => {
        set({ expandedNodes: new Set() });
      },

      setSidebarWidth: (width: number) => {
        // Clamp between 220 and 500
        const clampedWidth = Math.min(500, Math.max(220, width));
        set({ sidebarWidth: clampedWidth });
      },

      setTableFilter: (folderId: string, filter: string) => {
        const { tableFilters } = get();
        set({ tableFilters: { ...tableFilters, [folderId]: filter } });
      },

      clearTableFilter: (folderId: string) => {
        const { tableFilters } = get();
        const newFilters = { ...tableFilters };
        delete newFilters[folderId];
        set({ tableFilters: newFilters });
      },

      reset: () => {
        set(INITIAL_STATE);
      },
    }),
    {
      name: 'new-workbook-ui-store',
      // Custom serialization for Set
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          return {
            ...parsed,
            state: {
              ...parsed.state,
              expandedNodes: new Set(parsed.state.expandedNodes || []),
            },
          };
        },
        setItem: (name, value) => {
          const toStore = {
            ...value,
            state: {
              ...value.state,
              expandedNodes: Array.from(value.state.expandedNodes || []),
            },
          };
          localStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);
