import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBookingPassengerSchema } from '../src/features/booking/passenger.ts';

const schema = createBookingPassengerSchema('2026-10-30');
const passenger = { givenNames: 'Minh An', familyName: 'Nguyễn', dateOfBirth: '2000-02-29' };

test('passenger parsing trims names and date without dropping Vietnamese accents', () => {
  assert.deepEqual(schema.parse({ givenNames: ' Minh An ', familyName: ' Nguyễn ', dateOfBirth: ' 2000-02-29 ' }), passenger);
});

test('passenger names support single-character names, apostrophes and hyphens', () => {
  assert.deepEqual(schema.parse({ ...passenger, givenNames: ' A ', familyName: " O'Connor-Lê " }), {
    givenNames: 'A', familyName: "O'Connor-Lê", dateOfBirth: '2000-02-29',
  });
});

test('both name fields reject blanks and values longer than 100 characters', () => {
  for (const field of ['givenNames', 'familyName']) {
    for (const value of ['', '   ', 'A'.repeat(101)]) {
      assert.equal(schema.safeParse({ ...passenger, [field]: value }).success, false, field);
    }
  }
});

test('date of birth rejects impossible calendar dates including non-leap century years', () => {
  for (const dateOfBirth of ['2001-02-29', '1900-02-29', '2000-02-30', '2000-04-31', '2000-13-01', '2000-01-00', '0000-01-01']) {
    assert.equal(schema.safeParse({ ...passenger, dateOfBirth }).success, false, dateOfBirth);
  }
});

test('date of birth rejects locale dates and timestamps instead of shifting the calendar day', () => {
  for (const dateOfBirth of ['', '29/02/2000', '2000-2-29', '2000-02-29T00:00:00Z', '2000-02-29T23:00:00-07:00']) {
    assert.equal(schema.safeParse({ ...passenger, dateOfBirth }).success, false, dateOfBirth);
  }
});

test('birthday on the booking day is accepted without enforcing a minimum flying age', () => {
  assert.equal(schema.parse({ ...passenger, dateOfBirth: '2026-10-30' }).dateOfBirth, '2026-10-30');
});

test('birth dates after the booking date are rejected with an error on dateOfBirth', () => {
  const result = schema.safeParse({ ...passenger, dateOfBirth: '2026-10-31' });
  assert.equal(result.success, false);
  assert.deepEqual(result.error.issues.map(issue => issue.path), [['dateOfBirth']]);
});

test('the booking date argument determines the birth-date boundary independently for each schema', () => {
  const input = { ...passenger, dateOfBirth: '2026-10-31' };
  assert.equal(schema.safeParse(input).success, false);
  assert.equal(createBookingPassengerSchema('2026-10-31').parse(input).dateOfBirth, '2026-10-31');
});

test('invalid booking-date context fails immediately instead of disabling date validation', () => {
  for (const bookingDate of ['', '2026-02-30', '30/10/2026', '0000-01-01', '2026-10-30T00:00:00Z']) {
    assert.throws(() => createBookingPassengerSchema(bookingDate), undefined, bookingDate);
  }
});

test('all passenger fields are required and identify missing input fields', () => {
  const result = schema.safeParse({});
  assert.equal(result.success, false);
  assert.deepEqual(result.error.issues.map(issue => issue.path[0]).sort(), ['dateOfBirth', 'familyName', 'givenNames']);
});

test('passenger parsing excludes contact, document and server-calculated fields from the basic result', () => {
  assert.deepEqual(schema.parse({
    ...passenger, contactName: 'Someone Else', contactEmail: 'contact@example.com',
    passengerType: 'adult', baseAmount: 1, bookingId: 'other-booking', documentNumber: 'TEST-ONLY',
  }), passenger);
});

test('parsing different passengers preserves their individual values and the original inputs', () => {
  const first = { givenNames: ' Minh An ', familyName: ' Nguyễn ', dateOfBirth: '2000-02-29' };
  const second = { givenNames: ' Bình ', familyName: ' Trần ', dateOfBirth: '2015-03-01' };
  assert.deepEqual([schema.parse(first), schema.parse(second)], [
    passenger, { givenNames: 'Bình', familyName: 'Trần', dateOfBirth: '2015-03-01' },
  ]);
  assert.equal(first.givenNames, ' Minh An ');
  assert.equal(second.givenNames, ' Bình ');
});
