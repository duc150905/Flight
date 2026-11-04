import {test} from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {canonicalPay} from '../supabase/functions/_shared/vnpay/signing.ts';
let currentHandler;const values={SUPABASE_URL:'https://database.example',SUPABASE_ANON_KEY:'public-test',SUPABASE_SERVICE_ROLE_KEY:'server-test',VNPAY_TMN_CODE:'TEST1234',VNPAY_HASH_SECRET:'test-secret-for-endpoint-only',VNPAY_RETURN_URL:'https://database.example/return'};
globalThis.Deno={env:{get:k=>values[k]},serve:handler=>{currentHandler=handler;}};
async function handler(name){await import(`../supabase/functions/${name}/index.ts`);return currentHandler;}
test('expired or missing JWT cannot reach financial service RPCs',async()=>{
 const old=globalThis.fetch;const calls=[];globalThis.fetch=async url=>{calls.push(String(url));return new Response('{}',{status:401});};
 try{for(const name of ['vnpay-create','vnpay-sync','vnpay-refund']){const run=await handler(name);const response=await run(new Request('https://edge.example',{method:'POST',headers:{Authorization:'Bearer expired','Content-Type':'application/json'},body:'{}'}));assert.equal(response.status,401);}
 assert.ok(calls.every(url=>url.endsWith('/auth/v1/user')));}finally{globalThis.fetch=old;}
});
test('public IPN rejects tampering and acknowledges signed waiting without settling',async()=>{
 const run=await handler('vnpay-ipn');const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected service write');};
 try{const bad=await run(new Request('https://edge.example?vnp_SecureHash=forged'));assert.equal((await bad.json()).RspCode,'97');
 const f={vnp_TmnCode:'TEST1234',vnp_TxnRef:'a'.repeat(32),vnp_Amount:'1000000',vnp_ResponseCode:'00',vnp_TransactionStatus:'01'};
 const signature=createHmac('sha512',values.VNPAY_HASH_SECRET).update(canonicalPay(f)).digest('hex');
 const response=await run(new Request('https://edge.example?'+new URLSearchParams({...f,vnp_SecureHash:signature})));assert.equal((await response.json()).RspCode,'00');assert.equal(calls,0);
 }finally{globalThis.fetch=old;}
});
