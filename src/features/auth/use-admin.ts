import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuth } from './auth-provider';
import { checkIsAdmin } from './admin';

export { checkIsAdmin };

export type AdminStatus = {
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<boolean>;
};

type AdminDataState = {
  userId: string | null;
  isAdmin: boolean;
  error: string | null;
};

/**
 * Hook to reactively observe admin permissions of the current user.
 */
export function useAdmin(): AdminStatus {
  const { session, status } = useAuth();
  const currentUserId = session?.user?.id ?? null;

  const [data, setData] = useState<AdminDataState>({
    userId: null,
    isAdmin: false,
    error: null,
  });

  const refetch = useCallback(async (): Promise<boolean> => {
    if (!session || !supabase) {
      setData({ userId: currentUserId, isAdmin: false, error: null });
      return false;
    }
    try {
      const res = await checkIsAdmin(supabase);
      setData({ userId: currentUserId, isAdmin: res, error: null });
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể xác thực quyền quản trị.';
      setData({ userId: currentUserId, isAdmin: false, error: msg });
      return false;
    }
  }, [currentUserId, session]);

  useEffect(() => {
    let ignore = false;
    if (status === 'loading') return;

    if (!session || !supabase) {
      return;
    }

    void checkIsAdmin(supabase).then(
      res => {
        if (!ignore) {
          setData({ userId: session.user.id, isAdmin: res, error: null });
        }
      },
      err => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Không thể xác thực quyền quản trị.';
          setData({ userId: session.user.id, isAdmin: false, error: msg });
        }
      }
    );

    return () => {
      ignore = true;
    };
  }, [session, status]);

  const isCurrent = !session || data.userId === currentUserId;
  const loading = status === 'loading' || (Boolean(session) && !isCurrent);
  const isAdmin = Boolean(session) && isCurrent && data.isAdmin;
  const error = isCurrent ? data.error : null;

  return { isAdmin, loading, error, refetch };
}
