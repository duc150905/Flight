import { loadAllRows, loadAllAuditLogs } from '../complete-data';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { ActionButton, Notice } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import { useAdminI18n } from '../i18n';
import {
  filterAndPaginate,
  formatAdminError,
  type BookingPassengerRow,
  type BookingRow,
  type ProfileRow,
} from '../model';
import {
  AdminLoadingState,
  AdminPaginationBar,
  AdminSearchFilterBar,
  AdminShell,
  AdminStatusBadge,
  adminStyles,
} from '../ui';

type CustomerTab = 'profiles' | 'passengers';

async function loadCustomersBundle() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const [profRes, bkRes, paxRes, auditLogs] = await Promise.all([
    loadAllRows((from, to) => (supabase!.from('profiles').select('*').order('created_at', { ascending: false })).order('id').range(from, to)),
    loadAllRows((from, to) => (supabase!
      .from('bookings')
      .select('id,user_id,booking_code,status,total_amount,currency,contact_email,contact_phone')).order('id').range(from, to)),
    loadAllRows((from, to) => (supabase!.from('booking_passengers').select('*').order('created_at', { ascending: false })).order('id').range(from, to)),
    loadAllAuditLogs(supabase),
  ]);

  if (profRes.error) throw profRes.error;
  if (bkRes.error) throw bkRes.error;
  if (paxRes.error) throw paxRes.error;

  const adminActorIds = new Set<string>();
  for (const log of auditLogs) {
    if (log.actor_user_id) adminActorIds.add(log.actor_user_id);
  }

  return {
    profiles: profRes.data ?? [],
    bookings: bkRes.data ?? [],
    passengers: paxRes.data ?? [],
    adminActorIds: Array.from(adminActorIds),
  };
}

export function AdminCustomersScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { session } = useAuth();
  const { language, ta, bi, money, airportTime } = useAdminI18n();

  const [tab, setTab] = useState<CustomerTab>('profiles');
  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [page, setPage] = useState(1);

  const custQuery = useQuery({
    queryKey: ['admin-customers-bundle'],
    queryFn: loadCustomersBundle,
  });

  const adminIdSet = new Set<string>(custQuery.data?.adminActorIds ?? []);
  if (session?.user?.id) {
    adminIdSet.add(session.user.id);
  }

  // Exclude Admin accounts from Customer Profiles list
  const profiles = (custQuery.data?.profiles ?? []).filter((pr) => !adminIdSet.has(pr.id));
  const bookings = custQuery.data?.bookings ?? [];
  const passengers = custQuery.data?.passengers ?? [];

  const bookingsByUser = new Map<string, BookingRow[]>();
  const bookingById = new Map<string, BookingRow>();
  for (const b of bookings) {
    bookingById.set(b.id, b as BookingRow);
    const list = bookingsByUser.get(b.user_id) ?? [];
    list.push(b as BookingRow);
    bookingsByUser.set(b.user_id, list);
  }

  const pagedProfiles = filterAndPaginate(profiles, {
    query,
    page,
    pageSize: 8,
    getSearchText: (pr: ProfileRow) => {
      const userBks = bookingsByUser.get(pr.id) ?? [];
      const emails = userBks.map((b) => b.contact_email).join(' ');
      return `${pr.full_name} ${pr.contact_phone ?? ''} ${pr.id} ${emails}`;
    },
  });

  const pagedPassengers = filterAndPaginate(passengers, {
    query,
    page,
    pageSize: 8,
    getSearchText: (pax: BookingPassengerRow) => {
      const bk = bookingById.get(pax.booking_id);
      return `${pax.family_name} ${pax.given_names} ${pax.document_number ?? ''} ${pax.nationality_code ?? ''} ${bk?.booking_code ?? ''}`;
    },
  });

  return (
    <AdminShell
      activeSection="customers"
      title={bi('Quản lý Khách hàng & Hành khách', 'Customers & Travelers Management')}
      subtitle={bi(
        'Tra cứu tài khoản khách hàng đăng ký (profiles), lịch sử đặt chỗ và danh sách hành khách bay trên các đơn (booking_passengers).',
        'Inspect registered customer profiles, booking history, and traveler manifests across bookings.',
      )}
      onQuickSearch={(txt) => {
        setQuery(txt);
        setPage(1);
      }}
    >
      <View style={adminStyles.chipRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'profiles' }}
          onPress={() => {
            setTab('profiles');
            setPage(1);
          }}
          style={[adminStyles.chip, tab === 'profiles' && adminStyles.chipSelected]}
        >
          <Text style={[adminStyles.chipText, tab === 'profiles' && adminStyles.chipTextSelected]}>
            {bi(`Tài khoản khách hàng (${profiles.length})`, `Customer Profiles (${profiles.length})`)}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'passengers' }}
          onPress={() => {
            setTab('passengers');
            setPage(1);
          }}
          style={[adminStyles.chip, tab === 'passengers' && adminStyles.chipSelected]}
        >
          <Text
            style={[adminStyles.chipText, tab === 'passengers' && adminStyles.chipTextSelected]}
          >
            {bi(`Hành khách trên vé (${passengers.length})`, `Ticketed Passengers (${passengers.length})`)}
          </Text>
        </Pressable>
      </View>

      <AdminSearchFilterBar
        query={query}
        onQueryChange={(val) => {
          setQuery(val);
          setPage(1);
        }}
        placeholder={bi(
          'Tìm theo họ tên, số điện thoại, số CCCD/Hộ chiếu hoặc mã đơn PNR…',
          'Search by name, phone, passport/ID number, or PNR…',
        )}
        onRefresh={() => void custQuery.refetch()}
      />

      {custQuery.isPending ? (
        <AdminLoadingState />
      ) : custQuery.isError ? (
        <View style={adminStyles.card}>
          <Notice text={formatAdminError(custQuery.error, language)} />
          <ActionButton
            title={ta('admin.action.retry')}
            secondary
            onPress={() => void custQuery.refetch()}
          />
        </View>
      ) : tab === 'profiles' ? (
        pagedProfiles.items.length === 0 ? (
          <View style={adminStyles.card}>
            <Text style={adminStyles.muted}>{ta('admin.empty')}</Text>
          </View>
        ) : (
          <>
            {pagedProfiles.items.map((pr) => {
              const userBookings = bookingsByUser.get(pr.id) ?? [];
              const confirmedSpend = userBookings
                .filter((b) => b.status === 'confirmed')
                .reduce((sum, b) => sum + (b.total_amount || 0), 0);
              const latestEmail = userBookings[0]?.contact_email ?? '—';

              return (
                <View key={pr.id} style={adminStyles.itemCard}>
                  <View style={adminStyles.rowBetween}>
                    <Text style={adminStyles.bold}>{pr.full_name}</Text>
                    <AdminStatusBadge
                      active
                      customLabel={bi(
                        `${userBookings.length} booking`,
                        `${userBookings.length} bookings`,
                      )}
                    />
                  </View>

                  <Text style={adminStyles.muted}>
                    📞 {pr.contact_phone ?? bi('Chưa cập nhật SĐT', 'No phone')} · 📧 {latestEmail}
                  </Text>

                  <Text style={adminStyles.muted}>
                    {bi('Tổng chi tiêu đã xác nhận:', 'Confirmed spend:')}{' '}
                    <Text style={adminStyles.bold}>{money(confirmedSpend)}</Text> ·{' '}
                    {bi('Ngày tham gia:', 'Joined:')}{' '}
                    {airportTime(pr.created_at, 'Asia/Ho_Chi_Minh')}
                  </Text>

                  {userBookings.length > 0 && (
                    <View style={adminStyles.rowGap}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          router.push(
                            `/admin/bookings?q=${encodeURIComponent(userBookings[0].booking_code)}` as Href,
                          )
                        }
                        style={adminStyles.secondaryBtnSmall}
                      >
                        <Text style={adminStyles.secondaryBtnText}>
                          {bi('Xem các Booking của khách →', 'View Customer Bookings →')}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}

            <AdminPaginationBar
              page={pagedProfiles.page}
              totalPages={pagedProfiles.totalPages}
              total={pagedProfiles.total}
              onPageChange={setPage}
            />
          </>
        )
      ) : pagedPassengers.items.length === 0 ? (
        <View style={adminStyles.card}>
          <Text style={adminStyles.muted}>{ta('admin.empty')}</Text>
        </View>
      ) : (
        <>
          {pagedPassengers.items.map((pax) => {
            const bk = bookingById.get(pax.booking_id);
            return (
              <View key={pax.id} style={adminStyles.itemCard}>
                <View style={adminStyles.rowBetween}>
                  <Text style={adminStyles.bold}>
                    {pax.family_name} {pax.given_names}
                    {pax.gender ? ` (${pax.gender})` : ''}
                  </Text>
                  <AdminStatusBadge
                    active={bk?.status === 'confirmed'}
                    customLabel={bk ? `PNR #${bk.booking_code}` : 'PASSENGER'}
                  />
                </View>
                <Text style={adminStyles.muted}>
                  🎂 {bi('Ngày sinh:', 'DOB:')} {pax.date_of_birth} · 🪪{' '}
                  {pax.document_type ?? 'ID'}: {pax.document_number ?? '—'} · 🌐{' '}
                  {pax.nationality_code ?? 'VN'}
                </Text>
                {bk && (
                  <View style={adminStyles.rowGap}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push(
                          `/admin/bookings?q=${encodeURIComponent(bk.booking_code)}` as Href,
                        )
                      }
                      style={adminStyles.secondaryBtnSmall}
                    >
                      <Text style={adminStyles.secondaryBtnText}>
                        {bi(`Mở đơn #${bk.booking_code} →`, `Open Booking #${bk.booking_code} →`)}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}

          <AdminPaginationBar
            page={pagedPassengers.page}
            totalPages={pagedPassengers.totalPages}
            total={pagedPassengers.total}
            onPageChange={setPage}
          />
        </>
      )}
    </AdminShell>
  );
}

