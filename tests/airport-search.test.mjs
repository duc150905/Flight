import assert from 'node:assert/strict';
import { test } from 'node:test';

import { searchAirports } from '../src/features/discovery/airport-search.ts';

function airport(iata_code, city, name) {
  return { id: iata_code, iata_code, city, name, country_code: 'VN',
    timezone: 'Asia/Ho_Chi_Minh', is_active: true,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
}

const airports = [
  airport('HAN', 'Hà Nội', 'Sân bay quốc tế Nội Bài'),
  airport('SGN', 'TP. Hồ Chí Minh', 'Sân bay quốc tế Tân Sơn Nhất'),
  airport('CXR', 'Nha Trang', 'Sân bay quốc tế Cam Ranh'),
  airport('DAD', 'Đà Nẵng', 'Sân bay quốc tế Đà Nẵng'),
];
const codes = result => result.map(airport => airport.iata_code);

test('Ho Chi Minh abbreviations and historical names find Tan Son Nhat', () => {
  for (const query of ['TPHCM', 'TP HCM', 'HCM', 'TP.HCM', 'Thành phố Hồ Chí Minh',
    'Ho Chi Minh City', 'Saigon', 'Sài Gòn', 'Tan Son Nhat']) {
    assert.deepEqual(codes(searchAirports(airports, query)), ['SGN'], query);
  }
});

test('search ignores accents, case, punctuation and spacing', () => {
  for (const [query, expected] of [
    ['  DA NANG ', 'DAD'], ['danang', 'DAD'], ['đà---nẵng', 'DAD'],
    ['sAn BaY nOi BaI', 'HAN'], ['ha-noi', 'HAN'], ['camranh', 'CXR'],
  ]) assert.deepEqual(codes(searchAirports(airports, query)), [expected], query);
});

test('partial words can be typed in a different order', () => {
  assert.deepEqual(codes(searchAirports(airports, 'nhat tan')), ['SGN']);
  assert.deepEqual(codes(searchAirports(airports, 'noi quoc')), ['HAN']);
  assert.deepEqual(codes(searchAirports(airports, 'ran cam')), ['CXR']);
});

test('Hanoi and Nha Trang aliases work without relying on translated display names', () => {
  for (const [query, expected] of [
    ['Hanoi', 'HAN'], ['Ha Noi', 'HAN'], ['Noi Bai', 'HAN'],
    ['Nha Trang', 'CXR'], ['Cam Ranh', 'CXR'],
  ]) assert.deepEqual(codes(searchAirports(airports, query)), [expected], query);
});

test('translated city and airport names remain searchable', () => {
  const translatedNames = airport => airport.iata_code === 'DAD'
    ? ['Tourane', 'Tourane International Airport'] : [];
  assert.deepEqual(codes(searchAirports(airports, 'tourane', translatedNames)), ['DAD']);
});

test('exact IATA and aliases rank before partial matches and the result limit', () => {
  const partials = Array.from({ length: 15 }, (_, index) =>
    airport(`X${index}`, `Saigon outskirts ${index}`, `SGN shuttle ${index}`));
  const input = [...partials, airports[1]];
  assert.equal(searchAirports(input, 'SGN')[0].iata_code, 'SGN');
  assert.equal(searchAirports(input, 'Saigon')[0].iata_code, 'SGN');
  assert.equal(searchAirports(input, 'Saigon').length, 12);
  assert.deepEqual(input, [...partials, airports[1]], 'search must not mutate input order');
});

test('empty queries preserve input ordering and the twelve-result limit', () => {
  assert.deepEqual(searchAirports(airports, ''), airports);
  assert.deepEqual(searchAirports(airports, ' \t '), airports);
  const many = Array.from({ length: 14 }, (_, index) => airport(`X${index}`, `City ${index}`, 'Airport'));
  assert.deepEqual(codes(searchAirports(many, '')), [
    'X0', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8', 'X9', 'X10', 'X11',
  ]);
});

test('short queries do not use loose typo matching or return unrelated airports', () => {
  assert.deepEqual(searchAirports(airports, 'sgm'), []);
  assert.deepEqual(searchAirports(airports, 'hcmx'), []);
  assert.deepEqual(searchAirports(airports, 'zz'), []);
});
