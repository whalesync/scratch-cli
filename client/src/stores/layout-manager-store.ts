import { create } from 'zustand';

type State = {
  rightPanelOpened: boolean;
  navDrawerOpened: boolean;
};

type Actions = {
  setRightPanelOpened: (rightPanelOpened: boolean) => void;
  toggleRightPanel: () => void;
  toggleNavDrawer: () => void;
  openNavDrawer: () => void;
  closeNavDrawer: () => void;
};

type LayoutManagerStore = State & Actions;

export const useLayoutManagerStore = create<LayoutManagerStore>((set) => ({
  rightPanelOpened: true,
  navDrawerOpened: false,
  setRightPanelOpened: (rightPanelOpened: boolean) => set({ rightPanelOpened }),
  toggleRightPanel: () => set((state) => ({ rightPanelOpened: !state.rightPanelOpened })),
  toggleNavDrawer: () => set((state) => ({ navDrawerOpened: !state.navDrawerOpened })),
  openNavDrawer: () => set({ navDrawerOpened: true }),
  closeNavDrawer: () => set({ navDrawerOpened: false }),
}));
