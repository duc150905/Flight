import { adminListAuditLogs } from './rpc.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.generated.ts';

/** Never present an incomplete API page as a complete report/search dataset. */
export async function loadAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, pageSize = 500) {
  const rows: T[] = [];
  for (let index = 0; index < 200; index++) {
    const result = await page(index * pageSize, (index + 1) * pageSize - 1);
    if (result.error) throw result.error;
    rows.push(...(result.data ?? []));
    if (!result.data || result.data.length < pageSize) return { data: rows, error: null };
  }
  throw new Error('Too many records to load safely. Narrow the reporting dataset.');
}
export async function loadAllAuditLogs(client: SupabaseClient<Database>) {
  const result = await loadAllRows(async from => ({ data: await adminListAuditLogs(client, { limit: 200, offset: from }), error: null }), 200);
  return result.data;
}
