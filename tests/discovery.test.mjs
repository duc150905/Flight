import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  broadUtcWindow, fareTotal, localDate, searchSchema, validateSearch,
} from '../src/features/discovery/model.ts';

const criteria = {
  originId: '11111111-1111-4111-8111-111111111111',
  destinationId: '22222222-2222-4222-8222-222222222222',
  departureDate: '2026-11-02', adults: 2, children: 1, infants: 1, cabinClass: 'economy',
};

test('search rejects same airport, invalid calendar date and unaccompanied infants', () => {
  assert.equal(searchSchema.safeParse({ ...criteria, destinationId: criteria.originId }).success, false);
  assert.equal(searchSchema.safeParse({ ...criteria, departureDate: '2026-02-30' }).success, false);
  assert.equal(searchSchema.safeParse({ ...criteria, adults: 1, infants: 2 }).success, false);
  assert.equal(searchSchema.safeParse({ ...criteria, adults: 8, children: 2 }).success, false);
});

test('departure date is checked in the origin airport timezone', () => {
  const now = new Date('2026-11-01T18:00:00Z');
  assert.equal(localDate(now, 'Asia/Ho_Chi_Minh'), '2026-11-02');
  assert.equal(validateSearch(criteria, 'Asia/Ho_Chi_Minh', now).departureDate, '2026-11-02');
  assert.throws(() => validateSearch({ ...criteria, departureDate: '2026-11-01' }, 'Asia/Ho_Chi_Minh', now));
});

test('UTC window and final timezone match include flights crossing UTC midnight', () => {
  const { from, until } = broadUtcWindow('2026-11-02');
  const departure = new Date('2026-11-01T18:30:00Z');
  assert.ok(departure >= new Date(from) && departure < new Date(until));
  assert.equal(localDate(departure, 'Asia/Ho_Chi_Minh'), '2026-11-02');
  assert.equal(localDate(departure, 'America/New_York'), '2026-11-01');
});

test('fare estimate includes base, taxes and fees for each passenger type', () => {
  const fare = {
    adult_base_amount: 100, adult_tax_amount: 10, adult_fee_amount: 1,
    child_base_amount: 50, child_tax_amount: 5, child_fee_amount: 2,
    infant_base_amount: 20, infant_tax_amount: 3, infant_fee_amount: 4,
  };
  assert.equal(fareTotal(fare, criteria), 2 * 111 + 57 + 27);
});
