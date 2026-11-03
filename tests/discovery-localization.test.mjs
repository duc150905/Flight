import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatMoney, translate } from '../src/features/i18n/translate.ts';

test('trip search and validation messages switch language without changing selected data', () => {
  assert.equal(translate('vi', 'Khứ hồi'), 'Khứ hồi');
  assert.equal(translate('en', 'Khứ hồi'), 'Round trip');
  assert.equal(translate('en', 'Chặng {number}', { number: 2 }), 'Flight 2');
  assert.equal(translate('en', 'Mỗi em bé cần đi cùng một người lớn.'), 'Each infant needs an accompanying adult.');
  assert.equal(translate('en', 'Hà Nội ngàn năm văn hiến'), 'Hanoi, a thousand years of heritage');
  assert.equal(translate('en', 'Nguyen Van An'), 'Nguyen Van An');
});

test('estimated fare keeps its currency while adapting the display locale', () => {
  const vi = formatMoney('vi', 1200000, 'VND');
  const en = formatMoney('en', 1200000, 'VND');
  assert.match(vi, /₫/);
  assert.match(en, /₫/);
  assert.notEqual(en, vi);
});
