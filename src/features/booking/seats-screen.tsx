import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MoneyText } from '../currency/ui';
import { useLanguage } from '../i18n/provider';
import { useCheckout, useCheckoutStore } from './checkout-provider';
import { classifyPassenger } from './passenger-policy';
import { checkoutReview } from './review';
import { loadSeatMap } from './seats-data';
import { validateSelectedSeats } from './seats';
import { createStepRequestGuard } from './step-request';
import { CheckoutButton, CheckoutCard, CheckoutError, CheckoutShell, CheckoutText, MissingCheckout } from './ui';
export function SeatsScreen() {
  const draft = useCheckout(); const store = useCheckoutStore(); const { t } = useLanguage();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [guard] = useState(createStepRequestGuard);
  useFocusEffect(useCallback(() => { setBusy(false); return guard.cancel; }, [guard]));
  if (!draft.itinerary) return <MissingCheckout />;
  if (!checkoutReview(draft).success) return <CheckoutShell title="Seats" step={3}><CheckoutError message="extras.checkDetails" />
    <CheckoutButton title="Edit travellers" onPress={() => router.dismissTo('/checkout/passengers')} /></CheckoutShell>;
  async function next() {
    setBusy(true); setError(''); const state = store.getState(); const revision = state.revision; const token = guard.begin();
    try {
      if (!supabase || !state.itinerary) throw new Error('seats.loadError');
      const client = supabase;
      await validateSelectedSeats(state, id => loadSeatMap(client, id));
      if (!guard.isCurrent(token)) return;
      if (store.getState().revision !== revision) throw new Error('seats.changed');
      router.push('/checkout/quote');
    } catch (e) { if (guard.isCurrent(token)) setError(e instanceof Error ? e.message : 'seats.loadError'); }
    finally { if (guard.isCurrent(token)) setBusy(false); }
  }
  return <CheckoutShell title="Seats" step={3} back={() => router.back()}
    footer={{ title: busy ? 'Loading' : 'Review quote', disabled: busy, onPress: () => { void next(); } }}>
    <CheckoutText muted message="Choose a seat for each flight, or skip paid seat selection." />
    <CheckoutText muted message="Seat choices are not held." /><CheckoutError message={error} />
    {draft.itinerary.legs.map(leg => <CheckoutCard key={leg.flightId}>
      <CheckoutText title>{leg.origin.iata_code} → {leg.destination.iata_code}</CheckoutText>
      <CheckoutText muted>{leg.flightNumber} · {leg.fareName}</CheckoutText>
      {draft.passengers.map(p => {
        const choice = draft.seats.find(s => s.flightId === leg.flightId && s.passengerId === p.id);
        const infant = classifyPassenger(p.values.dateOfBirth.trim(), leg.departureDate) === 'infant';
        return <CheckoutCard key={p.id}><CheckoutText>{p.values.givenNames} {p.values.familyName}</CheckoutText>
          <CheckoutText muted>{infant ? t('seats.infant') : choice?.seatCode ?? t('No paid seat selected')}</CheckoutText>
          {choice && <MoneyText amount={choice.amount} />}</CheckoutCard>;
      })}
      <CheckoutButton title="Choose seats" secondary onPress={() => router.push({ pathname: '/checkout/seat-map', params: { flightId: leg.flightId } })} />
    </CheckoutCard>)}
  </CheckoutShell>;
}
