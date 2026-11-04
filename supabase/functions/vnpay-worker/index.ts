import {endpoint,env,json,rpc,runtime} from '../_shared/runtime.ts';import {readConfig} from '../_shared/vnpay/config.ts';import {reconcileBooking} from '../_shared/vnpay/reconcile.ts';
import {sendBookingMail} from '../_shared/send-booking-mail.ts';
endpoint(async request=>{
 if(request.method!=='POST')return json({error:'method'},405);
 if(request.headers.get('Authorization')!==`Bearer ${env('PAYMENT_WORKER_SECRET')}`)return json({error:'unauthorized'},401);
 const ids=await rpc<string[]>('vnpay_worker_batch',{});const config=readConfig(k=>runtime.env.get(k));
 const results=await Promise.allSettled(ids.map(id=>reconcileBooking(id,null,config)));
 let mailed=0;try{for(let i=0;i<3;i++){if(!await sendBookingMail())break;mailed++;}}catch{/* email config/transport never rolls back bookings */}
 return json({processed:results.filter(r=>r.status==='fulfilled').length,mailAttempts:mailed});
});
