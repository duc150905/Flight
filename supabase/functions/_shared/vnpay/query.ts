import {API_URL,signGatewayRequest,verifyGatewayResponse,vnDate,type Config,type Fields} from './signing.ts';
export function queryOutcome(f:Fields){if(f.vnp_ResponseCode!=='00'||f.vnp_TransactionType!=='01')return 'waiting';return f.vnp_TransactionStatus==='00'?'succeeded':f.vnp_TransactionStatus==='02'?'failed':'waiting';}
export async function gatewayCall(command:'querydr'|'refund',fields:Fields,config:Config,fetcher:typeof fetch=fetch){
 fields={...fields,vnp_SecureHash:await signGatewayRequest(command,fields,config.secret)};
 const response=await fetcher(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('payment.gateway');return verifyGatewayResponse(command,await response.json(),config);
}
export type QueryClaim={bookingId:string;ref:string;amount:number;created:string;queryId:string;ip:string};
export async function queryPayment(claim:QueryClaim,config:Config){
 const response=await gatewayCall('querydr',{vnp_RequestId:claim.queryId,vnp_Version:'2.1.0',vnp_Command:'querydr',vnp_TmnCode:config.tmnCode,vnp_TxnRef:claim.ref,vnp_TransactionDate:claim.created,vnp_CreateDate:vnDate(),vnp_IpAddr:claim.ip,vnp_OrderInfo:`Flyora query ${claim.ref}`},config);
 if(response.vnp_ResponseCode==='00'&&(response.vnp_TxnRef!==claim.ref||response.vnp_Amount!==String(claim.amount*100)))throw Error('payment.reference');
 return {response,outcome:queryOutcome(response)};
}
