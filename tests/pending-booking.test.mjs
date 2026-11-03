import assert from 'node:assert/strict';
import { test } from 'node:test';
import { holdSecondsRemaining, parsePendingBooking } from '../src/features/booking/pending-booking.ts';
import { pendingBookingFixture } from './fixtures/pending-booking.mjs';
import { translate } from '../src/features/i18n/translate.ts';
import { bookingVietnamese } from '../src/features/i18n/booking-messages.ts';
test('countdown starts from server time, clamps expiry, uses elapsed monotonic duration',()=>{
 const booking={status:'pending_payment',expiresAt:'2026-11-03T10:15:00Z',serverNow:'2026-11-03T10:00:00Z'};
 assert.equal(holdSecondsRemaining(booking,0),900);assert.equal(holdSecondsRemaining(booking,120000),780);
 assert.equal(holdSecondsRemaining(booking,1000000),0);assert.equal(holdSecondsRemaining({...booking,status:'expired'},0),0);
});
test('pending parser rejects arbitrary backend data',()=>{
 assert.throws(()=>parsePendingBooking({}));
 assert.equal(parsePendingBooking(pendingBookingFixture).total,1800000);
 assert.throws(()=>parsePendingBooking({...pendingBookingFixture,total:1}));
 assert.throws(()=>parsePendingBooking({...pendingBookingFixture,passengerSegments:[]}));
});
test('all pending checkout labels/errors have Vietnamese and English translations',()=>{
 for(const [key,value] of Object.entries(bookingVietnamese)){
  assert.equal(translate('vi',key),value);
  assert.ok(!translate('en',key).startsWith('booking.'));
 }
});
test('saved baggage weights may be fractional, matching existing catalogue allowances',()=>{
 const data=structuredClone(pendingBookingFixture);data.passengerSegments[0].allowance.cabin_kg=7.5;
 assert.equal(parsePendingBooking(data).passengerSegments[0].allowance.cabin_kg,7.5);
});
