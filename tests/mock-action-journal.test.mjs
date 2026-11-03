import assert from 'node:assert/strict';import {test} from 'node:test';
import {createMockActionJournal} from '../src/features/booking/mock-action-journal.ts';
test('lost reply replays same action UUID before accepting a changed outcome',async()=>{
 const map=new Map();const storage={getItem:async k=>map.get(k)??null,setItem:async(k,v)=>map.set(k,v)};let next=0;const calls=[];
 const journal=createMockActionJournal(storage,()=>String(++next));const action={kind:'resolve',target:'payment',outcome:'succeeded'};
 await assert.rejects(journal.run('a','booking','one',action,async(a,id)=>{calls.push([a,id]);throw Error('offline');}));
 const afterReload=createMockActionJournal(storage,()=>String(++next));
 const result=await afterReload.run('a','booking','two',{...action,outcome:'failed'},async(a,id)=>{calls.push([a,id]);return 'confirmed';});
 assert.equal(result.recovered,true);assert.equal(result.value,'confirmed');assert.deepEqual(calls[0],calls[1]);
 assert.equal(next,1);
});
test('failure to persist prevents any mutation and users are isolated',async()=>{
 let sent=false;const j=createMockActionJournal({getItem:async()=>null,setItem:async()=>{throw Error('disk');}},()=> 'uuid');
 await assert.rejects(j.run('a','b','s',{kind:'start'},async()=>{sent=true;}));assert.equal(sent,false);
});
test('known server rejection permits reviewing a changed cancellation fee',async()=>{
 const map=new Map();const j=createMockActionJournal({getItem:async k=>map.get(k)??null,setItem:async(k,v)=>map.set(k,v)},()=>String(map.size+Math.random()));
 await assert.rejects(j.run('a','b','fee0',{kind:'cancel',expectedFee:0},async()=>{throw Error('mock.priceChanged');}));
 const result=await j.run('a','b','fee200',{kind:'cancel',expectedFee:200},async action=>action.expectedFee);
 assert.equal(result.recovered,false);assert.equal(result.value,200);
});
test('recovery without a saved action never starts a payment',async()=>{
 let called=false;const j=createMockActionJournal({getItem:async()=>null,setItem:async()=>{}},()=> 'id');
 assert.equal(await j.recover('a','b',async()=>{called=true;}),null);assert.equal(called,false);
});
