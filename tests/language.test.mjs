import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLanguageStore, languageFromDevice } from '../src/features/i18n/language.ts';
import { createCheckoutDraftStore } from '../src/features/booking/draft.ts';

test('device language supports vi/en with Vietnamese fallback', () => {
  assert.equal(languageFromDevice(['en-US']), 'en');
  assert.equal(languageFromDevice(['vi-VN']), 'vi');
  assert.equal(languageFromDevice(['fr-FR']), 'vi');
});
test('restores saved language and persists later changes without touching checkout', async () => {
  const writes = []; const storage = { getItem: async () => 'en', setItem: async (key, value) => { writes.push(value); } };
  const store = createLanguageStore(storage, ['vi']);
  await store.getState().hydrate(); assert.equal(store.getState().language, 'en');
  const draft = createCheckoutDraftStore(); draft.getState().updateContact({ contactName: 'Still here' });
  await store.getState().setLanguage('vi');
  assert.deepEqual(writes, ['vi']); assert.equal(draft.getState().contact.contactName, 'Still here');
});
test('slow restoration cannot overwrite a newer manual choice; rapid writes retain the last choice', async () => {
  let restore; const writes = [];
  const storage = { getItem: () => new Promise(resolve => { restore = resolve; }), setItem: async (key, value) => { writes.push(value); } };
  const store = createLanguageStore(storage, ['en']); const pending = store.getState().hydrate();
  const first = store.getState().setLanguage('vi'); const last = store.getState().setLanguage('en');
  restore('vi'); await Promise.all([pending, first, last]);
  assert.equal(store.getState().language, 'en'); assert.deepEqual(writes, ['vi', 'en']);
});
test('unavailable storage or invalid saved values do not prevent choosing a language', async () => {
  const store = createLanguageStore({ getItem: async () => { throw new Error('unavailable'); }, setItem: async () => { throw new Error('full'); } }, ['en']);
  await store.getState().hydrate(); await store.getState().setLanguage('vi');
  assert.equal(store.getState().language, 'vi'); assert.equal(store.getState().ready, true); assert.equal(store.getState().storageError, true);
  const invalid = createLanguageStore({ getItem: async () => 'unknown', setItem: async () => {} }, ['en']);
  await invalid.getState().hydrate(); assert.equal(invalid.getState().language, 'en');
});
