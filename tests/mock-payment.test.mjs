import assert from 'node:assert/strict';import {test} from 'node:test';
import {parseMockState,startMockPayment} from '../src/features/booking/mock-payment.ts';
const id='11111111-1111-4111-8111-111111111111';
const state={booking:{id,bookingCode:'FY123456',status:'pending_payment',currency:'VND',total:100,expiresAt:'2026-12-01T00:15:00Z',serverNow:'2026-12-01T00:00:00Z'},payments:[],refunds:[],cancellation:{allowed:false,fee:0,refundAmount:0,reason:'unsupported'}};
test('mock state validates currency, payment amount and refund bounds',()=>{
 assert.equal(parseMockState(state).booking.total,100);
 assert.throws(()=>parseMockState({...state,booking:{...state.booking,currency:'USD'}}));
 assert.throws(()=>parseMockState({...state,payments:[{id,status:'succeeded',amount:1,currency:'VND',failureCode:null,createdAt:'2026-12-01T00:00:00Z'}]}));
 assert.throws(()=>parseMockState({...state,refunds:[{id,status:'succeeded',amount:101,currency:'VND',completedAt:'2026-12-01T00:00:00Z'}]}));
});
test('start mock payment sends IDs only and verifies the returned booking',async()=>{
 let args;const client={rpc:async(name,value)=>{assert.equal(name,'start_mock_payment');args=value;return {data:state,error:null};}};
 await startMockPayment(client,id,id);assert.deepEqual(args,{p_booking_id:id,p_request_id:id});
 await assert.rejects(startMockPayment({rpc:async()=>({error:{message:'secret details'}})},id,id),/mock.network/);
});
