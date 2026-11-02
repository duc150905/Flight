import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseSelectionParameter } from '../src/features/booking/selection.ts';
import { checkoutHrefForTrip, criteriaForLeg, parseTripSearchParameter,
  tripSearchSchema, validateTripSearch } from '../src/features/discovery/trip-search.ts';

const airportA = '11111111-1111-4111-8111-111111111111';
const airportB = '22222222-2222-4222-8222-222222222222';
const airportC = '33333333-3333-4333-8333-333333333333';
const flightA = '44444444-4444-4444-8444-444444444444';
const flightB = '55555555-5555-4555-8555-555555555555';
const fareA = '66666666-6666-4666-8666-666666666666';
const fareB = '77777777-7777-4777-8777-777777777777';
const leg = (originId, destinationId, departureDate) => ({ originId, destinationId, departureDate });
const base = { adults: 2, children: 1, infants: 1, cabinClass: 'economy' };
const roundTrip = { ...base, tripType: 'round_trip', legs: [
  leg(airportA, airportB, '2030-03-01'), leg(airportB, airportA, '2030-03-08'),
] };
const timezones = new Map([[airportA, 'Asia/Ho_Chi_Minh'], [airportB, 'Asia/Ho_Chi_Minh'],
  [airportC, 'Asia/Ho_Chi_Minh']]);

function offer(id, fareId, originId, destinationId, departureAt, arrivalAt) {
  return {
    flight: { id, departure_at: departureAt, arrival_at: arrivalAt },
    fare: { id: fareId, flight_id: id, cabin_class: 'economy' },
    origin: { id: originId, timezone: 'Asia/Ho_Chi_Minh' },
    destination: { id: destinationId, timezone: 'Asia/Ho_Chi_Minh' },
  };
}
const outbound = offer(flightA, fareA, airportA, airportB, '2030-03-01T02:00:00Z', '2030-03-01T04:00:00Z');
const inbound = offer(flightB, fareB, airportB, airportA, '2030-03-08T02:00:00Z', '2030-03-08T04:00:00Z');

test('round trip requires exactly two reversed routes and chronological dates', () => {
  assert.equal(tripSearchSchema.safeParse(roundTrip).success, true);
  assert.equal(tripSearchSchema.safeParse({ ...roundTrip, legs: [roundTrip.legs[0]] }).success, false);
  assert.equal(tripSearchSchema.safeParse({ ...roundTrip, legs: [roundTrip.legs[0], leg(airportB, airportC, '2030-03-08')] }).success, false);
  assert.equal(tripSearchSchema.safeParse({ ...roundTrip, legs: [roundTrip.legs[0], leg(airportB, airportA, '2030-02-28')] }).success, false);
});

test('multi city allows distinct city pairs in chronological order, with two to twelve legs', () => {
  const trip = { ...roundTrip, tripType: 'multi_city', legs: [
    leg(airportA, airportB, '2030-03-01'), leg(airportB, airportC, '2030-03-04'),
  ] };
  assert.equal(tripSearchSchema.safeParse(trip).success, true);
  assert.equal(tripSearchSchema.safeParse({ ...trip, legs: [leg(airportA, airportB, '2030-03-01'), leg(airportA, airportC, '2030-03-04')] }).success, true);
  assert.equal(tripSearchSchema.safeParse({ ...trip, legs: [trip.legs[0]] }).success, false);
  assert.equal(tripSearchSchema.safeParse({ ...trip, legs: Array(13).fill(trip.legs[0]) }).success, false);
});

test('each leg checks the airport local date and the shared passenger rules', () => {
  const now = new Date('2030-02-28T18:00:00Z');
  assert.deepEqual(validateTripSearch(roundTrip, timezones, now).legs, roundTrip.legs);
  assert.throws(() => validateTripSearch({ ...roundTrip, legs: [
    leg(airportA, airportB, '2030-02-28'), roundTrip.legs[1],
  ] }, timezones, now), /Chặng 1/);
  assert.equal(tripSearchSchema.safeParse({ ...roundTrip, adults: 1, infants: 2 }).success, false);
  assert.equal(criteriaForLeg(roundTrip, 1).originId, airportB);
});

test('route search rejects malformed or oversized input', () => {
  assert.deepEqual(parseTripSearchParameter(JSON.stringify(roundTrip)), roundTrip);
  assert.throws(() => parseTripSearchParameter('not-json'));
  assert.throws(() => parseTripSearchParameter('x'.repeat(4001)));
});

test('selected flights hand off only IDs and passenger counts in journey order', () => {
  const href = checkoutHrefForTrip(roundTrip, [outbound, inbound]);
  assert.equal(href.pathname, '/checkout');
  assert.deepEqual(parseSelectionParameter(href.params.selection), {
    tripType: 'round_trip', passengers: { adults: 2, children: 1, infants: 1 },
    segments: [
      { flightId: flightA, fareId: fareA, journeyIndex: 1, legIndex: 1 },
      { flightId: flightB, fareId: fareB, journeyIndex: 2, legIndex: 1 },
    ],
  });
  assert.equal(href.params.selection.includes('2030-03-01T02:00:00Z'), false);
});

test('selection rejects missing, repeated, mismatched and reversed-time flights', () => {
  assert.throws(() => checkoutHrefForTrip(roundTrip, [outbound]), /đủ chuyến/);
  assert.throws(() => checkoutHrefForTrip(roundTrip, [outbound, { ...inbound, flight: { ...inbound.flight, id: flightA }, fare: { ...inbound.fare, flight_id: flightA } }]), /không còn phù hợp/);
  assert.throws(() => checkoutHrefForTrip(roundTrip, [outbound, { ...inbound, flight: { ...inbound.flight, departure_at: '2030-03-01T03:00:00Z' } }]), /không còn phù hợp/);
  assert.throws(() => checkoutHrefForTrip(roundTrip, [outbound, { ...inbound, fare: { ...inbound.fare, flight_id: flightA } }]), /không còn phù hợp/);
});
