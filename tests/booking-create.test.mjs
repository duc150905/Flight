import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingPayload, createBooking, parseBookingReceipt } from '../src/features/booking/create-booking.ts';
import { createCheckoutDraftStore } from '../src/features/booking/draft.ts';
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
test('create payload normalizes names/contact and excludes client-side extra prices',()=>{
 const flightDay=new Date(now+86400000*30).toISOString().slice(0,10);
 const selection={tripType:'one_way',passengers:{adults:1,children:0,infants:0},segments:[{flightId:id,fareId:id,journeyIndex:1,legIndex:1}]};
 const store=createCheckoutDraftStore();store.getState().beginCheckout({selection,international:false,legs:[{...selection.segments[0],origin:{timezone:'UTC'},departureDate:flightDay,arrivalDate:flightDay,departureAt:`${flightDay}T12:00:00Z`,salesCloseAt:`${flightDay}T11:00:00Z`}]});
 store.getState().updateContact({contactName:' Test Person ',contactEmail:' TEST@Example.com ',contactPhone:'090 123 4567'});
 store.getState().updatePassenger('adult-1',{givenNames:' Test ',familyName:' Person ',dateOfBirth:'1990-01-01'});
 const quote={currency:'VND',base:100,tax:0,fee:0,baggage:0,seat:0,total:100,quotedAt:new Date(now).toISOString(),expiresAt:new Date(now+300000).toISOString(),lines:[{passengerId:'adult-1',flightId:id,passengerType:'adult',requiresSeat:true,base:100,tax:0,fee:0,baggage:0,seat:0,baggageName:null,seatCode:null}]};
 const result=bookingPayload(store.getState(),quote);
 assert.equal(result.contact.contactEmail,'test@example.com');assert.equal(result.travellers[0].values.givenNames,'Test');
 assert.equal(result.checkout.passengers[0].givenNames,undefined);assert.equal(store.getState().passengers[0].values.givenNames,' Test ');
});
