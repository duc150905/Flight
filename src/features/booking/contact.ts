import { z } from 'zod';

const phoneMessage = 'Enter 7–15 digits, optionally starting with + and a country code.';

const contactPhoneSchema = z.string().trim()
  .regex(/^\+?[0-9 ().-]+$/, phoneMessage)
  .transform(value => value.replace(/[ ().-]/g, ''))
  // Keep domestic leading zeros; never assume the caller's country code.
  .pipe(z.string().regex(/^(?:\+[1-9][0-9]{6,14}|[0-9]{7,15})$/, phoneMessage));

/** Contact for this booking, independent of the account holder and passengers. */
export const bookingContactSchema = z.object({
  contactName: z.string().trim()
    .min(2, 'Enter a contact name with at least 2 characters.')
    .max(100, 'Contact name must be 100 characters or fewer.'),
  contactEmail: z.string().trim().toLowerCase().pipe(z.email('Enter a valid contact email address.')),
  contactPhone: contactPhoneSchema,
});

export type BookingContactInput = z.input<typeof bookingContactSchema>;
export type BookingContact = z.output<typeof bookingContactSchema>;
