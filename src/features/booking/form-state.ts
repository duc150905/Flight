import { zodResolver } from '@hookform/resolvers/zod';
import { bookingContactSchema, type BookingContactInput } from './contact.ts';
import { z } from 'zod';
import { passengerDetailsSchema, passengerPolicySchema } from './passenger-policy.ts';
import type { CheckoutItinerary } from './itinerary-data.ts';
import type { CheckoutDraft } from './draft.ts';

/** onTouched: first validation on blur, subsequent validation while editing. */
export const checkoutValidationMode = { mode: 'onTouched', reValidateMode: 'onChange' } as const;
export function contactFormOptions(defaultValues: BookingContactInput) {
  return { ...checkoutValidationMode, resolver: zodResolver(bookingContactSchema), defaultValues };
}
export function passengerFormSchema(bookingDate: string) {
  return z.object({ passengers: z.array(z.object({
    id: z.string().min(1), values: passengerDetailsSchema(bookingDate),
  })).min(1, 'Add at least one traveller.') });
}
export function passengerFormOptions(passengers: CheckoutDraft['passengers'], bookingDate: string, itinerary?: CheckoutItinerary) {
  return { ...checkoutValidationMode, resolver: zodResolver(itinerary ? passengerPolicySchema(itinerary, bookingDate) : passengerFormSchema(bookingDate)), defaultValues: { passengers } };
}
