type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };
type Entry = { requestId: string; digest: string; phase: 'sent' | 'complete' };
type Api<T, P> = { find(requestId: string): Promise<T | null>; create(requestId: string, payload: P): Promise<T> };
/** No payload/PII is persisted. The server closes missing UUIDs during recovery. */
export function createBookingRequestJournal(storage: Storage, uuid: () => string) {
  const tails = new Map<string, Promise<unknown>>();
  const key = (owner: string) => `flyora.bookingRequest.v1.${owner}`;
  async function read(owner: string): Promise<Entry | null> {
    const raw = await storage.getItem(key(owner));
    if (!raw) return null;
    const value = JSON.parse(raw) as Entry;
    if (!value.requestId || !value.digest || !['sent', 'complete'].includes(value.phase)) throw new Error('booking.storageError');
    return value;
  }
  function serial<T>(owner: string, run: () => Promise<T>) {
    if (!owner) return Promise.reject(new Error('booking.authRequired'));
    const task = (tails.get(owner) ?? Promise.resolve()).catch(() => {}).then(run);
    tails.set(owner, task);
    void task.finally(() => { if (tails.get(owner) === task) tails.delete(owner); }).catch(() => {});
    return task;
  }
  async function complete(owner: string, entry: Entry) {
    // If the device write fails, retaining "sent" is safe: next time resolves server outcome.
    try { await storage.setItem(key(owner), JSON.stringify({ ...entry, phase: 'complete' })); } catch { /* recover next time */ }
  }
  return {
    recover<T>(owner: string, find: (requestId: string) => Promise<T | null>) {
      return serial(owner, async () => {
        const entry = await read(owner); if (!entry) return null;
        const saved = await find(entry.requestId);
        if (saved) await complete(owner, entry);
        return saved;
      });
    },
    submit<T, P>(owner: string, digest: string, payload: P, api: Api<T, P>) {
      return serial(owner, async () => {
        const old = await read(owner);
        if (old && (old.phase === 'sent' || old.digest === digest)) {
          const saved = await api.find(old.requestId);
          if (saved) { await complete(owner, old); return saved; }
          // "find" has atomically closed the old UUID, including delayed network requests.
        }
        const entry: Entry = { requestId: uuid(), digest, phase: 'sent' };
        // Failure here must prevent the network mutation entirely.
        try { await storage.setItem(key(owner), JSON.stringify(entry)); } catch { throw new Error('booking.storageError'); }
        const saved = await api.create(entry.requestId, payload);
        await complete(owner, entry);
        return saved;
      });
    },
  };
}
