import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.generated.ts';
import { selectedItinerarySchema, type SelectedItinerary } from './selection.ts';

type Tables = Database['public']['Tables'];
type Airport = Pick<Tables['airports']['Row'], 'id' | 'iata_code' | 'city' | 'country_code' | 'timezone' | 'is_active'>;
type Flight = Pick<Tables['flight_instances']['Row'], 'id' | 'departure_airport_id' | 'arrival_airport_id' | 'departure_at' | 'arrival_at' | 'flight_number' | 'sales_close_at' | 'published_at' | 'status'>;
type Fare = Pick<Tables['flight_fares']['Row'], 'id' | 'flight_id' | 'name' | 'is_active'> & Partial<Tables['flight_fares']['Row']>;
export type SelectedFlightRecord = { flight: Flight; fare: Fare; origin: Airport; destination: Airport };
export type ItineraryLeg = SelectedItinerary['segments'][number] & {
  origin: Airport; destination: Airport; flightNumber: string; fareName: string;
  departureAt: string; arrivalAt: string; salesCloseAt: string; departureDate: string; arrivalDate: string;
  prices?: { adult: number; child: number; infant: number; currency: string } | null;
};
export type CheckoutItinerary = { selection: SelectedItinerary; legs: ItineraryLeg[]; international: boolean };

export function localCalendarDay(instant: string | Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  const get = (name: string) => parts.find(part => part.type === name)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function hydrateItinerary(input: SelectedItinerary, records: SelectedFlightRecord[], now = new Date()): CheckoutItinerary {
  const selection = selectedItinerarySchema.parse(input);
  const unavailable = () => new Error('One of your selected flights or fares is no longer available. Please choose your flights again.');
  const legs = selection.segments.map(segment => {
    const record = records.find(r => r.flight.id === segment.flightId && r.fare.id === segment.fareId);
    if (!record) throw unavailable();
    const { flight, fare, origin, destination } = record;
    if (!flight.published_at || !['scheduled', 'delayed'].includes(flight.status) || !fare.is_active || fare.flight_id !== flight.id
      || origin.id !== flight.departure_airport_id || destination.id !== flight.arrival_airport_id
      || origin.id === destination.id || !origin.is_active || !destination.is_active
      || !(Date.parse(flight.sales_close_at) > now.getTime()) || !(Date.parse(flight.departure_at) > now.getTime())
      || !(Date.parse(flight.arrival_at) > Date.parse(flight.departure_at))) throw unavailable();
    const total = (type: 'adult' | 'child' | 'infant') => {
      const values = [fare[`${type}_base_amount`], fare[`${type}_tax_amount`], fare[`${type}_fee_amount`]];
      return values.every(value => Number.isSafeInteger(value) && value! >= 0) ? values.reduce<number>((sum, value) => sum + value!, 0) : NaN;
    };
    const prices = { adult: total('adult'), child: total('child'), infant: total('infant'), currency: fare.currency ?? '' };
    return { ...segment, origin, destination, flightNumber: flight.flight_number, fareName: fare.name,
      prices: prices.currency && [prices.adult, prices.child, prices.infant].every(Number.isSafeInteger) ? prices : null,
      departureAt: flight.departure_at, arrivalAt: flight.arrival_at, salesCloseAt: flight.sales_close_at,
      departureDate: localCalendarDay(flight.departure_at, origin.timezone),
      arrivalDate: localCalendarDay(flight.arrival_at, destination.timezone) };
  });
  legs.forEach((leg, index) => {
    const previous = legs[index - 1];
    if (previous && (Date.parse(leg.departureAt) <= Date.parse(previous.arrivalAt)
      || (leg.journeyIndex === previous.journeyIndex && leg.origin.id !== previous.destination.id))) {
      throw new Error('The selected flights do not form a valid connection. Please choose your flights again.');
    }
  });
  if (selection.tripType === 'round_trip') {
    const outbound = legs.filter(leg => leg.journeyIndex === 1);
    const inbound = legs.filter(leg => leg.journeyIndex === 2);
    if (outbound[0].origin.id !== inbound.at(-1)!.destination.id
      || outbound.at(-1)!.destination.id !== inbound[0].origin.id) throw new Error('The return journey must reverse the outbound route.');
  }
  return { selection, legs, international: legs.some(leg => leg.origin.country_code !== leg.destination.country_code) };
}

/** Read-only hydration. A future booking RPC must recheck availability and price. */
export async function loadCheckoutItinerary(client: SupabaseClient<Database>, selection: SelectedItinerary): Promise<CheckoutItinerary> {
  const validated = selectedItinerarySchema.parse(selection);
  const [flights, fares] = await Promise.all([
    client.from('flight_instances').select('id,departure_airport_id,arrival_airport_id,departure_at,arrival_at,flight_number,sales_close_at,published_at,status').in('id', validated.segments.map(s => s.flightId)),
    client.from('flight_fares').select('id,flight_id,name,is_active,currency,adult_base_amount,child_base_amount,infant_base_amount,adult_tax_amount,child_tax_amount,infant_tax_amount,adult_fee_amount,child_fee_amount,infant_fee_amount').in('id', validated.segments.map(s => s.fareId)),
  ]);
  if (flights.error || fares.error) throw new Error('Could not load your selected flights. Check your connection and try again.');
  const ids = [...new Set(flights.data.flatMap(f => [f.departure_airport_id, f.arrival_airport_id]))];
  if (!ids.length) throw new Error('Your selected flights are unavailable. Please choose your flights again.');
  const airports = await client.from('airports').select('id,iata_code,city,country_code,timezone,is_active').in('id', ids);
  if (airports.error) throw new Error('Could not load airport information. Please try again.');
  const records: SelectedFlightRecord[] = [];
  for (const segment of validated.segments) {
    const flight = flights.data.find(f => f.id === segment.flightId);
    const fare = fares.data.find(f => f.id === segment.fareId);
    const origin = airports.data.find(a => a.id === flight?.departure_airport_id);
    const destination = airports.data.find(a => a.id === flight?.arrival_airport_id);
    if (flight && fare && origin && destination) records.push({ flight, fare, origin, destination });
  }
  return hydrateItinerary(validated, records);
}
