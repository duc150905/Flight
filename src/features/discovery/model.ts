import { z } from 'zod';
import type { Database } from '@/types/database.generated';

export type Airport = Database['public']['Tables']['airports']['Row'];
export type Airline = Database['public']['Tables']['airlines']['Row'];
export type Destination = Database['public']['Tables']['destinations']['Row'];
export type Flight = Database['public']['Tables']['flight_instances']['Row'];
export type Fare = Database['public']['Tables']['flight_fares']['Row'];
export type CabinClass = Database['public']['Enums']['cabin_class'];

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Nhập ngày theo dạng YYYY-MM-DD.').refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Ngày khởi hành không hợp lệ.');

export const searchSchema = z.object({
  originId: z.uuid('Chọn sân bay đi.'),
  destinationId: z.uuid('Chọn sân bay đến.'),
  departureDate: calendarDate,
  adults: z.coerce.number().int().min(1).max(9),
  children: z.coerce.number().int().min(0).max(8),
  infants: z.coerce.number().int().min(0).max(9),
  cabinClass: z.enum(['economy', 'premium_economy', 'business', 'first']),
}).superRefine((value, context) => {
  if (value.originId === value.destinationId) context.addIssue({
    code: 'custom', path: ['destinationId'], message: 'Sân bay đến phải khác sân bay đi.',
  });
  if (value.infants > value.adults) context.addIssue({
    code: 'custom', path: ['infants'], message: 'Mỗi em bé cần đi cùng một người lớn.',
  });
  if (value.adults + value.children > 9) context.addIssue({
    code: 'custom', path: ['children'], message: 'Tối đa 9 hành khách cần ghế.',
  });
});

export type SearchCriteria = z.output<typeof searchSchema>;

export function localDate(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const part = (name: string) => parts.find(item => item.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function validateSearch(input: unknown, timezone: string, now = new Date()): SearchCriteria {
  const criteria = searchSchema.parse(input);
  if (criteria.departureDate < localDate(now, timezone)) {
    throw new Error('Ngày khởi hành không được ở trong quá khứ tại sân bay đi.');
  }
  return criteria;
}

// UTC bounds are wider than one day. The final match uses the departure
// airport's IANA timezone, including local DST transitions.
export function broadUtcWindow(date: string) {
  const midnight = Date.parse(`${date}T00:00:00Z`);
  return {
    from: new Date(midnight - 86_400_000).toISOString(),
    until: new Date(midnight + 2 * 86_400_000).toISOString(),
  };
}

export function fareTotal(fare: Fare, criteria: SearchCriteria): number {
  const amount = criteria.adults * (fare.adult_base_amount + fare.adult_tax_amount + fare.adult_fee_amount)
    + criteria.children * (fare.child_base_amount + fare.child_tax_amount + fare.child_fee_amount)
    + criteria.infants * (fare.infant_base_amount + fare.infant_tax_amount + fare.infant_fee_amount);
  if (!Number.isSafeInteger(amount)) throw new Error('Không thể hiển thị giá vé này.');
  return amount;
}

export type FlightOffer = {
  flight: Flight;
  fare: Fare;
  airline: Airline;
  origin: Airport;
  destination: Airport;
  total: number;
};

export const cabinLabels: Record<CabinClass, string> = {
  economy: 'Phổ thông', premium_economy: 'Phổ thông đặc biệt',
  business: 'Thương gia', first: 'Hạng nhất',
};

export function formatMoney(amount: number, currency = 'VND') {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency}`;
}
