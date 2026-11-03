import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../types/database.generated';
import {databaseIdSchema} from '../../lib/database-id.ts';
import {parseBookingReceipt} from './create-booking.ts';
const id=databaseIdSchema();const money=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const schema=z.object({payments:z.array(z.object({id,status:z.enum(['pending','succeeded','failed','cancelled']),amount:money.positive(),currency:z.literal('VND'),failureCode:z.string().nullable(),createdAt:z.iso.datetime({offset:true})})),
 refunds:z.array(z.object({id,status:z.enum(['pending','succeeded','failed']),amount:money.positive(),currency:z.literal('VND'),completedAt:z.iso.datetime({offset:true}).nullable()})),
 cancellation:z.object({allowed:z.boolean(),fee:money,refundAmount:money,reason:z.string()})});
export function parseMockState(raw:unknown){
 const booking=parseBookingReceipt((raw as {booking?:unknown})?.booking);const data=schema.parse(raw);
 if(data.payments.some(p=>p.amount!==booking.total)||data.refunds.some(r=>r.amount>booking.total)||data.cancellation.refundAmount>booking.total)throw Error('mock.invalid');
 return {booking,...data};
}
export type MockState=ReturnType<typeof parseMockState>;
export const mockOutcomes=['succeeded','failed','pending','cancelled'] as const;
export type MockOutcome=typeof mockOutcomes[number];
type Client=Pick<SupabaseClient<Database>,'rpc'>;
const safe=new Set(['mock.invalid','mock.state','mock.conflict','mock.ineligible','mock.priceChanged','mock.storage','booking.authRequired','booking.notFound']);
export function mockError(error:unknown){const message=error instanceof Error?error.message:(error as {message?:string})?.message;return message&&safe.has(message)?message:'mock.network';}
export async function loadMockPaymentState(client:Client,bookingId:string){
 const {data,error}=await client.rpc('get_mock_payment_state',{p_booking_id:id.parse(bookingId)});
 if(error)throw Error(mockError(error));const parsed=parseMockState(data);if(parsed.booking.id!==bookingId)throw Error('mock.invalid');return parsed;
}
export async function startMockPayment(client:Client,bookingId:string,requestId:string){
 const {data,error}=await client.rpc('start_mock_payment',{p_booking_id:id.parse(bookingId),p_request_id:id.parse(requestId)});
 if(error)throw Error(mockError(error));const parsed=parseMockState(data);if(parsed.booking.id!==bookingId)throw Error('mock.invalid');return parsed;
}
export async function resolveMockPayment(client:Client,paymentId:string,requestId:string,outcome:MockOutcome){
 const {data,error}=await client.rpc('resolve_mock_payment',{p_payment_id:id.parse(paymentId),p_request_id:id.parse(requestId),p_outcome:z.enum(mockOutcomes).parse(outcome)});
 if(error)throw Error(mockError(error));return parseMockState(data);
}
export async function cancelMockBooking(client:Client,bookingId:string,requestId:string,expectedFee:number){
 const {data,error}=await client.rpc('cancel_booking',{p_booking_id:id.parse(bookingId),p_request_id:id.parse(requestId),p_expected_fee:money.parse(expectedFee)});
 if(error)throw Error(mockError(error));const parsed=parseMockState(data);if(parsed.booking.id!==bookingId)throw Error('mock.invalid');return parsed;
}
export async function refundMockBooking(client:Client,bookingId:string,requestId:string,outcome:Exclude<MockOutcome,'cancelled'>){
 const {data,error}=await client.rpc('refund_mock_booking',{p_booking_id:id.parse(bookingId),p_request_id:id.parse(requestId),p_outcome:z.enum(['pending','succeeded','failed']).parse(outcome)});
 if(error)throw Error(mockError(error));const parsed=parseMockState(data);if(parsed.booking.id!==bookingId)throw Error('mock.invalid');return parsed;
}
