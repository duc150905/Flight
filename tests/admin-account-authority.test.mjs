import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadAdminAccounts, setAdminAccountRole, setAdminAccountSuspended } from '../src/features/admin/account-service.ts';
import { createAdminQueryClient, disposeAdminQueryClient } from '../src/features/admin/query-cache.ts';

test('directory uses real server emails and roles, pages deterministically', async () => {
 const calls=[]; const client={rpc:async(name,args)=>{calls.push([name,args]);return {data:args.p_offset===0?Array.from({length:200},(_,i)=>({id:`u${i}`,email:`real${i}@example.com`,full_name:'Name',phone:'12',role:i?'customer':'admin',suspended:false,created_at:'2026-01-01'})):[],error:null};}};
 const rows=await loadAdminAccounts(client);
 assert.equal(rows.length,200);assert.equal(rows[0].email,'real0@example.com');assert.equal(rows[0].role,'admin');assert.equal(rows[0].fullName,'Name');assert.deepEqual(calls.map(x=>x[1].p_offset),[0,200]);
});
test('directory rejects incomplete reads and aborted owner reads', async()=>{
 await assert.rejects(loadAdminAccounts({rpc:async()=>({data:null,error:{message:'denied'}})}),/denied/);
 const c=new AbortController();c.abort();let called=false;
 await assert.rejects(loadAdminAccounts({rpc:async()=>{called=true;}},c.signal),/abort/i);assert.equal(called,false);
});
test('grant and revoke use audited server RPC; suspension uses guarded function',async()=>{
 const calls=[];const c={rpc:async(...a)=>{calls.push(a);return{error:null,data:null}},functions:{invoke:async(...a)=>{calls.push(a);return{error:null,data:{ok:true}}}}};
 await setAdminAccountRole(c,'id','admin');await setAdminAccountRole(c,'id','customer');await setAdminAccountSuspended(c,'id',true);
 assert.deepEqual(calls,[['admin_set_account_role',{p_user_id:'id',p_role:'admin'}],['admin_set_account_role',{p_user_id:'id',p_role:'customer'}],['admin-account-suspension',{body:{userId:'id',suspended:true}}]]);
});
test('server failure never reports mutation success',async()=>{
 await assert.rejects(setAdminAccountSuspended({functions:{invoke:async()=>({data:{error:'Auth ban failed'},error:null})}},'id',true),/Auth ban failed/);
});
test('owner caches are isolated and old pending reads are cancelled',async()=>{
 const a=createAdminQueryClient(),b=createAdminQueryClient();a.setQueryData(['admin'],{secret:'owner-a'});assert.equal(b.getQueryData(['admin']),undefined);
 let finish;const pending=a.fetchQuery({queryKey:['pending'],queryFn:()=>new Promise(r=>{finish=r})});
 await disposeAdminQueryClient(a);finish('stale');await pending.catch(()=>{});assert.equal(a.getQueryData(['pending']),undefined);assert.equal(a.getQueryData(['admin']),undefined);
});

test('late directory page from an old owner is discarded after abort', async()=>{
 const controller=new AbortController();let resolve;
 const request=loadAdminAccounts({rpc:()=>new Promise(r=>{resolve=r})},controller.signal);
 controller.abort();resolve({data:[{id:'old-owner-secret',role:'admin'}],error:null});
 await assert.rejects(request,/abort/i);
});
