import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.generated';
import type { CheckoutDraftState } from './draft.ts';
import { checkoutReview } from './review.ts';
import { parseQuote, quoteMatchesRequest, quoteRequest, type CheckoutQuote } from './quote.ts';
import { databaseIdSchema } from '../../lib/database-id.ts';

const receiptSchema = z.object({ id: databaseIdSchema(), bookingCode: z.string().min(6).max(32),
  status: z.enum(['pending_payment', 'confirmed', 'expired', 'cancelled']),
  total: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), currency: z.literal('VND'),
  expiresAt: z.iso.datetime({ offset: true }), serverNow: z.iso.datetime({ offset: true }) });
export type BookingReceipt = z.output<typeof receiptSchema>;
export const parseBookingReceipt = (raw: unknown) => receiptSchema.parse(raw);
export function bookingPayload(draft: CheckoutDraftState, displayedQuote: CheckoutQuote) {
  const review = checkoutReview(draft);
  if (!review.success) throw new Error('extras.checkDetails');
  const checkout = quoteRequest(draft); const expectedQuote = parseQuote(displayedQuote);
  if (!quoteMatchesRequest(expectedQuote, checkout)) throw new Error('quote.invalid');
  return { checkout, expectedQuote, contact: review.data.contact, travellers: review.data.passengers };
}
export type BookingPayload = ReturnType<typeof bookingPayload>;
const safeCodes = new Set(['booking.authRequired', 'booking.invalid', 'booking.requestConflict', 'booking.priceChanged',
  'booking.quoteExpired', 'booking.seatRequired', 'booking.inventoryChanged', 'quote.authRequired', 'quote.invalid',
  'quote.unavailable', 'quote.offerUnavailable', 'quote.seatUnavailable', 'quote.seatIneligible', 'quote.soldOut']);
export function bookingError(error: unknown) {
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
  return safeCodes.has(message) ? message : 'booking.createError';
}
export async function createBooking(client: Pick<SupabaseClient<Database>, 'rpc'>, requestId: string, payload: BookingPayload) {
  const { data, error } = await client.rpc('create_booking', { p_request_id: databaseIdSchema().parse(requestId), p_request: payload });
  if (error) throw new Error(bookingError(error));
  return parseBookingReceipt(data);
}
