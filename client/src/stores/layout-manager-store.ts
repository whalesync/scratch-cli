import { create } from "zustand";

type State = {
    rightPanelOpened: boolean;
}


type Actions = {
    setRightPanelOpened: (rightPanelOpened: boolean) => void;
    toggleRightPanel: () => void;
}

type LayoutManagerStore = State & Actions;

export const useLayoutManagerStore = create<LayoutManagerStore>((set) => ({
  rightPanelOpened: true,
  setRightPanelOpened: (rightPanelOpened: boolean) => set({ rightPanelOpened }),
  toggleRightPanel: () => set((state) => ({ rightPanelOpened: !state.rightPanelOpened })),
}));