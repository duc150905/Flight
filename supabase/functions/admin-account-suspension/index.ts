import { changeAccountSuspension } from '../_shared/account-suspension.ts';
import { endpoint, env, json, owner, rpc, uuid } from '../_shared/runtime.ts';

endpoint(async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  await owner(request); // Validate against Auth, then prepare RPC re-checks current DB authority.
  const body = await request.json();
  const userId = uuid(body.userId);
  if (typeof body.suspended !== 'boolean') return json({ error: 'Status must be a boolean' }, 400);
  try {
    await changeAccountSuspension({
      prepare: async (id, suspended) => {
        const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/admin_prepare_suspension`, {
          method: 'POST', headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: request.headers.get('Authorization')!, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_user_id: id, p_suspended: suspended }), signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          throw new Error(error?.message ?? 'Admin access denied');
        }
        return uuid(await response.json());
      },
      updateAuth: async (id, suspended) => {
        const response = await fetch(`${env('SUPABASE_URL')}/auth/v1/admin/users/${id}`, {
          method: 'PUT', headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ban_duration: suspended ? '876000h' : 'none' }), signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error('Auth status update failed. Account actions remain blocked; retry this operation.');
      },
      finish: async (id, operationId) => { await rpc('admin_finish_suspension', { p_user_id: id, p_operation_id: operationId }); },
    }, userId, body.suspended);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Account status could not be confirmed' }, 400);
  }
});
