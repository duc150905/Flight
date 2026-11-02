import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useCheckout } from '@/features/booking/checkout-provider';
import { loadCheckoutItinerary } from '@/features/booking/itinerary-data';
import { parseSelectionParameter } from '@/features/booking/selection';
import { CheckoutButton, CheckoutError, CheckoutShell, CheckoutText } from '@/features/booking/ui';
import { useLanguage } from '@/features/i18n/provider';

export default function CheckoutEntry() {
  const { t } = useLanguage();
  const { selection } = useLocalSearchParams<{ selection?: string | string[] }>();
  const { beginCheckout } = useCheckout();
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const requestKey = `${JSON.stringify(selection)}:${attempt}`;
  const error = failure?.key === requestKey ? failure.message : '';
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const selected = parseSelectionParameter(selection);
        if (!supabase) throw new Error('The booking service is unavailable. Please try again later.');
        const itinerary = await loadCheckoutItinerary(supabase, selected);
        if (active) { beginCheckout(itinerary); router.replace('/checkout/passengers'); }
      } catch {
        if (active) setFailure({ key: requestKey, message: 'We could not open these flights. Check your connection and retry, or return to search and choose your flights again.' });
      }
    };
    void load(); return () => { active = false; };
  }, [selection, attempt, requestKey, beginCheckout]);
  return <CheckoutShell title="Your next journey">
    <CheckoutText muted>Preparing your selected flights…</CheckoutText>
    {!error && <ActivityIndicator accessibilityLabel={t('Loading your selected flights')} />}
    <CheckoutError message={error} />
    {!!error && <CheckoutButton title="Try again" onPress={() => setAttempt(n => n + 1)} />}
    <CheckoutButton title="Back to home" secondary onPress={() => router.replace('/')} />
  </CheckoutShell>;
}
