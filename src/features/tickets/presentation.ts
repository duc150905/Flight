import type { Json } from '@/types/database.generated';
import type { Language } from '../i18n/language.ts';
import { localeFor, translate } from '../i18n/translate.ts';
import type { BookingSummary, TicketSegment } from './model';

const statusLabels: Record<BookingSummary['status'], string> = {
  pending_payment: 'Chờ thanh toán', confirmed: 'Đã xác nhận',
  cancelled: 'Đã hủy', expired: 'Đã hết hạn',
};
const tripLabels: Record<BookingSummary['trip_type'], string> = {
  one_way: 'Một chiều', round_trip: 'Khứ hồi', multi_city: 'Nhiều chặng',
};
const cabinLabels: Record<TicketSegment['cabin_class'], string> = {
  economy: 'Phổ thông', premium_economy: 'Phổ thông đặc biệt',
  business: 'Thương gia', first: 'Hạng nhất',
};

export const bookingStatusLabel = (status: BookingSummary['status']) => statusLabels[status];
export const tripTypeLabel = (tripType: BookingSummary['trip_type']) => tripLabels[tripType];
export const cabinClassLabel = (cabin: TicketSegment['cabin_class']) => cabinLabels[cabin];

export function formatMoney(amount: number, currency: string, language: Language = 'vi'): string {
  return new Intl.NumberFormat(localeFor(language), { style: 'currency', currency }).format(amount);
}

export function formatDateTime(value: string, timeZone?: string | null, language: Language = 'vi'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return translate(language, 'Chưa có thời gian');
  try {
    return new Intl.DateTimeFormat(localeFor(language), { day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', ...(timeZone ? { timeZone } : {}) }).format(date);
  } catch { return translate(language, 'Chưa có thời gian'); }
}

function field(snapshot: Json, ...names: string[]): string | null {
  if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object') return null;
  for (const name of names) {
    const value = snapshot[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function flightSnapshotSummary(snapshot: Json) {
  return {
    flightNumber: field(snapshot, 'flight_number'),
    airlineName: field(snapshot, 'airline_name'),
    departureCode: field(snapshot, 'departure_iata', 'origin_iata', 'departure_airport_iata'),
    arrivalCode: field(snapshot, 'arrival_iata', 'destination_iata', 'arrival_airport_iata'),
    departureAt: field(snapshot, 'departure_at'),
    arrivalAt: field(snapshot, 'arrival_at'),
    departureTimezone: field(snapshot, 'departure_timezone', 'origin_timezone'),
    arrivalTimezone: field(snapshot, 'arrival_timezone', 'destination_timezone'),
  };
}
