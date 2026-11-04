import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthProvider } from '@/features/auth/auth-provider';
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
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }));
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <CurrencyProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            <AppLayout />
          </AuthProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </QueryClientProvider>
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
