import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as quote from '../src/features/booking/quote.ts';
const id='11111111-1111-4111-8111-111111111111';
const draft={itinerary:{selection:{tripType:'one_way',passengers:{adults:1,children:0,infants:0},segments:[{flightId:id,fareId:id,journeyIndex:1,legIndex:1}]}},
 passengers:[{id:'adult-1',values:{dateOfBirth:'1990-01-01',givenNames:'PRIVATE',passportNumber:'DO-NOT-SEND'}}],contact:{contactEmail:'private@example.com'},baggage:[],seats:[]};
test('quote payload strips contact, names, documents and all client prices',()=>{
 const request=quote.quoteRequest(draft);assert.equal(request.passengers[0].dateOfBirth,'1990-01-01');
 assert.equal(JSON.stringify(request).includes('PRIVATE'),false);assert.equal(JSON.stringify(request).includes('private@'),false);
 const changed=quote.quoteRequest({...draft,baggage:[{passengerId:'adult-1',flightId:id,offerId:id,amount:1}]});
 assert.deepEqual(changed.baggage,[{passengerId:'adult-1',flightId:id,offerId:id}]);
 assert.notEqual(quote.requestKey(request),quote.requestKey(changed));
});
const now=Date.parse('2026-11-02T00:00:00Z');
const result={currency:'VND',base:1000000,tax:180000,fee:70000,baggage:250000,seat:50000,total:1550000,quotedAt:new Date(now).toISOString(),expiresAt:new Date(now+300000).toISOString(),
 lines:[{passengerId:'adult-1',flightId:id,passengerType:'adult',requiresSeat:true,base:1000000,tax:180000,fee:70000,baggage:250000,seat:50000,baggageName:'Demo',seatCode:'2A'}]};
test('quote parser verifies sum, safe integers, line totals and short expiry',()=>{
 assert.equal(quote.parseQuote(result,now).total,1550000);
 for(const bad of [{...result,total:1},{...result,total:Number.MAX_SAFE_INTEGER+1},{...result,lines:[]},{...result,expiresAt:new Date(now-1).toISOString()},
 {...result,lines:[{...result.lines[0],seat:-1}]},{...result,currency:'USD'}]) assert.throws(()=>quote.parseQuote(bad,now));
});
