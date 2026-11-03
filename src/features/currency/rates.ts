type RateStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };

export const RATE_ENDPOINT = 'https://open.er-api.com/v6/latest/USD';
export const RATE_ATTRIBUTION = 'https://www.exchangerate-api.com';
export const MAX_RATE_AGE = 36 * 60 * 60 * 1000;
export type ExchangeRate = { vndPerUsd: number; updatedAt: number; nextUpdateAt: number };
const unavailable = () => new Error('currency.unavailable');
export function isFreshRate(value: ExchangeRate | null | undefined, now = Date.now()): value is ExchangeRate {
  return !!value && typeof value.vndPerUsd === 'number' && Number.isFinite(value.vndPerUsd) && value.vndPerUsd > 0
    && Number.isSafeInteger(value.updatedAt) && value.updatedAt > 0 && value.updatedAt <= now + 300_000
    && now - value.updatedAt <= MAX_RATE_AGE && Number.isSafeInteger(value.nextUpdateAt)
    && value.nextUpdateAt > value.updatedAt && value.nextUpdateAt - value.updatedAt <= 48 * 60 * 60 * 1000;
}
export function parseRatePayload(payload: unknown, now = Date.now()): ExchangeRate {
  if (!payload || typeof payload !== 'object') throw unavailable();
  const raw = payload as Record<string, unknown>;
  const rates = raw.rates as Record<string, unknown> | undefined;
  if (raw.result !== 'success' || raw.base_code !== 'USD' || rates?.USD !== 1
    || typeof rates.VND !== 'number' || typeof raw.time_last_update_unix !== 'number' || typeof raw.time_next_update_unix !== 'number') throw unavailable();
  const rate = { vndPerUsd: rates.VND, updatedAt: raw.time_last_update_unix * 1000, nextUpdateAt: raw.time_next_update_unix * 1000 };
  if (!isFreshRate(rate, now)) throw unavailable();
  return rate;
}
type FetchRate = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;
export async function fetchUsdVnd(fetcher: FetchRate = fetch, now = Date.now): Promise<ExchangeRate> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(RATE_ENDPOINT, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) throw unavailable();
    return parseRatePayload(await response.json(), now());
  } finally { clearTimeout(timeout); }
}
/** Public market data only; no booking amounts or personal data leave the device. */
export function createRateService(storage: RateStorage, load: () => Promise<ExchangeRate> = fetchUsdVnd, now = Date.now) {
  let cached: ExchangeRate | null = null;
  let restored: Promise<void> | undefined;
  let pending: Promise<ExchangeRate> | undefined;
  const restore = () => restored ??= (async () => {
    try {
      const value = JSON.parse(await storage.getItem('flyora.fx.usd-vnd') ?? 'null') as ExchangeRate | null;
      if (isFreshRate(value, now())) cached = value;
    } catch { /* A missing/bad cache never blocks a live request. */ }
  })();
  return {
    getRate(force = false): Promise<ExchangeRate> {
      if (pending) return pending;
      pending = (async () => {
        await restore();
        if (!force && isFreshRate(cached, now()) && now() < cached.nextUpdateAt) return cached;
        try {
          const fresh = await load();
          if (!isFreshRate(fresh, now())) throw unavailable();
          cached = fresh;
          try { await storage.setItem('flyora.fx.usd-vnd', JSON.stringify(fresh)); } catch { /* In-memory rate remains usable. */ }
          return fresh;
        } catch (error) {
          if (isFreshRate(cached, now())) return cached;
          throw error;
        }
      })().finally(() => { pending = undefined; });
      return pending;
    },
  };
}
