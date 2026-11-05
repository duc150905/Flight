import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogueSql, catalogue } from '../scripts/generate-catalogue-seed.mjs';
import { translate } from '../src/features/i18n/translate.ts';

test('catalogue generator rejects invalid/risky date ranges and commits only once', () => {
  for (const days of [0, 61, 1.2, NaN]) assert.throws(() => buildCatalogueSql({ days }));
  for (const startDate of ['2026-02-30', '2026-01-01;delete', 'wrong']) assert.throws(() => buildCatalogueSql({ startDate }));
  assert.throws(() => buildCatalogueSql({ repeat: 2 }));
  const dry = buildCatalogueSql({ days: 2, startDate: '2026-11-10', rollback: true, repeat: 2 });
  assert.match(dry, /1\.\.2 loop/);
  assert.match(dry, /rollback;\s*$/);
  assert.doesNotMatch(dry, /\/\* (?:CATALOGUE_JSON|START_DATE|DAYS|REPEAT|FINISH) \*\//);
  assert.match(buildCatalogueSql(), /commit;\s*$/);
});

test('every catalogue mutation is limited to the ten authorized tables', () => {
  const sql = buildCatalogueSql();
  const allowed = new Set(['airports', 'airlines', 'destinations', 'aircraft', 'seats', 'flight_instances',
    'flight_fares', 'flight_seats', 'addon_products', 'flight_addon_offers']);
  const writes = [...sql.matchAll(/(?:insert\s+into|update|delete\s+from|truncate)\s+public\.(\w+)/gi)].map(x => x[1]);
  assert.equal(new Set(writes).size, 10);
  for (const table of writes) assert(allowed.has(table), table);
  assert.doesNotMatch(sql, /(?:insert\s+into|update|delete\s+from|truncate)\s+(?:auth|private)\./i);
  assert.doesNotMatch(sql, /\b(?:grant|revoke|create\s+policy|alter\s+table)\b/i);
});

test('route rotations fit within a day and keys cannot collide', () => {
  const pairs = new Set();
  const known = new Set(['SGN', 'HAN', 'DAD', 'PQC', 'CXR', 'DLI', 'HUI', 'HPH', 'SIN', 'BKK', 'ICN', 'NRT',
    ...catalogue.airports.map(a => a[0])]);
  const carriers = new Set(['VN', 'VJ', 'QH', 'VU', 'SQ', ...catalogue.airlines.map(a => a[0])]);
  for (const [from, to, carrier, minutes, price] of catalogue.routePairs) {
    const key = [from, to].sort().join('-');
    assert(!pairs.has(key), key); pairs.add(key);
    assert(known.has(from) && known.has(to) && from !== to);
    assert(carriers.has(carrier));
    assert(Number.isInteger(minutes) && minutes > 0);
    assert(Number.isSafeInteger(price) && price > 0);
    // Latest departure 08:45; two flights + 90 min turnaround + 10 min return padding.
    assert(8 * 60 + 45 + 2 * minutes + 100 < 24 * 60);
  }
  assert.equal(pairs.size * 2 * 30, 2160);
});

test('catalogue supports complete domestic and international multi-city loops in both directions', () => {
  const routes = new Set(catalogue.routePairs.flatMap(([a, b]) => [`${a}-${b}`, `${b}-${a}`]));
  const loops = [
    ['DAD', 'PQC', 'CXR', 'DLI', 'DAD'],
    ['HPH', 'HUI', 'DAD', 'HPH'],
    ['DAD', 'SIN', 'BKK', 'DAD'],
    ['SGN', 'KUL', 'SIN', 'BKK', 'KUL', 'SGN'],
    ['SGN', 'ICN', 'NRT', 'HAN', 'DAD', 'SGN'],
  ];
  for (const loop of loops) {
    for (let i = 1; i < loop.length; i++) {
      assert(routes.has(`${loop[i - 1]}-${loop[i]}`), `Missing outbound leg ${loop[i - 1]}-${loop[i]}`);
      assert(routes.has(`${loop[i]}-${loop[i - 1]}`), `Missing return leg ${loop[i]}-${loop[i - 1]}`);
    }
  }
});

test('all new airport timezones are accepted and all public display names are clean', () => {
  const names = [];
  for (const [iata, name, english, city, englishCity, country, timezone] of catalogue.airports) {
    assert.match(iata, /^[A-Z]{3}$/); assert.match(country, /^[A-Z]{2}$/);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: timezone }));
    names.push(name, english, city, englishCity);
  }
  for (const p of catalogue.products) {
    names.push(p[1], p[2]);
    assert(Number.isSafeInteger(p[5]) && p[5] > 0);
    assert(p[3] !== 'baggage' || p[4] > 0);
  }
  for (const d of catalogue.destinations) names.push(...d.slice(2));
  for (const name of names) assert.doesNotMatch(name, /demo|synthetic|mô phỏng/i);
});

test('new airport, destination and service names display in the selected language', () => {
  const pairs = [
    ...catalogue.airports.flatMap(a => [[a[1], a[2]], [a[3], a[4]]]),
    ...catalogue.destinations.flatMap(d => [[d[2], d[3]], [d[4], d[5]]]),
    ...catalogue.products.map(p => [p[1], p[2]]),
  ];
  for (const [vi, en] of pairs) {
    assert.equal(translate('vi', vi), vi);
    assert.equal(translate('en', vi), en);
  }
});
