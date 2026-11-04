import assert from 'node:assert/strict';
import { test } from 'node:test';
import { holdSecondsRemaining, parsePendingBooking,demoTicketReady,withLatestReceipt } from '../src/features/booking/pending-booking.ts';
import { pendingBookingFixture } from './fixtures/pending-booking.mjs';
import { translate } from '../src/features/i18n/translate.ts';
import { bookingVietnamese } from '../src/features/i18n/booking-messages.ts';
import * as pendingPresentation from '../src/features/booking/pending-booking.ts';
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
test('demo ticket requires confirmed order and every required seat confirmed',()=>{
 const data=structuredClone(pendingBookingFixture);assert.equal(demoTicketReady(data),false);
 data.status='confirmed';assert.equal(demoTicketReady(data),false);
 data.seats[0].status='confirmed';assert.equal(demoTicketReady(data),true);
 data.seats=[];assert.equal(demoTicketReady(data),false);
});
test('an older mock cache cannot turn a freshly expired booking back into pending',()=>{
 const expired={...pendingBookingFixture,status:'expired',serverNow:'2026-11-03T10:16:00Z'};
 assert.equal(withLatestReceipt(expired,pendingBookingFixture).status,'expired');
 const confirmed={...pendingBookingFixture,status:'confirmed',serverNow:'2026-11-03T10:17:00Z'};
 assert.equal(withLatestReceipt(expired,confirmed).status,'confirmed');
});

test('cancelling from an open e-ticket switches to booking details instead of a ticket error',()=>{
 const booking=structuredClone(pendingBookingFixture);
 booking.status='confirmed';booking.seats[0].status='confirmed';
 assert.equal(pendingPresentation.bookingScreenMode(booking,true),'receipt');
 booking.status='cancelled';booking.seats[0].status='released';
 assert.equal(pendingPresentation.bookingScreenMode(booking,true),'details');
 assert.equal(pendingPresentation.bookingScreenMode({...booking,status:'expired'},true),'details');
});
