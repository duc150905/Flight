import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.generated';
/** A mutation must never pick up another account's token after an async wait. */
export function createOwnerRpcClient({ url, key, accessToken, fetcher }: {
  url: string; key: string; accessToken: string; fetcher?: typeof fetch;
}) {
  return createClient<Database>(url, key, {
    accessToken: async () => accessToken,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(fetcher ? { global: { fetch: fetcher } } : {}),
  });
}
