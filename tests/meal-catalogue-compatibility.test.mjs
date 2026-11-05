import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadBaggage} from '../src/features/booking/extras-data.ts';

test('a general meal catalogue never invents flight offers or complimentary inclusion',async()=>{
 const data={
  flight_fares:[{id:'fare-a',flight_id:'flight-a',baggage_allowance:{cabin_pieces:1,cabin_kg:7,checked_pieces:0,checked_kg:0}}],
  flight_addon_offers:[],
  addon_products:[{id:'meal-1',category:'meal',name:'Vegetarian meal',description:'Menu item',weight_kg:null}],
 };
 const client={from(table){const q={select(){return q;},in(){return q;},eq(){return q;},then(resolve){return Promise.resolve({data:data[table],error:null}).then(resolve);}};return q;}};
 const result=await loadBaggage(client,{legs:[{fareId:'fare-a',flightId:'flight-a'}]});
 assert.deepEqual(result.meals,[]);
 assert.deepEqual(result.offers,[]);
 assert.equal(result.allowances['flight-a'].cabinKg,7);
});
