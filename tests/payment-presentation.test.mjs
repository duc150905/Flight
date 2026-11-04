import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as presentation from '../src/features/booking/payment-presentation.ts';
const { cancellationStage }=presentation;

const state=(status,allowed=true)=>({booking:{status},cancellation:{allowed}});
test('a cancellable unpaid hold is distinct from a paid cancellation',()=>{
 assert.equal(cancellationStage(state('pending_payment'),true),'unpaid');
 assert.equal(cancellationStage(state('confirmed'),false),'paid');
});
test('only unresolved VNPAY payment/refund outcomes are polled while the screen is active',()=>{
 const pending={provider:'vnpay_sandbox',payments:[{status:'pending'}],refundState:null};
 assert.equal(presentation.paymentRefreshInterval(pending,true,120000,0),10000);
 assert.equal(presentation.paymentRefreshInterval(pending,false,120000,0),false);
 assert.equal(presentation.paymentRefreshInterval(pending,true,120000,120000),false);
 assert.equal(presentation.paymentRefreshInterval({...pending,provider:'mock'},true,120000,0),false);
 assert.equal(presentation.paymentRefreshInterval({...pending,payments:[]},true,120000,0),false);
 assert.equal(presentation.paymentRefreshInterval({...pending,payments:[{status:'succeeded'}]},true,120000,0),false);
 for(const refundState of ['ready','submitted','unknown','processing']){
  assert.equal(presentation.paymentRefreshInterval({...pending,payments:[],refundState},true,120000,0),10000);
 }
 for(const refundState of ['succeeded','failed','review']){
  assert.equal(presentation.paymentRefreshInterval({...pending,payments:[],refundState},true,120000,0),false);
 }
 assert.equal(presentation.paymentRefreshInterval({...pending,payments:[],refundState:'review',refundJobs:[{state:'review'},{state:'processing'}]},true,120000,0),10000);
});

test('the retry deadline expires without waiting for a newer server response',()=>{
 const pending={provider:'vnpay_sandbox',payments:[{status:'pending'}],dataUpdatedAt:1000};
 assert.equal(presentation.paymentWatchExpired(pending,120000,119999),false);
 assert.equal(presentation.paymentWatchExpired(pending,120000,120000),true);
 assert.equal(presentation.paymentWatchExpired({...pending,payments:[{status:'succeeded'}]},120000,130000),false);
});

test('initial confirmed receipts and later status transitions refresh detailed seats once',()=>{
 const pending={ownerId:'owner',bookingId:'booking',status:'pending_payment'};
 const confirmed={...pending,status:'confirmed'};
 assert.equal(presentation.bookingDetailsChanged(undefined,pending),false);
 assert.equal(presentation.bookingDetailsChanged(undefined,confirmed),true);
 assert.equal(presentation.bookingDetailsChanged(pending,confirmed),true);
 assert.equal(presentation.bookingDetailsChanged(confirmed,confirmed),false);
 assert.equal(presentation.bookingDetailsChanged(confirmed,{...confirmed,ownerId:'another-owner'}),true);
});

test('a read-only retry reloads booking details without requiring a gateway action',async()=>{
 const events=[];
 await presentation.refreshPaymentRead(async()=>{events.push('read legacy mock state');},()=>true,()=>events.push('reload details'));
 assert.deepEqual(events,['read legacy mock state','reload details']);
});

test('a payment read finishing after the owner or screen changed cannot reload that screen',async()=>{
 let current=true;let refreshed=false;
 await presentation.refreshPaymentRead(async()=>{current=false;},()=>current,()=>{refreshed=true;});
 assert.equal(refreshed,false);
});
test('expired holds, denied policies and ended bookings have no cancellation action',()=>{
 assert.equal(cancellationStage(state('pending_payment'),false),null);
 assert.equal(cancellationStage(state('pending_payment',false),true),null);
 assert.equal(cancellationStage(state('confirmed',false)),null);
 assert.equal(cancellationStage(state('cancelled')),null);
 assert.equal(cancellationStage(state('expired')),null);
 assert.equal(cancellationStage(undefined),null);
});
