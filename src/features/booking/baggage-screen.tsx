import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { MoneyText } from '../currency/ui';
import { useLanguage } from '../i18n/provider';
import { isBaggageCurrent } from './baggage';
import { useCheckout, useCheckoutStore } from './checkout-provider';
import { loadBaggage } from './extras-data';
import { Option, Tabs } from './options-ui';
import { checkoutReview } from './review';
import { CheckoutButton, CheckoutCard, CheckoutError, CheckoutShell, CheckoutText, MissingCheckout } from './ui';

export function BaggageScreen() {
  const draft = useCheckout(); const store = useCheckoutStore(); const { t } = useLanguage();
  const [flight, setFlight] = useState(''); const [person, setPerson] = useState(''); const [error, setError] = useState('');
  const itinerary = draft.itinerary;
  const query = useQuery({ queryKey: ['checkout-baggage', itinerary?.selection], enabled: !!itinerary,
    queryFn: () => { if (!supabase || !itinerary) throw new Error('extras.loadError'); return loadBaggage(supabase, itinerary); }, staleTime: 0 });
  if (!itinerary) return <MissingCheckout />;
  if (!checkoutReview(draft).success) return <CheckoutShell title="Baggage" step={2}>
    <CheckoutError message="extras.checkDetails" /><CheckoutButton title="Edit travellers" onPress={() => router.dismissTo('/checkout/passengers')} />
  </CheckoutShell>;
  const leg = itinerary.legs.find(l => l.flightId === flight) ?? itinerary.legs[0];
  const passenger = draft.passengers.find(p => p.id === person) ?? draft.passengers[0];
  const current = draft.baggage.find(b => b.flightId === leg.flightId && b.passengerId === passenger.id);
  const stale = draft.baggage.some(b => !query.data || !isBaggageCurrent(b, query.data.offers));
  const allowance = query.data?.allowances[leg.flightId];
  async function next() {
    setError(''); const revision = store.getState().revision;
    const fresh = await query.refetch();
    if (fresh.error || !fresh.data) { setError('extras.loadError'); return; }
    if (revision !== store.getState().revision || store.getState().baggage.some(b => !isBaggageCurrent(b, fresh.data.offers))) {
      setError('extras.changed'); return;
    }
    router.push('/checkout/seats');
  }
  return <CheckoutShell title="Baggage" step={2} back={() => router.back()}
    footer={{ title: query.isFetching ? 'Loading' : 'Next', disabled: query.isFetching || !query.data || stale, onPress: () => { void next(); } }}>
    <Tabs label="Your flights" selected={leg.flightId} onSelect={setFlight} values={itinerary.legs.map(l => ({ id: l.flightId, text: `${l.origin.iata_code} → ${l.destination.iata_code}` }))} />
    <Tabs label="Travellers" selected={passenger.id} onSelect={setPerson} values={draft.passengers.map((p, i) => ({ id: p.id, text: `${i + 1}. ${p.values.givenNames} ${p.values.familyName}` }))} />
    {query.isFetching && <ActivityIndicator accessibilityLabel={t('Loading')} />}
    {(query.isError || error) && <><CheckoutError message={error || 'extras.loadError'} /><CheckoutButton title="Retry" secondary onPress={() => { void query.refetch(); }} /></>}
    {stale && query.data && <CheckoutError message="extras.changed" />}
    <CheckoutCard><CheckoutText title message="Cabin bags" />
      <CheckoutText>{allowance ? t('bags.allowance', { pieces: allowance.cabinPieces, kg: allowance.cabinKg }) : t('bags.allowanceUnavailable')}</CheckoutText>
      <CheckoutText muted message="Included in your fare" />
    </CheckoutCard>
    <CheckoutCard><CheckoutText title message="Checked bags" />
      <CheckoutText>{allowance ? t('bags.allowance', { pieces: allowance.checkedPieces, kg: allowance.checkedKg }) : t('bags.allowanceUnavailable')}</CheckoutText>
      <CheckoutText muted message="Included in your fare" />
      <Option title={t('No extra checked bag')} selected={!current} onPress={() => draft.setBaggage(passenger.id, leg.flightId, null)} />
      {query.data?.offers.filter(o => o.flightId === leg.flightId).map(o => <Option key={o.id} title={t('bags.package', { kg: o.weightKg })}
        selected={current?.offerId === o.id && isBaggageCurrent(current, [o])} onPress={() => { setError(''); draft.setBaggage(passenger.id, leg.flightId, o); }}>
        <MoneyText amount={o.amount} /></Option>)}
      {query.data && !query.data.offers.some(o => o.flightId === leg.flightId) && <CheckoutText muted message="No extra baggage available for this flight." />}
    </CheckoutCard>
    <CheckoutText muted message="Baggage is selected separately for each traveller and flight." />
  </CheckoutShell>;
}
