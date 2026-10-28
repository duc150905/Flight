import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Text } from 'react-native';
import { useAuth } from './auth-provider';
import { authErrorMessage, loginSchema, registerSchema, verificationSchema, type LoginInput, type RegisterInput } from './model';
import { ActionButton, AuthShell, FormField, Notice, styles } from './ui';

type Mode = 'login' | 'register' | 'verify';
type Navigation = { change: (mode: Mode, email?: string) => void };
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const change = (next: Mode, email = '') => { setEmail(email); setMode(next); };
  return <AuthShell>
    {mode === 'login' && <LoginForm change={change} />}
    {mode === 'register' && <RegisterForm change={change} />}
    {mode === 'verify' && <VerifyForm initialEmail={email} change={change} />}
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
    <Text accessibilityRole="header" style={styles.title}>Welcome back</Text>
    <Text style={styles.description}>Sign in to keep your journeys in one place.</Text>
    <FormField control={control} name="email" label="Email address" autoCapitalize="none" autoCorrect={false}
      keyboardType="email-address" autoComplete="email" editable={!isSubmitting} placeholder="you@example.com" />
    <FormField control={control} name="password" label="Password" password autoCapitalize="none" autoCorrect={false}
      autoComplete="current-password" editable={!isSubmitting} returnKeyType="go" onSubmitEditing={() => void submit()} />
    <Notice text={error} />
    <ActionButton title="Sign in" busy={isSubmitting} onPress={() => void submit()} />
    <ActionButton title="Create an account" secondary disabled={isSubmitting} onPress={() => change('register')} />
    <ActionButton title="Verify email" secondary disabled={isSubmitting} onPress={() => change('verify', getValues('email'))} />
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
    <Text accessibilityRole="header" style={styles.title}>Start your journey</Text>
    <Text style={styles.description}>Create your Flight account. Passenger details can be added when you book.</Text>
    <FormField control={control} name="name" label="Full name" autoComplete="name" autoCapitalize="words" editable={!isSubmitting} />
    <FormField control={control} name="email" label="Email address" autoComplete="email" keyboardType="email-address"
      autoCapitalize="none" autoCorrect={false} editable={!isSubmitting} placeholder="you@example.com" />
    <FormField control={control} name="password" label="Password" password autoComplete="new-password"
      autoCapitalize="none" autoCorrect={false} editable={!isSubmitting} placeholder="At least 8 characters" />
    <FormField control={control} name="confirmPassword" label="Confirm password" password autoComplete="new-password"
      autoCapitalize="none" autoCorrect={false} editable={!isSubmitting} />
    <Notice text={error} />
    <ActionButton title="Create account" busy={isSubmitting} onPress={() => void submit()} />
    <ActionButton title="Back to sign in" secondary disabled={isSubmitting} onPress={() => change('login')} />
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
      setMessage('If this account is awaiting confirmation, a new code has been sent. Check your inbox and spam folder.');
    } catch (error) { setError(authErrorMessage(error)); }
    finally { setResending(false); }
  };
  const busy = isSubmitting || resending;
  return <>
    <Text accessibilityRole="header" style={styles.title}>Check your inbox</Text>
    <Text style={styles.description}>Enter the code from your confirmation email. You can return here later to finish verification.</Text>
    <FormField control={control} name="email" label="Email address" keyboardType="email-address" autoComplete="email"
      autoCapitalize="none" autoCorrect={false} editable={!busy} />
    <FormField control={control} name="token" label="Verification code" keyboardType="number-pad"
      autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={10} editable={!busy} />
    <Notice text={error} /><Notice text={message} success />
    <ActionButton title="Verify email" busy={isSubmitting} disabled={resending} onPress={() => void submit()} />
    <ActionButton title={seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'} secondary busy={resending}
      disabled={isSubmitting || seconds > 0} onPress={() => void resend()} />
    <ActionButton title="Back to sign in" secondary disabled={busy} onPress={() => change('login')} />
  </>;
}
