import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/auth-provider';
import { CurrencyRateNote, MoneyText } from '../currency/ui';
import { useLanguage } from '../i18n/provider';
import { useCheckout } from './checkout-provider';
import { checkoutEstimate } from './estimate';
import { quoteRequest, requestKey } from './quote';
import { loadQuote } from './quote-data';
import { checkoutReview } from './review';
import { CheckoutButton, CheckoutCard, CheckoutError, CheckoutShell, CheckoutText, MissingCheckout } from './ui';
export function QuoteScreen() {
  const draft = useCheckout(); const { session } = useAuth(); const { language, t } = useLanguage();
  const [now, setNow] = useState(Date.now); const [acknowledged, acknowledge] = useState('');
  const valid = checkoutReview(draft).success;
  const request = draft.itinerary ? quoteRequest(draft) : null;
  const key = request ? requestKey(request, draft.revision) : '';
  const query = useQuery({ queryKey: ['checkout-quote', session?.user.id, key], enabled: valid && !!request,
    queryFn: async () => { if (!supabase || !request) throw new Error('quote.loadError'); const data = await loadQuote(supabase, request); setNow(Date.now()); return data; },
    retry: false, staleTime: 0, gcTime: 0 });
  const refetch = query.refetch;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') { setNow(Date.now()); void refetch(); } });
    return () => { clearInterval(timer); listener.remove(); };
  }, [refetch]);
  if (!draft.itinerary) return <MissingCheckout />;
  if (!valid) return <CheckoutShell title="Quote summary" step={3}><CheckoutError message="extras.checkDetails" />
    <CheckoutButton title="Edit travellers" onPress={() => router.dismissTo('/checkout/passengers')} /></CheckoutShell>;
  const quote = query.data; const expired = !!quote && Date.parse(quote.expiresAt) <= now;
  const usable = quote && !expired && !query.isError && !query.isFetching;
  const estimate = checkoutEstimate(draft); const changed = !!quote && !!estimate && quote.total !== estimate.amount;
  const signature = `${key}:${quote?.quotedAt}`;
  return <CheckoutShell title="Quote summary" step={3} back={() => router.back()}>
    <CheckoutText muted message="Seat choices are not held." />
    <CheckoutText muted message="This is a quote only. Booking and payment are not completed." />
    {query.isFetching && <ActivityIndicator accessibilityLabel={t('Loading')} />}
    {query.isError && <CheckoutError message={query.error.message} />}
    {expired && <CheckoutError message="quote.expired" />}
    <CheckoutButton title="Refresh quote" secondary disabled={query.isFetching} onPress={() => { void query.refetch(); }} />
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
        <CheckoutText title message="Total from server" /><MoneyText amount={quote.total} />
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
      <CheckoutButton title={acknowledged === signature ? 'Price reviewed' : 'I have reviewed this price'} disabled={acknowledged === signature} onPress={() => acknowledge(signature)} />
    </>}
  </CheckoutShell>;
}
