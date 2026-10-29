import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/features/auth/auth-provider';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }));
  return <QueryClientProvider client={queryClient}>
    <AuthProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false }} /></AuthProvider>
  </QueryClientProvider>;
}
