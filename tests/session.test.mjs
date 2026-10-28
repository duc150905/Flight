import assert from 'node:assert/strict';
import { test } from 'node:test';
import { watchSession } from '../src/features/auth/session.ts';

function setup(timeoutMs) {
  let complete, fail, notify;
  let unsubscribed = false;
  const sessions = [], errors = [];
  const auth = {
    getSession: () => new Promise((resolve, reject) => { complete = resolve; fail = reject; }),
    onAuthStateChange: callback => {
      notify = callback;
      return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
    },
  };
  const dispose = watchSession(auth, value => sessions.push(value), error => errors.push(error), timeoutMs);
  return { sessions, errors, dispose, complete: value => complete(value), fail: value => fail(value),
    notify: value => notify('SIGNED_OUT', value), initial: value => notify('INITIAL_SESSION', value), isUnsubscribed: () => unsubscribed };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('startup restores a persisted session', async () => {
  const s = setup(); s.complete({ data: { session: { user: { id: 'a' } } }, error: null });
  await tick(); assert.equal(s.sessions[0].user.id, 'a'); s.dispose();
});
test('stale startup cannot restore a session after sign-out', async () => {
  const s = setup(); s.notify(null); s.complete({ data: { session: { user: { id: 'a' } } }, error: null });
  await tick(); assert.deepEqual(s.sessions, [null]); s.dispose();
});
test('unmount unsubscribes and ignores pending work', async () => {
  const s = setup(); s.dispose(); s.complete({ data: { session: null }, error: null });
  await tick(); assert.equal(s.isUnsubscribed(), true); assert.deepEqual(s.sessions, []);
});
test('startup rejection becomes a recoverable error', async () => {
  const s = setup(); s.fail(new Error('offline')); await tick();
  assert.equal(s.errors.length, 1); s.dispose();
});
test('INITIAL_SESSION null cannot hide a startup network error', async () => {
  const s = setup(); s.initial(null);
  s.complete({ data: { session: null }, error: { code: 'network_error' } });
  await tick(); assert.deepEqual(s.sessions, []); assert.equal(s.errors.length, 1); s.dispose();
});
test('a stalled restore becomes a retryable error instead of an endless spinner', async () => {
  const s = setup(10); await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(s.errors.length, 1); s.dispose();
});
