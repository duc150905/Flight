import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkIsAdmin } from '../src/features/auth/admin.ts';

test('checkIsAdmin returns false when client is null or undefined', async () => {
  assert.equal(await checkIsAdmin(null), false);
  assert.equal(await checkIsAdmin(undefined), false);
});

test('checkIsAdmin returns true when client rpc returns true', async () => {
  const mockClient = {
    rpc: async (fn) => {
      assert.equal(fn, 'is_admin');
      return { data: true, error: null };
    },
  };
  assert.equal(await checkIsAdmin(mockClient), true);
});

test('checkIsAdmin returns false when client rpc returns false', async () => {
  const mockClient = {
    rpc: async (fn) => {
      assert.equal(fn, 'is_admin');
      return { data: false, error: null };
    },
  };
  assert.equal(await checkIsAdmin(mockClient), false);
});

test('checkIsAdmin returns false when client rpc returns an error', async () => {
  const mockClient = {
    rpc: async () => ({
      data: null,
      error: { message: 'Permission denied', code: '42501' },
    }),
  };
  assert.equal(await checkIsAdmin(mockClient), false);
});

test('checkIsAdmin catches unexpected network rejection and returns false safely', async () => {
  const mockClient = {
    rpc: async () => {
      throw new Error('Network timeout');
    },
  };
  assert.equal(await checkIsAdmin(mockClient), false);
});
