import { z } from 'zod';

export const calendarDateSchema = z.iso.date('Enter a real date in YYYY-MM-DD format.')
  .refine(value => !value.startsWith('0000-'), 'The year must be 0001 or later.');

const passengerNameSchema = z.string().trim()
  .min(1, 'Enter the traveller’s name.')
  .max(100, 'Each name must be 100 characters or fewer.');

/** bookingDate is the caller-supplied booking calendar day, not the flight date. */
export function createBookingPassengerSchema(bookingDate: string) {
  const latestBirthDate = calendarDateSchema.parse(bookingDate);

  return z.object({
    givenNames: passengerNameSchema,
    familyName: passengerNameSchema,
    dateOfBirth: z.string().trim().pipe(calendarDateSchema)
      .refine(value => value <= latestBirthDate, 'Date of birth cannot be after the booking date.'),
  });
}

export type BookingPassengerInput = z.input<ReturnType<typeof createBookingPassengerSchema>>;
export type BookingPassenger = z.output<ReturnType<typeof createBookingPassengerSchema>>;
