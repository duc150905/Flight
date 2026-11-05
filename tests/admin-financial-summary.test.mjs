import assert from 'node:assert/strict';
import { test } from 'node:test';
const module = await import('../src/features/admin/financial-summary.ts').catch(() => ({}));
const nowMs = Date.parse('2026-11-05T12:00:00Z');
const at = '2026-11-04T12:00:00Z';
const old = '2026-09-01T12:00:00Z';
function summarize(input) {
  assert.equal(typeof module.summarizeAdminBookingsAndRevenue, 'function', 'event-based financial summary exists');
  return module.summarizeAdminBookingsAndRevenue({ nowMs, daysWindow: 7, bookings: [], ...input });
}
test('cancelled paid order retains 350000 after completed refund', () => {
  const result = summarize({bookings:[{id:'b',status:'cancelled',total_amount:1553000,created_at:at,confirmed_at:at}],
    payments:[{id:'p',status:'succeeded',amount:1553000,created_at:at,paid_at:at}],
    refunds:[{id:'r',status:'succeeded',amount:1203000,created_at:at,completed_at:at}]});
  assert.equal(result.confirmedGrossAmount,0);
  assert.equal(result.successfulReceiptAmount,1553000);
  assert.equal(result.completedRefundAmount,1203000);
  assert.equal(result.netCashAmount,350000);
});
test('payment paid_at and refund completed_at select events independently from order creation', () => {
 const result = summarize({payments:[{id:'p',status:'succeeded',amount:500,created_at:old,paid_at:at}],
 refunds:[{id:'r',status:'succeeded',amount:700,created_at:old,completed_at:at},{id:'pending',status:'pending',amount:999,created_at:at,completed_at:null},{id:'review',status:'review',amount:999,created_at:at,completed_at:at}]});
 assert.equal(result.netCashAmount,-200);
 assert.equal(result.succeededPaymentsCount,1);
});
test('inclusive exact boundaries exclude future, invalid and missing event dates', () => {
 const cutoff = new Date(nowMs-7*86400000).toISOString();
 const payments = [cutoff,new Date(nowMs).toISOString(),new Date(nowMs+1).toISOString(),'bad',null].map((paid_at,i)=>({id:String(i),status:'succeeded',amount:100,created_at:at,paid_at}));
 assert.equal(summarize({payments}).successfulReceiptAmount,200);
});
test('distinct captures remain ledger receipts while repeated row ids do not double count', () => {
 const payment={id:'p',status:'succeeded',amount:100,created_at:at,paid_at:at};
 const result=summarize({bookings:[{id:'b',status:'confirmed',total_amount:100,created_at:at,confirmed_at:at}],payments:[payment,payment,{...payment,id:'p2'}]});
 assert.equal(result.confirmedGrossAmount,100);assert.equal(result.successfulReceiptAmount,200);
});
test('gateway duplicate capture counts as cash despite non-succeeded public status and later completion refunds it', () => {
 const result=summarize({payments:[{id:'first',status:'succeeded',amount:100,created_at:old,paid_at:old,captured:true,captured_at:old},{id:'duplicate',status:'cancelled',amount:100,created_at:old,paid_at:null,captured:true,captured_at:at}],refunds:[{id:'compensation',status:'succeeded',amount:100,created_at:old,completed_at:at}]});
 assert.equal(result.successfulReceiptAmount,100);assert.equal(result.netCashAmount,0);
});
test('authoritative capture flag prevents pending VNPAY from using succeeded fallback', () => {
 assert.equal(summarize({payments:[{id:'p',status:'succeeded',amount:100,created_at:at,paid_at:at,captured:false,captured_at:null}]}).successfulReceiptAmount,0);
});
test('VNPAY public success without an authoritative capture must not use legacy mock fallback', () => {
 assert.equal(summarize({payments:[{id:'vnpay',provider:'vnpay_sandbox',status:'succeeded',amount:100,created_at:at,paid_at:at}]}).successfulReceiptAmount,0);
});
