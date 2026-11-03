import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-provider';
import { ActionButton, Notice } from '@/features/auth/ui';
import { useLanguage } from '@/features/i18n/provider';
import type { Language } from '@/features/i18n/language';
import { supabase } from '@/lib/supabase';
import { createTicketService, ticketErrorMessage, type TicketDetails } from './model';
import { bookingStatusLabel, cabinClassLabel, flightSnapshotSummary, formatDateTime, formatMoney, tripTypeLabel } from './presentation';
import { TicketBack, TicketState, ticketStyles } from './ui';

type DetailState = { ownerId: string; bookingId: string; status: 'loading' | 'ready' | 'error';
  details: TicketDetails | null; error: string };
const service = supabase ? createTicketService(supabase) : null;

export function TicketDetailScreen() {
  const { t, language } = useLanguage();
  const params = useLocalSearchParams<{ id: string }>();
  const bookingId = typeof params.id === 'string' ? params.id : '';
  const { session, status, error: authError, retry: retryAuth } = useAuth();
  const userId = session?.user.id ?? '';
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DetailState>({ ownerId: '', bookingId: '', status: 'loading', details: null, error: '' });
  useEffect(() => {
    let active = true;
    if (!service || !userId || !bookingId || status !== 'ready') return;
    service.details(userId, bookingId).then(details => {
      if (active) setState({ ownerId: userId, bookingId, status: 'ready', details, error: '' });
    }).catch(error => {
      if (active) setState({ ownerId: userId, bookingId, status: 'error', details: null, error: ticketErrorMessage(error) });
    });
    return () => { active = false; };
  }, [userId, bookingId, status, attempt]);
  const reload = () => {
    setState({ ownerId: userId, bookingId, status: 'loading', details: null, error: '' });
    setAttempt(value => value + 1);
  };
  const current = state.ownerId === userId && state.bookingId === bookingId
    ? state : { status: 'loading' as const, details: null, error: '' };

  if (status === 'loading') return <TicketState title={t('Chi tiết đơn vé')} description={t('Đang kiểm tra phiên đăng nhập…')} loading />;
  if (status === 'error') return <TicketState title={t('Chi tiết đơn vé')} description={t(authError ?? 'Không thể khôi phục phiên.')}
    action={t('Thử lại')} onAction={retryAuth} />;
  if (!session) return <TicketState title={t('Chi tiết đơn vé')} description={t('Đăng nhập để xem đơn vé của bạn.')}
    action={t('Về đăng nhập')} onAction={() => router.replace('/account')} />;
  if (!service || !bookingId) return <TicketState title={t('Chi tiết đơn vé')} description={t('Đường dẫn đơn vé không hợp lệ.')}
    action={t('Về danh sách')} onAction={() => router.replace('/tickets')} />;
  if (current.status === 'loading') return <TicketState title={t('Chi tiết đơn vé')} description={t('Đang tải đơn vé…')} loading />;
  if (current.status === 'error' || !current.details) return <TicketState title={t('Chi tiết đơn vé')}
    description={t(current.error || 'Không thể tải đơn vé.')} action={t('Thử lại')} onAction={reload}>
    <ActionButton title={t('Về danh sách')} secondary onPress={() => router.replace('/tickets')} />
  </TicketState>;

  const { booking, segments, passengers } = current.details;
  const date = (value: string) => formatDateTime(value, null, language);
  const money = (amount: number) => formatMoney(amount, booking.currency, language);
  return <SafeAreaView style={ticketStyles.safe}>
    <ScrollView contentContainerStyle={ticketStyles.content}>
      <TicketBack label={t('Vé của tôi')} onPress={() => router.replace('/tickets')} />
      <Text accessibilityRole="header" style={ticketStyles.title}>{t('Đơn {code}', { code: booking.booking_code })}</Text>
      <Text style={ticketStyles.status}>{t(bookingStatusLabel(booking.status))}</Text>
      {booking.status === 'pending_payment' && <ActionButton title={t('Resume pending booking')}
        onPress={() => router.push({ pathname: '/pending/[id]', params: { id: booking.id } })} />}
      <View style={ticketStyles.card}>
        <Text style={ticketStyles.cardTitle}>{t('Thông tin đơn')}</Text>
        <Info label={t('Hành trình')} value={t(tripTypeLabel(booking.trip_type))} />
        <Info label={t('Đặt lúc')} value={date(booking.created_at)} />
        {booking.status === 'pending_payment' && <Info label={t('Hạn thanh toán')} value={date(booking.expires_at)} />}
        {booking.confirmed_at && <Info label={t('Xác nhận lúc')} value={date(booking.confirmed_at)} />}
        {booking.cancelled_at && <Info label={t('Hủy lúc')} value={date(booking.cancelled_at)} />}
      </View>
      <View style={ticketStyles.card}>
        <Text style={ticketStyles.cardTitle}>{t('Các chặng bay')}</Text>
        {segments.length === 0 && <Text style={ticketStyles.body}>{t('Chưa có chặng bay trong đơn này.')}</Text>}
        {segments.map(segment => {
          const flight = flightSnapshotSummary(segment.flight_snapshot);
          return <View key={segment.id} style={{ gap: 5 }}>
            <Text style={ticketStyles.strong}>{t('Hành trình {journey} · Chặng {leg}', {
              journey: segment.journey_number, leg: segment.leg_number,
            })}</Text>
            <Text style={ticketStyles.body}>{flight.departureCode ?? t('Sân bay đi')} → {flight.arrivalCode ?? t('Sân bay đến')}</Text>
            {flight.flightNumber && <Text style={ticketStyles.label}>
              {flight.airlineName ? `${flight.airlineName} · ` : ''}{flight.flightNumber}
            </Text>}
            {flight.departureAt && <Info label={t('Khởi hành')} value={flightTime(flight.departureAt, flight.departureTimezone, language, t)} />}
            {flight.arrivalAt && <Info label={t('Đến nơi')} value={flightTime(flight.arrivalAt, flight.arrivalTimezone, language, t)} />}
            <Text style={ticketStyles.label}>{t(cabinClassLabel(segment.cabin_class))} · {t('Giá vé')} {segment.fare_code_snapshot}</Text>
            <View style={ticketStyles.divider} />
          </View>;
        })}
      </View>
      <View style={ticketStyles.card}>
        <Text style={ticketStyles.cardTitle}>{t('Hành khách')}</Text>
        {passengers.length === 0 && <Text style={ticketStyles.body}>{t('Chưa có hành khách trong đơn này.')}</Text>}
        {passengers.map(person => <Text key={person.id} style={ticketStyles.body}>
          {person.ordinal}. {person.family_name} {person.given_names}
        </Text>)}
      </View>
      <View style={ticketStyles.card}>
        <Text style={ticketStyles.cardTitle}>{t('Liên hệ đơn vé')}</Text>
        <Info label={t('Người liên hệ')} value={booking.contact_name} />
        <Info label="Email" value={booking.contact_email} />
        <Info label={t('Số điện thoại')} value={booking.contact_phone} />
      </View>
      <View style={ticketStyles.card}>
        <Text style={ticketStyles.cardTitle}>{t('Tổng tiền mô phỏng')}</Text>
        <Info label={t('Giá vé')} value={money(booking.base_amount)} />
        <Info label={t('Thuế')} value={money(booking.tax_amount)} />
        <Info label={t('Phí')} value={money(booking.fee_amount)} />
        <Info label={t('Ghế')} value={money(booking.seat_amount)} />
        <Info label={t('Dịch vụ')} value={money(booking.addon_amount)} />
        <View style={ticketStyles.divider} />
        <Info label={t('Tổng cộng')} value={money(booking.total_amount)} />
      </View>
      <Notice text={booking.status === 'confirmed' ? '' : t('Chỉ đơn đã xác nhận mới là vé hợp lệ để bay.')} />
    </ScrollView>
  </SafeAreaView>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={ticketStyles.row}>
    <Text style={ticketStyles.label}>{label}</Text>
    <Text style={[ticketStyles.body, ticketStyles.column, { textAlign: 'right' }]}>{value}</Text>
  </View>;
}

function flightTime(value: string, timeZone: string | null, language: Language, t: (message: string) => string) {
  return timeZone ? formatDateTime(value, timeZone, language) : t('Chưa có múi giờ sân bay');
}
