import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingContactSchema } from '../src/features/booking/contact.ts';

const contact = {
  contactName: 'Nguyễn Minh An',
  contactEmail: 'an@example.com',
  contactPhone: '0901234567',
};

test('booking contact normalizes whitespace, email and a formatted international phone', () => {
  assert.deepEqual(bookingContactSchema.parse({
    contactName: '  Nguyễn Minh An  ',
    contactEmail: '  AN+Tickets@Example.COM  ',
    contactPhone: ' +84 (90) 123-45.67 ',
  }), {
    contactName: 'Nguyễn Minh An',
    contactEmail: 'an+tickets@example.com',
    contactPhone: '+84901234567',
  });
});

test('booking contact preserves the leading zero of a domestic phone', () => {
  assert.deepEqual(bookingContactSchema.parse({ ...contact, contactPhone: '090 123 4567' }), contact);
});

test('contact names preserve Vietnamese accents, apostrophes and hyphens', () => {
  assert.equal(bookingContactSchema.parse({ ...contact, contactName: "  Hà O'Connor-Lê  " }).contactName, "Hà O'Connor-Lê");
});

test('contact name cannot be empty, one character or longer than 100 characters', () => {
  for (const contactName of ['', '   ', 'A', 'A'.repeat(101)]) {
    assert.equal(bookingContactSchema.safeParse({ ...contact, contactName }).success, false, `name length ${contactName.length}`);
  }
});

test('contact email must be a complete email address', () => {
  for (const contactEmail of ['', 'person', 'person@', 'person @example.com']) {
    assert.equal(bookingContactSchema.safeParse({ ...contact, contactEmail }).success, false, contactEmail);
  }
});

test('phone rejects missing digits, misplaced plus signs, letters and extensions', () => {
  for (const contactPhone of ['', ' ()-. ', '123456', '1234567890123456', '090+1234567', '++84901234567', '090ABC4567', '0901234567 ext 12', '+0901234567']) {
    assert.equal(bookingContactSchema.safeParse({ ...contact, contactPhone }).success, false, contactPhone);
  }
});

test('phone allows 7 to 15 digits without guessing a country code', () => {
  assert.equal(bookingContactSchema.parse({ ...contact, contactPhone: '1234567' }).contactPhone, '1234567');
  assert.equal(bookingContactSchema.parse({ ...contact, contactPhone: '+123456789012345' }).contactPhone, '+123456789012345');
});

test('all three contact fields are required and errors identify the corresponding field', () => {
  const result = bookingContactSchema.safeParse({});
  assert.equal(result.success, false);
  assert.deepEqual(result.error.issues.map(issue => issue.path[0]).sort(), ['contactEmail', 'contactName', 'contactPhone']);
});

test('contact parsing excludes passenger, owner and price fields from its result', () => {
  assert.deepEqual(bookingContactSchema.parse({
    ...contact,
    passengers: [{ givenNames: 'Bình', familyName: 'Trần' }],
    userId: 'another-user',
    totalAmount: 1,
    status: 'confirmed',
  }), contact);
});

test('normalization does not modify the form input', () => {
  const input = { contactName: ' An Nguyễn ', contactEmail: ' AN@Example.COM ', contactPhone: '090 123 4567' };
  const parsed = bookingContactSchema.parse(input);
  assert.equal(input.contactName, ' An Nguyễn ');
  assert.equal(input.contactEmail, ' AN@Example.COM ');
  assert.equal(input.contactPhone, '090 123 4567');
  assert.equal(parsed.contactName, 'An Nguyễn');
  assert.equal(parsed.contactEmail, 'an@example.com');
});
