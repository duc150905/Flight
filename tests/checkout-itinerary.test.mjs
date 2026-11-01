import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hydrateItinerary, localCalendarDay } from '../src/features/booking/itinerary-data.ts';

const flightId = '11111111-1111-4111-8111-111111111111';
const fareId = '22222222-2222-4222-8222-222222222222';
const selection = { tripType: 'one_way', passengers: { adults: 1, children: 0, infants: 0 }, segments: [{ flightId, fareId, journeyIndex: 1, legIndex: 1 }] };
const origin = { id: 'sgn', iata_code: 'SGN', city: 'Ho Chi Minh City', country_code: 'VN', timezone: 'Asia/Ho_Chi_Minh', is_active: true };
const destination = { ...origin, id: 'han', iata_code: 'HAN', city: 'Hanoi' };
const flight = { id: flightId, departure_airport_id: 'sgn', arrival_airport_id: 'han', departure_at: '2026-12-01T18:00:00Z', arrival_at: '2026-12-01T20:00:00Z', flight_number: 'VN100', sales_close_at: '2026-12-01T17:00:00Z', published_at: '2026-01-01T00:00:00Z', status: 'scheduled' };
const fare = { id: fareId, flight_id: flightId, name: 'Economy Standard', is_active: true };
const row = { flight, fare, origin, destination };
const now = new Date('2026-11-01T00:00:00Z');
test('hydration derives calendar days at the airports rather than the device timezone', () => {
  const result = hydrateItinerary(selection, [row], now);
  assert.equal(result.legs[0].departureDate, '2026-12-02');
  assert.equal(result.legs[0].origin.iata_code, 'SGN');
  assert.equal(result.international, false);
  assert.equal(localCalendarDay('2026-12-01T18:00:00Z', 'America/Los_Angeles'), '2026-12-01');
});
test('a published delayed flight remains selectable before its sales cutoff', () => {
  assert.equal(hydrateItinerary(selection, [{ ...row, flight: { ...flight, status: 'delayed' } }], now).legs.length, 1);
});
test('hydration rejects wrong fares, unpublished/cancelled/closed flights, missing airports and impossible chronology', () => {
  for (const bad of [
    { ...row, fare: { ...fare, flight_id: 'another' } },
    { ...row, fare: { ...fare, is_active: false } },
    { ...row, flight: { ...flight, published_at: null } },
    { ...row, flight: { ...flight, status: 'cancelled' } },
    { ...row, flight: { ...flight, sales_close_at: '2026-10-01T00:00:00Z' } },
    { ...row, flight: { ...flight, arrival_at: flight.departure_at } },
    { ...row, origin: { ...origin, id: 'other' } },
    { ...row, destination: { ...destination, is_active: false } },
  ]) assert.throws(() => hydrateItinerary(selection, [bad], now));
  assert.throws(() => hydrateItinerary(selection, [], now));
});
test('connections require matching airports and later departures; round trips must return to the origin', () => {
  const secondId = '33333333-3333-4333-8333-333333333333';
  const secondFareId = '44444444-4444-4444-8444-444444444444';
  const selected = { ...selection, tripType: 'round_trip', segments: [...selection.segments, { flightId: secondId, fareId: secondFareId, journeyIndex: 2, legIndex: 1 }] };
  const second = { flight: { ...flight, id: secondId, departure_airport_id: 'han', arrival_airport_id: 'sgn', departure_at: '2026-12-05T00:00:00Z', arrival_at: '2026-12-05T02:00:00Z' }, fare: { ...fare, id: secondFareId, flight_id: secondId }, origin: destination, destination: origin };
  assert.equal(hydrateItinerary(selected, [row, second], now).legs.length, 2);
  assert.throws(() => hydrateItinerary(selected, [row, { ...second, flight: { ...second.flight, departure_at: flight.departure_at } }], now));
  assert.throws(() => hydrateItinerary(selected, [row, { ...second, destination, flight: { ...second.flight, arrival_airport_id: 'han' } }], now));
  const connection = { ...selected, tripType: 'one_way', segments: [selected.segments[0], { ...selected.segments[1], journeyIndex: 1, legIndex: 2 }] };
  assert.throws(() => hydrateItinerary(connection, [row, { ...second, origin, flight: { ...second.flight, departure_airport_id: 'sgn' } }], now));
});
