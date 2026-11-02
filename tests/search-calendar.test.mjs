import assert from 'node:assert/strict';
import { test } from 'node:test';

import { monthAfter, monthGrid } from '../src/features/discovery/search-calendar.ts';

test('calendar aligns days with Sunday-first columns and includes leap day', () => {
  const february = monthGrid(2028, 1);
  assert.equal(february[2], '2028-02-01');
  assert.equal(february.at(-1), '2028-02-29');
  assert.equal(february.filter(Boolean).length, 29);
});

test('month navigation crosses year boundaries', () => {
  assert.deepEqual(monthAfter(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepEqual(monthAfter(2026, 0, -1), { year: 2025, month: 11 });
});
