import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-provider';
import { ActionButton, Notice } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import { createTicketService, ticketErrorMessage, type TicketDetails } from './model';
import { bookingStatusLabel, cabinClassLabel, flightSnapshotSummary, formatDateTime, formatMoney, tripTypeLabel } from './presentation';
import { TicketBack, TicketState, ticketStyles } from './ui';

type DetailState = { ownerId: string; bookingId: string; status: 'loading' | 'ready' | 'error';
  details: TicketDetails | null; error: string };
const service = supabase ? createTicketService(supabase) : null;

export function TicketDetailScreen() {
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

  if (status === 'loading') return <TicketState title="Chi tiết đơn vé" description="Đang kiểm tra phiên đăng nhập…" loading />;
  if (status === 'error') return <TicketState title="Chi tiết đơn vé" description={authError ?? 'Không thể khôi phục phiên.'}
    action="Thử lại" onAction={retryAuth} />;
  if (!session) return <TicketState title="Chi tiết đơn vé" description="Đăng nhập để xem đơn vé của bạn."
    action="Về đăng nhập" onAction={() => router.replace('/')} />;
  if (!service || !bookingId) return <TicketState title="Chi tiết đơn vé" description="Đường dẫn đơn vé không hợp lệ."
    action="Về danh sách" onAction={() => router.replace('/tickets')} />;
  if (current.status === 'loading') return <TicketState title="Chi tiết đơn vé" description="Đang tải đơn vé…" loading />;
  if (current.status === 'error' || !current.details) return <TicketState title="Chi tiết đơn vé"
    description={current.error || 'Không thể tải đơn vé.'} action="Thử lại" onAction={reload}>
    <ActionButton title="Về danh sách" secondary onPress={() => router.replace('/tickets')} />
  </TicketState>;

  const { booking, segments, passengers } = current.details;
  return <SafeAreaView style={ticketStyles.safe}>
    <ScrollView contentContainerStyle={ticketStyles.content}>
      <TicketBack label="Vé của tôi" onPress={() => router.replace('/tickets')} />
      <Text accessibilityRole="header" style={ticketStyles.title}>Đơn {booking.booking_code}</Text>
      <Text style={ticketStyles.status}>{bookingStatusLabel(booking.status)}</Text>
      <View style={ticketStyles.card}>
        <Text style={ticketStyles.cardTitle}>Thông tin đơn</Text>
        <Info label="Hành trình" value={tripTypeLabel(booking.trip_type)} />
        <Info label="Đặt lúc" value={formatDateTime(booking.created_at)} />
        {booking.status === 'pending_payment' && <Info label="Hạn thanh toán" value={formatDateTime(booking.expires_at)} />}
        {booking.confirmed_at && <Info label="Xác nhận lúc" value={formatDateTime(booking.confirmed_at)} />}
        {booking.cancelled_at && <Info label="Hủy lúc" value={formatDateTime(booking.cancelled_at)} />}
      </View>
      <View style={ticketStyles.card}>
        <Text style={ticketStyles.cardTitle}>Các chặng bay</Text>
        {segments.length === 0 && <Text style={ticketStyles.body}>Chưa có chặng bay trong đơn này.</Text>}
        {segments.map(segment => {
          const flight = flightSnapshotSummary(segment.flight_snapshot);
          return <View key={segment.id} style={{ gap: 5 }}>
            <Text style={ticketStyles.strong}>Hành trình {segment.journey_number} · Chặng {segment.leg_number}</Text>
            <Text style={ticketStyles.body}>{flight.departureCode ?? 'Sân bay đi'} → {flight.arrivalCode ?? 'Sân bay đến'}</Text>
            {flight.flightNumber && <Text style={ticketStyles.label}>
              {flight.airlineName ? `${flight.airlineName} · ` : ''}{flight.flightNumber}
            </Text>}
            {flight.departureAt && <Info label="Khởi hành" value={flightTime(flight.departureAt, flight.departureTimezone)} />}
            {flight.arrivalAt && <Info label="Đến nơi" value={flightTime(flight.arrivalAt, flight.arrivalTimezone)} />}
            <Text style={ticketStyles.label}>{cabinClassLabel(segment.cabin_class)} · Giá vé {segment.fare_code_snapshot}</Text>
            <View style={ticketStyles.divider} />
          </View>;
        })}
      </View>
      <View style={ticketStyles.card}>
        <Text style={ticketStyles.cardTitle}>Hành khách</Text>
        {passengers.length === 0 && <Text style={ticketStyles.body}>Chưa có hành khách trong đơn này.</Text>}
        {passengers.map(person => <Text key={person.id} style={ticketStyles.body}>
          {person.ordinal}. {person.family_name} {person.given_names}
        </Text>)}
      </View>
      <View style={ticketStyles.card}>
        <Text style={ticketStyles.cardTitle}>Liên hệ đơn vé</Text>
        <Info label="Người liên hệ" value={booking.contact_name} />
        <Info label="Email" value={booking.contact_email} />
        <Info label="Số điện thoại" value={booking.contact_phone} />
      </View>
      <View style={ticketStyles.card}>
        <Text style={ticketStyles.cardTitle}>Tổng tiền mô phỏng</Text>
        <Info label="Giá vé" value={formatMoney(booking.base_amount, booking.currency)} />
        <Info label="Thuế" value={formatMoney(booking.tax_amount, booking.currency)} />
        <Info label="Phí" value={formatMoney(booking.fee_amount, booking.currency)} />
        <Info label="Ghế" value={formatMoney(booking.seat_amount, booking.currency)} />
        <Info label="Dịch vụ" value={formatMoney(booking.addon_amount, booking.currency)} />
        <View style={ticketStyles.divider} />
        <Info label="Tổng cộng" value={formatMoney(booking.total_amount, booking.currency)} />
      </View>
      <Notice text={booking.status === 'confirmed' ? '' : 'Chỉ đơn đã xác nhận mới là vé hợp lệ để bay.'} />
    </ScrollView>
  </SafeAreaView>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={ticketStyles.row}>
    <Text style={ticketStyles.label}>{label}</Text>
    <Text style={[ticketStyles.body, ticketStyles.column, { textAlign: 'right' }]}>{value}</Text>
  </View>;
}

function flightTime(value: string, timeZone: string | null) {
  return timeZone ? formatDateTime(value, timeZone) : 'Chưa có múi giờ sân bay';
}
