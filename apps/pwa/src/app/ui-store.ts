import { create } from 'zustand';

type UiState = {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
};

/** Ephemeral UI state only (ARQUITECTURA §5.1): nothing here comes from the server. */
export const useUi = create<UiState>((set) => ({
  menuOpen: false,
  setMenuOpen: (menuOpen) => set({ menuOpen }),
}));
