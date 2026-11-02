// Read-only live integration check. Uses the same publishable key as the app.
// Run: node --env-file=.env.local scripts/checkout-demo-smoke.mjs
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { loadCheckoutItinerary } from '../src/features/booking/itinerary-data.ts';
import { createCheckoutDraftStore } from '../src/features/booking/draft.ts';
import { checkoutReview } from '../src/features/booking/review.ts';
import { checkoutEstimate } from '../src/features/booking/estimate.ts';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Load the public Supabase environment first.');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: airline, error: airlineError } = await client.from('airlines').select('id').eq('iata_code', 'F0').single();
assert.equal(airlineError, null);
const { data: flights, error: flightError } = await client.from('flight_instances').select('id,flight_number,departure_at')
  .eq('airline_id', airline.id).gt('departure_at', new Date().toISOString()).order('departure_at', { ascending: false });
assert.equal(flightError, null);
const selected = ['F0101', 'F0102', 'F0103'].map(number => flights.find(flight => flight.flight_number === number));
assert.ok(selected.every(Boolean), 'Seed future fixtures before this check');
const { data: fares, error: fareError } = await client.from('flight_fares').select('id,flight_id').in('flight_id', selected.map(f => f.id)).eq('fare_code', 'DEMO_STANDARD');
assert.equal(fareError, null);
const segment = (flight, journeyIndex) => ({ flightId: flight.id, fareId: fares.find(fare => fare.flight_id === flight.id).id, journeyIndex, legIndex: 1 });
const itinerary = await loadCheckoutItinerary(client, { tripType: 'round_trip', passengers: { adults: 1, children: 1, infants: 1 }, segments: [segment(selected[0], 1), segment(selected[1], 2)] });
const birthday = new Date(`${itinerary.legs[0].departureDate}T12:00:00Z`); birthday.setUTCDate(birthday.getUTCDate() + 1);
const birthFor = years => `${birthday.getUTCFullYear() - years}-${birthday.toISOString().slice(5, 10)}`;
const store = createCheckoutDraftStore(); store.getState().beginCheckout(itinerary);
store.getState().updateContact({ contactName: 'Review', contactEmail: 'demo@example.com', contactPhone: '+84901234567' });
for (const [index, passenger] of store.getState().passengers.entries()) {
  store.getState().updatePassenger(passenger.id, { givenNames: 'Demo', familyName: 'Traveller', dateOfBirth: index === 0 ? '1990-01-01' : birthFor(index === 1 ? 12 : 2),
    nationalityCode: 'VN', passportIssuerCountry: 'VN', passportNumber: `DEMO-ONLY-${index}`, passportExpiryDate: '2036-12-31',
    ...(index === 2 ? { accompanyingAdultId: 'adult-1' } : {}) });
}
const result = checkoutReview(store.getState()); assert.equal(result.success, true);
assert.deepEqual(result.data.passengerSegments.filter(s => s.passengerId === 'child-1').map(s => s.passengerType), ['child', 'adult']);
assert.deepEqual(result.data.passengerSegments.filter(s => s.passengerId === 'infant-1').map(s => s.requiresSeat), [false, true]);
assert.equal(checkoutEstimate(store.getState()).amount, 5620000);
const domestic = await loadCheckoutItinerary(client, { tripType: 'one_way', passengers: { adults: 1, children: 0, infants: 0 }, segments: [segment(selected[2], 1)] });
assert.equal(domestic.international, false);
console.log('Live read-only smoke passed: hydration, per-leg birthdays/seats, international documents, estimate and domestic route. No customer data written.');
