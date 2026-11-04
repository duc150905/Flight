import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.generated';
import { databaseIdSchema } from '../../lib/database-id.ts';
import { parseBookingReceipt,type BookingReceipt } from './create-booking.ts';

const uuid = databaseIdSchema(); const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const schema = z.object({
  contact: z.object({ name: z.string(), email: z.string(), phone: z.string() }),
  base: money, tax: money, fee: money, baggage: money, seat: money,
  passengers: z.array(z.object({ id: uuid, ordinal: z.number().int().positive(), givenNames: z.string(), familyName: z.string(), gender: z.string().nullable() })).min(1).max(18),
  segments: z.array(z.object({ id: uuid, flightId: uuid, journeyIndex: z.number().int().positive(), legIndex: z.number().int().positive(),
    snapshot: z.object({ flight_number: z.string(), airline_name: z.string(), departure_iata: z.string(), arrival_iata: z.string(), departure_at: z.iso.datetime({ offset: true }), arrival_at: z.iso.datetime({ offset: true }), departure_timezone: z.string(), arrival_timezone: z.string(), fare_name: z.string() }) })).min(1).max(12),
  passengerSegments: z.array(z.object({ id: uuid, passengerId: uuid, flightId: uuid, passengerType: z.enum(['adult', 'child', 'infant']), requiresSeat: z.boolean(), accompanyingPassengerId: uuid.nullable(),
    allowance: z.object({ cabin_pieces: money, cabin_kg: z.number().nonnegative(), checked_pieces: money, checked_kg: z.number().nonnegative() }) })).min(1).max(216),
  seats: z.array(z.object({ passengerSegmentId: uuid, flightId: uuid, seatCode: z.string(), amount: money, status: z.enum(['held', 'confirmed', 'released', 'expired']) })).max(216),
  addons: z.array(z.object({ passengerSegmentId: uuid, flightId: uuid, name: z.string(), weightKg: z.number().nullable(), amount: money })).max(216),
});
export function parsePendingBooking(raw: unknown) {
  const receipt = parseBookingReceipt(raw); const details = schema.parse(raw);
  if (details.base + details.tax + details.fee + details.baggage + details.seat !== receipt.total
    || details.passengerSegments.length !== details.passengers.length * details.segments.length
    || new Set(details.passengers.map(p => p.id)).size !== details.passengers.length
    || new Set(details.segments.map(s => s.flightId)).size !== details.segments.length
    || details.passengerSegments.some(ps => !details.passengers.some(p => p.id === ps.passengerId) || !details.segments.some(s => s.flightId === ps.flightId))) throw new Error('booking.loadError');
  return { ...receipt, ...details };
}
export type PendingBooking = ReturnType<typeof parsePendingBooking>;
export function withLatestReceipt(booking:PendingBooking,receipt?:BookingReceipt):PendingBooking{
 return receipt&&receipt.id===booking.id&&Date.parse(receipt.serverNow)>=Date.parse(booking.serverNow)?{...booking,...receipt}:booking;
}
export function demoTicketReady(booking:PendingBooking){
 return booking.status==='confirmed'&&booking.passengerSegments.every(ps=>!ps.requiresSeat||booking.seats.some(s=>s.passengerSegmentId===ps.id&&s.flightId===ps.flightId&&s.status==='confirmed'));
}
/** A receipt URL can stay open during cancellation; ended bookings remain readable. */
export function bookingScreenMode(booking:PendingBooking,receipt=false){
 if(booking.status!=='confirmed')return 'details';
 if(!demoTicketReady(booking))return 'refresh-ticket';
 return receipt?'receipt':'success';
}
export function holdSecondsRemaining(booking: { status: string; expiresAt: string; serverNow: string }, elapsedMs: number) {
  return booking.status === 'pending_payment' ? Math.max(0, Math.ceil((Date.parse(booking.expiresAt) - Date.parse(booking.serverNow) - Math.max(0, elapsedMs)) / 1000)) : 0;
}
export async function loadPendingBooking(client: Pick<SupabaseClient<Database>, 'rpc'>, id: string) {
  const { data, error } = await client.rpc('get_pending_booking', { p_booking_id: uuid.parse(id) });
  if (error) throw new Error(error.message === 'booking.notFound' ? 'booking.notFound' : 'booking.loadError');
  return parsePendingBooking(data);
}
export async function findBookingRequest(client: Pick<SupabaseClient<Database>, 'rpc'>, id: string) {
  const { data, error } = await client.rpc('find_booking_request', { p_request_id: uuid.parse(id) });
  if (error) throw new Error('booking.recoveryError');
  return data === null ? null : parseBookingReceipt(data);
}
