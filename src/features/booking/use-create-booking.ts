import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { invalidateOwnerTickets } from '@/features/cache/policy';
import { useAuth } from '../auth/auth-provider';
import { useCheckout } from './checkout-provider';
import { bookingError, bookingPayload, createBooking, type BookingReceipt } from './create-booking';
import { clearPendingSelection } from './pending-selection-storage';
import { findBookingRequest } from './pending-booking';
import { createBookingRequestJournal } from './request-journal';
import type { CheckoutQuote } from './quote';
import { createOwnerRpcClient } from './owner-rpc';

const journal = createBookingRequestJournal(AsyncStorage, Crypto.randomUUID);
export function useCreateBooking() {
  const queryClient = useQueryClient();
  const draft = useCheckout(); const { session } = useAuth();
  const focused = useRef(false); const lock = useRef(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; }; }, []));
  function ownerClient() {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL; const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key || !session || !focused.current) throw new Error('booking.authRequired');
    return createOwnerRpcClient({ url, key, accessToken: session.access_token });
  }
  async function run(action: () => Promise<BookingReceipt | null>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const saved = await action();
      if (!focused.current) return;
      if (saved) {
        if (session) void invalidateOwnerTickets(queryClient, session.user.id);
        draft.finish();
        void clearPendingSelection();
        router.replace({ pathname: '/pending/[id]', params: { id: saved.id } });
      } else setError('booking.noSavedRequest');
    } catch (cause) { if (focused.current) setError(bookingError(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  return { busy, error,
    submit: (quote: CheckoutQuote) => run(async () => {
      const client = ownerClient(); if (!session) throw new Error('booking.authRequired');
      const payload = bookingPayload(draft, quote);
      const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(payload));
      return journal.submit(session.user.id, digest, payload, {
        find: id => { if (!focused.current) throw new Error('booking.authRequired'); return findBookingRequest(client, id); },
        create: (id, request) => { if (!focused.current) throw new Error('booking.authRequired'); return createBooking(client, id, request); },
      });
    }),
    recover: () => run(async () => {
      const client = ownerClient(); if (!session) throw new Error('booking.authRequired');
      return journal.recover(session.user.id, id => findBookingRequest(client, id));
    }),
  };
}
