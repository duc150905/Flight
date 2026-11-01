import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCheckoutDraftStore } from '../src/features/booking/draft.ts';
const selection = { tripType: 'one_way', passengers: { adults: 1, children: 1, infants: 1 }, segments: [{ flightId: '11111111-1111-4111-8111-111111111111', fareId: '22222222-2222-4222-8222-222222222222', journeyIndex: 1, legIndex: 1 }] };
const itinerary = { selection, legs: [], international: false };
test('begin checkout creates exact stable slots and a repeated selection preserves unfinished input', () => {
  const store = createCheckoutDraftStore();
  assert.equal(typeof store.getState().beginCheckout, 'function');
  store.getState().beginCheckout(itinerary);
  assert.deepEqual(store.getState().passengers.map(p => p.id), ['adult-1', 'child-1', 'infant-1']);
  store.getState().updateContact({ contactEmail: 'unfinished@' });
  store.getState().updatePassenger('child-1', { givenNames: 'Child' });
  store.getState().beginCheckout(structuredClone(itinerary));
  assert.equal(store.getState().contact.contactEmail, 'unfinished@');
  assert.equal(store.getState().passengers[1].values.givenNames, 'Child');
});
test('changing itinerary or counts clears old PII; independent users stores cannot share it', () => {
  const store = createCheckoutDraftStore();
  assert.equal(typeof store.getState().beginCheckout, 'function');
  store.getState().beginCheckout(itinerary);
  store.getState().updateContact({ contactName: 'Old user' });
  store.getState().beginCheckout({ ...itinerary, selection: { ...selection, passengers: { adults: 2, children: 0, infants: 0 } } });
  assert.equal(store.getState().contact.contactName, '');
  assert.deepEqual(store.getState().passengers.map(p => p.id), ['adult-1', 'adult-2']);
  assert.equal(createCheckoutDraftStore().getState().itinerary, null);
});
test('cancel/reset and successful finish clear itinerary and all personal information', () => {
  for (const action of ['reset', 'finish']) {
    const store = createCheckoutDraftStore();
    assert.equal(typeof store.getState().beginCheckout, 'function');
    store.getState().beginCheckout(itinerary);
    store.getState().updateContact({ contactName: 'Personal' });
    store.getState()[action]();
    assert.equal(store.getState().itinerary, null);
    assert.deepEqual(store.getState().passengers, []);
    assert.equal(store.getState().contact.contactName, '');
  }
});
