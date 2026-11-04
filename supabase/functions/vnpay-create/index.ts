import {endpoint,json,owner,rpc,uuid,runtime} from '../_shared/runtime.ts';
import {readConfig} from '../_shared/vnpay/config.ts';
import {createPayUrl,vnDate} from '../_shared/vnpay/signing.ts';
endpoint(async request=>{
 if(request.method!=='POST')return json({error:'method'},405);
 const userId=await owner(request);const input=await request.json();const config=readConfig(k=>runtime.env.get(k));
 const result=await rpc<{bookingId:string;paymentId:string;ref:string;amount:number;created:string;expiresAt:string;ip:string}>('begin_vnpay_payment',{p_booking_id:uuid(input.bookingId),p_owner_id:userId,p_request_id:uuid(input.requestId),p_ip:request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'127.0.0.1'});
 return json({bookingId:result.bookingId,paymentId:result.paymentId,expiresAt:result.expiresAt,paymentUrl:await createPayUrl({...result,expires:vnDate(new Date(result.expiresAt)),locale:input.locale},config)});
});
