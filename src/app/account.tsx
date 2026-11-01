import { useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { AuthScreen } from '@/features/auth/auth-screen';
import { AccountScreen } from '@/features/auth/account-screen';
import { ActionButton, AuthShell, Notice, colors, styles } from '@/features/auth/ui';

export default function Account() {
  const { session, status, error, retry } = useAuth();
  const [recovering, setRecovering] = useState(false);
  if (status === 'loading') return <AuthShell><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.description}>Đang khôi phục phiên đăng nhập…</Text></AuthShell>;
  if (status === 'error') return <AuthShell><Text style={styles.title}>Chưa thể mở tài khoản</Text><Notice text={error ?? ''} /><ActionButton title="Thử lại" onPress={retry} /></AuthShell>;
  return session && !recovering ? <AccountScreen /> : <AuthScreen onRecoveryChange={setRecovering} />;
}
