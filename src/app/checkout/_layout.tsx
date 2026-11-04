import { Stack, useGlobalSearchParams, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { AuthScreen } from '@/features/auth/auth-screen';
import { ActionButton, AuthShell, Notice } from '@/features/auth/ui';
import { CheckoutProvider } from '@/features/booking/checkout-provider';
import { savePendingSelection } from '@/features/booking/pending-selection-storage';
import { useLanguage } from '@/features/i18n/provider';

export default function CheckoutLayout() {
  const { t, language } = useLanguage();
  const { session, status, error, retry } = useAuth();
  const [recovering, setRecovering] = useState(false);

  const localParams = useLocalSearchParams<{ selection?: string | string[] }>();
  const globalParams = useGlobalSearchParams<{ selection?: string | string[] }>();
  const rawParam = localParams.selection ?? globalParams.selection;
  const selectionString = Array.isArray(rawParam) ? rawParam[0] : rawParam;

  useEffect(() => {
    if (selectionString) {
      void savePendingSelection(selectionString);
    }
  }, [selectionString]);

  if (status === 'loading') {
    return (
      <AuthShell>
        <ActivityIndicator accessibilityLabel={t('Restoring session')} />
      </AuthShell>
    );
  }

  if (status === 'error') {
    return (
      <AuthShell>
        <Notice text={t(error ?? 'Unable to restore your session.')} />
        <ActionButton title={t('Retry')} onPress={retry} />
      </AuthShell>
    );
  }

  if (!session || recovering) {
    return (
      <View style={layoutStyles.container}>
        <View style={layoutStyles.banner}>
          <Text style={layoutStyles.bannerIcon}>✈</Text>
          <Text style={layoutStyles.bannerText}>
            {t(language === 'en'
              ? 'Your selected flights are saved. Please sign in to continue booking!'
              : 'Chuyến bay bạn đã chọn đã được lưu tạm. Vui lòng đăng nhập để tiếp tục đặt vé!')}
          </Text>
        </View>
        <AuthScreen onRecoveryChange={setRecovering} />
      </View>
    );
  }

  return (
    <CheckoutProvider key={session.user.id}>
      <Stack screenOptions={{ headerShown: false }} />
    </CheckoutProvider>
  );
}

const layoutStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  banner: {
    backgroundColor: '#F0FDFA',
    borderBottomWidth: 1,
    borderBottomColor: '#CCFBF1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerIcon: { fontSize: 16, color: '#0F766E' },
  bannerText: { flex: 1, fontSize: 13, color: '#0F766E', fontWeight: '600', lineHeight: 18 },
});
