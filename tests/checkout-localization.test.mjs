import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingContactSchema } from '../src/features/booking/contact.ts';
import { createBookingPassengerSchema } from '../src/features/booking/passenger.ts';
import { translate, formatDate, formatMoney, displayText } from '../src/features/i18n/translate.ts';
import { en, vi } from '../src/features/i18n/messages.ts';

test('visible validation errors can switch language without modifying raw values', () => {
  const raw = { contactName: '', contactEmail: 'invalid', contactPhone: 'abc' };
  const before = structuredClone(raw);
  const contact = bookingContactSchema.safeParse(raw);
  const passenger = createBookingPassengerSchema('2026-11-02').safeParse({ givenNames: '', familyName: '', dateOfBirth: '2027-01-01' });
  for (const result of [contact, passenger]) {
    assert.equal(result.success, false);
    for (const issue of result.error.issues) assert.notEqual(translate('vi', issue.message), translate('en', issue.message));
  }
  assert.deepEqual(raw, before);
});
test('customer names are raw text even when they match translation or prototype keys', () => {
  for (const name of ['constructor', 'toString', 'Review', 'male']) {
    assert.equal(translate('vi', 'constructor'), 'constructor');
    assert.equal(displayText('vi', name), name);
  }
  assert.equal(displayText('vi', undefined, 'Review'), 'Xem lại');
});
test('checkout dictionaries are complete and dates, amounts and dynamic text follow language', () => {
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort());
  assert.equal(translate('vi', 'Traveller {number}', { number: 2 }), 'Hành khách 2');
  assert.notEqual(formatDate('vi', '2026-11-02'), formatDate('en', '2026-11-02'));
  assert.notEqual(formatMoney('vi', 1200000), formatMoney('en', 1200000));
});
