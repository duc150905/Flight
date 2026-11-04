import {databaseIdSchema} from '../../lib/database-id.ts';
import {z} from 'zod';import {parseMockState} from './mock-payment.ts';
const refundStates=z.enum(['ready','submitted','unknown','processing','succeeded','failed','review']);
export function parseGatewayState(raw:unknown){
 const base=parseMockState(raw),extra=z.object({provider:z.enum(['mock','vnpay_sandbox']).nullable().default(null),settlement:z.enum(['waiting','ticketed','compensation','failed']).nullable().default(null),refundState:refundStates.nullable().default(null),refundJobs:z.array(z.object({id:databaseIdSchema(),amount:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),state:refundStates})).max(100).default([])}).parse(raw);
 if(extra.refundJobs.some(job=>job.amount>base.booking.total))throw Error('payment.amount');return {...base,...extra};
}
export function paymentReturnId(value:unknown){const parsed=databaseIdSchema().safeParse(value);return parsed.success?parsed.data:null;}
export function safeCheckoutUrl(value:string){const url=new URL(value);if(url.protocol!=='https:'||url.hostname!=='sandbox.vnpayment.vn'||url.pathname!=='/paymentv2/vpcpay.html'||url.username||url.password||url.port)throw Error('payment.invalid');return url;}
