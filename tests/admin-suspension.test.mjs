import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changeAccountSuspension } from '../supabase/functions/_shared/account-suspension.ts';
test('suspension blocks account before Auth and only confirms after Auth succeeds',async()=>{
 const calls=[];await changeAccountSuspension({prepare:async()=>{calls.push('deny');return'op'},updateAuth:async()=>{calls.push('auth')},finish:async()=>{calls.push('confirm')}},'id',true);assert.deepEqual(calls,['deny','auth','confirm']);
});
test('Auth errors leave the account blocked and never confirm activation',async()=>{
 let confirmed=false;await assert.rejects(changeAccountSuspension({prepare:async()=> 'op',updateAuth:async()=>{throw Error('ban failed')},finish:async()=>{confirmed=true}},'id',false),/ban failed/);assert.equal(confirmed,false);
});
