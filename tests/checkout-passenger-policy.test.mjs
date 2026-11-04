import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as policy from '../src/features/booking/passenger-policy.ts';
import { createCheckoutDraftStore } from '../src/features/booking/draft.ts';

const { ageOnDate, classifyPassenger, passengerPolicySchema } = policy;

const values = { givenNames: 'An', familyName: 'Nguyễn', dateOfBirth: '1990-01-01' };
const passenger = (id, patch = {}) => ({ id, values: { ...values, ...patch } });
const itinerary = (counts = { adults: 1, children: 0, infants: 0 }, dates = ['2026-11-20'], international = false) => ({
  selection: { passengers: counts }, international,
  legs: dates.map(date => ({ departureDate: date, arrivalDate: date })),
});
test('classification uses exact flight-day birthdays including leap birthdays, not booking-day age', () => {
  assert.equal(classifyPassenger('2014-11-15', '2026-11-14'), 'child');
  assert.equal(classifyPassenger('2014-11-15', '2026-11-15'), 'adult');
  assert.equal(classifyPassenger('2024-11-15', '2026-11-14'), 'infant');
  assert.equal(classifyPassenger('2024-11-15', '2026-11-15'), 'child');
  assert.equal(ageOnDate('2008-02-29', '2026-02-28'), 17);
  assert.equal(ageOnDate('2008-02-29', '2026-03-01'), 18);
  assert.throws(() => ageOnDate('2026-11-21', '2026-11-20'));
});
test('selected counts and unique stable slots must match actual travellers', () => {
  const schema = passengerPolicySchema(itinerary(), '2026-11-01');
  assert.equal(schema.safeParse({ passengers: [passenger('adult-1')] }).success, true);
  for (const passengers of [[], [passenger('child-1')], [passenger('adult-1'), passenger('adult-1')]]) {
    assert.equal(schema.safeParse({ passengers }).success, false);
  }
});
test('a birthday changing type on the return leg keeps one itinerary with per-leg types', () => {
  const schema = passengerPolicySchema(itinerary({ adults: 1, children: 1, infants: 0 }, ['2026-11-10', '2026-11-20']), '2026-11-01');
  const result = schema.safeParse({ passengers: [passenger('adult-1'), passenger('child-1', { dateOfBirth: '2014-11-15' })] });
  assert.equal(result.success, true);
  assert.equal(typeof policy.derivePassengerSegments, 'function');
  const segments = policy.derivePassengerSegments(result.data.passengers, itinerary(undefined, ['2026-11-10', '2026-11-20']).legs);
  assert.deepEqual(segments.filter(s => s.passengerId === 'child-1').map(s => s.passengerType), ['child', 'adult']);
});
test('an infant becoming a child gets a return seat and needs a companion only on infant legs', () => {
  const trip = itinerary({ adults: 1, children: 0, infants: 1 }, ['2026-11-10', '2026-11-20']);
  const people = [passenger('adult-1'), passenger('infant-1', { dateOfBirth: '2024-11-15', accompanyingAdultId: 'adult-1' })];
  assert.equal(passengerPolicySchema(trip, '2026-11-01').safeParse({ passengers: people }).success, true);
  const result = policy.derivePassengerSegments(people, trip.legs).filter(s => s.passengerId === 'infant-1');
  assert.deepEqual(result.map(s => [s.passengerType, s.requiresSeat, s.accompanyingPassengerId]), [
    ['infant', false, 'adult-1'], ['child', true, null],
  ]);
});
test('first-flight type mismatch remains invalid instead of silently changing search counts', () => {
  const trip = itinerary({ adults: 1, children: 1, infants: 0 }, ['2026-11-20']);
  const result = passengerPolicySchema(trip, '2026-11-01').safeParse({ passengers: [passenger('adult-1'), passenger('child-1', { dateOfBirth: '2014-11-15' })] });
  assert.equal(result.success, false);
});
test('a future birth date returns field errors without throwing from age derivation', () => {
  const result = passengerPolicySchema(itinerary(), '2026-11-01').safeParse({ passengers: [passenger('adult-1', { dateOfBirth: '2030-01-01' })] });
  assert.equal(result.success, false);
});
test('infants require a distinct companion who is 18 on every leg and actually travels in this booking', () => {
  const schema = passengerPolicySchema(itinerary({ adults: 2, children: 0, infants: 2 }), '2026-11-01');
  const adult = passenger('adult-1');
  const other = passenger('adult-2', { dateOfBirth: '2008-11-20' });
  const infant = passenger('infant-1', { dateOfBirth: '2025-01-01', accompanyingAdultId: 'adult-1' });
  const second = passenger('infant-2', { dateOfBirth: '2025-02-01', accompanyingAdultId: 'adult-2' });
  assert.equal(schema.safeParse({ passengers: [adult, other, infant, second] }).success, true);
  for (const companions of [
    [adult, other, infant, { ...second, values: { ...second.values, accompanyingAdultId: 'adult-1' } }],
    [adult, { ...other, values: { ...other.values, dateOfBirth: '2008-11-21' } }, infant, second],
    [adult, other, infant, { ...second, values: { ...second.values, accompanyingAdultId: 'unknown' } }],
  ]) assert.equal(schema.safeParse({ passengers: companions }).success, false);
});
test('international travellers require nationality and a real unexpired passport through final arrival', () => {
  const trip = itinerary(undefined, ['2026-11-20'], true);
  trip.legs[0].arrivalDate = '2026-11-21';
  const schema = passengerPolicySchema(trip, '2026-11-01');
  assert.equal(schema.safeParse({ passengers: [passenger('adult-1')] }).success, false);
  const document = { nationalityCode: 'vn', passportNumber: ' B1234567 ', passportExpiryDate: '2030-01-01', passportIssuerCountry: 'vn' };
  const parsed = schema.parse({ passengers: [passenger('adult-1', document)] });
  assert.equal(parsed.passengers[0].values.nationalityCode, 'VN');
  assert.equal(parsed.passengers[0].values.passportNumber, 'B1234567');
  for (const invalid of [
    { passportExpiryDate: '2026-11-20' }, { passportExpiryDate: '2030-02-30' },
    { nationalityCode: 'XX' }, { passportIssuerCountry: 'ZZ' }, { passportNumber: '   ' },
  ]) assert.equal(schema.safeParse({ passengers: [passenger('adult-1', { ...document, ...invalid })] }).success, false);
});
test('domestic documents remain optional but provided malformed details do not silently pass', () => {
  const schema = passengerPolicySchema(itinerary(), '2026-11-01');
  assert.equal(schema.safeParse({ passengers: [passenger('adult-1')] }).success, true);
  assert.equal(schema.safeParse({ passengers: [passenger('adult-1', { nationalityCode: 'XX' })] }).success, false);
});
test('document and companion edits remain in the draft when a name is changed', () => {
  const store = createCheckoutDraftStore();
  store.getState().updatePassenger('infant-1', { ...values, passportNumber: 'B1234567', accompanyingAdultId: 'adult-1' });
  store.getState().updatePassenger('infant-1', { givenNames: 'New name' });
  assert.equal(store.getState().passengers[0].values.passportNumber, 'B1234567');
  assert.equal(store.getState().passengers[0].values.accompanyingAdultId, 'adult-1');
  store.getState().updatePassenger('infant-1', { passportNumber: '' });
  assert.equal(store.getState().passengers[0].values.passportNumber, '');
});
test('companion eligibility uses the same normalized DOB as the policy', () => {
  assert.equal(typeof policy.isEligibleCompanion, 'function');
  assert.equal(policy.isEligibleCompanion(' 1990-01-01 ', itinerary().legs), true);
  assert.equal(policy.isEligibleCompanion('2020-01-01', itinerary().legs), false);
  assert.equal(policy.isEligibleCompanion('not a date', itinerary().legs), false);
});
