import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Text } from 'react-native';
import { useAuth } from './auth-provider';
import {
  authErrorMessage, loginSchema, newPasswordSchema, registerSchema, verificationSchema,
  type LoginInput, type NewPasswordInput, type RegisterInput,
} from './model';
import { ActionButton, AuthShell, FormField, Notice, styles } from './ui';

type Mode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';
type Navigation = { change: (mode: Mode, email?: string) => void };
export function AuthScreen({ onRecoveryChange }: { onRecoveryChange: (active: boolean) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [resetRequestedAt, setResetRequestedAt] = useState(0);
  const change = (next: Mode, email = '') => {
    if (next === 'reset') setResetRequestedAt(Date.now());
    setEmail(email); setMode(next);
  };
  return <AuthShell>
    {mode === 'login' && <LoginForm change={change} />}
    {mode === 'register' && <RegisterForm change={change} />}
    {mode === 'verify' && <VerifyForm initialEmail={email} change={change} />}
    {mode === 'forgot' && <ForgotPasswordForm initialEmail={email} change={change} />}
    {mode === 'reset' && <ResetPasswordForm initialEmail={email} initialNextSend={resetRequestedAt + 60_000}
      change={change} onRecoveryChange={onRecoveryChange} />}
  </AuthShell>;
}

function LoginForm({ change }: Navigation) {
  const { actions } = useAuth();
  const [error, setError] = useState('');
  const { control, handleSubmit, getValues, formState: { isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' },
  });
  const submit = handleSubmit(async values => {
    setError('');
    try { await actions!.login(values); } catch (error) { setError(authErrorMessage(error)); }
  });
  return <>
    <Text accessibilityRole="header" style={styles.title}>Chào mừng trở lại</Text>
    <Text style={styles.description}>Đăng nhập để quản lý các chuyến đi của bạn.</Text>
    <FormField control={control} name="email" label="Email" autoCapitalize="none" autoCorrect={false}
      keyboardType="email-address" autoComplete="email" editable={!isSubmitting} placeholder="you@example.com" />
    <FormField control={control} name="password" label="Mật khẩu" password autoCapitalize="none" autoCorrect={false}
      autoComplete="current-password" editable={!isSubmitting} returnKeyType="go" onSubmitEditing={() => void submit()} />
    <Notice text={error} />
    <ActionButton title="Đăng nhập" busy={isSubmitting} onPress={() => void submit()} />
    <ActionButton title="Tạo tài khoản" secondary disabled={isSubmitting} onPress={() => change('register')} />
    <ActionButton title="Xác nhận email" secondary disabled={isSubmitting} onPress={() => change('verify', getValues('email'))} />
    <ActionButton title="Quên mật khẩu?" secondary disabled={isSubmitting} onPress={() => change('forgot', getValues('email'))} />
  </>;
}

function RegisterForm({ change }: Navigation) {
  const { actions } = useAuth();
  const [error, setError] = useState('');
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema), defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });
  const submit = handleSubmit(async values => {
    setError('');
    try {
      const result = await actions!.register(values);
      if (result === 'confirmation') change('verify', values.email.trim().toLowerCase());
    } catch (error) { setError(authErrorMessage(error)); }
  });
  return <>
    <Text accessibilityRole="header" style={styles.title}>Bắt đầu hành trình</Text>
    <Text style={styles.description}>Tạo tài khoản Flight. Bạn có thể thêm thông tin hành khách khi đặt vé.</Text>
    <FormField control={control} name="name" label="Họ và tên" autoComplete="name" autoCapitalize="words" editable={!isSubmitting} />
    <FormField control={control} name="email" label="Email" autoComplete="email" keyboardType="email-address"
      autoCapitalize="none" autoCorrect={false} editable={!isSubmitting} placeholder="you@example.com" />
    <FormField control={control} name="password" label="Mật khẩu" password autoComplete="new-password"
      autoCapitalize="none" autoCorrect={false} editable={!isSubmitting} placeholder="Tối thiểu 8 ký tự" />
    <FormField control={control} name="confirmPassword" label="Nhập lại mật khẩu" password autoComplete="new-password"
      autoCapitalize="none" autoCorrect={false} editable={!isSubmitting} />
    <Notice text={error} />
    <ActionButton title="Tạo tài khoản" busy={isSubmitting} onPress={() => void submit()} />
    <ActionButton title="Về đăng nhập" secondary disabled={isSubmitting} onPress={() => change('login')} />
  </>;
}

function VerifyForm({ initialEmail, change }: Navigation & { initialEmail: string }) {
  const { actions } = useAuth();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [nextSend, setNextSend] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const { control, handleSubmit, getValues, trigger, formState: { isSubmitting } } = useForm<{ email: string; token: string }>({
    resolver: zodResolver(verificationSchema), defaultValues: { email: initialEmail, token: '' },
  });
  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.max(0, Math.ceil((nextSend - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [nextSend]);
  const submit = handleSubmit(async ({ email, token }) => {
    setError(''); setMessage('');
    try { await actions!.verify(email, token); } catch (error) { setError(authErrorMessage(error)); }
  });
  const resend = async () => {
    if (resending || Date.now() < nextSend || !await trigger('email')) return;
    setResending(true); setError(''); setMessage('');
    try {
      await actions!.resend(getValues('email'));
      setNextSend(Date.now() + 60_000); setSeconds(60);
      setMessage('Nếu tài khoản đang chờ xác nhận, mã mới đã được gửi. Hãy kiểm tra hộp thư và thư rác.');
    } catch (error) { setError(authErrorMessage(error)); }
    finally { setResending(false); }
  };
  const busy = isSubmitting || resending;
  return <>
    <Text accessibilityRole="header" style={styles.title}>Kiểm tra email</Text>
    <Text style={styles.description}>Nhập mã trong email xác nhận. Bạn có thể quay lại bước này sau.</Text>
    <FormField control={control} name="email" label="Email" keyboardType="email-address" autoComplete="email"
      autoCapitalize="none" autoCorrect={false} editable={!busy} />
    <FormField control={control} name="token" label="Mã xác nhận" keyboardType="number-pad"
      autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={10} editable={!busy} />
    <Notice text={error} /><Notice text={message} success />
    <ActionButton title="Xác nhận email" busy={isSubmitting} disabled={resending} onPress={() => void submit()} />
    <ActionButton title={seconds > 0 ? `Gửi lại sau ${seconds} giây` : 'Gửi lại mã'} secondary busy={resending}
      disabled={isSubmitting || seconds > 0} onPress={() => void resend()} />
    <ActionButton title="Về đăng nhập" secondary disabled={busy} onPress={() => change('login')} />
  </>;
}

function ForgotPasswordForm({ initialEmail, change }: Navigation & { initialEmail: string }) {
  const { actions } = useAuth();
  const [error, setError] = useState('');
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<{ email: string }>({
    resolver: zodResolver(loginSchema.pick({ email: true })), defaultValues: { email: initialEmail },
  });
  const submit = handleSubmit(async ({ email }) => {
    setError('');
    try {
      await actions!.requestPasswordReset(email);
      change('reset', email.trim().toLowerCase());
    } catch (error) { setError(authErrorMessage(error)); }
  });
  return <>
    <Text accessibilityRole="header" style={styles.title}>Đặt lại mật khẩu</Text>
    <Text style={styles.description}>Nhập email tài khoản để nhận mã đặt lại mật khẩu.</Text>
    <FormField control={control} name="email" label="Email" keyboardType="email-address"
      autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!isSubmitting} />
    <Notice text={error} />
    <ActionButton title="Gửi mã đặt lại" busy={isSubmitting} onPress={() => void submit()} />
    <ActionButton title="Về đăng nhập" secondary disabled={isSubmitting} onPress={() => change('login')} />
  </>;
}

function ResetPasswordForm({ initialEmail, initialNextSend, change, onRecoveryChange }: Navigation & {
  initialEmail: string; initialNextSend: number; onRecoveryChange: (active: boolean) => void;
}) {
  const { actions } = useAuth();
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [nextSend, setNextSend] = useState(initialNextSend);
  const [seconds, setSeconds] = useState(60);
  const { control, handleSubmit, getValues, trigger, formState: { isSubmitting } } = useForm<{ email: string; token: string }>({
    resolver: zodResolver(verificationSchema), defaultValues: { email: initialEmail, token: '' },
  });
  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.max(0, Math.ceil((nextSend - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [nextSend]);
  const verify = handleSubmit(async ({ email, token }) => {
    setError(''); onRecoveryChange(true);
    try {
      await actions!.verifyRecovery(email, token);
      setVerified(true);
    } catch (error) {
      onRecoveryChange(false);
      setError(authErrorMessage(error));
    }
  });
  const resend = async () => {
    if (resending || Date.now() < nextSend || !await trigger('email')) return;
    setResending(true); setError('');
    try {
      await actions!.requestPasswordReset(getValues('email'));
      setNextSend(Date.now() + 60_000); setSeconds(60);
    } catch (error) { setError(authErrorMessage(error)); }
    finally { setResending(false); }
  };
  if (verified) return <SetRecoveredPasswordForm onComplete={() => onRecoveryChange(false)} />;
  return <>
    <Text accessibilityRole="header" style={styles.title}>Kiểm tra email</Text>
    <Text style={styles.description}>Nếu email có tài khoản, mã đặt lại đã được gửi. Nhập mã để chọn mật khẩu mới.</Text>
    <FormField control={control} name="email" label="Email" keyboardType="email-address"
      autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!isSubmitting && !resending} />
    <FormField control={control} name="token" label="Mã đặt lại" keyboardType="number-pad"
      autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={10} editable={!isSubmitting && !resending} />
    <Notice text={error} />
    <ActionButton title="Xác nhận mã" busy={isSubmitting} disabled={resending} onPress={() => void verify()} />
    <ActionButton title={seconds > 0 ? `Gửi lại sau ${seconds} giây` : 'Gửi lại mã'} secondary busy={resending}
      disabled={isSubmitting || seconds > 0} onPress={() => void resend()} />
    <ActionButton title="Về đăng nhập" secondary disabled={isSubmitting || resending} onPress={() => change('login')} />
  </>;
}

function SetRecoveredPasswordForm({ onComplete }: { onComplete: () => void }) {
  const { actions } = useAuth();
  const [error, setError] = useState('');
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema), defaultValues: { password: '', confirmPassword: '' },
  });
  const submit = handleSubmit(async values => {
    setError('');
    try { await actions!.setRecoveredPassword(values); onComplete(); }
    catch (error) { setError(authErrorMessage(error)); }
  });
  return <>
    <Text accessibilityRole="header" style={styles.title}>Chọn mật khẩu mới</Text>
    <Text style={styles.description}>Mã đã được xác nhận. Hãy đặt mật khẩu mới để hoàn tất.</Text>
    <FormField control={control} name="password" label="Mật khẩu mới" password autoComplete="new-password"
      autoCapitalize="none" autoCorrect={false} editable={!isSubmitting} />
    <FormField control={control} name="confirmPassword" label="Nhập lại mật khẩu mới" password autoComplete="new-password"
      autoCapitalize="none" autoCorrect={false} editable={!isSubmitting} />
    <Notice text={error} />
    <ActionButton title="Lưu mật khẩu mới" busy={isSubmitting} onPress={() => void submit()} />
  </>;
}
