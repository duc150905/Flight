import assert from 'node:assert/strict';
import {test} from 'node:test';
const module=await import('../src/features/admin/customer-search.ts').catch(()=>({}));
test('customer search includes authoritative account email, PNR and contact phone',()=>{
 assert.equal(typeof module.customerSearchText,'function');
 const text=module.customerSearchText({id:'owner',fullName:'Nguyen Dang An',email:'login@verified.test',phone:'0901'},[{booking_code:'PNR001',contact_email:'booking@test',contact_phone:'098765'}]);
 for(const value of ['login@verified.test','PNR001','098765','owner'])assert.ok(text.includes(value));
});
test('passenger search includes promised identity, booking and contact fields',()=>{
 assert.equal(typeof module.passengerSearchText,'function');
 const text=module.passengerSearchText({family_name:'Nguyen',given_names:'An',document_number:'P123',nationality_code:'VN'},{booking_code:'PNR',contact_phone:'099999',contact_email:'contact@test'});
 for(const value of ['Nguyen','An','P123','VN','099999','PNR','contact@test'])assert.ok(text.includes(value));
});
test('owner history selector returns every order and never includes other owner',()=>{
 assert.equal(typeof module.selectOwnerBookings,'function');
 const rows=Array.from({length:1201},(_,i)=>({id:String(i),user_id:i%2?'other':'owner'}));
 assert.equal(module.selectOwnerBookings(rows,'owner').length,601);
 assert.equal(module.selectOwnerBookings(rows,undefined).length,1201);
});
