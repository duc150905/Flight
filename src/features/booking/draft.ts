import { createStore } from 'zustand/vanilla';
import { z } from 'zod';

import { bookingContactSchema, type BookingContactInput } from './contact.ts';
import { createBookingPassengerSchema, type PassengerDetailsInput } from './passenger.ts';
import type { CheckoutItinerary } from './itinerary-data.ts';
import { selectedItinerarySchema } from './selection.ts';

export type CheckoutDraft = {
  contact: BookingContactInput;
  passengers: { id: string; values: PassengerDetailsInput }[];
};

export type CheckoutDraftState = CheckoutDraft & {
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
    beginCheckout: itinerary => {
      const selection = selectedItinerarySchema.parse(itinerary.selection);
      const snapshot: CheckoutItinerary = JSON.parse(JSON.stringify({ ...itinerary, selection }));
      if (JSON.stringify(get().itinerary?.selection) === JSON.stringify(selection)) {
        set({ itinerary: snapshot }); return;
      }
      const passengers = (['adult', 'child', 'infant'] as const).flatMap(type => {
        const count = type === 'adult' ? selection.passengers.adults : type === 'child' ? selection.passengers.children : selection.passengers.infants;
        return Array.from({ length: count }, (_, i) => ({ id: `${type}-${i + 1}`,
          values: { givenNames: '', familyName: '', dateOfBirth: '' } }));
      });
      set({ itinerary: snapshot, contact: emptyContact(), passengers });
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
      set(({ passengers }) => {
        const existing = passengers.find(passenger => passenger.id === id);
        const updated: CheckoutDraft['passengers'][number] = { id, values: {
          givenNames: patch.givenNames ?? existing?.values.givenNames ?? '',
          familyName: patch.familyName ?? existing?.values.familyName ?? '',
          dateOfBirth: patch.dateOfBirth ?? existing?.values.dateOfBirth ?? '',
        } };
        for (const key of ['nationalityCode', 'passportNumber', 'passportExpiryDate', 'passportIssuerCountry', 'accompanyingAdultId'] as const) {
          const value = patch[key] ?? existing?.values[key];
          if (value !== undefined) updated.values[key] = value;
        }
        return { passengers: existing
          ? passengers.map(passenger => passenger.id === id ? updated : passenger)
          : [...passengers, updated] };
      });
    },
    removePassenger: id => set(({ passengers }) => ({ passengers: passengers.filter(passenger => passenger.id !== id) })),
    reset: () => set({ itinerary: null, contact: emptyContact(), passengers: [] }),
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
