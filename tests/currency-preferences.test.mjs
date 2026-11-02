import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCurrencyStore } from '../src/features/currency/preferences.ts';
import { createLanguageStore } from '../src/features/i18n/language.ts';
import { createCheckoutDraftStore } from '../src/features/booking/draft.ts';
test('currency defaults to VND and stored USD restores independently of language and checkout', async () => {
  const writes=[]; const store=createCurrencyStore({getItem:async()=> 'USD',setItem:async(_,value)=>{writes.push(value);}});
  assert.equal(store.getState().currency,'VND'); await store.getState().hydrate();
  assert.equal(store.getState().currency,'USD');
  const language=createLanguageStore({getItem:async()=>null,setItem:async()=>{}},['vi']);
  const draft=createCheckoutDraftStore(); draft.getState().updateContact({contactName:'Still here'});
  await language.getState().setLanguage('en'); assert.equal(store.getState().currency,'USD');
  await store.getState().setCurrency('VND'); assert.equal(language.getState().language,'en');
  assert.equal(draft.getState().contact.contactName,'Still here');assert.deepEqual(writes,['VND']);
});
test('late restoration cannot overwrite manual currency and rapid writes finish in order',async()=>{
  let resolve;const writes=[];
  const store=createCurrencyStore({getItem:()=>new Promise(r=>{resolve=r}),setItem:async(_,v)=>{writes.push(v);}});
  const pending=store.getState().hydrate();const first=store.getState().setCurrency('USD');const last=store.getState().setCurrency('VND');resolve('USD');
  await Promise.all([pending,first,last]);assert.equal(store.getState().currency,'VND');assert.deepEqual(writes,['USD','VND']);
});
test('invalid preferences and storage failures leave currency choice usable',async()=>{
  const store=createCurrencyStore({getItem:async()=>{throw Error('offline');},setItem:async()=>{throw Error('full');}});
  await store.getState().hydrate();await store.getState().setCurrency('USD');
  assert.equal(store.getState().currency,'USD');assert.equal(store.getState().ready,true);assert.equal(store.getState().storageError,true);
  const invalid=createCurrencyStore({getItem:async()=> 'EUR',setItem:async()=>{}});await invalid.getState().hydrate();assert.equal(invalid.getState().currency,'VND');
});
