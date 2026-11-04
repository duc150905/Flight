import {endpoint,json,owner,rpc,runtime,uuid} from '../_shared/runtime.ts';
import {readConfig} from '../_shared/vnpay/config.ts';
import {queryPayment,type QueryClaim} from '../_shared/vnpay/query.ts';
endpoint(async request=>{
 if(request.method!=='POST')return json({error:'method'},405);
 const userId=await owner(request),body=await request.json();const claim=await rpc<QueryClaim|null>('claim_vnpay_sync',{p_booking_id:uuid(body.bookingId),p_owner_id:userId});
 if(claim){const {response,outcome}=await queryPayment(claim,readConfig(k=>runtime.env.get(k)));
  if(outcome!=='waiting')await rpc('apply_vnpay_result',{p_ref:claim.ref,p_amount:claim.amount,p_success:outcome==='succeeded',p_transaction_no:response.vnp_TransactionNo??'',p_pay_date:response.vnp_PayDate??'',p_code:response.vnp_ResponseCode});
 }
 return json({ok:true});
});
