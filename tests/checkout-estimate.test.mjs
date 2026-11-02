import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkoutEstimate } from '../src/features/booking/estimate.ts';
test('estimate uses the fare price for each leg’s age group and does not invent missing prices', () => {
  const prices = { adult: 100, child: 70, infant: 10, currency: 'VND' };
  const legs = [{ departureDate: '2026-11-01', prices }, { departureDate: '2026-11-03', prices }];
  const passengers = [{ id: 'adult-1', values: { dateOfBirth: '1990-01-01' } }, { id: 'child-1', values: { dateOfBirth: '2014-11-02' } }];
  assert.deepEqual(checkoutEstimate({ itinerary: { legs }, passengers }), { amount: 370, currency: 'VND' });
  assert.equal(checkoutEstimate({ itinerary: { legs: [{ ...legs[0], prices: null }] }, passengers }), null);
  assert.equal(checkoutEstimate({ itinerary: null, passengers }), null);
  assert.equal(checkoutEstimate({ itinerary: { legs: [{ ...legs[0], prices: { ...prices, adult: Number.MAX_SAFE_INTEGER } }] }, passengers }), null);
});
test('before valid birth dates are entered estimate uses the selected initial types', () => {
  const draft = { itinerary: { legs: [{ departureDate: '2026-11-01', prices: { adult: 100, child: 70, infant: 10, currency: 'VND' } }] }, passengers: [{ id: 'infant-1', values: { dateOfBirth: '' } }] };
  assert.equal(checkoutEstimate(draft).amount, 10);
});
