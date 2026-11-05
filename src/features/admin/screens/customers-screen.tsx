import { loadAllRows } from '../complete-data';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { ActionButton, Notice } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import { loadAdminAccounts, type AdminAccount } from '../account-service';
import { customerSearchText, passengerSearchText } from '../customer-search';
import { useAdminI18n } from '../i18n';
import {
  filterAndPaginate,
  formatAdminError,
  type BookingPassengerRow,
  type BookingRow,
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
  const [accounts, bkRes, paxRes] = await Promise.all([
    loadAdminAccounts(supabase),
    loadAllRows((from, to) => (supabase!
      .from('bookings')
      .select('id,user_id,booking_code,status,total_amount,currency,contact_email,contact_phone')).order('id').range(from, to)),
    loadAllRows((from, to) => (supabase!.from('booking_passengers').select('*').order('created_at', { ascending: false })).order('id').range(from, to)),
  ]);

  if (bkRes.error) throw bkRes.error;
  if (paxRes.error) throw paxRes.error;

  return {
    accounts,
    bookings: bkRes.data ?? [],
    passengers: paxRes.data ?? [],
  };
}

export function AdminCustomersScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  return <AdminCustomersContent key={initialQuery} initialQuery={initialQuery} />;
}
function AdminCustomersContent({ initialQuery }: { initialQuery: string }) {
  const { language, ta, bi, money, airportTime } = useAdminI18n();

  const [tab, setTab] = useState<CustomerTab>('profiles');
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);

  const custQuery = useQuery({
    queryKey: ['admin-customers-bundle'],
    queryFn: loadCustomersBundle,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const profiles = (custQuery.data?.accounts ?? []).filter(account => account.role === 'customer');
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
    getSearchText: (pr: AdminAccount) => customerSearchText(pr, bookingsByUser.get(pr.id) ?? []),
  });

  const pagedPassengers = filterAndPaginate(passengers, {
    query,
    page,
    pageSize: 8,
    getSearchText: (pax: BookingPassengerRow) => passengerSearchText(pax, bookingById.get(pax.booking_id)),
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
              const accountEmail = pr.email || '—';

              return (
                <View key={pr.id} style={adminStyles.itemCard}>
                  <View style={adminStyles.rowBetween}>
                    <Text style={adminStyles.bold}>{pr.fullName}</Text>
                    <AdminStatusBadge
                      active
                      customLabel={bi(
                        `${userBookings.length} booking`,
                        `${userBookings.length} bookings`,
                      )}
                    />
                  </View>

                  <Text style={adminStyles.muted}>
                    📞 {pr.phone?.trim() ? (
                      pr.phone
                    ) : (
                      <Text style={{ fontStyle: 'italic', color: '#94A3B8' }}>
                        {bi('Chưa cập nhật SĐT', 'No phone')}
                      </Text>
                    )}{' '}
                    · 📧 {accountEmail}
                  </Text>

                  <Text style={adminStyles.muted}>
                    {bi('Tổng chi tiêu đã xác nhận:', 'Confirmed spend:')}{' '}
                    <Text style={adminStyles.bold}>{money(confirmedSpend)}</Text> ·{' '}
                    {bi('Ngày tham gia:', 'Joined:')}{' '}
                    {airportTime(pr.createdAt, 'Asia/Ho_Chi_Minh')}
                  </Text>

                  {userBookings.length > 0 && (
                    <View style={adminStyles.rowGap}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          router.push(
                            `/admin/bookings?ownerId=${encodeURIComponent(pr.id)}` as Href,
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

