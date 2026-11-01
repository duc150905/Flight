import { zodResolver } from '@hookform/resolvers/zod';
import { bookingContactSchema, type BookingContactInput } from './contact.ts';
import { z } from 'zod';
import { passengerDetailsSchema, passengerPolicySchema } from './passenger-policy.ts';
import type { CheckoutItinerary } from './itinerary-data.ts';
import type { CheckoutDraft } from './draft.ts';
import type { FieldPath, UseFormReturn } from 'react-hook-form';

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
type PassengerFormValues = z.input<ReturnType<typeof passengerFormSchema>>;
export function restoreContactForm(form: Pick<UseFormReturn<BookingContactInput>, 'reset'>, contact: BookingContactInput) {
  form.reset(contact);
}
export function restorePassengerForm(form: Pick<UseFormReturn<PassengerFormValues>, 'reset'>, passengers: CheckoutDraft['passengers']) {
  form.reset({ passengers });
}
export async function revalidateCompanionFields(form: Pick<UseFormReturn<PassengerFormValues>, 'getValues' | 'getFieldState' | 'trigger'>) {
  const paths: FieldPath<PassengerFormValues>[] = [];
  form.getValues('passengers').forEach((passenger, index) => {
    if (!passenger.id.startsWith('infant-')) return;
    const path = `passengers.${index}.values.accompanyingAdultId` as const;
    const state = form.getFieldState(path);
    if (state.isTouched || state.error) paths.push(path);
  });
  return paths.length ? form.trigger(paths) : true;
}
