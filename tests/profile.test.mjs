import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createProfileService, ProfileMissingError, profileErrorMessage, profileSchema } from '../src/features/profile/model.ts';

const row = { id: 'user-1', full_name: 'Mai Nguyen', contact_phone: '+84912345678' };

function mockClient(result = { data: row, error: null }) {
  const calls = [];
  const query = {
    select(columns) { calls.push(['select', columns]); return this; },
    update(values) { calls.push(['update', values]); return this; },
    eq(column, value) { calls.push(['eq', column, value]); return this; },
    async maybeSingle() { calls.push(['maybeSingle']); return result; },
  };
  return { calls, client: { from(table) { calls.push(['from', table]); return query; } } };
}

test('profile input matches the database E.164 phone constraint', () => {
  assert.deepEqual(profileSchema.parse({ fullName: '  Mai Nguyen  ', contactPhone: '  +84912345678  ' }),
    { fullName: 'Mai Nguyen', contactPhone: '+84912345678' });
  assert.equal(profileSchema.safeParse({ fullName: 'Mai Nguyen', contactPhone: '' }).success, true);
  for (const contactPhone of ['0912345678', '+84 912 345 678', '+1234567', '+0123456789', '+1234567890123456']) {
    assert.equal(profileSchema.safeParse({ fullName: 'Mai Nguyen', contactPhone }).success, false);
  }
});

test('profile load reads only the signed-in user row', async () => {
  const { client, calls } = mockClient();
  assert.deepEqual(await createProfileService(client).load('user-1'), row);
  assert.deepEqual(calls, [
    ['from', 'profiles'], ['select', 'id,full_name,contact_phone'], ['eq', 'id', 'user-1'], ['maybeSingle'],
  ]);
});

test('profile save updates only allowed columns and returns the database row', async () => {
  const { client, calls } = mockClient();
  assert.deepEqual(await createProfileService(client).save('user-1', {
    fullName: '  Mai Nguyen  ', contactPhone: ' +84912345678 ',
  }), row);
  assert.deepEqual(calls, [
    ['from', 'profiles'], ['update', { full_name: 'Mai Nguyen', contact_phone: '+84912345678' }],
    ['eq', 'id', 'user-1'], ['select', 'id,full_name,contact_phone'], ['maybeSingle'],
  ]);
});

test('clearing a phone stores null, while invalid input sends no request', async () => {
  const { client, calls } = mockClient({ data: { ...row, contact_phone: null }, error: null });
  const service = createProfileService(client);
  await assert.rejects(() => service.save('user-1', { fullName: 'Mai Nguyen', contactPhone: '0912345678' }));
  assert.deepEqual(calls, []);
  assert.equal((await service.save('user-1', { fullName: 'Mai Nguyen', contactPhone: '  ' })).contact_phone, null);
  assert.deepEqual(calls[1], ['update', { full_name: 'Mai Nguyen', contact_phone: null }]);
});

test('missing or inaccessible profile is not silently recreated by the client', async () => {
  const { client } = mockClient({ data: null, error: null });
  const service = createProfileService(client);
  await assert.rejects(() => service.load('user-1'), ProfileMissingError);
  await assert.rejects(() => service.save('user-1', { fullName: 'Mai Nguyen', contactPhone: '' }), ProfileMissingError);
  assert.match(profileErrorMessage(new ProfileMissingError()), /Không tìm thấy hồ sơ/);
});

test('database errors propagate without exposing server details in the UI', async () => {
  const error = { code: '42501', message: 'private policy details' };
  const { client } = mockClient({ data: null, error });
  await assert.rejects(() => createProfileService(client).load('user-1'), e => e === error);
  assert.equal(profileErrorMessage(error).includes('private policy details'), false);
});
