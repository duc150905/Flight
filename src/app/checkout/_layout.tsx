import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { AuthScreen } from '@/features/auth/auth-screen';
import { ActionButton, AuthShell, Notice } from '@/features/auth/ui';
import { CheckoutProvider } from '@/features/booking/checkout-provider';

export default function CheckoutLayout() {
  const { session, status, error, retry } = useAuth();
  const [recovering, setRecovering] = useState(false);
  if (status === 'loading') return <AuthShell><ActivityIndicator accessibilityLabel="Restoring session" /></AuthShell>;
  if (status === 'error') return <AuthShell><Notice text={error ?? 'Unable to restore your session.'} /><ActionButton title="Retry" onPress={retry} /></AuthShell>;
  if (!session || recovering) return <AuthScreen onRecoveryChange={setRecovering} />;
  return <CheckoutProvider key={session.user.id}><Stack screenOptions={{ headerShown: false }} /></CheckoutProvider>;
}
