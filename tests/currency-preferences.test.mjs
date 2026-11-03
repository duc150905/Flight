import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as preferences from '../src/features/currency/preferences.ts';
import { createLanguageStore } from '../src/features/i18n/language.ts';
import { createCheckoutDraftStore } from '../src/features/booking/draft.ts';
import { presentMoney } from '../src/features/currency/presentation.ts';

test('language determines currency immediately and checkout data survives switching', async () => {
  assert.equal(typeof preferences.currencyForLanguage, 'function');
  const language = createLanguageStore({ getItem: async () => null, setItem: async () => {} }, ['vi']);
  const draft = createCheckoutDraftStore();
  draft.getState().updateContact({ contactName: 'Still here' });
  const now = Date.now();
  const rate = { vndPerUsd: 25000, updatedAt: now, nextUpdateAt: now + 86400000 };
  const price = () => presentMoney({ amount: 1250000, sourceCurrency: 'VND',
    currency: preferences.currencyForLanguage(language.getState().language),
    language: language.getState().language, rate, now });
  assert.equal(price().currency, 'VND');
  const writing = language.getState().setLanguage('en');
  assert.equal(price().currency, 'USD');
  assert.equal(price().value, 50);
  await writing;
  await language.getState().setLanguage('vi');
  assert.equal(price().currency, 'VND');
  assert.equal(price().value, 1250000);
  assert.equal(draft.getState().contact.contactName, 'Still here');
});

test('restored language controls currency and legacy currency settings are ignored', async () => {
  assert.equal(typeof preferences.currencyForLanguage, 'function');
  for (const [savedLanguage, legacyCurrency, expected] of [['en', 'VND', 'USD'], ['vi', 'USD', 'VND']]) {
    const reads = [];
    const language = createLanguageStore({ getItem: async key => {
      reads.push(key); return key === 'flight.language' ? savedLanguage : legacyCurrency;
    }, setItem: async () => {} }, ['vi']);
    await language.getState().hydrate();
    assert.equal(preferences.currencyForLanguage(language.getState().language), expected);
    assert.deepEqual(reads, ['flight.language']);
  }
});

test('currency follows language even when preference storage fails', async () => {
  assert.equal(typeof preferences.currencyForLanguage, 'function');
  const language = createLanguageStore({ getItem: async () => { throw Error('offline'); },
    setItem: async () => { throw Error('full'); } }, ['en-US']);
  await language.getState().hydrate();
  assert.equal(preferences.currencyForLanguage(language.getState().language), 'USD');
  await language.getState().setLanguage('vi');
  assert.equal(preferences.currencyForLanguage(language.getState().language), 'VND');
});
