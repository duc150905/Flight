import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.generated.ts';
import { loadAllRows } from './complete-data.ts';

export async function loadAircraftAndSeats(client: Pick<SupabaseClient<Database>, 'from'>) {
  const [airlines, aircraft, seats] = await Promise.all([
    loadAllRows((from,to)=>client.from('airlines').select('*').order('iata_code').order('id').range(from,to)),
    loadAllRows((from,to)=>client.from('aircraft').select('*').order('registration_code').order('id').range(from,to)),
    loadAllRows((from,to)=>client.from('seats').select('*').order('aircraft_id').order('row_number').order('column_number').order('id').range(from,to)),
  ]);
  if (airlines.error) throw airlines.error;
  if (aircraft.error) throw aircraft.error;
  if (seats.error) throw seats.error;
  return { airlines: airlines.data ?? [], aircraft: aircraft.data ?? [], seats: seats.data ?? [] };
}
