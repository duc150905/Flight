import { z } from 'zod';

import { buildCheckoutHref, type SelectedItinerary } from '../booking/selection.ts';
import { localDate, searchSchema, type FlightOffer, type SearchCriteria } from './model.ts';

const legSchema = z.object({
  originId: z.string(), destinationId: z.string(), departureDate: z.string(),
});

export const tripSearchSchema = z.object({
  tripType: z.enum(['one_way', 'round_trip', 'multi_city']),
  legs: z.array(legSchema).min(1).max(12),
  adults: z.coerce.number(), children: z.coerce.number(), infants: z.coerce.number(),
  cabinClass: z.enum(['economy', 'premium_economy', 'business', 'first']),
}).superRefine((trip, context) => {
  const expected = trip.tripType === 'one_way' ? 1 : trip.tripType === 'round_trip' ? 2 : null;
  if ((expected && trip.legs.length !== expected) || (trip.tripType === 'multi_city' && trip.legs.length < 2)) {
    context.addIssue({ code: 'custom', path: ['legs'], message: 'Số chặng không phù hợp với loại hành trình.' });
  }
  trip.legs.forEach((leg, index) => {
    const parsed = searchSchema.safeParse({ ...leg, adults: trip.adults, children: trip.children,
      infants: trip.infants, cabinClass: trip.cabinClass });
    if (!parsed.success) for (const issue of parsed.error.issues) context.addIssue({
      code: 'custom', path: ['legs', index, ...issue.path], message: issue.message,
    });
    const previous = trip.legs[index - 1];
    if (previous && leg.departureDate < previous.departureDate) context.addIssue({
      code: 'custom', path: ['legs', index, 'departureDate'], message: 'Ngày chặng sau không được trước chặng trước.',
    });
  });
  if (trip.tripType === 'round_trip' && trip.legs.length === 2
    && (trip.legs[1].originId !== trip.legs[0].destinationId
      || trip.legs[1].destinationId !== trip.legs[0].originId)) context.addIssue({
    code: 'custom', path: ['legs', 1], message: 'Chiều về phải quay lại sân bay đi ban đầu.',
  });
});

export type TripSearch = z.output<typeof tripSearchSchema>;
export type TripLeg = TripSearch['legs'][number];

export function validateTripSearch(input: unknown, airportTimezones: ReadonlyMap<string, string>, now = new Date()): TripSearch {
  const trip = tripSearchSchema.parse(input);
  trip.legs.forEach((leg, index) => {
    const timezone = airportTimezones.get(leg.originId);
    if (!timezone || !airportTimezones.has(leg.destinationId)) {
      throw new Error(`Chặng ${index + 1}: Chọn sân bay đang hoạt động.`);
    }
    if (leg.departureDate < localDate(now, timezone)) {
      throw new Error(`Chặng ${index + 1}: Ngày khởi hành đã qua tại sân bay đi.`);
    }
  });
  return trip;
}

export function parseTripSearchParameter(raw: unknown): TripSearch {
  if (typeof raw !== 'string' || raw.length > 4000) throw new Error('Thông tin tìm kiếm không hợp lệ.');
  return tripSearchSchema.parse(JSON.parse(raw));
}

export function criteriaForLeg(trip: TripSearch, index: number): SearchCriteria {
  const leg = trip.legs[index];
  if (!leg) throw new RangeError('Chặng bay không tồn tại.');
  return searchSchema.parse({ ...leg, adults: trip.adults, children: trip.children,
    infants: trip.infants, cabinClass: trip.cabinClass });
}

export function checkoutHrefForTrip(trip: TripSearch, offers: FlightOffer[]) {
  if (offers.length !== trip.legs.length) throw new Error('Hãy chọn đủ chuyến bay cho từng chặng.');
  const seen = new Set<string>();
  offers.forEach((offer, index) => {
    const leg = trip.legs[index];
    if (offer.flight.id !== offer.fare.flight_id || seen.has(offer.flight.id)
      || offer.origin.id !== leg.originId || offer.destination.id !== leg.destinationId
      || offer.fare.cabin_class !== trip.cabinClass
      || localDate(new Date(offer.flight.departure_at), offer.origin.timezone) !== leg.departureDate) {
      throw new Error('Chuyến bay đã chọn không còn phù hợp với tìm kiếm.');
    }
    seen.add(offer.flight.id);
    if (index && Date.parse(offer.flight.departure_at) <= Date.parse(offers[index - 1].flight.arrival_at)) {
      throw new Error('Chặng sau phải cất cánh sau khi chặng trước đến nơi.');
    }
  });
  const selection: SelectedItinerary = {
    tripType: trip.tripType,
    passengers: { adults: trip.adults, children: trip.children, infants: trip.infants },
    segments: offers.map((offer, index) => ({
      flightId: offer.flight.id, fareId: offer.fare.id, journeyIndex: index + 1, legIndex: 1,
    })),
  };
  return buildCheckoutHref(selection);
}
