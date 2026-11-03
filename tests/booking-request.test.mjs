import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBookingRequestJournal } from '../src/features/booking/request-journal.ts';
const storage=()=>{const values=new Map();return {values,getItem:async k=>values.get(k)??null,setItem:async(k,v)=>{values.set(k,v);}};};
const receipt={id:'saved-booking'};
test('duplicate submits serialize, uncertain reply recovers without another create',async()=>{
 const s=storage();let creates=0;let saved=null;let next=0;
 const j=createBookingRequestJournal(s,()=>`request-${++next}`);
 const api={find:async()=>saved,create:async()=>{creates++;saved=receipt;throw new Error('network timeout');}};
 await assert.rejects(j.submit('user','digest',{},api),/timeout/);
 const recovered=await j.submit('user','digest',{},api);assert.equal(recovered,receipt);assert.equal(creates,1);
 assert.equal([...s.values.values()].join('').includes('PRIVATE'),false);
});
test('reload checks old request before changed payload; missing result closes old UUID',async()=>{
 const s=storage();let seq=0;const calls=[];
 const first=createBookingRequestJournal(s,()=>`r${++seq}`);
 await assert.rejects(first.submit('a','old',{}, {find:async()=>null,create:async id=>{calls.push(id);throw new Error('offline');}}));
 const second=createBookingRequestJournal(s,()=>`r${++seq}`);
 const api={find:async id=>{calls.push(`resolve:${id}`);return null;},create:async id=>{calls.push(id);return receipt;}};
 assert.equal(await second.submit('a','new',{},api),receipt);
 assert.deepEqual(calls,['r1','resolve:r1','r2']);
});
test('storage errors prevent RPC, accounts use separate journals, no payload stored',async()=>{
 let called=false;
 const j=createBookingRequestJournal({getItem:async()=>null,setItem:async()=>{throw new Error('disk');}},()=> 'r');
 await assert.rejects(j.submit('a','hash',{private:'PRIVATE'},{create:async()=>{called=true;},find:async()=>null}));assert.equal(called,false);
 const s=storage(); const journal=createBookingRequestJournal(s,()=> 'r');
 for(const user of ['a','b']) await journal.submit(user,'hash',{private:'PRIVATE'},{create:async()=>receipt,find:async()=>null});
 assert.equal(s.values.size,2); assert.equal([...s.values.values()].join('').includes('PRIVATE'),false);
});
test('two concurrent presses do not create two bookings',async()=>{
 const s=storage();let count=0;const j=createBookingRequestJournal(s,()=> 'one');let saved=null;
 const api={find:async()=>saved,create:async()=>{count++; saved=receipt;return receipt;}};
 const [a,b]=await Promise.all([j.submit('a','x',{},api),j.submit('a','x',{},api)]);
 assert.equal(count,1);assert.deepEqual(a,b);
});
test('failed recovery blocks all further creates, including changed inputs',async()=>{
 const s=storage();let creates=0;const j=createBookingRequestJournal(s,()=> 'one');
 await assert.rejects(j.submit('a','first',{}, {find:async()=>null,create:async()=>{creates++;throw Error('timeout');}}));
 await assert.rejects(j.submit('a','changed',{}, {find:async()=>{throw Error('offline');},create:async()=>{creates++;return receipt;}}));
 assert.equal(creates,1);
});
