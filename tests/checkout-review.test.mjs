import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkoutReview } from '../src/features/booking/review.ts';
import { createCheckoutDraftStore } from '../src/features/booking/draft.ts';
const now = new Date('2026-11-01T00:00:00Z');
const selection = { tripType: 'one_way', passengers: { adults: 1, children: 0, infants: 0 }, segments: [{ flightId: '11111111-1111-4111-8111-111111111111', fareId: '22222222-2222-4222-8222-222222222222', journeyIndex: 1, legIndex: 1 }] };
const itinerary = { selection, international: false, legs: [{ ...selection.segments[0], origin: { timezone: 'Asia/Ho_Chi_Minh' }, departureDate: '2026-12-01', arrivalDate: '2026-12-01', departureAt: '2026-12-01T00:00:00Z', salesCloseAt: '2026-11-30T23:00:00Z' }] };
function ready() {
  const store = createCheckoutDraftStore(); store.getState().beginCheckout(itinerary);
  store.getState().updateContact({ contactName: ' Nguyễn An ', contactEmail: ' AN@Example.COM ', contactPhone: '090 123 4567' });
  store.getState().updatePassenger('adult-1', { givenNames: ' Minh An ', familyName: ' Nguyễn ', dateOfBirth: '2000-01-01' });
  return store;
}
test('review returns normalized contact and travellers while preserving raw editable data', () => {
  const store = ready(); const review = checkoutReview(store.getState(), now);
  assert.equal(review.success, true);
  assert.equal(review.data.contact.contactEmail, 'an@example.com');
  assert.equal(review.data.passengers[0].values.givenNames, 'Minh An');
  assert.equal(store.getState().contact.contactEmail, ' AN@Example.COM ');
  assert.equal(store.getState().passengers[0].values.givenNames, ' Minh An ');
});
test('review revalidates edits instead of reusing a previous success', () => {
  const store = ready(); assert.equal(checkoutReview(store.getState(), now).success, true);
  store.getState().updatePassenger('adult-1', { dateOfBirth: '2020-01-01' });
  const invalid = checkoutReview(store.getState(), now);
  assert.equal(invalid.success, false); assert.equal(invalid.target, 'passengers');
  store.getState().updateContact({ contactEmail: 'broken@' });
  assert.equal(checkoutReview(store.getState(), now).target, 'contact');
});
test('empty, departed or sales-closed itineraries cannot pass review', () => {
  assert.equal(checkoutReview(createCheckoutDraftStore().getState(), now).target, 'selection');
  const store = ready();
  assert.equal(checkoutReview(store.getState(), new Date('2026-12-02T00:00:00Z')).target, 'selection');
  assert.equal(checkoutReview(store.getState(), new Date('2026-11-30T23:30:00Z')).target, 'selection');
});
