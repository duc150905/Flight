import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { AdminGuard } from '@/features/auth/admin-guard';
import { AdminQueryProvider } from '@/features/admin/admin-query-provider';
import { useAuth } from '@/features/auth/auth-provider';
import { AuthScreen } from '@/features/auth/auth-screen';
import { ActionButton, AuthShell, Notice, colors, styles } from '@/features/auth/ui';

export default function AdminLayout() {
  const { session, status, error, retry } = useAuth();
  const [recovering, setRecovering] = useState(false);

  if (status === 'loading') {
    return (
      <AuthShell>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.description}>Đang khôi phục phiên đăng nhập…</Text>
      </AuthShell>
    );
  }

  if (status === 'error') {
    return (
      <AuthShell>
        <Text style={styles.title}>Chưa thể mở trang quản trị</Text>
        <Notice text={error ?? ''} />
        <ActionButton title="Thử lại" onPress={retry} />
      </AuthShell>
    );
  }

  if (!session || recovering) {
    return <AuthScreen onRecoveryChange={setRecovering} />;
  }

  return (
    <AdminGuard key={session.user.id}>
      <AdminQueryProvider key={session.user.id}>
        <Stack screenOptions={{ headerShown: false }} />
      </AdminQueryProvider>
    </AdminGuard>
  );
}
