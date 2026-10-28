import { ActivityIndicator, Text } from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { AuthScreen } from '@/features/auth/auth-screen';
import { AccountScreen } from '@/features/auth/account-screen';
import { ActionButton, AuthShell, Notice, colors, styles } from '@/features/auth/ui';

export default function Index() {
  const { session, status, error, retry } = useAuth();
  if (status === 'loading') return <AuthShell><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.description}>Getting your account ready…</Text></AuthShell>;
  if (status === 'error') return <AuthShell><Text style={styles.title}>Let’s try again</Text><Notice text={error ?? ''} /><ActionButton title="Retry" onPress={retry} /></AuthShell>;
  return session ? <AccountScreen /> : <AuthScreen />;
}
