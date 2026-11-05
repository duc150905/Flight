import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadAircraftAndSeats} from '../src/features/admin/aircraft-data.ts';
import {buildStandardSeatTemplate} from '../src/features/admin/model.ts';

function fixtureClient({failAfterFirstPage=false}={}) {
  const target=buildStandardSeatTemplate({firstRows:1,businessRows:2,premiumEconomyRows:2,economyRows:10,exitRowNumber:10})
    .map((s,index)=>({...s,id:`target-${index}`,aircraft_id:'VN-A321'}));
  // Reproduce an API page containing only 29 of the aircraft's 84 seats.
  const other=Array.from({length:3660},(_,index)=>({id:`other-${index}`,aircraft_id:'another-aircraft',is_active:true}));
  const records={airlines:[{id:'VN'}],aircraft:[{id:'VN-A321'}],seats:[...other.slice(0,971),...target.slice(0,29),...other.slice(971),...target.slice(29)]};
  const requests=[];
  const client={from(table){
    const response=(from=0,to=999)=>{
      requests.push({table,from,to});
      if(table==='seats'&&from>0&&failAfterFirstPage)return {data:null,error:new Error('second page unavailable')};
      return {data:records[table].slice(from,Math.min(to+1,from+1000)),error:null};
    };
    const builder={select(){return this;},order(){return this;},
      range(from,to){return Promise.resolve(response(from,to));},
      then(resolve,reject){return Promise.resolve(response()).then(resolve,reject);},
    };return builder;
  }};
  return {client,requests};
}

test('admin aircraft loader returns all 84 VN-A321 seats rather than the first-page count of 29',async()=>{
  const {client,requests}=fixtureClient();
  const result=await loadAircraftAndSeats(client);
  assert.equal(result.seats.filter(s=>s.aircraft_id==='VN-A321').length,84);
  assert.equal(result.seats.length,3744);
  assert.equal(new Set(result.seats.map(s=>s.id)).size,3744);
  assert(requests.some(r=>r.table==='seats'&&r.from>=1000));
});

test('a later seat page failure is reported instead of displaying a partial aircraft layout',async()=>{
  const {client}=fixtureClient({failAfterFirstPage:true});
  await assert.rejects(()=>loadAircraftAndSeats(client),/second page unavailable/);
});
