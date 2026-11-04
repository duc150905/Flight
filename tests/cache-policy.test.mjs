import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dehydrate, QueryClient } from '@tanstack/react-query';

import {
  cacheKeys, cacheTimes, clearPrivateQueries, invalidateFlightSearch,
  invalidateOwnerTickets, shouldPersistPublicQuery,
} from '../src/features/cache/policy.ts';

test('disk cache contains only successful public catalogue queries', () => {
  const client = new QueryClient();
  client.setQueryData(cacheKeys.airports, [{ iata_code: 'HAN' }]);
  client.setQueryData(cacheKeys.destinations, [{ title: 'Hà Nội' }]);
  client.setQueryData(cacheKeys.flightSearch('HAN-SGN'), [{ fare: 1 }]);
  client.setQueryData(cacheKeys.tickets('owner-a'), [{ booking_code: 'SECRET' }]);
  client.setQueryData(['airports', 'owner-a'], [{ booking_code: 'SECRET' }]);
  const persisted = dehydrate(client, {
    shouldDehydrateQuery: shouldPersistPublicQuery,
    shouldDehydrateMutation: () => false,
  });
  assert.deepEqual(persisted.queries.map(query => query.queryKey), [
    cacheKeys.airports, cacheKeys.destinations,
  ]);
  assert.equal(JSON.stringify(persisted).includes('SECRET'), false);
});

test('account change removes private caches but retains public data', () => {
  const client = new QueryClient();
  client.setQueryData(cacheKeys.airports, ['HAN']);
  client.setQueryData(cacheKeys.flightSearch('HAN-SGN'), ['public offer']);
  client.setQueryData(cacheKeys.tickets('owner-a'), ['private ticket']);
  client.setQueryData(cacheKeys.ticketDetail('owner-a', 'booking-a'), 'private detail');
  client.setQueryData(['airports', 'owner-a'], ['private malformed key']);
  client.setQueryData(['admin-bookings-bundle'], 'private admin data');
  clearPrivateQueries(client);
  assert.deepEqual(client.getQueryData(cacheKeys.airports), ['HAN']);
  assert.deepEqual(client.getQueryData(cacheKeys.flightSearch('HAN-SGN')), ['public offer']);
  assert.equal(client.getQueryData(cacheKeys.tickets('owner-a')), undefined);
  assert.equal(client.getQueryData(cacheKeys.ticketDetail('owner-a', 'booking-a')), undefined);
  assert.equal(client.getQueryData(['airports', 'owner-a']), undefined);
  assert.equal(client.getQueryData(['admin-bookings-bundle']), undefined);
  assert.equal(client.getQueryData(cacheKeys.tickets('owner-b')), undefined);
});

test('fresh catalogue is reused and targeted invalidation fetches it again', async () => {
  const client = new QueryClient();
  let requests = 0;
  const load = () => Promise.resolve(++requests);
  const options = { queryKey: cacheKeys.airports, queryFn: load, staleTime: cacheTimes.catalogue };
  assert.equal(await client.fetchQuery(options), 1);
  assert.equal(await client.fetchQuery(options), 1);
  assert.equal(requests, 1);
  await client.invalidateQueries({ queryKey: cacheKeys.airports });
  assert.equal(await client.fetchQuery(options), 2);
});

test('flight edits invalidate public search and detail queries', async () => {
  const client = new QueryClient();
  const keys = [cacheKeys.flightSearch('a'), cacheKeys.itinerarySearch('b', 0), cacheKeys.flightDetail('c')];
  for (const key of keys) client.setQueryData(key, 'old');
  client.setQueryData(cacheKeys.airports, 'catalogue');
  await invalidateFlightSearch(client);
  for (const key of keys) assert.equal(client.getQueryState(key)?.isInvalidated, true);
  assert.equal(client.getQueryState(cacheKeys.airports)?.isInvalidated, false);
});

test('booking change invalidates only its owner tickets', async () => {
  const client = new QueryClient();
  client.setQueryData(cacheKeys.tickets('owner-a'), 'a');
  client.setQueryData(cacheKeys.ticketDetail('owner-a', 'booking-a'), 'a detail');
  client.setQueryData(cacheKeys.tickets('owner-b'), 'b');
  await invalidateOwnerTickets(client, 'owner-a');
  assert.equal(client.getQueryState(cacheKeys.tickets('owner-a'))?.isInvalidated, true);
  assert.equal(client.getQueryState(cacheKeys.ticketDetail('owner-a', 'booking-a'))?.isInvalidated, true);
  assert.equal(client.getQueryState(cacheKeys.tickets('owner-b'))?.isInvalidated, false);
});
