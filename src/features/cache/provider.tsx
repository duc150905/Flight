import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';

import { cacheKeys, cacheTimes, shouldPersistPublicQuery } from './policy';

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'flyora.public-query-cache.v1',
});

function createAppQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: cacheTimes.default } },
  });
  for (const key of [cacheKeys.airports, cacheKeys.destinations]) {
    client.setQueryDefaults(key, { staleTime: cacheTimes.catalogue, gcTime: 24 * 60 * 60_000 });
  }
  return client;
}

export function AppCacheProvider({ children }: PropsWithChildren) {
  const [client] = useState(createAppQueryClient);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    focusManager.setFocused(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', state => {
      focusManager.setFocused(state === 'active');
    });
    return () => { listener.remove(); focusManager.setFocused(undefined); };
  }, []);

  return <PersistQueryClientProvider client={client} persistOptions={{
    persister,
    maxAge: 24 * 60 * 60_000,
    buster: 'flyora-public-v1',
    dehydrateOptions: {
      shouldDehydrateQuery: shouldPersistPublicQuery,
      shouldDehydrateMutation: () => false,
    },
  }}>
    {children}
  </PersistQueryClientProvider>;
}
