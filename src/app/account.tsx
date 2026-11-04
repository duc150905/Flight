import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { AuthScreen } from '@/features/auth/auth-screen';
import { AccountScreen } from '@/features/auth/account-screen';
import { ActionButton, AuthShell, Notice, colors, styles } from '@/features/auth/ui';
import { getPendingSelection } from '@/features/booking/pending-selection-storage';
import { useLanguage } from '@/features/i18n/provider';

export default function Account() {
  const { t } = useLanguage();
  const { session, status, error, retry } = useAuth();
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (session && !recovering) {
      void getPendingSelection().then((pending) => {
        if (pending) {
          router.replace({ pathname: '/checkout', params: { selection: pending } });
        }
      });
    }
  }, [session, recovering]);
  if (status === 'loading') return <AuthShell><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.description}>{t('Đang khôi phục phiên đăng nhập…')}</Text></AuthShell>;
  if (status === 'error') {
    return (
      <AuthShell>
        <Text style={styles.title}>{t('Chưa thể mở tài khoản')}</Text>
        <Notice text={error ?? ''} />
        <ActionButton title={t('Thử lại')} onPress={retry} />
        <ActionButton
          title={t('Về trang chủ')}
          secondary
          onPress={() => router.replace('/')}
        />
      </AuthShell>
    );
  }
  return session && !recovering ? <AccountScreen /> : <AuthScreen onRecoveryChange={setRecovering} />;
}
