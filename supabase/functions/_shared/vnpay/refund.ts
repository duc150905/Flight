import {gatewayCall} from './query.ts';import {type Config,type Fields,wireAmount} from './signing.ts';
export function refundOutcome(f:Fields){
 if(f.vnp_ResponseCode==='94')return 'processing';
 if(f.vnp_ResponseCode==='95'||f.vnp_TransactionStatus==='09')return 'failed';
 if(f.vnp_ResponseCode!=='00')return 'unknown';
 if(f.vnp_TransactionStatus==='00')return 'succeeded';
 return ['05','06'].includes(f.vnp_TransactionStatus)?'processing':'unknown';
}
export type RefundClaim={refundId:string;requestId:string;date:string;ref:string;amount:number;type:string;transactionNo:string;created:string;ip:string};
export async function sendRefund(claim:RefundClaim,config:Config){
 const response=await gatewayCall('refund',{vnp_RequestId:claim.requestId,vnp_Version:'2.1.0',vnp_Command:'refund',vnp_TmnCode:config.tmnCode,vnp_TransactionType:claim.type,vnp_TxnRef:claim.ref,vnp_Amount:wireAmount(claim.amount),vnp_TransactionNo:claim.transactionNo,vnp_TransactionDate:claim.created,vnp_CreateBy:'Flyora',vnp_CreateDate:claim.date,vnp_IpAddr:claim.ip,vnp_OrderInfo:`Flyora refund ${claim.ref}`},config);
 if(response.vnp_TxnRef!==claim.ref||response.vnp_Amount!==wireAmount(claim.amount)||response.vnp_TransactionType!==claim.type)throw Error('payment.reference');
 return {response,state:refundOutcome(response)};
}
