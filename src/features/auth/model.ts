import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ.'));
const passwordSchema = z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.').max(128, 'Mật khẩu không quá 128 ký tự.');
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Hãy nhập mật khẩu.'),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, 'Họ tên cần ít nhất 2 ký tự.').max(100, 'Họ tên không quá 100 ký tự.'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(value => value.password === value.confirmPassword, {
  message: 'Mật khẩu nhập lại không khớp.', path: ['confirmPassword'],
});
export const otpSchema = z.object({ token: z.string().trim().regex(/^\d{6,10}$/, 'Hãy nhập đầy đủ mã số trong email.') });
export const verificationSchema = otpSchema.extend({ email: emailSchema });
const passwordFields = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
});
export const newPasswordSchema = passwordFields.refine(value => value.password === value.confirmPassword, {
  message: 'Mật khẩu nhập lại không khớp.', path: ['confirmPassword'],
});
export const changePasswordSchema = passwordFields.extend({
  currentPassword: z.string().min(1, 'Hãy nhập mật khẩu hiện tại.'),
}).superRefine((value, context) => {
  if (value.password !== value.confirmPassword) context.addIssue({
    code: 'custom', message: 'Mật khẩu nhập lại không khớp.', path: ['confirmPassword'],
  });
  if (value.currentPassword === value.password) context.addIssue({
    code: 'custom', message: 'Hãy chọn mật khẩu khác mật khẩu hiện tại.', path: ['password'],
  });
});
export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type NewPasswordInput = z.input<typeof newPasswordSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
type AuthGateway = Pick<SupabaseClient['auth'], 'signUp' | 'signInWithPassword' | 'signInWithOAuth' | 'setSession' | 'verifyOtp' | 'resend' | 'signOut' | 'resetPasswordForEmail' | 'updateUser'>;

function googleCallbackTokens(callbackUrl: string, redirectTo: string) {
  const callback = new URL(callbackUrl);
  const expected = new URL(redirectTo);
  if (callback.protocol !== expected.protocol || callback.host !== expected.host || callback.pathname !== expected.pathname) {
    throw new Error('Unexpected Google sign-in redirect');
  }
  const query = new URLSearchParams(callback.hash.slice(1));
  if (callback.searchParams.has('error') || query.has('error')) {
    throw Object.assign(new Error('Google sign-in was not completed'), { code: 'google_sign_in_failed' });
  }
  const access_token = query.get('access_token');
  const refresh_token = query.get('refresh_token');
  if (!access_token || !refresh_token) throw new Error('Google sign-in session missing');
  return { access_token, refresh_token };
}

export function createAuthService(auth: AuthGateway) {
  return {
    async login(input: LoginInput) {
      const { data, error } = await auth.signInWithPassword(loginSchema.parse(input));
      if (error) throw error;
      if (!data.session) throw new Error('Session missing');
    },
    async googleSignIn(redirectTo: string, native: boolean) {
      const { data, error } = await auth.signInWithOAuth({
        provider: 'google', options: { redirectTo, skipBrowserRedirect: native },
      });
      if (error) throw error;
      if (!data.url) throw new Error('Google sign-in URL missing');
      return data.url;
    },
    async completeGoogleSignIn(callbackUrl: string, redirectTo: string) {
      const { data, error } = await auth.setSession(googleCallbackTokens(callbackUrl, redirectTo));
      if (error) throw error;
      if (!data.session) throw new Error('Google sign-in session missing');
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
    async requestPasswordReset(email: string) {
      const { error } = await auth.resetPasswordForEmail(emailSchema.parse(email));
      if (error) throw error;
    },
    async verifyRecovery(email: string, token: string) {
      const { data, error } = await auth.verifyOtp({
        email: emailSchema.parse(email), token: otpSchema.parse({ token }).token, type: 'recovery',
      });
      if (error) throw error;
      if (!data.session) throw new Error('Session missing');
    },
    async setRecoveredPassword(input: NewPasswordInput) {
      const { password } = newPasswordSchema.parse(input);
      const { error } = await auth.updateUser({ password });
      if (error) throw error;
    },
    async changePassword(input: ChangePasswordInput) {
      const { currentPassword, password } = changePasswordSchema.parse(input);
      const { error } = await auth.updateUser({ password, current_password: currentPassword });
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
    invalid_credentials: 'Email hoặc mật khẩu không đúng.',
    email_not_confirmed: 'Hãy xác nhận email trước khi đăng nhập.',
    user_already_exists: 'Không thể tạo tài khoản này. Hãy thử đăng nhập.',
    weak_password: 'Mật khẩu chưa đáp ứng yêu cầu bảo mật.',
    over_email_send_rate_limit: 'Đã đạt giới hạn gửi email. Hãy thử lại sau.',
    over_request_rate_limit: 'Bạn đã thử quá nhiều lần. Hãy đợi rồi thử lại.',
    otp_expired: 'Mã không hợp lệ hoặc đã hết hạn. Hãy kiểm tra hoặc yêu cầu mã mới.',
    email_address_invalid: 'Email không hợp lệ.',
    email_address_not_authorized: 'Dịch vụ email thử nghiệm chưa thể gửi tới địa chỉ này.',
    signup_disabled: 'Hiện chưa thể đăng ký tài khoản mới.',
    google_sign_in_failed: 'Không thể đăng nhập với Google. Hãy thử lại hoặc liên hệ quản trị viên.',
  };
  return messages[code] ?? 'Có lỗi xảy ra. Hãy kiểm tra kết nối và thử lại.';
}
