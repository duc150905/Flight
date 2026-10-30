import { z } from 'zod';

const calendarDateSchema = z.iso.date('Ngày cần có thật và theo định dạng YYYY-MM-DD.')
  .refine(value => !value.startsWith('0000-'), 'Năm phải từ 0001 trở đi.');

const passengerNameSchema = z.string().trim()
  .min(1, 'Hãy nhập đầy đủ họ và tên hành khách.')
  .max(100, 'Mỗi phần họ hoặc tên không quá 100 ký tự.');

/** bookingDate is the caller-supplied booking calendar day, not the flight date. */
export function createBookingPassengerSchema(bookingDate: string) {
  const latestBirthDate = calendarDateSchema.parse(bookingDate);

  return z.object({
    givenNames: passengerNameSchema,
    familyName: passengerNameSchema,
    dateOfBirth: z.string().trim().pipe(calendarDateSchema)
      .refine(value => value <= latestBirthDate, 'Ngày sinh không được sau ngày đặt vé.'),
  });
}

export type BookingPassengerInput = z.input<ReturnType<typeof createBookingPassengerSchema>>;
export type BookingPassenger = z.output<ReturnType<typeof createBookingPassengerSchema>>;
