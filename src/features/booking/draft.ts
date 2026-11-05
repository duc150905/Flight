import { createStore } from 'zustand/vanilla';
import { z } from 'zod';

import { bookingContactSchema, type BookingContactInput } from './contact.ts';
import { createBookingPassengerSchema, type PassengerDetailsInput } from './passenger.ts';
import type { CheckoutItinerary } from './itinerary-data.ts';
import { selectedItinerarySchema } from './selection.ts';
import type { BaggageChoice, BaggageOffer, MealChoice, MealOffer, SeatChoice } from './baggage.ts';
import { seatEligibility, type MapSeat } from './seats.ts';

export type CheckoutDraft = {
  contact: BookingContactInput;
  passengers: { id: string; values: PassengerDetailsInput }[];
};

export type CheckoutDraftState = CheckoutDraft & {
  baggage: BaggageChoice[];
  meals: MealChoice[];
  seats: SeatChoice[];
  revision: number;
  setBaggage: (passengerId: string, flightId: string, offer: BaggageOffer | null) => void;
  setMeal: (passengerId: string, flightId: string, meal: MealOffer | null) => void;
  setSeat: (passengerId: string, flightId: string, seat: MapSeat | null) => void;
  itinerary: CheckoutItinerary | null;
  beginCheckout: (itinerary: CheckoutItinerary) => void;
  finish: () => void;
  updateContact: (patch: Partial<BookingContactInput>) => void;
  updatePassenger: (id: string, patch: Partial<PassengerDetailsInput>) => void;
  removePassenger: (id: string) => void;
  reset: () => void;
};

const emptyContact = (): BookingContactInput => ({ contactName: '', contactEmail: '', contactPhone: '' });

/** One in-memory store per checkout flow; partial/invalid form text is intentional. */
export function createCheckoutDraftStore() {
  return createStore<CheckoutDraftState>()((set, get) => ({
    itinerary: null,
    contact: emptyContact(),
    passengers: [],
    baggage: [], meals: [], seats: [], revision: 0,
    setSeat: (passengerId, flightId, seat) => {
      const state = get(); const passenger = state.passengers.find(p => p.id === passengerId);
      const leg = state.itinerary?.legs.find(l => l.flightId === flightId);
      if (!passenger || !leg) throw new Error('extras.invalid');
      if (seat) { const error = seatEligibility(seat, passenger, leg, state.passengers, state.seats); if (error) throw new Error(error); }
      const remaining = state.seats.filter(s => s.passengerId !== passengerId || s.flightId !== flightId);
      set({ seats: seat ? [...remaining, { passengerId, flightId, seatId: seat.flight_seat_id, seatCode: seat.seat_code,
        amount: seat.selection_fee_amount, currency: seat.currency }] : remaining, revision: state.revision + 1 });
    },
    setMeal: (passengerId, flightId, meal) => {
      const state = get();
      if (!state.passengers.some(p => p.id === passengerId) || !state.itinerary?.legs.some(l => l.flightId === flightId)
        || (meal && (meal.flightId !== flightId || !Number.isSafeInteger(meal.amount) || meal.amount < 0 || meal.currency !== 'VND'))) {
        throw new Error('extras.invalid');
      }
      const currentMeals = state.meals ?? [];
      const remaining = currentMeals.filter(m => m.passengerId !== passengerId || m.flightId !== flightId);
      set({
        meals: meal ? [...remaining, { passengerId, flightId, offerId: meal.id, productId: meal.productId, name: meal.name, description: meal.description, amount: meal.amount, currency: meal.currency }] : remaining,
        revision: state.revision + 1,
      });
    },
    setBaggage: (passengerId, flightId, offer) => {
      const state = get();
      if (!state.passengers.some(p => p.id === passengerId) || !state.itinerary?.legs.some(l => l.flightId === flightId)
        || (offer && (offer.flightId !== flightId || !Number.isSafeInteger(offer.amount) || offer.amount < 0 || offer.currency !== 'VND'))) throw new Error('extras.invalid');
      const remaining = state.baggage.filter(b => b.passengerId !== passengerId || b.flightId !== flightId);
      set({ baggage: offer ? [...remaining, { passengerId, flightId, offerId: offer.id, name: offer.name,
        weightKg: offer.weightKg, amount: offer.amount, currency: offer.currency }] : remaining, revision: state.revision + 1 });
    },
    beginCheckout: itinerary => {
      const selection = selectedItinerarySchema.parse(itinerary.selection);
      const snapshot: CheckoutItinerary = JSON.parse(JSON.stringify({ ...itinerary, selection }));
      if (JSON.stringify(get().itinerary?.selection) === JSON.stringify(selection)) {
        set({ itinerary: snapshot, revision: get().revision + 1 }); return;
      }
      const passengers = (['adult', 'child', 'infant'] as const).flatMap(type => {
        const count = type === 'adult' ? selection.passengers.adults : type === 'child' ? selection.passengers.children : selection.passengers.infants;
        return Array.from({ length: count }, (_, i) => ({ id: `${type}-${i + 1}`,
          values: { givenNames: '', familyName: '', dateOfBirth: '' } }));
      });
      set({ itinerary: snapshot, contact: emptyContact(), passengers, baggage: [], meals: [], seats: [], revision: get().revision + 1 });
    },
    finish: () => get().reset(),
    updateContact: patch => set(({ contact }) => ({
      contact: {
        contactName: patch.contactName ?? contact.contactName,
        contactEmail: patch.contactEmail ?? contact.contactEmail,
        contactPhone: patch.contactPhone ?? contact.contactPhone,
      },
    })),
    updatePassenger: (id, patch) => {
      if (!id.trim()) throw new Error('Mã hành khách trong bản nháp không được trống.');
      set(({ passengers, seats, revision }) => {
        const existing = passengers.find(passenger => passenger.id === id);
        const updated: CheckoutDraft['passengers'][number] = { id, values: {
          givenNames: patch.givenNames ?? existing?.values.givenNames ?? '',
          familyName: patch.familyName ?? existing?.values.familyName ?? '',
          dateOfBirth: patch.dateOfBirth ?? existing?.values.dateOfBirth ?? '',
        } };
        for (const key of ['nationalityCode', 'passportNumber', 'passportExpiryDate', 'passportIssuerCountry', 'accompanyingAdultId', 'gender'] as const) {
          const value = patch[key] ?? existing?.values[key];
          if (value !== undefined) updated.values[key] = value;
        }
        const eligibilityChanged = (patch.dateOfBirth !== undefined && patch.dateOfBirth !== existing?.values.dateOfBirth)
          || (patch.accompanyingAdultId !== undefined && patch.accompanyingAdultId !== existing?.values.accompanyingAdultId);
        return { seats: eligibilityChanged ? [] : seats, revision: revision + 1, passengers: existing
          ? passengers.map(passenger => passenger.id === id ? updated : passenger)
          : [...passengers, updated] };
      });
    },
    removePassenger: id => set(({ passengers, baggage, meals, revision }) => ({ passengers: passengers.filter(passenger => passenger.id !== id),
      baggage: baggage.filter(b => b.passengerId !== id), meals: (meals ?? []).filter(m => m.passengerId !== id), seats: [], revision: revision + 1 })),
    reset: () => set({ itinerary: null, contact: emptyContact(), passengers: [], baggage: [], meals: [], seats: [], revision: get().revision + 1 }),
  }));
}

/** Returns a normalized copy; leaves the draft intact so the form can show errors. */
export function validateCheckoutDraft(draft: CheckoutDraft, bookingDate: string) {
  return z.object({
    contact: bookingContactSchema,
    passengers: z.array(z.object({
      id: z.string().refine(id => id.trim().length > 0, 'Mã hành khách không được trống.'),
      values: createBookingPassengerSchema(bookingDate),
    }))
      .min(1, 'Cần ít nhất một hành khách.')
      .refine(passengers => new Set(passengers.map(passenger => passenger.id)).size === passengers.length,
        'Mã hành khách trong bản nháp không được trùng nhau.'),
  }).safeParse(draft);
}
