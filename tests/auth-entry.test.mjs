import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as auth from '../src/features/auth/model.ts';

test('confirmation entry is offered only for the explicit unconfirmed-email error', () => {
  assert.equal(typeof auth.isEmailConfirmationRequired, 'function');
  assert.equal(auth.isEmailConfirmationRequired({ code: 'email_not_confirmed' }), true);
  for (const error of [null, undefined, 'email_not_confirmed', {}, { code: 'invalid_credentials' }, { message: 'email_not_confirmed' }]) {
    assert.equal(auth.isEmailConfirmationRequired(error), false);
  }
});
