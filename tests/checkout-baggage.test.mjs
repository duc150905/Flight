import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCheckoutDraftStore } from '../src/features/booking/draft.ts';
import * as baggage from '../src/features/booking/baggage.ts';
const flightId='11111111-1111-4111-8111-111111111111', fareId='22222222-2222-4222-8222-222222222222';
const itinerary={selection:{tripType:'one_way',passengers:{adults:2,children:0,infants:0},segments:[{flightId,fareId,journeyIndex:1,legIndex:1}]},legs:[{flightId}],international:false};
const offer={id:fareId,flightId,name:'Demo 15 kg',weightKg:15,amount:250000,currency:'VND'};
test('baggage choices are per traveller/leg, replace rather than stack, and clear with checkout',()=>{
 const store=createCheckoutDraftStore();store.getState().beginCheckout(itinerary);
 store.getState().setBaggage('adult-1',flightId,offer);store.getState().setBaggage('adult-2',flightId,offer);
 store.getState().setBaggage('adult-1',flightId,{...offer,id:flightId});assert.equal(store.getState().baggage.length,2);
 assert.equal(store.getState().baggage.find(b=>b.passengerId==='adult-1').offerId,flightId);
 store.getState().setBaggage('adult-1',flightId,null);assert.equal(store.getState().baggage.length,1);
 assert.throws(()=>store.getState().setBaggage('unknown',flightId,offer));
 store.getState().reset();assert.deepEqual(store.getState().baggage,[]);assert.deepEqual(store.getState().seats,[]);
});
test('names and same itinerary preserve extras; birthday/companion changes invalidate dependent seats',()=>{
 const store=createCheckoutDraftStore();store.getState().beginCheckout(itinerary);store.getState().setBaggage('adult-1',flightId,offer);
 store.setState({seats:[{passengerId:'adult-1',flightId,seatId:fareId,seatCode:'1A',amount:50000,currency:'VND'}]});
 store.getState().updatePassenger('adult-1',{givenNames:'Demo'});assert.equal(store.getState().seats.length,1);
 store.getState().beginCheckout(itinerary);assert.equal(store.getState().baggage.length,1);
 store.getState().updatePassenger('adult-1',{dateOfBirth:'1990-01-01'});assert.equal(store.getState().seats.length,0);assert.equal(store.getState().baggage.length,1);
 store.getState().beginCheckout({...itinerary,selection:{...itinerary.selection,passengers:{adults:1,children:0,infants:0}}});assert.deepEqual(store.getState().baggage,[]);
});
test('stale baggage price, withdrawn offer and wrong flight cannot be treated as current',()=>{
 const choice={passengerId:'adult-1',flightId,offerId:offer.id,amount:offer.amount,currency:'VND'};
 assert.equal(baggage.isBaggageCurrent(choice,[offer]),true);
 for(const offers of [[],[{...offer,amount:400000}],[{...offer,flightId:fareId}]]) assert.equal(baggage.isBaggageCurrent(choice,offers),false);
 assert.equal(baggage.parseAllowance({cabin_pieces:1,cabin_kg:7,checked_pieces:0,checked_kg:0}).cabinKg,7);
 assert.equal(baggage.parseAllowance({cabin_kg:-1}),null);
});
