import { loadAllRows } from '../complete-data';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { selectOwnerBookings } from '../customer-search';
import { bookingFlightDetails } from '../booking-details';
import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { ActionButton, Notice } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import { useAdminI18n } from '../i18n';
import {
  filterAndPaginate,
  formatAdminError,
  type BookingEventRow,
  type BookingPassengerRow,
  type BookingRow,
  type BookingSegmentRow,
} from '../model';
import {
  AdminLoadingState,
  AdminPaginationBar,
  AdminSearchFilterBar,
  AdminShell,
  AdminStatusBadge,
  adminStyles,
} from '../ui';

type BookingStatusFilter = 'all' | 'confirmed' | 'pending_payment' | 'cancelled' | 'expired';

async function loadAdminBookingsBundle() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const [bkRes, paxRes, segRes, evtRes, seatRes, addonRes] = await Promise.all([
    loadAllRows((from, to) => (supabase!.from('bookings').select('*').order('created_at', { ascending: false })).order('id').range(from, to)),
    loadAllRows((from, to) => (supabase!.from('booking_passengers').select('*').order('ordinal', { ascending: true })).order('id').range(from, to)),
    loadAllRows((from, to) => (supabase!.from('booking_segments').select('*').order('journey_number', { ascending: true })).order('id').range(from, to)),
    loadAllRows((from, to) => (supabase!.from('booking_events').select('*').order('created_at', { ascending: false })).order('id').range(from, to)),
    loadAllRows((from, to) => supabase!.from('seat_reservations').select('*,flight_seats(seat_code),booking_passenger_segments(passenger_id)').order('id').range(from, to)),
    loadAllRows((from, to) => supabase!.from('booking_addons').select('*,booking_passenger_segments(passenger_id)').order('id').range(from, to)),
  ]);

  if (bkRes.error) throw bkRes.error;
  if (paxRes.error) throw paxRes.error;
  if (segRes.error) throw segRes.error;
  if (evtRes.error) throw evtRes.error;
  if (seatRes.error) throw seatRes.error;
  if (addonRes.error) throw addonRes.error;

  const paxByBooking: Record<string, BookingPassengerRow[]> = {};
  for (const p of paxRes.data ?? []) {
    const list = paxByBooking[p.booking_id] ?? [];
    list.push(p);
    paxByBooking[p.booking_id] = list;
  }

  const segByBooking: Record<string, BookingSegmentRow[]> = {};
  for (const s of segRes.data ?? []) {
    const list = segByBooking[s.booking_id] ?? [];
    list.push(s);
    segByBooking[s.booking_id] = list;
  }

  const evtByBooking: Record<string, BookingEventRow[]> = {};
  for (const e of evtRes.data ?? []) {
    const list = evtByBooking[e.booking_id] ?? [];
    list.push(e);
    evtByBooking[e.booking_id] = list;
  }

  return {
    bookings: bkRes.data ?? [],
    paxByBooking,
    segByBooking,
    evtByBooking,
    reservations: seatRes.data,
    addons: addonRes.data,
  };
}

export function AdminBookingsScreen() {
  const params = useLocalSearchParams<{ q?: string; ownerId?: string; bookingId?: string }>();
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  const ownerId = typeof params.ownerId === 'string' ? params.ownerId : undefined;
  const bookingId = typeof params.bookingId === 'string' ? params.bookingId : undefined;
  return <AdminBookingsContent key={JSON.stringify([initialQuery, ownerId, bookingId])} initialQuery={initialQuery} ownerId={ownerId} bookingId={bookingId} />;
}
function AdminBookingsContent({ initialQuery, ownerId, bookingId }: { initialQuery: string; ownerId?: string; bookingId?: string }) {
  const { language, ta, bi, money, airportTime } = useAdminI18n();

  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(bookingId ?? null);

  const bookingsQuery = useQuery({
    queryKey: ['admin-bookings-bundle'],
    queryFn: loadAdminBookingsBundle,
  });

  const bookings = bookingsQuery.data?.bookings ?? [];
  const paxByBooking = bookingsQuery.data?.paxByBooking ?? {};
  const segByBooking = bookingsQuery.data?.segByBooking ?? {};
  const evtByBooking = bookingsQuery.data?.evtByBooking ?? {};

  const ownerBookings = selectOwnerBookings(bookings, ownerId).filter(b => !bookingId || b.id === bookingId);
  const statusFiltered = ownerBookings.filter(b => statusFilter === 'all' || b.status === statusFilter);

  const pagedBookings = filterAndPaginate(statusFiltered, {
    query,
    page,
    pageSize: 8,
    getSearchText: (bk: BookingRow) => {
      const paxNames = (paxByBooking[bk.id] ?? [])
        .map((p) => `${p.family_name} ${p.given_names} ${p.document_number ?? ''}`)
        .join(' ');
      return `${bk.id} ${bk.user_id} ${bk.booking_code} ${bk.contact_name} ${bk.contact_email} ${bk.contact_phone} ${bk.status} ${paxNames}`;
    },
  });

  const statusChips: { key: BookingStatusFilter; label: string }[] = [
    { key: 'all', label: bi(`Tất cả (${ownerBookings.length})`, `All (${ownerBookings.length})`) },
    {
      key: 'confirmed',
      label: bi(
        `Đã xác nhận (${ownerBookings.filter((b) => b.status === 'confirmed').length})`,
        `Confirmed (${ownerBookings.filter((b) => b.status === 'confirmed').length})`,
      ),
    },
    {
      key: 'pending_payment',
      label: bi(
        `Chờ thanh toán (${ownerBookings.filter((b) => b.status === 'pending_payment').length})`,
        `Pending (${ownerBookings.filter((b) => b.status === 'pending_payment').length})`,
      ),
    },
    {
      key: 'cancelled',
      label: bi(
        `Đã hủy (${ownerBookings.filter((b) => b.status === 'cancelled').length})`,
        `Cancelled (${ownerBookings.filter((b) => b.status === 'cancelled').length})`,
      ),
    },
    {
      key: 'expired',
      label: bi(
        `Hết hạn (${ownerBookings.filter((b) => b.status === 'expired').length})`,
        `Expired (${ownerBookings.filter((b) => b.status === 'expired').length})`,
      ),
    },
  ];

  const formatTripType = (tripType: string) => {
    switch (tripType) {
      case 'one_way':
        return bi('Một chiều', 'One-way');
      case 'round_trip':
        return bi('Khứ hồi', 'Round-trip');
      case 'multi_city':
        return bi('Nhiều chặng', 'Multi-city');
      default:
        return tripType;
    }
  };

  const formatBookingStatus = (status: string) => {
    switch (status) {
      case 'confirmed':
        return bi('ĐÃ XÁC NHẬN', 'CONFIRMED');
      case 'pending_payment':
        return bi('CHỜ THANH TOÁN', 'PENDING PAYMENT');
      case 'cancelled':
        return bi('ĐÃ HỦY', 'CANCELLED');
      case 'expired':
        return bi('HẾT HẠN', 'EXPIRED');
      default:
        return status.toUpperCase();
    }
  };

  const formatGender = (gender?: string | null) => {
    if (!gender) return '';
    const g = gender.toLowerCase().trim();
    if (g === 'male' || g === 'm') return bi('Nam', 'Male');
    if (g === 'female' || g === 'f') return bi('Nữ', 'Female');
    return bi('Khác', 'Other');
  };

  const formatEventInfo = (ev: BookingEventRow) => {
    let icon = '📌';
    let title = ev.event_type;
    let desc = ev.safe_message;

    switch (ev.event_type) {
      case 'created':
        icon = '📝';
        title = bi('Khởi tạo đơn đặt vé', 'Booking Created');
        desc = bi('Đơn hàng đã được tạo; đang chờ khách hàng thanh toán.', 'Booking created; awaiting payment.');
        break;
      case 'payment_started':
        icon = '💳';
        title = bi('Bắt đầu thanh toán', 'Payment Started');
        desc = bi('Khách hàng tiến hành phiên giao dịch thanh toán.', 'Customer initiated payment session.');
        break;
      case 'payment_succeeded':
        icon = '💰';
        title = bi('Thanh toán thành công', 'Payment Succeeded');
        desc = bi('Giao dịch thanh toán được ghi nhận thành công.', 'Payment confirmed successfully.');
        break;
      case 'payment_failed':
        icon = '⚠️';
        title = bi('Thanh toán thất bại', 'Payment Failed');
        desc = bi('Giao dịch thanh toán không thành công hoặc bị từ chối.', 'Payment failed or declined.');
        break;
      case 'payment_cancelled':
        icon = '🚫';
        title = bi('Hủy giao dịch thanh toán', 'Payment Cancelled');
        desc = bi('Giao dịch thanh toán đã bị hủy.', 'Payment transaction was cancelled.');
        break;
      case 'checkout_updated':
        icon = '✏️';
        title = bi('Cập nhật đơn đặt vé', 'Booking Updated');
        desc = bi('Thông tin hành trình hoặc liên hệ đã được cập nhật.', 'Itinerary or contact details updated.');
        break;
      case 'seat_changed':
        icon = '💺';
        title = bi('Thay đổi chỗ ngồi', 'Seat Changed');
        desc = bi('Vị trí ghế ngồi đã được cập nhật.', 'Seat selection updated.');
        break;
      case 'confirmed':
        icon = '✅';
        title = bi('Đã xác nhận đặt chỗ', 'Booking Confirmed');
        desc = bi('Đơn đặt chỗ đã được xác nhận vé chính thức.', 'Booking officially confirmed.');
        break;
      case 'expired':
        icon = '⏰';
        title = bi('Hết hạn thanh toán', 'Hold Expired');
        desc = bi('Hết thời gian giữ chỗ; đơn đặt vé tự động hết hạn.', 'Hold time expired; booking expired.');
        break;
      case 'cancelled':
        icon = '❌';
        title = bi('Đã hủy đơn đặt vé', 'Booking Cancelled');
        desc = bi('Đơn đặt chỗ đã bị hủy.', 'Booking has been cancelled.');
        break;
      case 'refund_requested':
      case 'refund_started':
        icon = '🔄';
        title = bi('Yêu cầu hoàn tiền', 'Refund Requested');
        desc = bi('Hệ thống tiếp nhận yêu cầu hoàn tiền cho đơn.', 'Refund request submitted.');
        break;
      case 'refund_succeeded':
        icon = '💵';
        title = bi('Hoàn tiền thành công', 'Refund Succeeded');
        desc = bi('Đã xử lý hoàn tiền thành công cho khách hàng.', 'Refund processed successfully.');
        break;
      case 'refund_failed':
        icon = '⚠️';
        title = bi('Hoàn tiền thất bại', 'Refund Failed');
        desc = bi('Giao dịch hoàn tiền gặp sự cố hoặc bị từ chối.', 'Refund transaction failed.');
        break;
      default:
        title = ev.event_type;
        break;
    }

    if (ev.safe_message === 'Mock payment result recorded.') {
      if (ev.event_type === 'payment_cancelled') {
        desc = bi('Giao dịch thanh toán đã bị hủy.', 'Payment transaction was cancelled.');
      } else if (ev.event_type === 'payment_succeeded') {
        desc = bi('Giao dịch thanh toán được ghi nhận thành công.', 'Payment transaction recorded successfully.');
      } else if (ev.event_type === 'payment_failed') {
        desc = bi('Giao dịch thanh toán không thành công hoặc bị từ chối.', 'Payment failed or declined.');
      }
    }

    const statusLabel = (s?: string | null) => {
      if (!s || s === '—') return null;
      switch (s) {
        case 'pending_payment':
          return bi('Chờ thanh toán', 'Pending');
        case 'confirmed':
          return bi('Đã xác nhận', 'Confirmed');
        case 'cancelled':
          return bi('Đã hủy', 'Cancelled');
        case 'expired':
          return bi('Hết hạn', 'Expired');
        default:
          return s;
      }
    };

    const fromLabel = statusLabel(ev.from_status);
    const toLabel = statusLabel(ev.to_status);
    let transition: string | null = null;
    if (fromLabel && toLabel && fromLabel !== toLabel) {
      transition = `${fromLabel} → ${toLabel}`;
    } else if (toLabel && !fromLabel) {
      transition = `→ ${toLabel}`;
    }

    return { icon, title, desc, transition };
  };

  return (
    <AdminShell
      activeSection="bookings"
      title={bi('Quản lý Đơn đặt chỗ', 'Bookings Management')}
      subtitle={bi(
        'Tra cứu đơn đặt vé theo mã PNR, tên hành khách, email, số điện thoại và trạng thái. Trạng thái đơn chỉ chuyển qua luồng giữ ghế & thanh toán hợp lệ của server.',
        'Search bookings by PNR, passenger, email, phone, and status. Booking states are strictly governed by server-side seat-hold & payment rules.',
      )}
      onQuickSearch={(txt) => {
        setQuery(txt);
        setPage(1);
      }}
    >
      {(ownerId || bookingId) && <View style={adminStyles.card}><Text style={adminStyles.muted}>{ownerId ? bi(`Tất cả đơn của tài khoản: ${ownerId}`, `All orders for account: ${ownerId}`) : bi(`Đơn: ${bookingId}`, `Booking: ${bookingId}`)}</Text><ActionButton secondary title={bi('Bỏ lọc liên kết', 'Clear linked filter')} onPress={() => router.replace('/admin/bookings')} /></View>}
      <AdminSearchFilterBar
        query={query}
        onQueryChange={(val) => {
          setQuery(val);
          setPage(1);
        }}
        placeholder={bi(
          'Nhập mã đơn (PNR), tên người liên hệ, email, SĐT hoặc tên hành khách…',
          'Search by PNR code, contact name, email, phone, or passenger name…',
        )}
        onRefresh={() => void bookingsQuery.refetch()}
      />

      {/* Booking Status Chips */}
      <View style={adminStyles.chipRow}>
        {statusChips.map((chip) => {
          const selected = statusFilter === chip.key;
          return (
            <Pressable
              key={chip.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setStatusFilter(chip.key);
                setPage(1);
              }}
              style={[adminStyles.chip, selected && adminStyles.chipSelected]}
            >
              <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {bookingsQuery.isPending ? (
        <AdminLoadingState />
      ) : bookingsQuery.isError ? (
        <View style={adminStyles.card}>
          <Notice text={formatAdminError(bookingsQuery.error, language)} />
          <ActionButton
            title={ta('admin.action.retry')}
            secondary
            onPress={() => void bookingsQuery.refetch()}
          />
        </View>
      ) : pagedBookings.items.length === 0 ? (
        <View style={adminStyles.card}>
          <Text style={adminStyles.muted}>{ta('admin.empty')}</Text>
        </View>
      ) : (
        <>
          {pagedBookings.items.map((bk) => {
            const paxList = paxByBooking[bk.id] ?? [];
            const segList = segByBooking[bk.id] ?? [];
            const evtList = evtByBooking[bk.id] ?? [];
            const isExpanded = expandedBookingId === bk.id;

            return (
              <View key={bk.id} style={adminStyles.itemCard}>
                <View style={adminStyles.rowBetween}>
                  <Text style={adminStyles.bold}>
                    #{bk.booking_code} · {bk.contact_name} ({formatTripType(bk.trip_type)})
                  </Text>
                  <AdminStatusBadge
                    active={bk.status === 'confirmed'}
                    customLabel={formatBookingStatus(bk.status)}
                  />
                </View>

                <Text style={adminStyles.muted}>
                  📧 {bk.contact_email || '—'} · 📞 {bk.contact_phone?.trim() ? (
                    bk.contact_phone
                  ) : (
                    <Text style={{ fontStyle: 'italic', color: '#94A3B8' }}>
                      {bi('Chưa cập nhật SĐT', 'No phone')}
                    </Text>
                  )} · 👥 {paxList.length}{' '}
                  {bi('hành khách', 'passengers')} · ✈ {segList.length}{' '}
                  {bi('chặng bay', 'segments')}
                </Text>

                <Text style={adminStyles.muted}>
                  {bi('Tổng thanh toán:', 'Total amount:')}{' '}
                  <Text style={adminStyles.bold}>{money(bk.total_amount, bk.currency)}</Text> (
                  {bi('Giá vé:', 'Base:')} {money(bk.base_amount)} +{' '}
                  {bi('Thuế/Phí:', 'Tax/Fee:')} {money(bk.tax_amount + bk.fee_amount)} +{' '}
                  {bi('Ghế/Dịch vụ:', 'Seat/Add-ons:')} {money(bk.seat_amount + bk.addon_amount)})
                </Text>

                <Text style={adminStyles.muted}>
                  {bi('Ngày tạo:', 'Created:')}{' '}
                  {airportTime(bk.created_at, 'Asia/Ho_Chi_Minh')}
                  {bk.confirmed_at
                    ? ` · ${bi('Xác nhận:', 'Confirmed:')} ${airportTime(bk.confirmed_at, 'Asia/Ho_Chi_Minh')}`
                    : ''}
                </Text>

                <View style={adminStyles.rowGap}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setExpandedBookingId(isExpanded ? null : bk.id)}
                    style={adminStyles.primaryBtnSmall}
                  >
                    <Text style={adminStyles.primaryBtnText}>
                      {isExpanded
                        ? bi('Đóng chi tiết đơn', 'Hide Booking Details')
                        : bi('Xem chi tiết Hành khách & Chặng bay', 'Inspect Passengers & Segments')}
                    </Text>
                  </Pressable>
                </View>

                {isExpanded && (
                  <View style={[adminStyles.card, { marginTop: 8, backgroundColor: '#F8FAFC' }]}>
                    {/* Passengers */}
                    <Text style={adminStyles.bold}>
                      👥 {bi(`Danh sách hành khách (${paxList.length})`, `Passengers (${paxList.length})`)}
                    </Text>
                    {paxList.length === 0 ? (
                      <Text style={adminStyles.muted}>
                        {bi('Không có dữ liệu hành khách.', 'No passenger records.')}
                      </Text>
                    ) : (
                      paxList.map((p) => (
                        <View key={p.id} style={adminStyles.rowBetween}>
                          <Text style={adminStyles.label}>
                            {p.ordinal}. {p.family_name} {p.given_names}
                            {p.gender ? ` (${formatGender(p.gender)})` : ''}
                          </Text>
                          <Text style={adminStyles.muted}>
                            {bi('Ngày sinh:', 'DOB:')} {p.date_of_birth} · {p.document_type ?? 'CCCD/Hộ chiếu'}:{' '}
                            {p.document_number ?? '—'}
                          </Text>
                        </View>
                      ))
                    )}

                    <View style={adminStyles.divider} />

                    {/* Segments */}
                    <Text style={adminStyles.bold}>
                      ✈ {bi(`Chặng bay (${segList.length})`, `Flight Segments (${segList.length})`)}
                    </Text>
                    {segList.map((seg) => {
                      const flight = bookingFlightDetails(seg.flight_snapshot);
                      const reservations = (bookingsQuery.data?.reservations ?? []).filter(row => row.booking_id === bk.id && row.flight_id === seg.flight_id);
                      const addons = (bookingsQuery.data?.addons ?? []).filter(row => row.booking_id === bk.id && row.flight_id === seg.flight_id);
                      const passengerName = (id: string | undefined) => { const passenger = paxList.find(row => row.id === id); return passenger ? passenger.family_name + ' ' + passenger.given_names : '—'; };
                      return <View key={seg.id} style={adminStyles.itemCard}>
                        <Text style={adminStyles.bold}>{flight.flightNumber} · {flight.airlineName} · {flight.departureIata} → {flight.arrivalIata}</Text>
                        <Text style={adminStyles.muted}>{bi('Khởi hành', 'Departure')}: {flight.departureAt ? airportTime(flight.departureAt, flight.departureTimezone) : '—'} · {flight.departureTimezone}</Text>
                        <Text style={adminStyles.muted}>{bi('Đến', 'Arrival')}: {flight.arrivalAt ? airportTime(flight.arrivalAt, flight.arrivalTimezone) : '—'} · {flight.arrivalTimezone}</Text>
                        <Text style={adminStyles.label}>{bi('Chặng', 'Leg')} {seg.journey_number}.{seg.leg_number} · {seg.cabin_class.toUpperCase()} ({seg.fare_code_snapshot})</Text>
                        <Text style={adminStyles.bold}>{bi('Ghế', 'Seats')}</Text>
                        {reservations.length === 0 && <Text style={adminStyles.muted}>—</Text>}
                        {reservations.map(row => <Text key={row.id} style={adminStyles.muted}>{passengerName(row.booking_passenger_segments?.passenger_id)} · {row.flight_seats?.seat_code ?? '—'} · {row.status} · {money(row.selection_amount, row.currency)}</Text>)}
                        <Text style={adminStyles.bold}>{bi('Dịch vụ đã đặt', 'Booked add-ons')}</Text>
                        {addons.length === 0 && <Text style={adminStyles.muted}>—</Text>}
                        {addons.map(row => <Text key={row.id} style={adminStyles.muted}>{passengerName(row.booking_passenger_segments?.passenger_id)} · {row.product_name_snapshot}{row.weight_kg_snapshot ? ' · ' + row.weight_kg_snapshot + ' kg' : ''} × {row.quantity} · {money(row.total_amount ?? row.unit_amount * row.quantity, row.currency)}</Text>)}
                      </View>;
                    })}

                    {evtList.length > 0 && (
                      <>
                        <View style={adminStyles.divider} />
                        <Text style={[adminStyles.bold, { marginBottom: 8 }]}>
                          🕒 {bi('Lịch sử trạng thái đơn', 'Booking Event Timeline')}
                        </Text>
                        {[...evtList]
                          .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
                          .map((ev) => {
                          const info = formatEventInfo(ev);
                          return (
                            <View
                              key={ev.id}
                              style={{
                                backgroundColor: '#FFFFFF',
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                                borderRadius: 8,
                                padding: 10,
                                marginBottom: 8,
                              }}
                            >
                              <View style={adminStyles.rowBetween}>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      fontWeight: '700',
                                      color: '#0F172A',
                                    }}
                                  >
                                    {info.icon} {info.title}
                                  </Text>
                                  {info.transition && (
                                    <View
                                      style={{
                                        backgroundColor: '#F1F5F9',
                                        paddingHorizontal: 8,
                                        paddingVertical: 2,
                                        borderRadius: 4,
                                      }}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 11,
                                          fontWeight: '600',
                                          color: '#475569',
                                        }}
                                      >
                                        {info.transition}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={adminStyles.helperText}>
                                  {airportTime(ev.created_at, 'Asia/Ho_Chi_Minh')}
                                </Text>
                              </View>
                              <Text style={[adminStyles.muted, { marginTop: 4, fontSize: 12 }]}>
                                {info.desc}
                              </Text>
                            </View>
                          );
                        })}
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          <AdminPaginationBar
            page={pagedBookings.page}
            totalPages={pagedBookings.totalPages}
            total={pagedBookings.total}
            onPageChange={setPage}
          />
        </>
      )}
    </AdminShell>
  );
}

