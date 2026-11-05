import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { createAdminQueryClient, disposeAdminQueryClient } from './query-cache';
/** Mount with an owner key. A disposed client's late responses cannot enter a new owner's cache. */
export function AdminQueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(createAdminQueryClient);
  useEffect(() => () => { void disposeAdminQueryClient(client); }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
