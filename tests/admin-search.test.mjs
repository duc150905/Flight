import assert from 'node:assert/strict';
import {test} from 'node:test';
import {filterAndPaginate} from '../src/features/admin/model.ts';

test('admin search folds Vietnamese accents, case and whitespace across independent fields',()=>{
 const records=[{name:'Nguyễn Đặng An',pnr:'FYAB123',active:true},{name:'Trần Minh Bảo',pnr:'FYOTHER',active:false}];
 for(const query of ['nguyen dang an','NGUYỄN ĐẶNG AN','  Nguyễn   Đặng  An  ','FYAB123 nguyen','đặng FYAB123']){
  const result=filterAndPaginate(records,{query,getSearchText:r=>`${r.name} ${r.pnr}`,getIsActive:r=>r.active});
  assert.deepEqual(result.items,[records[0]],query);
 }
 assert.equal(filterAndPaginate(records,{query:'nguyen FYOTHER',getSearchText:r=>`${r.name} ${r.pnr}`}).total,0);
 assert.equal(filterAndPaginate(records,{query:'  ',statusFilter:'inactive',getSearchText:r=>r.name,getIsActive:r=>r.active}).items[0],records[1]);
});

test('global admin search recognizes every two-character IATA carrier and keeps other terms on bookings',async()=>{
 const {adminQuickSearchRoute}=await import('../src/features/admin/admin-search.ts');
 for(const number of ['KE7030','TG7001','MH10','CX711','VU304','F0103','VN118']){
  assert.equal(adminQuickSearchRoute(number),`/admin/flights?q=${number}`);
 }
 assert.equal(adminQuickSearchRoute('  vn 118 '),'/admin/flights?q=VN118');
 assert.equal(adminQuickSearchRoute(''),'\/admin/bookings');
 assert.equal(adminQuickSearchRoute('Nguyễn An'),'/admin/bookings?q=Nguy%E1%BB%85n%20An');
});
