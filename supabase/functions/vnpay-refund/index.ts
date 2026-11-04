import {endpoint,json,owner,rpc,runtime,uuid} from '../_shared/runtime.ts';
import {readConfig} from '../_shared/vnpay/config.ts';import {sendRefund,type RefundClaim} from '../_shared/vnpay/refund.ts';
endpoint(async request=>{
 if(request.method!=='POST')return json({error:'method'},405);
 const userId=await owner(request),body=await request.json();uuid(body.requestId);
 const claim=await rpc<RefundClaim|null>('claim_vnpay_refund',{p_booking_id:uuid(body.bookingId),p_owner_id:userId});
 if(!claim)return json({ok:true});
 try{const {response,state}=await sendRefund(claim,readConfig(k=>runtime.env.get(k)));
  await rpc('apply_vnpay_refund',{p_refund_id:claim.refundId,p_state:state,p_code:response.vnp_ResponseCode,p_transaction_no:response.vnp_TransactionNo??''});
 }catch{await rpc('apply_vnpay_refund',{p_refund_id:claim.refundId,p_state:'unknown',p_code:'transport_or_validation',p_transaction_no:''});}
 return json({ok:true});
});
