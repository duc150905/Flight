import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingPayload, createBooking, parseBookingReceipt } from '../src/features/booking/create-booking.ts';
const id='11111111-1111-4111-8111-111111111111';
const now=Date.now();
const receipt={id,bookingCode:'FY123456',status:'pending_payment',total:100,currency:'VND',expiresAt:new Date(now+900000).toISOString(),serverNow:new Date(now).toISOString()};
test('receipt rejects invalid money, status and missing timestamps',()=>{
 assert.equal(parseBookingReceipt(receipt).id,id);
 for(const bad of [{...receipt,total:0},{...receipt,total:Number.MAX_SAFE_INTEGER+1},{...receipt,currency:'USD'},{...receipt,status:'paid'},{...receipt,serverNow:''}]) assert.throws(()=>parseBookingReceipt(bad));
});
test('create adapter sends request UUID, whitelists errors and validates receipt',async()=>{
 const payload={checkout:{}}; let args;
 const client={rpc:async(name,value)=>{assert.equal(name,'create_booking');args=value;return {data:receipt,error:null};}};
 assert.equal((await createBooking(client,id,payload)).id,id);assert.deepEqual(args,{p_request_id:id,p_request:payload});
 await assert.rejects(createBooking({rpc:async()=>({error:{message:'SECRET DATABASE DETAIL'}})},id,payload),/booking.createError/);
 await assert.rejects(createBooking({rpc:async()=>({error:{message:'booking.priceChanged'}})},id,payload),/booking.priceChanged/);
});
test('payload uses normalized review data and refuses invalid traveller/contact data',()=>{
 assert.throws(()=>bookingPayload({itinerary:null},{}));
});
