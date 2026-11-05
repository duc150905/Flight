import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { supabase } from '@/lib/supabase';
import { loadAdminAccounts } from './account-service';
export function useAdminAccounts() {
  const { session } = useAuth();
  const query = useQuery({ queryKey: ['admin-accounts', session?.user.id], enabled: Boolean(session && supabase), queryFn: ({ signal }) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    return loadAdminAccounts(supabase, signal);
  } });
  return { ...query, accounts: query.data ?? [] };
}
