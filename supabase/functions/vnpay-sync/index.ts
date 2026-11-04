import {endpoint,json,owner,runtime,uuid} from '../_shared/runtime.ts';
import {readConfig} from '../_shared/vnpay/config.ts';
import {reconcileBooking} from '../_shared/vnpay/reconcile.ts';
endpoint(async request=>{
 if(request.method!=='POST')return json({error:'method'},405);
 const userId=await owner(request),body=await request.json();
 await reconcileBooking(uuid(body.bookingId),userId,readConfig(k=>runtime.env.get(k)));
 return json({ok:true});
});
