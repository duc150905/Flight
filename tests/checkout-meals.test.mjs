import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCheckoutDraftStore } from '../src/features/booking/draft.ts';
import { checkoutEstimate } from '../src/features/booking/estimate.ts';
import { quoteRequest, parseQuote, quoteMatchesRequest } from '../src/features/booking/quote.ts';
import { parsePendingBooking } from '../src/features/booking/pending-booking.ts';
import { pendingBookingFixture } from './fixtures/pending-booking.mjs';
import { isMealCurrent } from '../src/features/booking/baggage.ts';
import { loadBaggage } from '../src/features/booking/extras-data.ts';
import { translate } from '../src/features/i18n/translate.ts';
import { readFileSync } from 'node:fs';

const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const itinerary = {
  selection: { tripType: 'round_trip', passengers: { adults: 1, children: 0, infants: 0 }, segments: [
    { flightId: id(1), fareId: id(3), journeyIndex: 1, legIndex: 1 },
    { flightId: id(2), fareId: id(4), journeyIndex: 2, legIndex: 1 },
  ] },
  legs: [1, 2].map(n => ({ flightId: id(n), departureDate: '2026-11-13', prices: { adult: 1000000, child: 700000, infant: 100000, currency: 'VND' } })),
};
const meal = (flight = 1, amount = 110000) => ({ id: id(5 + flight), flightId: id(flight), productId: id(9), name: 'Chicken rice', amount, currency: 'VND' });
function store() { const s = createCheckoutDraftStore(); s.getState().beginCheckout(itinerary); s.getState().updatePassenger('adult-1', { dateOfBirth: '1990-01-01' }); return s; }

test('meal choices are independent per leg, replaceable, priced, removable and reset with the itinerary', () => {
  const s = store(); s.getState().setMeal('adult-1', id(1), meal()); s.getState().setMeal('adult-1', id(2), meal(2, 95000));
  assert.equal(checkoutEstimate(s.getState()).amount, 2205000);
  s.getState().setMeal('adult-1', id(1), { ...meal(), id: id(10), amount: 130000 });
  assert.equal(s.getState().meals.length, 2); assert.equal(checkoutEstimate(s.getState()).amount, 2225000);
  s.getState().setMeal('adult-1', id(1), null);
  assert.equal(s.getState().meals[0].flightId, id(2));
  s.getState().reset(); assert.deepEqual(s.getState().meals, []);
});

test('wrong-leg and invalid meal prices cannot enter the draft or estimate', () => {
  const s = store();
  for (const offer of [meal(2), { ...meal(), amount: -1 }, { ...meal(), amount: 1.1 }, { ...meal(), currency: 'USD' }]) {
    assert.throws(() => s.getState().setMeal('adult-1', id(1), offer), /extras.invalid/);
  }
  assert.equal(checkoutEstimate({ ...s.getState(), meals: [{ ...meal(), amount: -1 }] }), null);
});

test('quote payload sends meal identifiers only and changing meals changes request identity', () => {
  const s = store(); s.getState().setMeal('adult-1', id(1), meal());
  const request = quoteRequest(s.getState());
  assert.deepEqual(request.meals, [{ passengerId: 'adult-1', flightId: id(1), offerId: id(6) }]);
  assert.equal(JSON.stringify(request).includes('Chicken rice'), false);
  assert.equal(JSON.stringify(request).includes('110000'), false);
});

test('quote validates meal component sums and requires a meal line for selected meals', () => {
  const now = Date.now(); const s = store(); s.getState().setMeal('adult-1', id(1), meal());
  const lines = [1, 2].map(n => ({ passengerId: 'adult-1', flightId: id(n), passengerType: 'adult', requiresSeat: true,
    base: 1000000, tax: 0, fee: 0, baggage: 0, seat: 0, meal: n === 1 ? 110000 : 0, mealName: n === 1 ? 'Chicken rice' : null,
    baggageName: null, seatCode: null }));
  const raw = { currency: 'VND', base: 2000000, tax: 0, fee: 0, baggage: 0, seat: 0, meal: 110000, total: 2110000,
    quotedAt: new Date(now).toISOString(), expiresAt: new Date(now + 300000).toISOString(), lines };
  const q = parseQuote(raw, now); assert.equal(q.meal, 110000); assert.equal(quoteMatchesRequest(q, quoteRequest(s.getState())), true);
  assert.throws(() => parseQuote({ ...raw, meal: 0 }, now));
  assert.equal(quoteMatchesRequest({ ...q, lines: q.lines.map(l => ({ ...l, meal: 0, mealName: null })) }, quoteRequest(s.getState())), false);
});

test('pending order separates meal from legacy aggregate addons and retains old bookings', () => {
  assert.equal(parsePendingBooking(pendingBookingFixture).meal, 0);
  const raw = { ...pendingBookingFixture, baggage: 310000, baggageOnly: 200000, meal: 110000, total: 1910000,
    addons: [...pendingBookingFixture.addons, { passengerSegmentId: pendingBookingFixture.passengerSegments[0].id,
      flightId: pendingBookingFixture.segments[0].flightId, name: 'Chicken rice', category: 'meal', weightKg: null, amount: 110000 }] };
  const value = parsePendingBooking(raw); assert.equal(value.baggage, 200000); assert.equal(value.meal, 110000);
  assert.throws(() => parsePendingBooking({ ...raw, baggageOnly: 1 }));
});

test('menu substitutions, changed ingredients and changed prices require reselection', () => {
  const s = store(); s.getState().setMeal('adult-1', id(1), meal()); const choice = s.getState().meals[0];
  assert.equal(isMealCurrent(choice, [meal()]), true);
  for (const changed of [{ ...meal(), productId: id(20) }, { ...meal(), name: 'Beef rice' }, { ...meal(), description: 'Contains milk' }, meal(1, 120000)]) {
    assert.equal(isMealCurrent(choice, [changed]), false);
  }
});

test('meal loader uses only real offers for the selected flights with supported quantity', async () => {
  const data = { flight_fares: [{ id: id(3), flight_id: id(1), baggage_allowance: {} }, { id: id(4), flight_id: id(2), baggage_allowance: {} }],
    addon_products: [{ id: id(9), name: 'Rice', category: 'meal', description: 'Ingredients', weight_kg: null }],
    flight_addon_offers: [{ id: id(6), flight_id: id(1), product_id: id(9), unit_amount: 110000, currency: 'VND', max_quantity_per_passenger: 1 },
      { id: id(7), flight_id: id(2), product_id: id(9), unit_amount: 110000, currency: 'VND', max_quantity_per_passenger: 2 }] };
  const client = { from(table) { const q = { select() { return q; }, in() { return q; }, eq() { return q; }, then(resolve) { return Promise.resolve({ data: data[table], error: null }).then(resolve); } }; return q; } };
  const result = await loadBaggage(client, { legs: [{ fareId: id(3), flightId: id(1) }, { fareId: id(4), flightId: id(2) }] });
  assert.equal(result.meals.length, 1); assert.equal(result.meals[0].flightId, id(1));
});

test('seed menu names and ingredient descriptions display in both app languages', () => {
  const menu = JSON.parse(readFileSync(new URL('../supabase/seeds/meal-catalogue.json', import.meta.url), 'utf8'));
  for (const m of menu) {
    assert.equal(translate('en', m.nameVi), m.nameEn); assert.equal(translate('vi', m.nameVi), m.nameVi);
    assert.equal(translate('en', m.descriptionVi), m.descriptionEn);
  }
  assert.equal(translate('en', 'quote.meal'), 'Meals'); assert.equal(translate('vi', 'quote.meal'), 'Suất ăn');
});
