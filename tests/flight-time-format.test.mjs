import assert from 'node:assert/strict';
import test from 'node:test';
import { formatFlightTime } from '../src/features/discovery/time-format.ts';

test('cached flight time formatting preserves locale and airport timezone', () => {
  const iso = '2026-11-05T10:30:00.000Z';
  for (const [timezone, locale] of [
    ['Asia/Ho_Chi_Minh', 'vi-VN'],
    ['Asia/Tokyo', 'en-US'],
    ['Europe/London', 'en-US'],
  ]) {
    const expected = new Intl.DateTimeFormat(locale, {
      timeZone: timezone, hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
    assert.equal(formatFlightTime(iso, timezone, locale), expected);
    assert.equal(formatFlightTime(iso, timezone, locale), expected);
  }
});
