import type { Session, SupabaseClient } from '@supabase/supabase-js';

export function watchSession(
  auth: Pick<SupabaseClient['auth'], 'getSession' | 'onAuthStateChange'>,
  onSession: (session: Session | null) => void,
  onError: (error: unknown) => void,
  timeoutMs = 15_000,
) {
  let disposed = false;
  let revision = 0;
  const timer = setTimeout(() => {
    if (!disposed) onError(new Error('Session restore timed out'));
  }, timeoutMs);
  const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
    // INITIAL_SESSION does not carry load errors. getSession owns startup so
    // a temporary network failure remains retryable instead of showing login.
    if (event === 'INITIAL_SESSION') return;
    clearTimeout(timer);
    revision++;
    if (!disposed) onSession(session);
  });
  const initialRevision = revision;
  void auth.getSession().then(({ data, error }) => {
    clearTimeout(timer);
    if (disposed || revision !== initialRevision) return;
    if (error) onError(error);
    else onSession(data.session);
  }).catch(error => {
    clearTimeout(timer);
    if (!disposed && revision === initialRevision) onError(error);
  });
  return () => { disposed = true; clearTimeout(timer); subscription.unsubscribe(); };
}
