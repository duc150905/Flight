import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { MoneyText } from '../currency/ui';
import { useLanguage } from '../i18n/provider';
import { useCheckout } from './checkout-provider';
import { classifyPassenger } from './passenger-policy';
import { checkoutReview } from './review';
import { Tabs } from './options-ui';
import { SeatGrid, SeatLegend } from './seat-grid';
import { seatChoiceCurrent } from './seats';
import { useSeatMap } from './use-seat-map';
import { CheckoutButton, CheckoutCard, CheckoutError, CheckoutShell, CheckoutText, MissingCheckout } from './ui';
export function SeatMapScreen({ flightId }: { flightId?: string }) {
  const draft = useCheckout(); const { t } = useLanguage();
  const leg = draft.itinerary?.legs.find(l => l.flightId === flightId);
  const query = useSeatMap(leg?.flightId); const refetch = query.refetch;
  useFocusEffect(useCallback(() => { if (leg) void refetch(); }, [refetch, leg]));
  const [person, selectPerson] = useState(''); const [error, setError] = useState('');
  if (!draft.itinerary || !leg) return <MissingCheckout />;
  if (!checkoutReview(draft).success) return <CheckoutShell title="Choose seats" step={3}><CheckoutError message="extras.checkDetails" />
    <CheckoutButton title="Edit travellers" onPress={() => router.dismissTo('/checkout/passengers')} /></CheckoutShell>;
  const passenger = draft.passengers.find(p => p.id === person) ?? draft.passengers[0];
  const choice = draft.seats.find(s => s.flightId === flightId && s.passengerId === passenger.id);
  const map = query.data?.filter(s => s.cabin_class === leg.cabinClass) ?? [];
  const infant = classifyPassenger(passenger.values.dateOfBirth.trim(), leg.departureDate) === 'infant';
  const stale = choice && query.data && !seatChoiceCurrent(choice, query.data, draft);
  return <CheckoutShell title="Choose seats" step={3} back={() => router.back()} footer={{ title: 'Done', onPress: () => router.back() }}
    footerDetail={<CheckoutText>{passenger.values.givenNames} · {choice?.seatCode ?? t('No paid seat selected')}</CheckoutText>}>
    <CheckoutText title>{leg.origin.iata_code} → {leg.destination.iata_code}</CheckoutText>
    <CheckoutText muted message="Seat selection is optional. Your fare includes travel in the selected cabin; choosing a specific seat costs extra." />
    <CheckoutText muted message="Skipping paid seat selection adds no selection fee. A suitable seat is assigned when you create your booking." />
    <CheckoutText muted>{leg.flightNumber} · {t(leg.fareName)}</CheckoutText>
    <Tabs label="Travellers" selected={passenger.id} onSelect={id => { selectPerson(id); setError(''); }} values={draft.passengers.map((p, i) => {
      const picked = draft.seats.find(s => s.flightId === flightId && s.passengerId === p.id);
      return { id: p.id, text: `${i + 1}. ${p.values.givenNames} · ${picked?.seatCode ?? '—'}` };
    })} />
    <SeatLegend /><CheckoutText muted message="Seat choices are not held." />
    <CheckoutText muted message="seats.exitRule" />
    {infant && <CheckoutText message="seats.infant" />}
    {query.isFetching && <ActivityIndicator accessibilityLabel={t('Loading')} />}
    {query.isError && <CheckoutError message={query.error.message} />}
    <CheckoutError message={error || (stale ? 'seats.changed' : undefined)} />
    <CheckoutButton title="Refresh seats" secondary disabled={query.isFetching} onPress={() => { void query.refetch(); }} />
    {!query.isError && query.data && !map.length && <CheckoutError message="seats.unavailable" />}
    {!query.isError && map.length > 0 && <SeatGrid map={map} draft={draft} leg={leg} passengerId={passenger.id} busy={query.isFetching} onError={setError} />}
    <CheckoutCard><CheckoutText title>{passenger.values.givenNames} · {choice?.seatCode ?? t('No paid seat selected')}</CheckoutText>
      <MoneyText amount={choice?.amount ?? 0} />
      {choice && <CheckoutButton title="Clear seat selection" secondary onPress={() => { draft.setSeat(passenger.id, leg.flightId, null); setError(''); }} />}
    </CheckoutCard>
  </CheckoutShell>;
}
