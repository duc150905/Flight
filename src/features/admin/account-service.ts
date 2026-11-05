import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminAuditLogRow } from './rpc.ts';

type Client = Pick<SupabaseClient, 'rpc'>;
export type AdminAccount = { id: string; email: string; fullName: string; phone: string; role: 'admin' | 'customer'; suspended: boolean; createdAt: string; pendingSuspended: boolean | null };
function fail(error: unknown): never { throw new Error(error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)); }
export async function loadAdminAccounts(client: Client, signal?: AbortSignal): Promise<AdminAccount[]> {
  const accounts: AdminAccount[] = [];
  for (let offset = 0; offset < 100000; offset += 200) {
    signal?.throwIfAborted();
    const request = client.rpc('admin_list_accounts', { p_limit: 200, p_offset: offset });
    const { data, error } = await (signal && 'abortSignal' in request ? request.abortSignal(signal) : request);
    signal?.throwIfAborted();
    if (error) fail(error);
    if (!Array.isArray(data)) throw new Error('Invalid account directory response');
    for (const row of data) {
      if (row.role !== 'admin' && row.role !== 'customer') throw new Error('Invalid server account role');
      accounts.push({ id: row.id, email: row.email ?? '', fullName: row.full_name ?? '', phone: row.phone ?? '', role: row.role, suspended: row.suspended === true, createdAt: row.created_at, pendingSuspended: row.pending_suspended ?? null });
    }
    if (data.length < 200) return accounts;
  }
  throw new Error('Account directory is too large to load safely.');
}
export async function setAdminAccountRole(client: Client, id: string, role: AdminAccount['role']) {
  const { error } = await client.rpc('admin_set_account_role', { p_user_id: id, p_role: role });
  if (error) fail(error);
}
export async function setAdminAccountSuspended(client: Pick<SupabaseClient, 'functions'>, id: string, suspended: boolean) {
  const { data, error } = await client.functions.invoke('admin-account-suspension', { body: { userId: id, suspended } });
  if (error) fail(error);
  if (data?.ok !== true) fail(data?.error ?? 'Account status could not be confirmed. Retry to reconcile the server operation.');
}
export async function loadAdminAccountAudit(client: Client): Promise<AdminAuditLogRow[]> {
  const rows: AdminAuditLogRow[] = [];
  for (let offset = 0; offset < 100000; offset += 200) {
    const { data, error } = await client.rpc('admin_list_audit_logs', { p_limit: 200, p_offset: offset });
    if (error) fail(error);
    if (!Array.isArray(data)) throw new Error('Invalid server audit response');
    rows.push(...data);
    if (data.length < 200) return rows;
  }
  throw new Error('Audit is too large to load safely.');
}
