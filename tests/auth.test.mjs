import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginSchema, registerSchema, otpSchema, newPasswordSchema, changePasswordSchema, profileSchema, createAuthService, authErrorMessage } from '../src/features/auth/model.ts';

const credentials = { email: '  Person@Example.com ', password: '  password123  ' };
test('login normalizes email without modifying a password', () => {
  assert.deepEqual(loginSchema.parse(credentials), { email: 'person@example.com', password: '  password123  ' });
});
test('malformed email and empty password cannot be submitted', () => {
  assert.equal(loginSchema.safeParse({ email: 'bad', password: '' }).success, false);
});
test('registration rejects mismatched and short passwords', () => {
  for (const [password, confirmPassword] of [['password123', 'different'], ['abc', 'abc']]) {
    assert.equal(registerSchema.safeParse({ name: 'Duc', email: 'a@b.com', password, confirmPassword }).success, false);
  }
});
test('OTP accepts digits and rejects incomplete or nonnumeric codes', () => {
  assert.equal(otpSchema.safeParse({ token: '123456' }).success, true);
  for (const token of ['123', 'abcdef', '12345678901']) assert.equal(otpSchema.safeParse({ token }).success, false);
});
test('signup requests confirmation when the server has not issued a session', async () => {
  let request;
  const actions = createAuthService({ signUp: async input => { request = input; return { data: { session: null }, error: null }; } });
  assert.equal(await actions.register({ ...credentials, name: '  Duc  ', confirmPassword: credentials.password }), 'confirmation');
  assert.deepEqual(request, { email: 'person@example.com', password: '  password123  ', options: { data: { full_name: 'Duc' } } });
});
test('invalid registration never reaches the remote auth API', async () => {
  let calls = 0;
  const actions = createAuthService({ signUp: async () => { calls++; } });
  await assert.rejects(() => actions.register({ ...credentials, name: 'Duc', confirmPassword: 'wrong' }));
  assert.equal(calls, 0);
});
test('login sends normalized credentials and propagates auth errors', async () => {
  const actions = createAuthService({ signInWithPassword: async input => {
    assert.equal(input.email, 'person@example.com');
    return { data: { session: null }, error: { code: 'invalid_credentials' } };
  } });
  await assert.rejects(() => actions.login(credentials), e => e.code === 'invalid_credentials');
});
test('verification must receive a session before it succeeds', async () => {
  const actions = createAuthService({ verifyOtp: async input => {
    assert.deepEqual(input, { email: 'person@example.com', token: '123456', type: 'email' });
    return { data: { session: null }, error: null };
  } });
  await assert.rejects(() => actions.verify(credentials.email, '123456'));
});
test('verification accepts a server-issued session', async () => {
  const actions = createAuthService({ verifyOtp: async () => ({ data: { session: { user: { id: 'user' } } }, error: null }) });
  await actions.verify('person@example.com', '123456');
});
test('resend requests a signup email and signout is device-local', async () => {
  const actions = createAuthService({
    resend: async input => { assert.deepEqual(input, { type: 'signup', email: 'person@example.com' }); return { error: null }; },
    signOut: async input => { assert.deepEqual(input, { scope: 'local' }); return { error: null }; },
  });
  await actions.resend(credentials.email);
  await actions.logout();
});
test('error messages do not expose unexpected server data', () => {
  assert.equal(authErrorMessage({ message: 'sensitive server internals' }).includes('sensitive'), false);
  assert.notEqual(authErrorMessage({ code: 'email_not_confirmed' }), authErrorMessage({ code: 'invalid_credentials' }));
});
test('recovery requests normalize email without exposing whether an account exists', async () => {
  let requested;
  const actions = createAuthService({ resetPasswordForEmail: async email => {
    requested = email; return { error: null };
  } });
  assert.equal(await actions.requestPasswordReset(credentials.email), undefined);
  assert.equal(requested, 'person@example.com');
});
test('recovery code must create a session before changing the password', async () => {
  const actions = createAuthService({ verifyOtp: async input => {
    assert.deepEqual(input, { email: 'person@example.com', token: '123456', type: 'recovery' });
    return { data: { session: null }, error: null };
  } });
  await assert.rejects(() => actions.verifyRecovery(credentials.email, '123456'));
});
test('new passwords are validated before reaching Supabase', async () => {
  let calls = 0;
  const actions = createAuthService({ updateUser: async () => { calls++; return { error: null }; } });
  for (const input of [
    { password: 'short', confirmPassword: 'short' },
    { password: 'longenough', confirmPassword: 'different' },
  ]) await assert.rejects(() => actions.setRecoveredPassword(input));
  assert.equal(calls, 0);
  assert.equal(newPasswordSchema.safeParse({ password: 'longenough', confirmPassword: 'longenough' }).success, true);
});
test('signed-in password change requires the current password', async () => {
  let payload;
  const actions = createAuthService({ updateUser: async input => {
    payload = input; return { error: null };
  } });
  assert.equal(changePasswordSchema.safeParse({ currentPassword: '', password: 'newpassword', confirmPassword: 'newpassword' }).success, false);
  await actions.changePassword({ currentPassword: 'oldpassword', password: 'newpassword', confirmPassword: 'newpassword' });
  assert.deepEqual(payload, { password: 'newpassword', current_password: 'oldpassword' });
});
test('profile saves contact data as metadata without changing the Auth phone identifier', async () => {
  let payload;
  const actions = createAuthService({ updateUser: async input => {
    payload = input; return { data: { user: { id: 'user' } }, error: null };
  } });
  assert.equal(profileSchema.safeParse({ fullName: 'A', contactPhone: 'invalid' }).success, false);
  const user = await actions.updateProfile({ fullName: '  Mai Nguyen  ', contactPhone: '  +84 912 345 678  ' });
  assert.equal(user.id, 'user');
  assert.deepEqual(payload, { data: { full_name: 'Mai Nguyen', contact_phone: '+84 912 345 678' } });
});
