import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitPhone, choosePhoneCode } from '../src/features/booking/phone.ts';
import { bookingContactSchema } from '../src/features/booking/contact.ts';
test('phone country selector preserves domestic and unsupported international numbers', () => {
  assert.deepEqual(splitPhone('090 123 4567'), { code: '', number: '090 123 4567' });
  assert.deepEqual(splitPhone('+84 901234567'), { code: '+84', number: '901234567' });
  assert.deepEqual(splitPhone('+819012345678'), { code: '', number: '+819012345678' });
  const selected = choosePhoneCode('090 123 4567', '+84');
  assert.equal(selected, '+84 90 123 4567');
  assert.equal(bookingContactSchema.parse({ contactName: 'An', contactEmail: 'an@example.com', contactPhone: selected }).contactPhone, '+84901234567');
});
