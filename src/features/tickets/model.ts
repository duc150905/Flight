import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.generated';

type Booking = Database['public']['Tables']['bookings']['Row'];
type Segment = Database['public']['Tables']['booking_segments']['Row'];
type Passenger = Database['public']['Tables']['booking_passengers']['Row'];

export const TICKET_PAGE_SIZE = 20;
export type BookingSummary = Pick<Booking,
  'id' | 'booking_code' | 'status' | 'trip_type' | 'total_amount' | 'currency' | 'created_at' | 'expires_at'>;
export type BookingDetails = Pick<Booking,
  'id' | 'user_id' | 'booking_code' | 'status' | 'trip_type' | 'total_amount' | 'base_amount' |
  'tax_amount' | 'fee_amount' | 'seat_amount' | 'addon_amount' | 'currency' | 'created_at' |
  'expires_at' | 'confirmed_at' | 'cancelled_at' | 'contact_name' | 'contact_email' | 'contact_phone'>;
export type TicketSegment = Pick<Segment,
  'id' | 'booking_id' | 'journey_number' | 'leg_number' | 'flight_snapshot' | 'fare_code_snapshot' | 'cabin_class'>;
export type TicketPassenger = Pick<Passenger, 'id' | 'booking_id' | 'ordinal' | 'given_names' | 'family_name'>;
export type TicketDetails = { booking: BookingDetails; segments: TicketSegment[]; passengers: TicketPassenger[] };

const summaryColumns = 'id,booking_code,status,trip_type,total_amount,currency,created_at,expires_at';
const detailColumns = 'id,user_id,booking_code,status,trip_type,total_amount,base_amount,tax_amount,fee_amount,seat_amount,addon_amount,currency,created_at,expires_at,confirmed_at,cancelled_at,contact_name,contact_email,contact_phone';
const segmentColumns = 'id,booking_id,journey_number,leg_number,flight_snapshot,fare_code_snapshot,cabin_class';
const passengerColumns = 'id,booking_id,ordinal,given_names,family_name';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TicketNotFoundError extends Error {
  constructor() { super('Booking not found or inaccessible'); }
}

export function createTicketService(client: Pick<SupabaseClient<Database>, 'from'>) {
  return {
    async list(userId: string, page = 0): Promise<BookingSummary[]> {
      if (!userId || !Number.isSafeInteger(page) || page < 0) throw new RangeError('Invalid ticket list request');
      const start = page * TICKET_PAGE_SIZE;
      const { data, error } = await client.from('bookings').select(summaryColumns)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(start, start + TICKET_PAGE_SIZE - 1);
      if (error) throw error;
      return data ?? [];
    },
    async details(userId: string, bookingId: string): Promise<TicketDetails> {
      if (!userId || !uuidPattern.test(bookingId)) throw new TicketNotFoundError();
      const { data: booking, error } = await client.from('bookings').select(detailColumns)
        .eq('id', bookingId).eq('user_id', userId).maybeSingle();
      if (error) throw error;
      if (!booking) throw new TicketNotFoundError();
      const [segmentResult, passengerResult] = await Promise.all([
        client.from('booking_segments').select(segmentColumns).eq('booking_id', bookingId)
          .order('journey_number', { ascending: true }).order('leg_number', { ascending: true }),
        client.from('booking_passengers').select(passengerColumns).eq('booking_id', bookingId)
          .order('ordinal', { ascending: true }),
      ]);
      if (segmentResult.error) throw segmentResult.error;
      if (passengerResult.error) throw passengerResult.error;
      return { booking, segments: segmentResult.data ?? [], passengers: passengerResult.data ?? [] };
    },
  };
}

export function ticketErrorMessage(error: unknown): string {
  return error instanceof TicketNotFoundError
    ? 'Không tìm thấy đơn vé này hoặc bạn không có quyền xem.'
    : 'Không thể tải đơn vé. Hãy kiểm tra kết nối và thử lại.';
}
