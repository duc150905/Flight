import {API_URL,signGatewayRequest,verifyGatewayResponse,vnDate,type Config,type Fields} from './signing.ts';
export function queryOutcome(f:Fields){if(f.vnp_ResponseCode!=='00'||f.vnp_TransactionType!=='01')return 'waiting';return f.vnp_TransactionStatus==='00'?'succeeded':f.vnp_TransactionStatus==='02'?'failed':'waiting';}
type GatewayDiagnostic={command:'querydr'|'refund';category:'timeout'|'network'|'http'|'bad_json'|'unverified_response';elapsedMs:number;httpStatus?:number;responseCode?:string};
class GatewayError extends Error{
 readonly diagnostic:GatewayDiagnostic;
 constructor(diagnostic:GatewayDiagnostic){super(`payment.gateway_${diagnostic.category}`);this.diagnostic=diagnostic;}
}
/** Persist only known diagnostics, never raw response text, request fields or credentials. */
export function gatewayFailureCode(error:unknown){
 if(error instanceof GatewayError){
  const d=error.diagnostic;
  if(d.category==='http')return `gateway_http_${d.httpStatus}`;
  if(d.category==='unverified_response')return d.responseCode?`gateway_unverified_${d.responseCode}`:'gateway_unverified';
  return `gateway_${d.category}`;
 }
 if(error instanceof Error&&error.message==='payment.reference')return 'gateway_reference_mismatch';
 if(error instanceof Error&&error.message==='payment.config')return 'gateway_config';
 return 'transport_or_validation';
}
export async function gatewayCall(command:'querydr'|'refund',fields:Fields,config:Config,fetcher:typeof fetch=fetch){
 fields={...fields,vnp_SecureHash:await signGatewayRequest(command,fields,config.secret)};
 const started=Date.now();
 const fail=(category:GatewayDiagnostic['category'],details:Pick<GatewayDiagnostic,'httpStatus'|'responseCode'>={}):never=>{
  const diagnostic={command,category,elapsedMs:Date.now()-started,...details};
  console.warn('vnpay_gateway_failure',diagnostic);
  throw new GatewayError(diagnostic);
 };
 let response:Response;
 try{response=await fetcher(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields),signal:AbortSignal.timeout(15000)});}
 catch(error){return fail(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'timeout':'network');}
 if(!response.ok)return fail('http',{httpStatus:response.status});
 let raw:unknown;
 try{raw=await response.json();}catch(error){
  const category=error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'timeout':error instanceof SyntaxError?'bad_json':'network';
  return fail(category,{httpStatus:response.status});
 }
 try{return await verifyGatewayResponse(command,raw,config);}
 catch{
  const code=raw&&typeof raw==='object'&&'vnp_ResponseCode' in raw?raw.vnp_ResponseCode:undefined;
  return fail('unverified_response',{httpStatus:response.status,...(typeof code==='string'&&/^\d{2}$/.test(code)?{responseCode:code}:{})});
 }
}
export type QueryClaim={bookingId:string;ref:string;amount:number;created:string;queryId:string;ip:string};
export async function queryPayment(claim:QueryClaim,config:Config){
 const response=await gatewayCall('querydr',{vnp_RequestId:claim.queryId,vnp_Version:'2.1.0',vnp_Command:'querydr',vnp_TmnCode:config.tmnCode,vnp_TxnRef:claim.ref,vnp_TransactionDate:claim.created,vnp_CreateDate:vnDate(),vnp_IpAddr:claim.ip,vnp_OrderInfo:`Flyora query ${claim.ref}`},config);
 if(response.vnp_ResponseCode==='00'&&(response.vnp_TxnRef!==claim.ref||response.vnp_Amount!==String(claim.amount*100)))throw Error('payment.reference');
 return {response,outcome:queryOutcome(response)};
}
