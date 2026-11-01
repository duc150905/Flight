import { z } from 'zod';

const phoneMessage = 'Số điện thoại cần từ 7 đến 15 chữ số, có thể bắt đầu bằng + và mã quốc gia.';

const contactPhoneSchema = z.string().trim()
  .regex(/^\+?[0-9 ().-]+$/, phoneMessage)
  .transform(value => value.replace(/[ ().-]/g, ''))
  // Keep domestic leading zeros; never assume the caller's country code.
  .pipe(z.string().regex(/^(?:\+[1-9][0-9]{6,14}|[0-9]{7,15})$/, phoneMessage));

/** Contact for this booking, independent of the account holder and passengers. */
export const bookingContactSchema = z.object({
  contactName: z.string().trim()
    .min(2, 'Họ tên liên hệ cần ít nhất 2 ký tự.')
    .max(100, 'Họ tên liên hệ không quá 100 ký tự.'),
  contactEmail: z.string().trim().toLowerCase().pipe(z.email('Email liên hệ không hợp lệ.')),
  contactPhone: contactPhoneSchema,
});

export type BookingContactInput = z.input<typeof bookingContactSchema>;
export type BookingContact = z.output<typeof bookingContactSchema>;
