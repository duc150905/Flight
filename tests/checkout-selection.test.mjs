import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as selection from '../src/features/booking/selection.ts';

const flight = '11111111-1111-4111-8111-111111111111';
const fare = '22222222-2222-4222-8222-222222222222';
const input = { tripType: 'one_way', segments: [{ flightId: flight, fareId: fare, journeyIndex: 1, legIndex: 1 }], passengers: { adults: 2, children: 1, infants: 1 } };

test('selection URL carries only validated IDs and counts and roundtrips multiple legs', () => {
  const href = selection.buildCheckoutHref({ ...input, contactEmail: 'private@example.com', total: 1 });
  assert.equal(href.pathname, '/checkout');
  assert.deepEqual(selection.parseSelectionParameter(href.params.selection), input);
  assert.equal(href.params.selection.includes('private'), false);
  const multi = { ...input, tripType: 'round_trip', segments: [...input.segments, { flightId: fare, fareId: flight, journeyIndex: 2, legIndex: 1 }] };
  assert.deepEqual(selection.parseSelectionParameter(JSON.stringify(multi)), multi);
});
test('selection rejects malformed IDs, repeated flights, missing or noncontiguous legs and invalid counts', () => {
  for (const bad of [
    { ...input, passengers: { adults: 0, children: 1, infants: 0 } },
    { ...input, passengers: { adults: 1, children: 0, infants: 2 } },
    { ...input, passengers: { adults: 9, children: 1, infants: 0 } },
    { ...input, segments: [] }, { ...input, segments: [...input.segments, ...input.segments] },
    { ...input, segments: [{ ...input.segments[0], flightId: 'bad' }] },
    { ...input, segments: [{ ...input.segments[0], legIndex: 2 }] },
    { ...input, tripType: 'round_trip' },
    { ...input, tripType: 'round_trip', segments: [{ ...input.segments[0], journeyIndex: 2 }] },
    { ...input, tripType: 'multi_city', segments: [{ ...input.segments[0], journeyIndex: 2 }] },
  ]) assert.throws(() => selection.buildCheckoutHref(bad));
  for (const raw of [undefined, ['{}'], '{', '{}']) assert.throws(() => selection.parseSelectionParameter(raw));
});
test('TV1 one-way adapter accepts its current detail parameters without copying price', () => {
  assert.deepEqual(selection.selectionFromDiscovery({ id: flight, fareId: fare, adults: '2', children: '1', infants: '1', total: 1 }), input);
});
