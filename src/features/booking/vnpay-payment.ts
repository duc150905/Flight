import {databaseIdSchema} from '../../lib/database-id.ts';
export function paymentReturnId(value:unknown){const parsed=databaseIdSchema().safeParse(value);return parsed.success?parsed.data:null;}
export function safeCheckoutUrl(value:string){const url=new URL(value);if(url.protocol!=='https:'||url.hostname!=='sandbox.vnpayment.vn'||url.pathname!=='/paymentv2/vpcpay.html'||url.username||url.password||url.port)throw Error('payment.invalid');return url;}
