import {rpc} from '../runtime.ts';import type {Config} from './signing.ts';import {queryPayment,type QueryClaim} from './query.ts';import {refundOutcome,sendRefund,type RefundClaim} from './refund.ts';import {queryRefund} from './recovery.ts';
export async function reconcileBooking(bookingId:string,ownerId:string|null,config:Config){
 const claim=await rpc<QueryClaim|null>('claim_vnpay_sync',{p_booking_id:bookingId,p_owner_id:ownerId});
 if(claim){try{const {response,outcome}=await queryPayment(claim,config);if(outcome!=='waiting')await rpc('apply_vnpay_result',{p_ref:claim.ref,p_amount:claim.amount,p_success:outcome==='succeeded',p_transaction_no:response.vnp_TransactionNo??'',p_pay_date:response.vnp_PayDate??'',p_code:response.vnp_ResponseCode});}catch{/* persisted backoff; retry read only */}}
 const refund=await rpc<RefundClaim|null>('claim_vnpay_refund',{p_booking_id:bookingId,p_owner_id:ownerId});
 if(refund){try{const {response,state}=await sendRefund(refund,config);await rpc('apply_vnpay_refund',{p_refund_id:refund.refundId,p_state:state,p_code:response.vnp_ResponseCode,p_transaction_no:response.vnp_TransactionNo??''});}
  catch{await rpc('apply_vnpay_refund',{p_refund_id:refund.refundId,p_state:'unknown',p_code:'transport_or_validation',p_transaction_no:''});}}
 const recover=await rpc<RefundClaim|null>('claim_vnpay_refund_sync',{p_booking_id:bookingId});
 if(recover){try{const {response,matched}=await queryRefund(recover,config);if(matched)await rpc('apply_vnpay_refund',{p_refund_id:recover.refundId,p_state:refundOutcome({...response,vnp_ResponseCode:'00'}),p_code:response.vnp_ResponseCode,p_transaction_no:response.vnp_TransactionNo??''});}catch{/* never resubmit an unknown refund */}}
}
