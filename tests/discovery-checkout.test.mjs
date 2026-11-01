import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as discovery from '../src/features/discovery/model.ts';
import { parseSelectionParameter } from '../src/features/booking/selection.ts';
const flightId = '11111111-1111-4111-8111-111111111111';
const fareId = '22222222-2222-4222-8222-222222222222';
const criteria = { adults: 2, children: 1, infants: 1 };
test('selected discovery offer opens checkout with exact fare and traveller counts, never its displayed price', () => {
  assert.equal(typeof discovery.checkoutHrefForOffer, 'function');
  const href = discovery.checkoutHrefForOffer({ flight: { id: flightId }, fare: { id: fareId, flight_id: flightId }, total: 1 }, criteria);
  assert.equal(href.pathname, '/checkout');
  assert.deepEqual(parseSelectionParameter(href.params.selection), {
    tripType: 'one_way', passengers: criteria,
    segments: [{ flightId, fareId, journeyIndex: 1, legIndex: 1 }],
  });
});
test('discovery handoff rejects a fare attached to another flight', () => {
  assert.equal(typeof discovery.checkoutHrefForOffer, 'function');
  assert.throws(() => discovery.checkoutHrefForOffer({ flight: { id: flightId }, fare: { id: fareId, flight_id: fareId } }, criteria));
});
