import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'));
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, 'Enter at least 2 characters.').max(100, 'Use no more than 100 characters.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(128, 'Use no more than 128 characters.'),
  confirmPassword: z.string(),
}).refine(value => value.password === value.confirmPassword, {
  message: 'Passwords do not match.', path: ['confirmPassword'],
});
export const otpSchema = z.object({ token: z.string().trim().regex(/^\d{6,10}$/, 'Enter the complete numeric code from your email.') });
export const verificationSchema = otpSchema.extend({ email: emailSchema });
export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
type AuthGateway = Pick<SupabaseClient['auth'], 'signUp' | 'signInWithPassword' | 'verifyOtp' | 'resend' | 'signOut'>;

export function createAuthService(auth: AuthGateway) {
  return {
    async login(input: LoginInput) {
      const { data, error } = await auth.signInWithPassword(loginSchema.parse(input));
      if (error) throw error;
      if (!data.session) throw new Error('Session missing');
    },
    async register(input: RegisterInput) {
      const { name, email, password } = registerSchema.parse(input);
      const { data, error } = await auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) throw error;
      return data.session ? 'signed-in' : 'confirmation';
    },
    async verify(email: string, token: string) {
      const { data, error } = await auth.verifyOtp({
        email: emailSchema.parse(email), token: otpSchema.parse({ token }).token, type: 'email',
      });
      if (error) throw error;
      if (!data.session) throw new Error('Session missing');
    },
    async resend(email: string) {
      const { error } = await auth.resend({ type: 'signup', email: emailSchema.parse(email) });
      if (error) throw error;
    },
    async logout() {
      const { error } = await auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
  };
}

export function authErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    invalid_credentials: 'The email or password is incorrect.',
    email_not_confirmed: 'Verify your email before signing in. Choose "Verify email" below.',
    user_already_exists: 'Unable to create this account. Try signing in instead.',
    weak_password: 'Your password does not meet the security requirements.',
    over_email_send_rate_limit: 'Email sending limit reached. Please try again later.',
    over_request_rate_limit: 'Too many attempts. Please wait and try again.',
    otp_expired: 'This code is invalid or has expired. Check it or request a new one.',
    email_address_invalid: 'Enter a valid email address.',
    email_address_not_authorized: 'The test email service cannot send to this address yet.',
    signup_disabled: 'New account registration is currently unavailable.',
  };
  return messages[code] ?? 'Something went wrong. Check your connection and try again.';
}
