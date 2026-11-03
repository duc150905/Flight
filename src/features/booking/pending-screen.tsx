import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { databaseIdSchema } from '../../lib/database-id';
import { useAuth } from '../auth/auth-provider';
import { ActionButton, AuthShell } from '../auth/ui';
import { MoneyText } from '../currency/ui';
import { useLanguage } from '../i18n/provider';
import { formatDateTime, bookingStatusLabel } from '../tickets/presentation';
import { loadPendingBooking, holdSecondsRemaining,demoTicketReady, type PendingBooking } from './pending-booking';
import { CheckoutButton, CheckoutCard, CheckoutError, CheckoutShell, CheckoutText, useCheckoutColors } from './ui';
import {useMockCheckout,type MockCheckout} from './use-mock-checkout';
import {MockPaymentPanel} from './mock-payment-panel';
import {PaymentSuccessView} from './payment-success';
import {BookingManagementPanel} from './booking-management-panel';

export function PendingBookingScreen({receipt=false}:{receipt?:boolean}={}) {
  const { id } = useLocalSearchParams<{ id: string }>(); const { session, status } = useAuth(); const { t } = useLanguage();
  const validId = databaseIdSchema().safeParse(id).success;
  const enabled = !!session && status === 'ready' && validId;
  const [clockNow, setClockNow] = useState(() => performance.now());
  const query = useQuery({ queryKey: ['pending-booking', session?.user.id, id], enabled, retry: false, staleTime: 0, gcTime: 0,
    queryFn: async () => {
      if (!supabase) throw new Error('booking.loadError');
      const booking = await loadPendingBooking(supabase, id);
      const receivedAt = performance.now(); setClockNow(receivedAt);
      return { booking, receivedAt };
    } });
  const refetch = query.refetch; const expiredCheck = useRef<number | null>(null);
  const mock=useMockCheckout(id,enabled,()=>{void refetch();});
  useFocusEffect(useCallback(() => { if (enabled) void refetch(); }, [enabled, refetch]));
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setClockNow(performance.now()), 1000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refetch(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [enabled, refetch]);
  const data = query.data;
  const seconds = data ? holdSecondsRemaining(data.booking, clockNow - data.receivedAt) : 0;
  useEffect(() => {
    if (data && data.booking.status === 'pending_payment' && seconds === 0 && !query.isFetching && expiredCheck.current !== data.receivedAt) {
      expiredCheck.current = data.receivedAt; void refetch();
    }
  }, [seconds, data, query.isFetching, refetch]);
  if (status === 'loading') return <AuthShell><ActivityIndicator accessibilityLabel={t('Restoring session')} /></AuthShell>;
  if (!session || status !== 'ready') return <AuthShell><CheckoutText message="Sign in to resume your booking." /><ActionButton title={t('Sign in')} onPress={() => router.replace('/account')} /></AuthShell>;
  if (!validId) return <AuthShell><CheckoutError message="booking.notFound" /><ActionButton title={t('My bookings')} onPress={() => router.replace('/tickets')} /></AuthShell>;
  if (!data) return <CheckoutShell title="Payment" step={4} back={() => router.replace('/tickets')}>
    {query.isFetching ? <ActivityIndicator accessibilityLabel={t('Loading')} /> : <><CheckoutError message={query.error?.message ?? 'booking.loadError'} /><CheckoutButton title="Retry" onPress={() => { void refetch(); }} /></>}
  </CheckoutShell>;
  const booking=mock.state?{...data.booking,...mock.state.booking}:data.booking;
  if(booking.status==='confirmed'&&!demoTicketReady(booking))return <CheckoutShell title="mock.demoTicket" back={()=>router.replace('/tickets')}><CheckoutText message="mock.refreshTicket"/><CheckoutButton title="Refresh booking" onPress={()=>{void refetch();}}/></CheckoutShell>;
  if(receipt&&booking.status!=='confirmed')return <CheckoutShell title="mock.demoTicket" back={()=>router.replace('/tickets')}><CheckoutError message="mock.state"/><CheckoutButton title="mock.details" onPress={()=>router.replace({pathname:'/pending/[id]',params:{id:booking.id}})}/></CheckoutShell>;
  if(booking.status==='confirmed'&&!receipt)return <PaymentSuccessView booking={booking}/>;
  return <PendingBookingView booking={booking} mock={mock} receipt={receipt} seconds={seconds} refreshing={query.isFetching} error={query.error?.message} refresh={() => { void refetch();mock.refresh(); }} />;
}

/** Pure PDF-based presentation, also used for visual QA with synthetic data. */
export function PendingBookingView({ booking, seconds, refreshing = false, error, refresh,mock,receipt=false }: {
  booking: PendingBooking; seconds: number; refreshing?: boolean; error?: string; refresh(): void;mock?:MockCheckout;receipt?:boolean;
}) {
  const { t, language } = useLanguage(); const c = useCheckoutColors();
  const active = booking.status === 'pending_payment' && seconds > 0;
  const clock = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  return <CheckoutShell title={receipt?'mock.demoTicket':'Payment'} step={4} back={() => router.replace('/tickets')}
    savedTotal={{ amount: booking.total, count: booking.passengers.length,caption:'mock.noMoney' }}
    footer={{ title: active ? mock?.busy?'mock.processing':'mock.pay' : 'View booking details', disabled: active&&(!mock?.state||mock.busy||!!mock.error||mock.state.booking.status!=='pending_payment'),
      onPress: () => active?void mock?.pay():router.replace({ pathname: '/tickets/[id]', params: { id: booking.id } }) }}>
    <View style={[styles.notice, { backgroundColor: c.tint }]}>
      {receipt&&<CheckoutText muted message="mock.notBoardingPass"/>}
      <CheckoutText title>{t(bookingStatusLabel(booking.status))}</CheckoutText>
      <CheckoutText>{t('Booking reference')}: {booking.bookingCode}</CheckoutText>
      {active ? <>
        <CheckoutText title>{t('Time remaining')}: {clock}</CheckoutText>
        <CheckoutText muted message="mock.hold" />
      </> : <CheckoutText muted message={booking.status === 'pending_payment' ? 'Checking hold status. Refresh to confirm availability.' : booking.status === 'expired' ? 'Your hold expired. Search again to get current fares and seats.' : 'Open booking details to view the latest status.'} />}
      {refreshing && <ActivityIndicator accessibilityLabel={t('Refreshing booking')} />}
      <CheckoutError message={error} />
      <CheckoutButton title="Refresh booking" secondary disabled={refreshing} onPress={refresh} />
    </View>
    {!receipt&&<CheckoutCard>
      <CheckoutText title message="Payment method" />
      {mock?<MockPaymentPanel mock={mock}/>:<CheckoutText muted message="mock.noMoney"/>}
    </CheckoutCard>}
    <CheckoutCard><CheckoutText title message="Your flights" />
      {booking.segments.map(segment => <View key={segment.id} style={styles.group}>
        <CheckoutText title>{segment.snapshot.departure_iata} → {segment.snapshot.arrival_iata}</CheckoutText>
        <CheckoutText>{segment.snapshot.airline_name} · {segment.snapshot.flight_number}</CheckoutText>
        <CheckoutText muted>{formatDateTime(segment.snapshot.departure_at, segment.snapshot.departure_timezone, language)}</CheckoutText>
        <CheckoutText muted>{t(segment.snapshot.fare_name)}</CheckoutText>
      </View>)}
    </CheckoutCard>
    <CheckoutCard><CheckoutText title message="Traveller details" />
      {booking.passengers.map(person => <View key={person.id} style={styles.group}>
        <CheckoutText title>{person.givenNames} {person.familyName}</CheckoutText>
        {booking.passengerSegments.filter(ps => ps.passengerId === person.id).map(ps => {
          const seat = booking.seats.find(s => s.passengerSegmentId === ps.id);
          const segment = booking.segments.find(s => s.flightId === ps.flightId)!;
          const extras = booking.addons.filter(a => a.passengerSegmentId === ps.id);
          return <View key={ps.id} style={styles.group}>
            <CheckoutText muted>{segment.snapshot.departure_iata} → {segment.snapshot.arrival_iata} · {t(ps.passengerType)}</CheckoutText>
            <CheckoutText>{ps.requiresSeat && seat ? `${t('Seat')}: ${seat.seatCode}` : t('Infant travels on the accompanying adult’s lap.')}</CheckoutText>
            {seat && <CheckoutText muted message={seat.amount === 0 ? 'Seat assigned at no extra charge.' : 'Paid seat selection included in total.'} />}
            <CheckoutText muted>{t('Included baggage')}: {ps.allowance.cabin_kg} kg {t('Cabin baggage')} · {ps.allowance.checked_kg} kg {t('Checked baggage')}</CheckoutText>
            {extras.map((extra, i) => <CheckoutText key={i}>{t(extra.name)} · {extra.weightKg} kg</CheckoutText>)}
          </View>;
        })}
      </View>)}
    </CheckoutCard>
    <CheckoutCard><CheckoutText title message="Contact details" />
      <CheckoutText>{booking.contact.name}</CheckoutText>
      <CheckoutText>{booking.contact.email}</CheckoutText>
      <CheckoutText>{booking.contact.phone}</CheckoutText>
    </CheckoutCard>
    <CheckoutCard><CheckoutText title message="Price breakdown" />
      {(['base', 'tax', 'fee', 'baggage', 'seat'] as const).map(field => <View style={styles.price} key={field}>
        <CheckoutText message={`quote.${field}`} /><MoneyText amount={booking[field]} />
      </View>)}
    </CheckoutCard>
    {!active && booking.status === 'expired' && <CheckoutButton title="Search flights again" onPress={() => router.replace('/')} />}
    {mock&&<BookingManagementPanel mock={mock}/>}
  </CheckoutShell>;
}
const styles = StyleSheet.create({
  notice: { borderRadius: 12, padding: 16, gap: 12 }, method: { flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderRadius: 10, padding: 16 },
  group: { gap: 10 }, price: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
});
