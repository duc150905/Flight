import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { searchSchema } from '../src/features/discovery/model.ts';
import { buildCheckoutHref, parseSelectionParameter } from '../src/features/booking/selection.ts';
const seedId = key => {
  const hex = createHash('md5').update(`flight-seed-v1:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
test('TV3 deterministic PostgreSQL airport IDs work in discovery without changing stored IDs', () => {
  const result = searchSchema.parse({ originId: seedId('airport:SGN'), destinationId: seedId('airport:HAN'), departureDate: '2026-11-23', adults: 1, children: 0, infants: 0, cabinClass: 'economy' });
  assert.equal(result.destinationId, seedId('airport:HAN'));
});
test('checkout accepts PostgreSQL UUIDs regardless of version bits and canonicalizes case', () => {
  const flightId = seedId('flight:SGN-HAN-VN210:2026-11-23');
  const fareId = seedId('fare:demo');
  const input = { tripType: 'one_way', passengers: { adults: 1, children: 0, infants: 0 }, segments: [{ flightId: flightId.toUpperCase(), fareId, journeyIndex: 1, legIndex: 1 }] };
  assert.equal(parseSelectionParameter(buildCheckoutHref(input).params.selection).segments[0].flightId, flightId);
  assert.throws(() => buildCheckoutHref({ ...input, segments: [{ ...input.segments[0], fareId: 'invalid' }] }));
  assert.throws(() => buildCheckoutHref({ ...input, segments: [input.segments[0], { ...input.segments[0], flightId, legIndex: 2 }] }));
});
