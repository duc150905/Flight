import { createStore } from 'zustand/vanilla';

export type Language = 'vi' | 'en';
export type LanguageStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
const storageKey = 'flight.language';
export function languageFromDevice(tags: readonly string[]): Language {
  for (const tag of tags) {
    const code = tag.toLowerCase().split(/[-_]/)[0];
    if (code === 'vi' || code === 'en') return code;
  }
  return 'vi';
}
export function createLanguageStore(storage: LanguageStorage, deviceLanguages: readonly string[]) {
  let revision = 0;
  let hydration: Promise<void> | undefined;
  let writes = Promise.resolve();
  return createStore<{
    language: Language; ready: boolean; storageError: boolean;
    hydrate(): Promise<void>; setLanguage(language: Language): Promise<void>;
  }>((set) => ({
    language: languageFromDevice(deviceLanguages), ready: false, storageError: false,
    hydrate() {
      if (hydration) return hydration;
      const startedAt = revision;
      hydration = (async () => {
        try {
          const saved = await storage.getItem(storageKey);
          if (revision === startedAt && (saved === 'vi' || saved === 'en')) set({ language: saved });
        } catch { set({ storageError: true }); }
        finally { set({ ready: true }); }
      })();
      return hydration;
    },
    setLanguage(language) {
      revision++;
      set({ language });
      writes = writes.then(async () => {
        try { await storage.setItem(storageKey, language); }
        catch { set({ storageError: true }); }
      });
      return writes;
    },
  }));
}
