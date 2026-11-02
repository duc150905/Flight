import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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
  const [bkRes, paxRes, segRes, evtRes] = await Promise.all([
    supabase.from('bookings').select('*').order('created_at', { ascending: false }),
    supabase.from('booking_passengers').select('*').order('ordinal', { ascending: true }),
    supabase.from('booking_segments').select('*').order('journey_number', { ascending: true }),
    supabase.from('booking_events').select('*').order('created_at', { ascending: false }),
  ]);

  if (bkRes.error) throw bkRes.error;
  if (paxRes.error) throw paxRes.error;
  if (segRes.error) throw segRes.error;
  if (evtRes.error) throw evtRes.error;

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
  };
}

export function AdminBookingsScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { language, ta, bi, money, airportTime } = useAdminI18n();

  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  const bookingsQuery = useQuery({
    queryKey: ['admin-bookings-bundle'],
    queryFn: loadAdminBookingsBundle,
  });

  const bookings = bookingsQuery.data?.bookings ?? [];
  const paxByBooking = bookingsQuery.data?.paxByBooking ?? {};
  const segByBooking = bookingsQuery.data?.segByBooking ?? {};
  const evtByBooking = bookingsQuery.data?.evtByBooking ?? {};

  const statusFiltered = bookings.filter((b) =>
    statusFilter === 'all' ? true : b.status === statusFilter,
  );

  const pagedBookings = filterAndPaginate(statusFiltered, {
    query,
    page,
    pageSize: 8,
    getSearchText: (bk: BookingRow) => {
      const paxNames = (paxByBooking[bk.id] ?? [])
        .map((p) => `${p.family_name} ${p.given_names} ${p.document_number ?? ''}`)
        .join(' ');
      return `${bk.booking_code} ${bk.contact_name} ${bk.contact_email} ${bk.contact_phone} ${bk.status} ${paxNames}`;
    },
  });

  const statusChips: { key: BookingStatusFilter; label: string }[] = [
    { key: 'all', label: bi(`Tất cả (${bookings.length})`, `All (${bookings.length})`) },
    {
      key: 'confirmed',
      label: bi(
        `Đã xác nhận (${bookings.filter((b) => b.status === 'confirmed').length})`,
        `Confirmed (${bookings.filter((b) => b.status === 'confirmed').length})`,
      ),
    },
    {
      key: 'pending_payment',
      label: bi(
        `Chờ thanh toán (${bookings.filter((b) => b.status === 'pending_payment').length})`,
        `Pending (${bookings.filter((b) => b.status === 'pending_payment').length})`,
      ),
    },
    {
      key: 'cancelled',
      label: bi(
        `Đã hủy (${bookings.filter((b) => b.status === 'cancelled').length})`,
        `Cancelled (${bookings.filter((b) => b.status === 'cancelled').length})`,
      ),
    },
    {
      key: 'expired',
      label: bi(
        `Hết hạn (${bookings.filter((b) => b.status === 'expired').length})`,
        `Expired (${bookings.filter((b) => b.status === 'expired').length})`,
      ),
    },
  ];

  return (
    <AdminShell
      activeSection="bookings"
      title={bi('Quản lý Đơn đặt chỗ (Bookings — F10)', 'Bookings Management (F10)')}
      subtitle={bi(
        'Tra cứu đơn đặt vé theo mã PNR, tên hành khách, email, số điện thoại và trạng thái. Trạng thái đơn chỉ chuyển qua luồng giữ ghế & thanh toán hợp lệ của server.',
        'Search bookings by PNR, passenger, email, phone, and status. Booking states are strictly governed by server-side seat-hold & payment rules.',
      )}
      onQuickSearch={(txt) => {
        setQuery(txt);
        setPage(1);
      }}
    >
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
                    #{bk.booking_code} · {bk.contact_name} ({bk.trip_type})
                  </Text>
                  <AdminStatusBadge
                    active={bk.status === 'confirmed'}
                    customLabel={bk.status.toUpperCase()}
                  />
                </View>

                <Text style={adminStyles.muted}>
                  📧 {bk.contact_email} · 📞 {bk.contact_phone} · 👥 {paxList.length}{' '}
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
                    <Notice
                      text={bi(
                        'Quy tắc F10: Trạng thái đơn (pending_payment / confirmed / cancelled / expired) được đồng bộ nguyên tử với kho ghế và giao dịch thanh toán trên server; không cho phép sửa tay tùy ý.',
                        'F10 Rule: Booking status is atomically synchronized with seat inventory and payment transactions on the server; arbitrary manual overrides are disabled.',
                      )}
                      success
                    />

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
                            {p.gender ? ` (${p.gender})` : ''}
                          </Text>
                          <Text style={adminStyles.muted}>
                            DOB: {p.date_of_birth} · {p.document_type ?? 'ID'}:{' '}
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
                    {segList.map((seg) => (
                      <View key={seg.id} style={adminStyles.rowBetween}>
                        <Text style={adminStyles.label}>
                          {bi('Chặng', 'Leg')} {seg.journey_number}.{seg.leg_number} ·{' '}
                          {seg.cabin_class.toUpperCase()} ({seg.fare_code_snapshot})
                        </Text>
                        <Text style={adminStyles.muted}>Flight ID: #{seg.flight_id.slice(0, 8)}</Text>
                      </View>
                    ))}

                    {evtList.length > 0 && (
                      <>
                        <View style={adminStyles.divider} />
                        <Text style={adminStyles.bold}>
                          🕒 {bi('Lịch sử trạng thái đơn', 'Booking Event Timeline')}
                        </Text>
                        {evtList.map((ev) => (
                          <View key={ev.id} style={adminStyles.rowBetween}>
                            <Text style={adminStyles.muted}>
                              [{ev.event_type}] {ev.from_status ?? '—'} → {ev.to_status ?? '—'}:{' '}
                              {ev.safe_message}
                            </Text>
                            <Text style={adminStyles.helperText}>
                              {ev.created_at.slice(0, 19).replace('T', ' ')}
                            </Text>
                          </View>
                        ))}
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

