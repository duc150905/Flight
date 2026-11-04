import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';

import { clearPrivateQueries } from '@/features/cache/policy';
import { supabase } from '@/lib/supabase';
import { createAuthService } from './model';
import { watchSession } from './session';

const actions = supabase ? createAuthService(supabase.auth) : null;
type AuthState = { session: Session | null; status: 'loading' | 'ready' | 'error'; error?: string };
const AuthContext = createContext<(AuthState & { actions: typeof actions; retry: () => void }) | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const ownerRef = useRef<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AuthState>({ session: null, status: 'loading' });
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const dispose = watchSession(client.auth,
      session => {
        const ownerId = session?.user.id ?? null;
        if (ownerRef.current !== ownerId) clearPrivateQueries(queryClient);
        ownerRef.current = ownerId;
        setState({ session, status: 'ready' });
      },
      () => {
        clearPrivateQueries(queryClient);
        ownerRef.current = null;
        setState({ session: null, status: 'error', error: 'Không thể khôi phục phiên đăng nhập. Hãy kiểm tra kết nối và thử lại.' });
      });
    if (Platform.OS === 'web') return dispose;
    const syncRefresh = (next: string | null | undefined) => {
      if (next === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    syncRefresh(AppState.currentState);
    const listener = AppState.addEventListener('change', syncRefresh);
    return () => { dispose(); listener.remove(); client.auth.stopAutoRefresh(); };
  }, [attempt, queryClient]);
  const value = !supabase
    ? { session: null, status: 'error' as const, error: 'Chưa cấu hình Supabase. Hãy kiểm tra .env.local rồi khởi động lại ứng dụng.' }
    : state;
  return <AuthContext.Provider value={{ ...value, actions, retry: () => {
    setState({ session: null, status: 'loading' }); setAttempt(value => value + 1);
  } }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider missing');
  return context;
}
