import type { CheckoutDraftState } from './draft.ts';
import { bookingContactSchema } from './contact.ts';
import { localCalendarDay } from './itinerary-data.ts';
import { derivePassengerSegments, passengerPolicySchema } from './passenger-policy.ts';

/** Revalidate current raw data every time; review never creates/confirms an order. */
export function checkoutReview(draft: CheckoutDraftState, now = new Date()) {
  const itinerary = draft.itinerary;
  if (!itinerary?.legs.length || itinerary.legs.some(leg => !(Date.parse(leg.departureAt) > now.getTime()) || !(Date.parse(leg.salesCloseAt) > now.getTime()))) {
    return { success: false as const, target: 'selection' as const, messages: ['These flights are no longer available for checkout. Please choose your flights again.'] };
  }
  const contact = bookingContactSchema.safeParse(draft.contact);
  if (!contact.success) return { success: false as const, target: 'contact' as const, messages: contact.error.issues.map(i => i.message) };
  const bookingDate = localCalendarDay(now, itinerary.legs[0].origin.timezone);
  const passengers = passengerPolicySchema(itinerary, bookingDate).safeParse({ passengers: draft.passengers });
  if (!passengers.success) return { success: false as const, target: 'passengers' as const, messages: passengers.error.issues.map(i => i.message) };
  return { success: true as const, data: { itinerary, contact: contact.data, passengers: passengers.data.passengers,
    passengerSegments: derivePassengerSegments(passengers.data.passengers, itinerary.legs) } };
}
