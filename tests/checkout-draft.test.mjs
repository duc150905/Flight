import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCheckoutDraftStore, validateCheckoutDraft } from '../src/features/booking/draft.ts';

const contact = { contactName: 'Nguyễn An', contactEmail: 'an@example.com', contactPhone: '0901234567' };
const passenger = { givenNames: 'Minh An', familyName: 'Nguyễn', dateOfBirth: '2000-02-29' };

test('a checkout draft starts with blank contact and no passengers', () => {
  const state = createCheckoutDraftStore().getState();
  assert.deepEqual(state.contact, { contactName: '', contactEmail: '', contactPhone: '' });
  assert.deepEqual(state.passengers, []);
});

test('partial invalid contact input remains available when another step reads the same draft', () => {
  const store = createCheckoutDraftStore();
  store.getState().updateContact({ contactName: ' An ', contactEmail: 'unfinished@' });
  store.getState().updateContact({ contactPhone: '09' });
  assert.deepEqual(store.getState().contact, { contactName: ' An ', contactEmail: 'unfinished@', contactPhone: '09' });
  store.getState().updateContact({ contactEmail: '' });
  assert.equal(store.getState().contact.contactEmail, '');
});

test('passengers are updated by stable ID without duplicating or overwriting another passenger', () => {
  const store = createCheckoutDraftStore();
  store.getState().updatePassenger('p1', { givenNames: 'An' });
  store.getState().updatePassenger('p2', { givenNames: 'Bình', familyName: 'Trần' });
  store.getState().updatePassenger('p1', { familyName: 'Nguyễn' });
  assert.deepEqual(store.getState().passengers, [
    { id: 'p1', values: { givenNames: 'An', familyName: 'Nguyễn', dateOfBirth: '' } },
    { id: 'p2', values: { givenNames: 'Bình', familyName: 'Trần', dateOfBirth: '' } },
  ]);
  store.getState().updatePassenger('p1', { givenNames: '' });
  assert.equal(store.getState().passengers[0].values.givenNames, '');
});

test('removing one passenger preserves the contact and the remaining passenger', () => {
  const store = createCheckoutDraftStore();
  store.getState().updateContact(contact);
  store.getState().updatePassenger('p1', passenger);
  store.getState().updatePassenger('p2', { ...passenger, givenNames: 'Bình' });
  store.getState().removePassenger('p1');
  assert.deepEqual(store.getState().contact, contact);
  assert.deepEqual(store.getState().passengers, [{ id: 'p2', values: { ...passenger, givenNames: 'Bình' } }]);
});

test('reset clears both contact and passengers and the draft remains usable', () => {
  const store = createCheckoutDraftStore();
  store.getState().updateContact(contact);
  store.getState().updatePassenger('p1', passenger);
  store.getState().reset();
  assert.deepEqual(store.getState().contact, { contactName: '', contactEmail: '', contactPhone: '' });
  assert.deepEqual(store.getState().passengers, []);
  store.getState().updatePassenger('p2', passenger);
  assert.equal(store.getState().passengers[0].id, 'p2');
});

test('separate checkout stores do not share draft data', () => {
  const first = createCheckoutDraftStore();
  const second = createCheckoutDraftStore();
  first.getState().updateContact(contact);
  first.getState().updatePassenger('p1', passenger);
  assert.equal(second.getState().contact.contactName, '');
  assert.deepEqual(second.getState().passengers, []);
});

test('input objects and earlier snapshots are not modified by later edits', () => {
  const store = createCheckoutDraftStore();
  const input = { ...passenger };
  store.getState().updatePassenger('p1', input);
  const before = store.getState();
  input.givenNames = 'Outside change';
  store.getState().updatePassenger('p1', { familyName: 'Trần' });
  assert.deepEqual(before.passengers, [{ id: 'p1', values: passenger }]);
  assert.deepEqual(store.getState().passengers, [{ id: 'p1', values: { ...passenger, familyName: 'Trần' } }]);
});

test('draft actions retain only contact and passenger form fields', () => {
  const store = createCheckoutDraftStore();
  store.getState().updateContact({ ...contact, userId: 'another-user', totalAmount: 1 });
  store.getState().updatePassenger('p1', { ...passenger, passengerType: 'adult', amount: 1 });
  assert.deepEqual(store.getState().contact, contact);
  assert.deepEqual(store.getState().passengers, [{ id: 'p1', values: passenger }]);
});

test('blank passenger IDs fail without changing the draft', () => {
  const store = createCheckoutDraftStore();
  for (const id of ['', '   ']) assert.throws(() => store.getState().updatePassenger(id, passenger));
  assert.deepEqual(store.getState().passengers, []);
});

test('validating a complete draft returns normalized data while preserving unfinished form formatting', () => {
  const store = createCheckoutDraftStore();
  store.getState().updateContact({ ...contact, contactEmail: ' AN@Example.COM ', contactPhone: '+84 (90) 123-4567' });
  store.getState().updatePassenger('p1', { ...passenger, givenNames: ' Minh An ' });
  const result = validateCheckoutDraft(store.getState(), '2026-10-30');
  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    contact: { ...contact, contactEmail: 'an@example.com', contactPhone: '+84901234567' },
    passengers: [{ id: 'p1', values: passenger }],
  });
  assert.equal(store.getState().contact.contactEmail, ' AN@Example.COM ');
  assert.equal(store.getState().passengers[0].values.givenNames, ' Minh An ');
});

test('validation identifies contact and passenger field errors without clearing the draft', () => {
  const store = createCheckoutDraftStore();
  store.getState().updateContact({ contactEmail: 'incomplete@' });
  store.getState().updatePassenger('p1', { ...passenger, dateOfBirth: '2026-10-31' });
  const result = validateCheckoutDraft(store.getState(), '2026-10-30');
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some(issue => issue.path.join('.') === 'contact.contactEmail'));
  assert.ok(result.error.issues.some(issue => issue.path.join('.') === 'passengers.0.values.dateOfBirth'));
  assert.equal(store.getState().contact.contactEmail, 'incomplete@');
});

test('valid contact alone cannot validate as a checkout draft with no passengers', () => {
  const store = createCheckoutDraftStore();
  store.getState().updateContact(contact);
  const result = validateCheckoutDraft(store.getState(), '2026-10-30');
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some(issue => issue.path.join('.') === 'passengers'));
});

test('validation rejects duplicate passenger IDs in a supplied draft', () => {
  const result = validateCheckoutDraft({ contact, passengers: [
    { id: 'p1', values: passenger }, { id: 'p1', values: passenger },
  ] }, '2026-10-30');
  assert.equal(result.success, false);
});
