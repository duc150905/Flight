import assert from 'node:assert/strict';
import { test } from 'node:test';
const module = await import('../src/features/admin/reconciliation-data.ts').catch(() => ({}));
test('reconciliation forwards exact paging, query and status filters to server', async () => {
 assert.equal(typeof module.loadAdminVnpayReviewPage,'function');
 const calls=[];const client={rpc:async(name,args)=>{calls.push({name,args});return {data:{items:[{booking_id:'b',payment_id:'p',refund_id:'r',refund_state:'review',completed_at:null,provider_reference:'gateway'}],total:121,page:7,page_size:20},error:null};}};
 const result=await module.loadAdminVnpayReviewPage(client,{page:7,pageSize:20,query:'PNR121',state:'review'});
 assert.equal(result.total,121);assert.equal(result.items[0].payment_id,'p');
 assert.deepEqual(calls,[{name:'admin_vnpay_review_page',args:{p_query:'PNR121',p_state:'review',p_limit:20,p_offset:120}}]);
});
test('reconciliation exposes server errors and rejects malformed page envelopes', async () => {
 assert.equal(typeof module.loadAdminVnpayReviewPage,'function');
 await assert.rejects(module.loadAdminVnpayReviewPage({rpc:async()=>({data:null,error:new Error('forbidden')})},{}),/forbidden/);
 await assert.rejects(module.loadAdminVnpayReviewPage({rpc:async()=>({data:[],error:null})},{}),/response/i);
});
test('payment ledger pages beyond API cap and exposes capture dates independently',async()=>{
 assert.equal(typeof module.loadAdminPaymentLedger,'function');
 let calls=0;const rows=Array.from({length:1001},(_,i)=>({id:String(i),captured:true,captured_at:'2026-11-05T00:00:00Z'}));
 const result=await module.loadAdminPaymentLedger({rpc:async(name,args)=>{assert.equal(name,'admin_payment_ledger_page');calls++;return {data:{items:rows.slice(args.p_offset,args.p_offset+args.p_limit),total:rows.length},error:null};}});
 assert.equal(result.length,1001);assert.equal(calls,3);assert.equal(result[1000].captured,true);
});
