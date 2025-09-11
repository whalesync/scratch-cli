import { create } from "zustand";

type State = {
    navbarOpened: boolean;
}


type Actions = {
    setNavbarOpened: (navbarOpened: boolean) => void;
    toggleNavbar: () => void;
}

type LayoutManagerStore = State & Actions;

export const useLayoutManagerStore = create<LayoutManagerStore>((set) => ({
  navbarOpened: true,
  setNavbarOpened: (navbarOpened: boolean) => set({ navbarOpened }),
  toggleNavbar: () => set((state) => ({ navbarOpened: !state.navbarOpened })),
}));