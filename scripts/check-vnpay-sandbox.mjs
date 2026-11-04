import {readFileSync} from 'node:fs';
import {readConfig} from '../supabase/functions/_shared/vnpay/config.ts';
import {queryPayment} from '../supabase/functions/_shared/vnpay/query.ts';
import {vnDate} from '../supabase/functions/_shared/vnpay/signing.ts';
const values=Object.fromEntries(readFileSync('.env.vnpay.local','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const config=readConfig(k=>values[k]);
const originalFetch=globalThis.fetch;let diagnostic;
globalThis.fetch=async(...args)=>{const result=await originalFetch(...args);try{const r=await result.clone().json();diagnostic={status:result.status,keys:Object.keys(r),responseCode:r.vnp_ResponseCode,message:r.vnp_Message,merchantMatches:r.vnp_TmnCode===config.tmnCode,hasHash:!!r.vnp_SecureHash};}catch{}return result;};
try{const {response}=await queryPayment({bookingId:'readiness',ref:crypto.randomUUID().replaceAll('-',''),amount:10000,created:vnDate(),queryId:crypto.randomUUID().replaceAll('-',''),ip:'127.0.0.1'},config);
 console.log(JSON.stringify({gateway:'VNPAY Sandbox',signatureVerified:true,responseCode:response.vnp_ResponseCode,expectedMissingTransaction:'91'}));
}catch(e){console.log(JSON.stringify({gateway:'VNPAY Sandbox',verified:false,error:e.message,diagnostic}));process.exitCode=1;}
