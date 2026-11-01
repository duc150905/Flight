import { zodResolver } from '@hookform/resolvers/zod';
import { bookingContactSchema, type BookingContactInput } from './contact.ts';

/** onTouched: first validation on blur, subsequent validation while editing. */
export const checkoutValidationMode = { mode: 'onTouched', reValidateMode: 'onChange' } as const;
export function contactFormOptions(defaultValues: BookingContactInput) {
  return { ...checkoutValidationMode, resolver: zodResolver(bookingContactSchema), defaultValues };
}
