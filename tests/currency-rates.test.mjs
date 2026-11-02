import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRatePayload, isFreshRate, createRateService, fetchUsdVnd } from '../src/features/currency/rates.ts';
import { presentMoney, inlineMoney } from '../src/features/currency/presentation.ts';
const now=Date.parse('2026-11-02T08:00:00Z');
const payload={result:'success',base_code:'USD',time_last_update_unix:(now-3600000)/1000,time_next_update_unix:(now+23*3600000)/1000,rates:{USD:1,VND:25000}};
const rate={vndPerUsd:25000,updatedAt:now-3600000,nextUpdateAt:now+23*3600000};
test('provider rate must be successful USD base, finite positive VND and plausible timestamps',()=>{
  assert.deepEqual(parseRatePayload(payload,now),rate);
  for(const bad of [{...payload,result:'error'},{...payload,base_code:'VND'},{...payload,rates:{USD:1,VND:0}},{...payload,rates:{USD:1,VND:Infinity}},
    {...payload,time_last_update_unix:(now+3600000)/1000},{...payload,time_next_update_unix:1},
    {...payload,time_last_update_unix:(now-37*3600000)/1000}])assert.throws(()=>parseRatePayload(bad,now));
  assert.equal(isFreshRate({...rate,updatedAt:now-37*3600000},now),false);
});
test('conversion divides VND by USD rate, rounds total to cents, preserves original amount and language choice',()=>{
  const vi=presentMoney({amount:1250000,sourceCurrency:'VND',currency:'USD',language:'vi',rate,now});
  const en=presentMoney({amount:1250000,sourceCurrency:'VND',currency:'USD',language:'en',rate,now});
  assert.equal(vi.value,50);assert.equal(en.value,50);assert.equal(vi.converted,true);assert.match(en.formatted,/50\.00/);assert.notEqual(vi.formatted,en.formatted);
  assert.equal(presentMoney({amount:125,sourceCurrency:'VND',currency:'USD',language:'en',rate,now}).value,0.01);
  assert.equal(presentMoney({amount:0,sourceCurrency:'VND',currency:'USD',language:'en',rate,now}).value,0);
});
test('missing/stale rates never label VND as USD; malformed amounts cannot show a fabricated total',()=>{
  const input={amount:1250000,sourceCurrency:'VND',currency:'USD',language:'en',now};
  for(const fx of [null,{...rate,updatedAt:now-37*3600000}]){
    const result=presentMoney({...input,rate:fx});assert.equal(result.currency,'VND');assert.equal(result.value,1250000);assert.equal(result.fallback,true);assert.equal(result.converted,false);
  }
  for(const amount of [NaN,-1,Infinity,Number.MAX_SAFE_INTEGER+1])assert.equal(presentMoney({...input,rate,amount}),null);
  assert.equal(presentMoney({...input,currency:'VND',rate:null}).fallback,false);
});
test('inline fees retain original VND alongside an indicative USD amount',()=>{
  const fee=presentMoney({amount:200000,sourceCurrency:'VND',currency:'USD',language:'en',rate,now});
  const label=inlineMoney(fee);assert.ok(label.includes(fee.formatted));assert.ok(label.includes(fee.baseFormatted));
  const base=presentMoney({amount:200000,sourceCurrency:'VND',currency:'VND',language:'vi',rate:null,now});
  assert.equal(inlineMoney(base),base.formatted);assert.equal(inlineMoney(null),'—');
});
test('service restores daily cache, deduplicates requests and retains a still-fresh cache on network failure',async()=>{
  let time=now,calls=0;const writes=[];
  const storage={getItem:async()=>JSON.stringify(rate),setItem:async(_,v)=>{writes.push(v);}};
  const service=createRateService(storage,async()=>{calls++;return rate;},()=>time);
  assert.deepEqual(await service.getRate(),rate);assert.equal(calls,0);
  await Promise.all([service.getRate(true),service.getRate(true)]);assert.equal(calls,1);assert.equal(writes.length,1);
  time=now+24*3600000;
  const offline=createRateService(storage,async()=>{throw Error('offline');},()=>time);
  assert.deepEqual(await offline.getRate(),rate);
  time=now+40*3600000;await assert.rejects(()=>offline.getRate());
});
test('bad stored JSON and unavailable storage do not prevent a valid live rate',async()=>{
  const service=createRateService({getItem:async()=>'{',setItem:async()=>{throw Error('full');}},async()=>rate,()=>now);
  assert.deepEqual(await service.getRate(),rate);
});
test('HTTP errors and wrong response shapes fail without a hidden fixed rate',async()=>{
  await assert.rejects(()=>fetchUsdVnd(async()=>({ok:false,status:429,json:async()=>payload}),()=>now));
  await assert.rejects(()=>fetchUsdVnd(async()=>({ok:true,status:200,json:async()=>({rates:{}})}),()=>now));
  assert.deepEqual(await fetchUsdVnd(async()=>({ok:true,status:200,json:async()=>payload}),()=>now),rate);
});
