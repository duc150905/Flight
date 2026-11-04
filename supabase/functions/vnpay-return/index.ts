import {endpoint,env,json,runtime} from '../_shared/runtime.ts';
import {readConfig} from '../_shared/vnpay/config.ts';
import {verifyPayCallback} from '../_shared/vnpay/signing.ts';
endpoint(async request=>{
 if(request.method!=='GET')return json({error:'method'},405);
 const result=await verifyPayCallback(new URL(request.url).searchParams,readConfig(k=>runtime.env.get(k)));
 const url=new URL(`${env('SUPABASE_URL')}/rest/v1/payments`);url.searchParams.set('provider_reference',`eq.${result.ref}`);url.searchParams.set('provider','eq.vnpay_sandbox');url.searchParams.set('select','booking_id');url.searchParams.set('limit','1');
 const response=await fetch(url,{headers:{apikey:env('SUPABASE_SERVICE_ROLE_KEY'),Authorization:`Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('payment.server');const rows=await response.json();
 if(!rows[0]?.booking_id)return json({error:'payment.notFound'},404);
 return new Response(null,{status:302,headers:{Location:`flight://payment-return?bookingId=${encodeURIComponent(rows[0].booking_id)}`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
});
