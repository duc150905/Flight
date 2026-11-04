import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as seats from '../src/features/booking/seats.ts';
import { createCheckoutDraftStore } from '../src/features/booking/draft.ts';
const f='11111111-1111-4111-8111-111111111111', g='22222222-2222-4222-8222-222222222222';
const seat={flight_seat_id:g,seat_code:'2A',row_number:2,column_number:1,cabin_class:'economy',position:'window',is_exit_row:false,selection_fee_amount:50000,currency:'VND',availability:'available'};
const people=[{id:'adult-1',values:{dateOfBirth:'1990-01-01'}},{id:'infant-1',values:{dateOfBirth:'2024-11-18',accompanyingAdultId:'adult-1'}}];
const leg={flightId:f,fareId:g,departureDate:'2026-11-16',cabinClass:'economy'};
test('infant can select a seat only after becoming a child on that flight date',()=>{
 assert.equal(seats.seatEligibility(seat,people[1],leg,people,[]),'seats.infant');
 assert.equal(seats.seatEligibility(seat,people[1],{...leg,departureDate:'2026-11-20'},people,[]),null);
 assert.equal(seats.seatEligibility({...seat,is_exit_row:true},people[0],leg,people,[]),'seats.exit');
 assert.equal(seats.seatEligibility({...seat,is_exit_row:true},people[0],{...leg,departureDate:'2026-11-20'},people,[]),null);
});
test('blocked, held, booked, wrong-cabin, duplicate and under-18 exit seats are refused',()=>{
 for(const availability of ['blocked','held','booked']) assert.equal(seats.seatEligibility({...seat,availability},people[0],leg,people,[]),'seats.unavailable');
 assert.equal(seats.seatEligibility({...seat,cabin_class:'business'},people[0],leg,people,[]),'seats.unavailable');
 assert.equal(seats.seatEligibility(seat,people[0],leg,people,[{passengerId:'infant-1',flightId:f,seatId:g}]),'seats.duplicate');
 assert.equal(seats.seatEligibility({...seat,is_exit_row:true},{id:'adult-1',values:{dateOfBirth:'2009-01-01'}},leg,people,[]),'seats.exit');
});
test('map keeps actual positions, rejects duplicate cells/IDs and unsupported geometry',()=>{
 assert.equal(seats.seatRows(seats.parseSeatMap([seat])).find(row=>row.row===2).seats[0].seat_code,'2A');
 for(const map of [[seat,seat],[{...seat,column_number:7}],[{...seat,selection_fee_amount:-1}]]) assert.throws(()=>seats.parseSeatMap(map));
});

test('seat rows preserve real row numbers without inventing empty leading or missing rows',()=>{
 const map=[{...seat,row_number:8,column_number:6,seat_code:'8F'},
  {...seat,flight_seat_id:f,row_number:6,seat_code:'6A'}];
 const rows=seats.seatRows(map);
 assert.deepEqual(rows.map(row=>row.row),[6,8]);
 assert.equal(rows[0].seats[0].seat_code,'6A');
 assert.equal(rows[0].seats[5],null);
 assert.equal(rows[1].seats[5].seat_code,'8F');
 assert.deepEqual(seats.seatRows([]),[]);
});

test('front-cabin rows stay in the full map while an economy traveller cannot select them',()=>{
 const front={...seat,flight_seat_id:f,row_number:1,seat_code:'1A',cabin_class:'business'};
 const economy={...seat,row_number:6,seat_code:'6A'};
 const rows=seats.seatRows([economy,front]);
 assert.deepEqual(rows.map(row=>row.row),[1,6]);
 assert.equal(rows[0].seats[0].seat_code,'1A');
 assert.equal(seats.seatEligibility(front,people[0],leg,people,[]),'seats.unavailable');
 assert.equal(seats.seatEligibility(economy,people[0],leg,people,[]),null);
});
test('seat choices cannot overwrite another traveller and clear/reprice correctly',()=>{
 const store=createCheckoutDraftStore();store.getState().beginCheckout({selection:{tripType:'one_way',passengers:{adults:2,children:0,infants:0},segments:[{flightId:f,fareId:g,journeyIndex:1,legIndex:1}]},legs:[leg],international:false});
 store.getState().updatePassenger('adult-1',{dateOfBirth:'1990-01-01'});store.getState().updatePassenger('adult-2',{dateOfBirth:'1991-01-01'});
 store.getState().setSeat('adult-1',f,seat);assert.throws(()=>store.getState().setSeat('adult-2',f,seat));
 assert.equal(store.getState().seats[0].seatCode,'2A');store.getState().setSeat('adult-1',f,null);assert.equal(store.getState().seats.length,0);
});
test('skipping paid seats needs no supported map; selected flights are refreshed once',async()=>{
 let calls=0;const loader=async()=>{calls++;throw new Error('seats.unsupported');};
 const store=createCheckoutDraftStore();
 await seats.validateSelectedSeats(store.getState(),loader);assert.equal(calls,0);
 store.setState({seats:[{passengerId:'adult-1',flightId:f,seatId:g,amount:50000,currency:'VND'}]});
 await assert.rejects(seats.validateSelectedSeats(store.getState(),loader),/unsupported/);assert.equal(calls,1);
});
