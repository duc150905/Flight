import {endpoint,env,json,rpc,runtime} from '../_shared/runtime.ts';import {readConfig} from '../_shared/vnpay/config.ts';import {reconcileBooking} from '../_shared/vnpay/reconcile.ts';
endpoint(async request=>{
 if(request.method!=='POST')return json({error:'method'},405);
 if(request.headers.get('Authorization')!==`Bearer ${env('PAYMENT_WORKER_SECRET')}`)return json({error:'unauthorized'},401);
 const ids=await rpc<string[]>('vnpay_worker_batch',{});const config=readConfig(k=>runtime.env.get(k));
 const results=await Promise.allSettled(ids.map(id=>reconcileBooking(id,null,config)));
 return json({processed:results.filter(r=>r.status==='fulfilled').length});
});
