import { performance } from 'node:perf_hooks';
import { formatFlightTime } from '../src/features/discovery/time-format.ts';

const cases = Array.from({ length: 1_000 }, (_, index) => ({
  iso: new Date(Date.UTC(2026, 10, 5, 0, index)).toISOString(),
  timezone: index % 2 ? 'Asia/Ho_Chi_Minh' : 'Asia/Tokyo',
  locale: index % 2 ? 'vi-VN' : 'en-US',
}));

function original(iso, timezone, locale) {
  return new Intl.DateTimeFormat(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit' })
    .format(new Date(iso));
}

function measure(format) {
  const times = [];
  let checksum = 0;
  for (let run = 0; run < 8; run++) {
    const start = performance.now();
    for (const { iso, timezone, locale } of cases) checksum += format(iso, timezone, locale).length;
    const elapsed = performance.now() - start;
    if (run > 0) times.push(elapsed);
  }
  times.sort((a, b) => a - b);
  return { medianMs: times[Math.floor(times.length / 2)], checksum };
}

const before = measure(original);
const after = measure(formatFlightTime);
if (before.checksum !== after.checksum) throw new Error('Formatted values differ');
console.log(JSON.stringify({
  node: process.version,
  cases: cases.length,
  baselineMedianMs: Number(before.medianMs.toFixed(2)),
  cachedMedianMs: Number(after.medianMs.toFixed(2)),
  speedup: Number((before.medianMs / after.medianMs).toFixed(1)),
}, null, 2));
