import { createStore } from 'zustand/vanilla';

export type SearchStoreState = {
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
};

export const searchStore = createStore<SearchStoreState>((set) => ({
  searchOpen: false,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  toggleSearch: () => set((state) => ({ searchOpen: !state.searchOpen })),
}));

let shouldOpenSearchOnHome = false;

export function triggerOpenSearch() {
  shouldOpenSearchOnHome = true;
  searchStore.getState().openSearch();
}

export function consumeOpenSearch() {
  if (shouldOpenSearchOnHome) {
    shouldOpenSearchOnHome = false;
    return true;
  }
  return false;
}
