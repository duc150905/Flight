import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AuthProvider } from '@/features/auth/auth-provider';
import { AppCacheProvider } from '@/features/cache/provider';
import { LanguageProvider } from '@/features/i18n/provider';
import { CurrencyProvider } from '@/features/currency/provider';
import { BottomTabBar } from '@/components/bottom-tab-bar';

function AppLayout() {
  const pathname = usePathname();
  const hideFooter = pathname.startsWith('/admin') || pathname.startsWith('/checkout');

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            animationDuration: 180,
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="account" options={{ animation: 'fade' }} />
          <Stack.Screen name="tickets" options={{ animation: 'fade' }} />
          <Stack.Screen name="results" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="itinerary-results" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="flights/[id]" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
      </View>
      {!hideFooter && <BottomTabBar />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppCacheProvider>
      <LanguageProvider>
        <CurrencyProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            <AppLayout />
          </AuthProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </AppCacheProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
});
