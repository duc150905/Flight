import type { Query, QueryClient, QueryKey } from '@tanstack/react-query';

export const cacheTimes = {
  catalogue: 10 * 60_000,
  search: 30_000,
  ticket: 15_000,
  default: 30_000,
  live: 0,
} as const;

// Only these anonymous, slow-changing datasets may survive an app restart.
const durablePublicKeys = new Set(['airports', 'featured-destinations']);

export const cacheKeys = {
  airports: ['airports'] as const,
  destinations: ['featured-destinations'] as const,
  flightSearch: (key: string) => ['flight-search', key] as const,
  itinerarySearch: (key: string, index: number) => ['trip-flight-search', key, index] as const,
  flightDetail: (key: string) => ['flight-detail', key] as const,
  tickets: (ownerId: string) => ['tickets', ownerId] as const,
  ticketDetail: (ownerId: string, bookingId: string) => ['ticket-detail', ownerId, bookingId] as const,
};

export function isDurablePublicKey(key: QueryKey): boolean {
  return key.length === 1 && typeof key[0] === 'string' && durablePublicKeys.has(key[0]);
}

export function isPublicQueryKey(key: QueryKey): boolean {
  if (isDurablePublicKey(key)) return true;
  if ((key[0] === 'flight-search' || key[0] === 'flight-detail') && key.length === 2) {
    return typeof key[1] === 'string';
  }
  if (key[0] === 'trip-flight-search' && key.length === 3) {
    return typeof key[1] === 'string' && typeof key[2] === 'number';
  }
  return key.length === 3 && key[0] === 'display-exchange-rate'
    && key[1] === 'USD' && key[2] === 'VND';
}

export function shouldPersistPublicQuery(query: Query): boolean {
  return query.state.status === 'success' && isDurablePublicKey(query.queryKey);
}

export function clearPrivateQueries(client: Pick<QueryClient, 'removeQueries'>): void {
  client.removeQueries({ predicate: query => !isPublicQueryKey(query.queryKey) });
}

export async function invalidateFlightSearch(client: Pick<QueryClient, 'invalidateQueries'>): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: ['flight-search'] }),
    client.invalidateQueries({ queryKey: ['trip-flight-search'] }),
    client.invalidateQueries({ queryKey: ['flight-detail'] }),
  ]);
}

export async function invalidateOwnerTickets(
  client: Pick<QueryClient, 'invalidateQueries'>, ownerId: string,
): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: cacheKeys.tickets(ownerId) }),
    client.invalidateQueries({ queryKey: ['ticket-detail', ownerId] }),
  ]);
}
