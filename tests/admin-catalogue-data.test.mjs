import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadCatalogues, loadFlightsBundle, loadAddonsBundle, loadFlightSeats } from '../src/features/admin/catalogue-data.ts';

function clientFixture(failTable) {
  const calls = [];
  const client = { from(table) {
    const order = [];
    return { select() { return this; }, eq(column, value) { assert.equal(column, 'flight_id'); assert.equal(value, 'flight-1'); return this; },
      order(column) { order.push(column); return this; },
      range(from, to) {
        calls.push({ table, from, to, order: [...order] });
        if (table === failTable && from >= 500) return Promise.resolve({ data: null, error: Error('page unavailable') });
        const count = table === 'flight_addon_offers' ? 10326 : table === 'flight_fares' ? 6577 : 1834;
        return Promise.resolve({ data: Array.from({ length: Math.max(0, Math.min(to + 1, count) - from) }, (_, i) => ({ id: `${table}-${from + i}`, flight_id: 'flight-1' })), error: null });
      } };
  } };
  return { client, calls };
}

test('catalogue, fare, flight, offer selectors and seat inventory read all pages beyond the API cap', async () => {
  const { client, calls } = clientFixture();
  const catalogue = await loadCatalogues(client);
  const flights = await loadFlightsBundle(client);
  const addons = await loadAddonsBundle(client);
  const seats = await loadFlightSeats(client, 'flight-1');
  assert.equal(catalogue.destinations.length, 1834);
  assert.equal(catalogue.airports.length, 1834);
  assert.equal(catalogue.airlines.length, 1834);
  assert.equal(flights.flights.length, 1834);
  assert.equal(flights.aircraftList.length, 1834);
  assert.equal(flights.faresByFlight['flight-1'].length, 6577);
  assert.equal(addons.offers.length, 10326);
  assert.equal(addons.products.length, 1834);
  assert.equal(addons.flights.length, 1834);
  assert.equal(seats.length, 1834);
  for (const call of calls) {
    assert.equal(call.to - call.from, 499);
    assert.equal(call.order.at(-1), 'id', `${call.table} needs a unique final sort key`);
  }
});

test('later catalogue/flight/offer/seat errors never return partial search data', async () => {
  for (const [table, load] of [
    ['destinations', loadCatalogues], ['flight_fares', loadFlightsBundle], ['flight_addon_offers', loadAddonsBundle],
    ['flight_seats', client => loadFlightSeats(client, 'flight-1')],
  ]) await assert.rejects(() => load(clientFixture(table).client), /page unavailable/);
});
