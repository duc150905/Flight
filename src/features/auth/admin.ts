import type { SupabaseClient } from '@supabase/supabase-js';

type RpcClient = Pick<SupabaseClient, 'rpc'>;

/**
 * Pure function to check if the current user session has admin role via RPC.
 * Returns false on missing client, error, or non-admin result.
 */
export async function checkIsAdmin(client: RpcClient | null | undefined): Promise<boolean> {
  if (!client) return false;
  try {
    const { data, error } = await client.rpc('is_admin');
    if (error) {
      return false;
    }
    return Boolean(data);
  } catch {
    return false;
  }
}

