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

export type FlightTimingStage =
  | 'payment_pending'
  | 'cancelled'
  | 'expired'
  | 'boarding'
  | 'upcoming_soon'
  | 'upcoming'
  | 'in_flight'
  | 'completed'
  | 'unknown';

export type FlightTimingInfo = {
  stage: FlightTimingStage;
  labelKey: string;
  labelParams?: Record<string, string | number>;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  isUpcoming: boolean;
  stepIndex: number;
  routeText: string | null;
  flightNumber: string | null;
  airlineName: string | null;
  departureAt: string | null;
  arrivalAt: string | null;
  departureTimezone: string | null;
  arrivalTimezone: string | null;
  departureDate: Date | null;
  arrivalDate: Date | null;
  diffHours: number | null;
};

export function resolveFlightTiming(
  rawSegments: { flight_snapshot?: Json }[] | undefined | null,
  bookingStatus: BookingSummary['status'],
  now: Date = new Date(),
): FlightTimingInfo {
  const segments = Array.isArray(rawSegments) ? rawSegments : [];
  const summaries = segments
    .map(s => (s && s.flight_snapshot ? flightSnapshotSummary(s.flight_snapshot) : null))
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const firstSummary = summaries[0] ?? null;
  const lastSummary = summaries[summaries.length - 1] ?? null;

  const routeText = firstSummary?.departureCode && lastSummary?.arrivalCode
    ? (firstSummary.departureCode === lastSummary.arrivalCode && summaries.length > 1
        ? `${firstSummary.departureCode} ⇄ ${summaries[0]?.arrivalCode ?? lastSummary.arrivalCode}`
        : `${firstSummary.departureCode} → ${lastSummary.arrivalCode}`)
    : null;

  const flightNumber = summaries.map(s => s.flightNumber).filter(Boolean).join(', ') || null;
  const airlineName = firstSummary?.airlineName ?? null;
  const departureAt = firstSummary?.departureAt ?? null;
  const arrivalAt = lastSummary?.arrivalAt ?? null;
  const departureTimezone = firstSummary?.departureTimezone ?? null;
  const arrivalTimezone = lastSummary?.arrivalTimezone ?? null;

  if (bookingStatus === 'cancelled') {
    return {
      stage: 'cancelled',
      labelKey: 'Đã hủy',
      badgeBg: '#FEF2F2',
      badgeColor: '#DC2626',
      badgeBorder: '#FECACA',
      isUpcoming: false,
      stepIndex: -1,
      routeText, flightNumber, airlineName, departureAt, arrivalAt, departureTimezone, arrivalTimezone,
      departureDate: departureAt ? new Date(departureAt) : null,
      arrivalDate: arrivalAt ? new Date(arrivalAt) : null,
      diffHours: null,
    };
  }

  if (bookingStatus === 'expired') {
    return {
      stage: 'expired',
      labelKey: 'Đã hết hạn',
      badgeBg: '#F1F5F9',
      badgeColor: '#64748B',
      badgeBorder: '#CBD5E1',
      isUpcoming: false,
      stepIndex: -1,
      routeText, flightNumber, airlineName, departureAt, arrivalAt, departureTimezone, arrivalTimezone,
      departureDate: departureAt ? new Date(departureAt) : null,
      arrivalDate: arrivalAt ? new Date(arrivalAt) : null,
      diffHours: null,
    };
  }

  if (bookingStatus === 'pending_payment') {
    return {
      stage: 'payment_pending',
      labelKey: 'Chờ thanh toán',
      badgeBg: '#FEF3C7',
      badgeColor: '#B45309',
      badgeBorder: '#FDE68A',
      isUpcoming: true,
      stepIndex: 0,
      routeText, flightNumber, airlineName, departureAt, arrivalAt, departureTimezone, arrivalTimezone,
      departureDate: departureAt ? new Date(departureAt) : null,
      arrivalDate: arrivalAt ? new Date(arrivalAt) : null,
      diffHours: null,
    };
  }

  const depTimes = summaries
    .map(s => (s.departureAt ? new Date(s.departureAt).getTime() : NaN))
    .filter(t => !Number.isNaN(t));
  const arrTimes = summaries
    .map(s => (s.arrivalAt ? new Date(s.arrivalAt).getTime() : NaN))
    .filter(t => !Number.isNaN(t));

  if (depTimes.length === 0) {
    return {
      stage: 'upcoming',
      labelKey: 'Đã xác nhận',
      badgeBg: '#EFF6FF',
      badgeColor: '#1D4ED8',
      badgeBorder: '#BFDBFE',
      isUpcoming: true,
      stepIndex: 1,
      routeText, flightNumber, airlineName, departureAt, arrivalAt, departureTimezone, arrivalTimezone,
      departureDate: null, arrivalDate: null, diffHours: null,
    };
  }

  const minDep = Math.min(...depTimes);
  const maxArr = arrTimes.length > 0 ? Math.max(...arrTimes) : minDep + 2 * 3600 * 1000;
  const currentTime = now.getTime();
  const depDate = new Date(minDep);
  const arrDate = new Date(maxArr);

  if (currentTime < minDep) {
    const diffMs = minDep - currentTime;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= 2) {
      const minutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
      return {
        stage: 'boarding',
        labelKey: 'Chuẩn bị bay (còn {time})',
        labelParams: { time: `${minutes}m` },
        badgeBg: '#FFF7ED',
        badgeColor: '#C2410C',
        badgeBorder: '#FDBA74',
        isUpcoming: true,
        stepIndex: 1,
        routeText, flightNumber, airlineName, departureAt, arrivalAt, departureTimezone, arrivalTimezone,
        departureDate: depDate, arrivalDate: arrDate, diffHours,
      };
    }

    if (diffHours <= 24) {
      const hours = Math.max(1, Math.round(diffHours));
      return {
        stage: 'upcoming_soon',
        labelKey: 'Sắp bay (còn {time})',
        labelParams: { time: `${hours}h` },
        badgeBg: '#FEF3C7',
        badgeColor: '#B45309',
        badgeBorder: '#FCD34D',
        isUpcoming: true,
        stepIndex: 1,
        routeText, flightNumber, airlineName, departureAt, arrivalAt, departureTimezone, arrivalTimezone,
        departureDate: depDate, arrivalDate: arrDate, diffHours,
      };
    }

    const days = Math.floor(diffHours / 24);
    return {
      stage: 'upcoming',
      labelKey: days > 0 ? 'Sắp tới (còn {days} ngày)' : 'Sắp khởi hành',
      labelParams: { days },
      badgeBg: '#EFF6FF',
      badgeColor: '#1D4ED8',
      badgeBorder: '#BFDBFE',
      isUpcoming: true,
      stepIndex: 1,
      routeText, flightNumber, airlineName, departureAt, arrivalAt, departureTimezone, arrivalTimezone,
      departureDate: depDate, arrivalDate: arrDate, diffHours,
    };
  }

  if (currentTime >= minDep && currentTime <= maxArr) {
    return {
      stage: 'in_flight',
      labelKey: '✈️ Đang bay',
      badgeBg: '#ECFDF5',
      badgeColor: '#047857',
      badgeBorder: '#6EE7B7',
      isUpcoming: true,
      stepIndex: 2,
      routeText, flightNumber, airlineName, departureAt, arrivalAt, departureTimezone, arrivalTimezone,
      departureDate: depDate, arrivalDate: arrDate, diffHours: 0,
    };
  }

  return {
    stage: 'completed',
    labelKey: 'Đã hoàn thành',
    badgeBg: '#F1F5F9',
    badgeColor: '#475569',
    badgeBorder: '#CBD5E1',
    isUpcoming: false,
    stepIndex: 3,
    routeText, flightNumber, airlineName, departureAt, arrivalAt, departureTimezone, arrivalTimezone,
    departureDate: depDate, arrivalDate: arrDate, diffHours: null,
  };
}
