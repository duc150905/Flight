import {gatewayCall} from './query.ts';import type {Config,Fields} from './signing.ts';import type {RefundClaim} from './refund.ts';
export function refundQueryMatches(claim:Pick<RefundClaim,'ref'|'amount'|'type'>,response:Fields){return response.vnp_TxnRef===claim.ref&&response.vnp_Amount===String(claim.amount*100)&&response.vnp_TransactionType===claim.type;}
export async function queryRefund(claim:RefundClaim,config:Config){
 const response=await gatewayCall('querydr',{vnp_RequestId:claim.requestId,vnp_Version:'2.1.0',vnp_Command:'querydr',vnp_TmnCode:config.tmnCode,vnp_TxnRef:claim.ref,vnp_TransactionDate:claim.created,vnp_CreateDate:claim.date,vnp_IpAddr:claim.ip,vnp_OrderInfo:`Flyora refund query ${claim.ref}`},config);
 return {response,matched:response.vnp_ResponseCode==='00'&&refundQueryMatches(claim,response)};
}
