import { createStore } from 'zustand/vanilla';

export type DisplayCurrency = 'VND' | 'USD';
export type CurrencyStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export function createCurrencyStore(storage: CurrencyStorage) {
  let revision = 0; let hydration: Promise<void> | undefined; let writes = Promise.resolve();
  return createStore<{
    currency: DisplayCurrency; ready: boolean; storageError: boolean;
    hydrate(): Promise<void>; setCurrency(currency: DisplayCurrency): Promise<void>;
  }>(set => ({
    currency: 'VND', ready: false, storageError: false,
    hydrate() {
      if (hydration) return hydration;
      const startedAt = revision;
      hydration = (async () => {
        try {
          const saved = await storage.getItem('flyora.displayCurrency');
          if (revision === startedAt && (saved === 'VND' || saved === 'USD')) set({ currency: saved });
        } catch { set({ storageError: true }); }
        finally { set({ ready: true }); }
      })();
      return hydration;
    },
    setCurrency(currency) {
      revision++; set({ currency });
      writes = writes.then(async () => {
        try { await storage.setItem('flyora.displayCurrency', currency); }
        catch { set({ storageError: true }); }
      });
      return writes;
    },
  }));
}
