export type Fields=Record<string,string>;
export type Config={secret:string;tmnCode:string;returnUrl:string};
export const PAY_URL='https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
export const API_URL='https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
export function wireAmount(amount:number){if(!Number.isSafeInteger(amount)||amount<=0||amount>9_999_999_999)throw Error('payment.amount');return String(amount*100);}
export function vnDate(date=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date).replace(/\D/g,'');}
const encode=(s:string)=>encodeURIComponent(s).replace(/%20/g,'+');
export function canonicalPay(fields:Fields){return Object.keys(fields).filter(k=>k!=='vnp_SecureHash'&&k!=='vnp_SecureHashType').sort().map(k=>`${encode(k)}=${encode(fields[k])}`).join('&');}
async function hmac(text:string,secret:string){const e=new TextEncoder();const k=await crypto.subtle.importKey('raw',e.encode(secret),{name:'HMAC',hash:'SHA-512'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,e.encode(text))),v=>v.toString(16).padStart(2,'0')).join('');}
function same(a:string,b:string){if(!/^[a-f\d]{128}$/i.test(a)||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.toLowerCase().charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export async function createPayUrl(input:{ref:string;amount:number;created:string;expires:string;ip:string;locale?:string},config:Config){
 const url=new URL(config.returnUrl);if(url.protocol!=='https:')throw Error('payment.config');
 const fields:Fields={vnp_Version:'2.1.0',vnp_Command:'pay',vnp_TmnCode:config.tmnCode,vnp_TxnRef:input.ref,vnp_Amount:wireAmount(input.amount),vnp_CurrCode:'VND',vnp_OrderInfo:`Flyora ${input.ref}`,vnp_OrderType:'other',vnp_Locale:input.locale==='en'?'en':'vn',vnp_ReturnUrl:config.returnUrl,vnp_IpAddr:input.ip,vnp_CreateDate:input.created,vnp_ExpireDate:input.expires};
 const canonical=canonicalPay(fields);return `${PAY_URL}?${canonical}&vnp_SecureHash=${await hmac(canonical,config.secret)}`;
}
export async function verifyPayCallback(params:URLSearchParams,config:Pick<Config,'secret'|'tmnCode'>){
 const fields:Fields={};for(const [k,v] of params){if(k in fields||!/^vnp_[A-Za-z]+$/.test(k)||v.length>1024)throw Error('payment.signature');fields[k]=v;}
 if(fields.vnp_TmnCode!==config.tmnCode||!same(fields.vnp_SecureHash??'',await hmac(canonicalPay(fields),config.secret)))throw Error('payment.signature');
 if(!/^[a-f0-9]{32}$/.test(fields.vnp_TxnRef??'')||!/^\d{1,12}$/.test(fields.vnp_Amount??'')||!/^[0-9]{2}$/.test(fields.vnp_ResponseCode??'')||!/^[0-9]{2}$/.test(fields.vnp_TransactionStatus??''))throw Error('payment.invalid');
 const amount=Number(fields.vnp_Amount)/100;if(!Number.isSafeInteger(amount)||amount<=0)throw Error('payment.amount');
 const success=fields.vnp_ResponseCode==='00'&&fields.vnp_TransactionStatus==='00';
 if(success&&(!/^[1-9]\d{0,14}$/.test(fields.vnp_TransactionNo??'')||!/^\d{14}$/.test(fields.vnp_PayDate??'')))throw Error('payment.invalid');
 const outcome=success?'succeeded':fields.vnp_TransactionStatus==='02'||fields.vnp_ResponseCode==='24'?'failed':'waiting';
 return {ref:fields.vnp_TxnRef,amount,success,outcome,transactionNo:fields.vnp_TransactionNo??'',payDate:fields.vnp_PayDate??'',code:fields.vnp_ResponseCode,status:fields.vnp_TransactionStatus};
}
const base=['vnp_RequestId','vnp_Version','vnp_Command','vnp_TmnCode'];
const query=['vnp_TxnRef','vnp_TransactionDate','vnp_CreateDate','vnp_IpAddr','vnp_OrderInfo'];
const refund=['vnp_TransactionType','vnp_TxnRef','vnp_Amount','vnp_TransactionNo','vnp_TransactionDate','vnp_CreateBy','vnp_CreateDate','vnp_IpAddr','vnp_OrderInfo'];
const response=['vnp_ResponseId','vnp_Command','vnp_ResponseCode','vnp_Message','vnp_TmnCode','vnp_TxnRef','vnp_Amount','vnp_BankCode','vnp_PayDate','vnp_TransactionNo','vnp_TransactionType','vnp_TransactionStatus','vnp_OrderInfo'];
export function signGatewayRequest(command:'querydr'|'refund',fields:Fields,secret:string){return hmac([...base,...(command==='refund'?refund:query)].map(k=>fields[k]??'').join('|'),secret);}
export async function verifyGatewayResponse(command:'querydr'|'refund',raw:unknown,config:Pick<Config,'secret'|'tmnCode'>){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('payment.response');
 const fields=raw as Fields;for(const [k,v] of Object.entries(fields))if(typeof v!=='string'||v.length>2048||!k.startsWith('vnp_'))throw Error('payment.response');
 const keys=command==='querydr'?[...response,'vnp_PromotionCode','vnp_PromotionAmount']:response;
 if(fields.vnp_TmnCode!==config.tmnCode||fields.vnp_Command!==command||!same(fields.vnp_SecureHash??'',await hmac(keys.map(k=>fields[k]??'').join('|'),config.secret)))throw Error('payment.signature');
 return fields;
}
