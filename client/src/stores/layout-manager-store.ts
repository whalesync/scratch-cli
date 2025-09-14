import { create } from "zustand";

type State = {
    navbarOpened: boolean;
    rightPanelOpened: boolean;
}


type Actions = {
    setNavbarOpened: (navbarOpened: boolean) => void;
    toggleNavbar: () => void;
    setRightPanelOpened: (rightPanelOpened: boolean) => void;
    toggleRightPanel: () => void;
}

type LayoutManagerStore = State & Actions;

export const useLayoutManagerStore = create<LayoutManagerStore>((set) => ({
  navbarOpened: true,
  setNavbarOpened: (navbarOpened: boolean) => set({ navbarOpened }),
  toggleNavbar: () => set((state) => ({ navbarOpened: !state.navbarOpened })),
  rightPanelOpened: true,
  setRightPanelOpened: (rightPanelOpened: boolean) => set({ rightPanelOpened }),
  toggleRightPanel: () => set((state) => ({ rightPanelOpened: !state.rightPanelOpened })),
}));