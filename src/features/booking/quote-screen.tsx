import { router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/auth-provider';
import { CurrencyRateNote, MoneyText } from '../currency/ui';
import { useLanguage } from '../i18n/provider';
import { useCheckout } from './checkout-provider';
import { checkoutEstimate } from './estimate';
import { creationQuoteRefreshKey, expiredQuoteRefreshKey, quoteRequest, requestKey } from './quote';
import { loadQuote } from './quote-data';
import { checkoutReview } from './review';
import { useCreateBooking } from './use-create-booking';
import { CheckoutButton, CheckoutCard, CheckoutError, CheckoutShell, CheckoutText, MissingCheckout } from './ui';
export function QuoteScreen() {
  const draft = useCheckout(); const { session } = useAuth(); const { language, t } = useLanguage();
  const [now, setNow] = useState(Date.now); const [acknowledged, acknowledge] = useState('');
  const [focused, setFocused] = useState(false);
  const refreshedExpiry = useRef<string | null>(null);
  const refreshedCreationError = useRef<string | null>(null);
  const creation = useCreateBooking();
  const valid = checkoutReview(draft).success;
  const request = draft.itinerary ? quoteRequest(draft) : null;
  const key = request ? requestKey(request, draft.revision) : '';
  const query = useQuery({ queryKey: ['checkout-quote', session?.user.id, key], enabled: focused && valid && !!request && !!session,
    queryFn: async () => { if (!supabase || !request) throw new Error('quote.loadError'); const data = await loadQuote(supabase, request); setNow(Date.now()); return data; },
    retry: false, staleTime: 0, gcTime: 0 });
  const refetch = query.refetch;
  const ownerId = session?.user.id;
  useFocusEffect(useCallback(() => {
    setFocused(true); setNow(Date.now());
    if (valid && key && ownerId) void refetch();
    return () => setFocused(false);
  }, [valid, key, ownerId, refetch]));
  useEffect(() => {
    if (!focused || !valid || !key || !ownerId) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') { setNow(Date.now()); void refetch(); } });
    return () => { clearInterval(timer); listener.remove(); };
  }, [focused, valid, key, ownerId, refetch]);
  useEffect(() => {
    const refreshKey = expiredQuoteRefreshKey(query.data, key, now, {
      focused, valid, fetching: query.isFetching, failed: query.isError,
      creating: creation.busy, creationError: !!creation.error && creation.error !== 'booking.noSavedRequest',
    }, refreshedExpiry.current);
    if (refreshKey) { refreshedExpiry.current = refreshKey; void refetch(); }
  }, [query.data, key, now, focused, valid, query.isFetching, query.isError, creation.busy, creation.error, refetch]);
  useEffect(() => {
    if (!creation.error) { refreshedCreationError.current = null; return; }
    if (!focused || !valid || !ownerId || creation.busy || query.isFetching || query.isError) return;
    const refreshKey = creationQuoteRefreshKey(creation.error, key, refreshedCreationError.current);
    if (refreshKey) { refreshedCreationError.current = refreshKey; void refetch(); }
  }, [creation.error, creation.busy, focused, valid, ownerId, key, query.isFetching, query.isError, refetch]);
  if (!draft.itinerary) return <MissingCheckout />;
  if (!valid) return <CheckoutShell title="Quote summary" step={3}><CheckoutError message="extras.checkDetails" />
    <CheckoutButton title="Edit travellers" onPress={() => router.dismissTo('/checkout/passengers')} /></CheckoutShell>;
  const quote = query.data; const expired = !!quote && Date.parse(quote.expiresAt) <= now;
  const usable = quote && !expired && !query.isError && !query.isFetching;
  const estimate = checkoutEstimate(draft); const changed = !!quote && !!estimate && quote.total !== estimate.amount;
  const signature = `${key}:${quote?.quotedAt}`;
  return <CheckoutShell title="Quote summary" step={3} back={() => router.back()}>
    <CheckoutText muted message="Seat choices are not held." />
    <CheckoutText muted message="Review the price, then create your booking to hold seats. No payment is taken yet." />
    {creation.busy && <ActivityIndicator accessibilityLabel={t('Creating booking')} />}
    <CheckoutError message={creation.error} />
    {!!creation.error && <CheckoutButton title="Check saved booking" secondary disabled={creation.busy} onPress={() => { void creation.recover(); }} />}
    {query.isFetching && <><ActivityIndicator accessibilityLabel={t('Updating your quote…')} /><CheckoutText muted message="Updating your quote…" /></>}
    {query.isError && <CheckoutError message={query.error.message} />}
    {expired && !query.isFetching && <CheckoutError message="quote.expired" />}
    {query.isError && <CheckoutButton title="Retry" variant="text" disabled={query.isFetching || creation.busy} onPress={() => { void query.refetch(); }} />}
    {usable && <>
      {changed && <CheckoutError message="quote.changed" />}
      <CheckoutCard>
        <CheckoutText title message="Fare including taxes and fees" />
        <MoneyText amount={quote.base + quote.tax + quote.fee} />
        <CheckoutText muted message="Already included in the fare above; not charged again." />
        {(['base', 'tax', 'fee'] as const).map(field => <CheckoutCard key={field}>
        <CheckoutText message={`quote.${field}`} /><MoneyText amount={quote[field]} /></CheckoutCard>)}
        <CheckoutText muted message="Taxes and fare fees are configured per fare, not calculated from a fixed percentage." />
        <CheckoutText title message="Additional services" />
        {(['baggage', 'seat'] as const).map(field => <CheckoutCard key={field}>
          <CheckoutText message={`quote.${field}`} /><MoneyText amount={quote[field]} />
        </CheckoutCard>)}
        <CheckoutText title message="quote.total" /><MoneyText amount={quote.total} />
        <CurrencyRateNote />
        <CheckoutText muted>{t('quote.validUntil', { time: new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { timeStyle: 'short' }).format(new Date(quote.expiresAt)) })}</CheckoutText>
      </CheckoutCard>
      <CheckoutCard>{quote.lines.map(line => {
        const p = draft.passengers.find(p => p.id === line.passengerId)!; const leg = draft.itinerary!.legs.find(l => l.flightId === line.flightId)!;
        return <CheckoutCard key={`${line.flightId}:${line.passengerId}`}>
          <CheckoutText>{p.values.givenNames} {p.values.familyName} · {leg.origin.iata_code} → {leg.destination.iata_code}</CheckoutText>
          <CheckoutText muted>{t(line.passengerType)} · {line.seatCode ?? t('No paid seat selected')}</CheckoutText>
          {!!line.baggageName && <CheckoutText>{t(line.baggageName)}</CheckoutText>}
          <MoneyText amount={line.base + line.tax + line.fee + line.baggage + line.seat} />
        </CheckoutCard>;
      })}</CheckoutCard>
      {changed && <CheckoutButton title={acknowledged === signature ? 'Price reviewed' : 'I have reviewed this price'} disabled={acknowledged === signature} onPress={() => acknowledge(signature)} />}
      <CheckoutText muted message="Seats are held for up to 15 minutes after creating your booking. Automatic seat assignment is free; seats together are not guaranteed." />
      <CheckoutButton title="Create booking and hold seats" disabled={creation.busy || (changed && acknowledged !== signature)} onPress={() => { void creation.submit(quote); }} />
    </>}
  </CheckoutShell>;
}
