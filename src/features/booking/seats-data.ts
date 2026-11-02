import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.generated.ts';
import { parseSeatMap } from './seats.ts';
export async function loadSeatMap(client: SupabaseClient<Database>, flightId: string) {
  const all: unknown[] = [];
  for (let offset = 0; offset <= 5000; offset += 500) {
    const result = await client.rpc('get_seat_map', { p_flight_id: flightId }).order('row_number').order('column_number').range(offset, offset + 499);
    if (result.error) throw new Error('seats.loadError');
    all.push(...result.data);
    if (result.data.length < 500) {
      try { return parseSeatMap(all); } catch { throw new Error('seats.unsupported'); }
    }
  }
  throw new Error('seats.unsupported');
}
