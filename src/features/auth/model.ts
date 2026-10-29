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
export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên cần ít nhất 2 ký tự.').max(100, 'Họ tên không quá 100 ký tự.'),
  contactPhone: z.string().trim().max(30, 'Số điện thoại không quá 30 ký tự.').refine(value =>
    value === '' || (/^\+?[0-9][0-9 .()-]*$/.test(value) && value.replace(/\D/g, '').length >= 7),
    'Số điện thoại liên hệ không hợp lệ.'),
});
export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type NewPasswordInput = z.input<typeof newPasswordSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type ProfileInput = z.input<typeof profileSchema>;
type AuthGateway = Pick<SupabaseClient['auth'], 'signUp' | 'signInWithPassword' | 'verifyOtp' | 'resend' | 'signOut' | 'resetPasswordForEmail' | 'updateUser'>;

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
    async updateProfile(input: ProfileInput) {
      const { fullName, contactPhone } = profileSchema.parse(input);
      const { data, error } = await auth.updateUser({ data: { full_name: fullName, contact_phone: contactPhone } });
      if (error) throw error;
      return data.user;
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
  };
  return messages[code] ?? 'Có lỗi xảy ra. Hãy kiểm tra kết nối và thử lại.';
}
