import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.generated.ts';
import { loadAllRows } from './complete-data.ts';

type CatalogueClient = Pick<SupabaseClient<Database>, 'from'>;

export async function loadCatalogues(client: CatalogueClient) {
  const [airports, airlines, destinations] = await Promise.all([
    loadAllRows((from, to) => client.from('airports').select('*').order('city').order('iata_code').order('id').range(from, to)),
    loadAllRows((from, to) => client.from('airlines').select('*').order('iata_code').order('id').range(from, to)),
    loadAllRows((from, to) => client.from('destinations').select('*').order('sort_order').order('slug').order('id').range(from, to)),
  ]);
  return { airports: airports.data, airlines: airlines.data, destinations: destinations.data };
}

export async function loadFlightsBundle(client: CatalogueClient) {
  const [airports, airlines, aircraft, flights, fares] = await Promise.all([
    loadAllRows((from, to) => client.from('airports').select('*').order('iata_code').order('id').range(from, to)),
    loadAllRows((from, to) => client.from('airlines').select('*').order('iata_code').order('id').range(from, to)),
    loadAllRows((from, to) => client.from('aircraft').select('*').order('registration_code').order('id').range(from, to)),
    loadAllRows((from, to) => client.from('flight_instances').select('*').order('departure_at').order('id').range(from, to)),
    loadAllRows((from, to) => client.from('flight_fares').select('*').order('adult_base_amount').order('id').range(from, to)),
  ]);
  const faresByFlight: Record<string, Database['public']['Tables']['flight_fares']['Row'][]> = {};
  for (const fare of fares.data) (faresByFlight[fare.flight_id] ??= []).push(fare);
  return { airports: airports.data, airlines: airlines.data, aircraftList: aircraft.data, flights: flights.data, faresByFlight, fetchedAtMs: Date.now() };
}

export async function loadAddonsBundle(client: CatalogueClient) {
  const [products, offers, flights] = await Promise.all([
    loadAllRows((from, to) => client.from('addon_products').select('*').order('category').order('id').range(from, to)),
    loadAllRows((from, to) => client.from('flight_addon_offers').select('*').order('unit_amount').order('id').range(from, to)),
    loadAllRows((from, to) => client.from('flight_instances').select('*').order('departure_at').order('id').range(from, to)),
  ]);
  return { products: products.data, offers: offers.data, flights: flights.data };
}

export async function loadFlightSeats(client: CatalogueClient, flightId: string) {
  return (await loadAllRows((from, to) => client.from('flight_seats').select('*').eq('flight_id', flightId)
    .order('row_number').order('column_number').order('id').range(from, to))).data;
}
