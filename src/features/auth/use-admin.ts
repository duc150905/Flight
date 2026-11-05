import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './auth-provider';
import { checkIsAdmin } from './admin';
export { checkIsAdmin };
export type AdminStatus = { isAdmin: boolean; loading: boolean; error: string | null; refetch: () => Promise<boolean> };
export function useAdmin(): AdminStatus {
  const { session, status } = useAuth();
  const owner = session?.user.id ?? null;
  const identity = `${owner ?? ''}:${session?.access_token ?? ''}`;
  const sequence = useRef(0);
  const [data, setData] = useState({ identity: '', isAdmin: false });
  const refetch = useCallback(async () => {
    const ticket = ++sequence.current;
    const allowed = Boolean(owner && supabase && await checkIsAdmin(supabase));
    if (ticket === sequence.current) setData({ identity, isAdmin: allowed });
    return ticket === sequence.current && allowed;
  }, [identity, owner]);
  const cancelPending = useCallback(() => { sequence.current++; }, []);
  useEffect(() => {
    void refetch();
    const timer = setInterval(() => { void refetch(); }, 15000);
    return () => { clearInterval(timer); cancelPending(); };
  }, [refetch, cancelPending]);
  const current = data.identity === identity;
  return { isAdmin: Boolean(owner && current && data.isAdmin), loading: status === 'loading' || Boolean(owner && !current), error: null, refetch };
}
