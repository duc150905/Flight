import { QueryClient } from '@tanstack/react-query';
export function createAdminQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: false, refetchOnWindowFocus: true }, mutations: { retry: false } } });
}
export async function disposeAdminQueryClient(client: QueryClient) {
  await client.cancelQueries();
  client.clear();
}
