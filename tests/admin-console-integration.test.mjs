import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as data from '../src/features/admin/complete-data.ts';
import { adminChartSeries } from '../src/features/admin/chart-series.ts';
test('admin data reads beyond PostgREST cap and fails instead of reporting partial results',async()=>{
 const rows=Array.from({length:1251},(_,id)=>({id:String(id)}));const calls=[];
 const result=await data.loadAllRows(async(from,to)=>{calls.push([from,to]);return {data:rows.slice(from,to+1),error:null};});
 assert.equal(result.data.length,1251);assert.equal(calls.length,3);
 await assert.rejects(data.loadAllRows(async(from,to)=>from?{data:null,error:new Error('offline')}:{data:rows.slice(from,to+1),error:null}),/offline/);
 const audit=await data.loadAllRows(async(from,to)=>({data:rows.slice(from,to+1),error:null}),200);assert.equal(audit.data.length,1251);
});

test('audit RPC failure is exposed rather than presented as an empty immutable history',async()=>{
 const client={rpc:async()=>({data:null,error:{message:'audit unavailable'}})};
 await assert.rejects(()=>data.loadAllAuditLogs(client),/audit unavailable/);
});
test('overview chart uses real dates and confirmed amounts, including a zero-data baseline',()=>{
 const now=Date.parse('2026-11-02T08:00:00Z');assert.ok(adminChartSeries([],now,7).every(p=>p.bookingPct===0&&p.revPct===0));
 const points=adminChartSeries([{created_at:'2026-11-01T18:00:00Z',status:'confirmed',total_amount:1200000},
 {created_at:'2026-11-02T03:00:00Z',status:'pending_payment',total_amount:300000},
 {created_at:'2026-10-01T00:00:00Z',status:'confirmed',total_amount:999999},
 {created_at:'2026-11-03T00:00:00Z',status:'confirmed',total_amount:999999}],now,7);
 assert.equal(points.at(-1).bookings,2);assert.equal(points.at(-1).revenue,1200000);assert.equal(points.slice(0,-1).reduce((s,p)=>s+p.bookings,0),0);
});
