import { supabase } from '@/lib/supabase';
import {
  broadUtcWindow, fareTotal, localDate, searchSchema, validateSearch,
  type Airport, type Destination, type Flight, type FlightOffer, type SearchCriteria,
} from './model';

function client() {
  if (!supabase) throw new Error('Chưa cấu hình Supabase. Hãy kiểm tra .env.local rồi khởi động lại ứng dụng.');
  return supabase;
}

export async function listAirports(): Promise<Airport[]> {
  const airports: Airport[] = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client().from('airports').select('*')
      .eq('is_active', true).order('city').order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    airports.push(...(data ?? []));
    if (!data || data.length < pageSize) return airports;
  }
}

export async function listDestinations(): Promise<Destination[]> {
  const { data, error } = await client().from('destinations').select('*')
    .eq('is_active', true).eq('is_featured', true).order('sort_order').limit(8);
  if (error) throw error;
  return data ?? [];
}

export async function searchOneWay(input: unknown): Promise<{ criteria: SearchCriteria; offers: FlightOffer[] }> {
  const db = client();
  const parsed = searchSchema.parse(input);
  const [originResult, destinationResult] = await Promise.all([
    db.from('airports').select('*').eq('id', parsed.originId).eq('is_active', true).single(),
    db.from('airports').select('*').eq('id', parsed.destinationId).eq('is_active', true).single(),
  ]);
  if (originResult.error || !originResult.data) throw new Error('Không tìm thấy sân bay đi đang hoạt động.');
  if (destinationResult.error || !destinationResult.data) throw new Error('Không tìm thấy sân bay đến đang hoạt động.');
  const origin = originResult.data;
  const destination = destinationResult.data;
  const criteria = validateSearch(parsed, origin.timezone);
  const { from, until } = broadUtcWindow(criteria.departureDate);
  const flights: Flight[] = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from('flight_instances').select('*')
      .eq('departure_airport_id', origin.id).eq('arrival_airport_id', destination.id)
      .in('status', ['scheduled', 'delayed']).not('published_at', 'is', null)
      .gt('sales_close_at', new Date().toISOString())
      .gte('departure_at', from).lt('departure_at', until)
      .order('departure_at').order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    flights.push(...(data ?? []).filter(flight =>
      localDate(new Date(flight.departure_at), origin.timezone) === criteria.departureDate));
    if (!data || data.length < pageSize) break;
  }
  if (flights.length === 0) return { criteria, offers: [] };

  const fares = [];
  for (let index = 0; index < flights.length; index += 100) {
    const ids = flights.slice(index, index + 100).map(flight => flight.id);
    const { data, error } = await db.from('flight_fares').select('*').in('flight_id', ids)
      .eq('cabin_class', criteria.cabinClass).eq('is_active', true);
    if (error) throw error;
    fares.push(...(data ?? []));
  }
  const airlineIds = [...new Set(flights.map(flight => flight.airline_id))];
  const { data: airlines, error: airlineError } = await db.from('airlines').select('*')
    .in('id', airlineIds).eq('is_active', true);
  if (airlineError) throw airlineError;
  const flightById = new Map(flights.map(flight => [flight.id, flight]));
  const airlineById = new Map((airlines ?? []).map(airline => [airline.id, airline]));
  const offers: FlightOffer[] = [];
  for (const fare of fares) {
    const flight = flightById.get(fare.flight_id);
    const airline = flight && airlineById.get(flight.airline_id);
    if (flight && airline) offers.push({
      flight, fare, airline, origin, destination, total: fareTotal(fare, criteria),
    });
  }
  return { criteria, offers };
}

export async function loadFlightOffer(flightId: string, fareId: string, criteria: SearchCriteria): Promise<FlightOffer> {
  const db = client();
  const [flightResult, fareResult] = await Promise.all([
    db.from('flight_instances').select('*').eq('id', flightId).single(),
    db.from('flight_fares').select('*').eq('id', fareId).eq('is_active', true).single(),
  ]);
  if (flightResult.error || !flightResult.data || fareResult.error || !fareResult.data
    || fareResult.data.flight_id !== flightResult.data.id) throw new Error('Chuyến bay hoặc hạng vé không còn khả dụng.');
  const flight = flightResult.data;
  const fare = fareResult.data;
  if (!flight.published_at || !['scheduled', 'delayed'].includes(flight.status)
    || Date.parse(flight.sales_close_at) <= Date.now()
    || flight.departure_airport_id !== criteria.originId
    || flight.arrival_airport_id !== criteria.destinationId) {
    throw new Error('Chuyến bay này không còn mở bán theo tìm kiếm hiện tại.');
  }
  const [originResult, destinationResult, airlineResult] = await Promise.all([
    db.from('airports').select('*').eq('id', flight.departure_airport_id).single(),
    db.from('airports').select('*').eq('id', flight.arrival_airport_id).single(),
    db.from('airlines').select('*').eq('id', flight.airline_id).single(),
  ]);
  if (!originResult.data || !destinationResult.data || !airlineResult.data) {
    throw new Error('Không thể tải thông tin sân bay hoặc hãng bay.');
  }
  if (fare.cabin_class !== criteria.cabinClass
    || localDate(new Date(flight.departure_at), originResult.data.timezone) !== criteria.departureDate) {
    throw new Error('Hạng vé không khớp với tìm kiếm hiện tại.');
  }
  return {
    flight, fare, airline: airlineResult.data, origin: originResult.data,
    destination: destinationResult.data, total: fareTotal(fare, criteria),
  };
}
