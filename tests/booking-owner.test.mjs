import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOwnerRpcClient } from '../src/features/booking/owner-rpc.ts';
test('a delayed RPC retains the submitting token after the app account changes',async()=>{
 let token='owner-a-token'; const headers=[];
 const client=createOwnerRpcClient({url:'https://example.supabase.co',key:'sb_publishable_test',accessToken:token,
 fetcher:async(_url,init)=>{headers.push(new Headers(init.headers).get('Authorization'));return new Response('null',{status:200,headers:{'Content-Type':'application/json'}});}});
 token='owner-b-token';
 await client.rpc('find_booking_request',{p_request_id:'11111111-1111-4111-8111-111111111111'});
 assert.equal(token,'owner-b-token'); assert.deepEqual(headers,['Bearer owner-a-token']);
});
