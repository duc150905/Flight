import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as gateway from '../supabase/functions/_shared/vnpay/query.ts';
const config={tmnCode:'TEST1234',secret:'never-log-this-secret',returnUrl:'https://example.invalid'};
const fields={vnp_Command:'querydr',vnp_TmnCode:'TEST1234',vnp_TxnRef:'private-reference'};

test('unsigned VNPAY 99 remains untrusted but preserves a safe diagnostic',async()=>{
 const logs=[];const warn=console.warn;console.warn=(...args)=>logs.push(args);
 try{
  await assert.rejects(()=>gateway.gatewayCall('querydr',fields,config,async()=>Response.json({vnp_ResponseCode:'99',vnp_Message:'Unexpected error '+config.secret})),error=>{
   assert.equal(error.diagnostic.category,'unverified_response');
   assert.equal(error.diagnostic.responseCode,'99');
   assert.equal(error.diagnostic.httpStatus,200);
   assert.equal(gateway.gatewayFailureCode(error),'gateway_unverified_99');return true;
  });
  const text=JSON.stringify(logs);
  assert.ok(text.includes('unverified_response'));
  assert.ok(!text.includes(config.secret));assert.ok(!text.includes(fields.vnp_TxnRef));assert.ok(!text.includes('Unexpected error'));
 }finally{console.warn=warn;}
});

test('HTTP, timeout, transport and non-JSON failures stay distinguishable without changing financial outcomes',async()=>{
 const warn=console.warn;console.warn=()=>{};
 try{
  const cases=[
   [async()=>new Response('<html>upstream error</html>',{status:500}),'gateway_http_500'],
   [async()=>new Response('<html>not json</html>'),'gateway_bad_json'],
   [async()=>{throw new DOMException('timed out','TimeoutError');},'gateway_timeout'],
   [async()=>{throw new TypeError('fetch failed '+config.secret);},'gateway_network'],
  ];
  for(const [fetcher,code] of cases)await assert.rejects(()=>gateway.gatewayCall('querydr',fields,config,fetcher),error=>{assert.equal(gateway.gatewayFailureCode(error),code);return true;});
 }finally{console.warn=warn;}
});

test('deadline and transport errors while reading a response body are not labelled malformed JSON',async()=>{
 const warn=console.warn;console.warn=()=>{};
 try{
  for(const [failure,code] of [[new DOMException('body deadline','TimeoutError'),'gateway_timeout'],[new TypeError('stream disconnected'),'gateway_network']]){
   const fetcher=async()=>new Response(new ReadableStream({start(controller){controller.error(failure);}}));
   await assert.rejects(()=>gateway.gatewayCall('querydr',fields,config,fetcher),error=>{assert.equal(gateway.gatewayFailureCode(error),code);return true;});
  }
 }finally{console.warn=warn;}
});
