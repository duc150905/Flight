import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { ActionButton, Notice } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import { useAdminI18n } from '../i18n';
import {
  filterAndPaginate,
  formatAdminError,
  type BookingRow,
  type PaymentRow,
  type RefundRow,
} from '../model';
import {
  AdminLoadingState,
  AdminPaginationBar,
  AdminSearchFilterBar,
  AdminShell,
  AdminStatusBadge,
  adminStyles,
} from '../ui';

type PaymentTab = 'payments' | 'refunds';
type PaymentStatusFilter = 'all' | 'succeeded' | 'initiated' | 'failed' | 'cancelled';

async function loadPaymentsBundle() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const [payRes, refRes, bkRes] = await Promise.all([
    supabase.from('payments').select('*').order('created_at', { ascending: false }),
    supabase.from('refunds').select('*').order('created_at', { ascending: false }),
    supabase.from('bookings').select('id,booking_code,contact_name,contact_email,status'),
  ]);

  if (payRes.error) throw payRes.error;
  if (refRes.error) throw refRes.error;
  if (bkRes.error) throw bkRes.error;

  return {
    payments: payRes.data ?? [],
    refunds: refRes.data ?? [],
    bookings: bkRes.data ?? [],
  };
}

export function AdminPaymentsScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { language, ta, bi, money, airportTime } = useAdminI18n();

  const [tab, setTab] = useState<PaymentTab>('payments');
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('all');
  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [page, setPage] = useState(1);

  const payQuery = useQuery({
    queryKey: ['admin-payments-bundle'],
    queryFn: loadPaymentsBundle,
  });

  const payments = payQuery.data?.payments ?? [];
  const refunds = payQuery.data?.refunds ?? [];
  const bookings = payQuery.data?.bookings ?? [];

  const bookingById = new Map<string, Pick<BookingRow, 'id' | 'booking_code' | 'contact_name' | 'contact_email' | 'status'>>();
  for (const b of bookings) {
    bookingById.set(b.id, b);
  }

  const filteredPayments = payments.filter((p) =>
    statusFilter === 'all' ? true : p.status === statusFilter,
  );

  const pagedPayments = filterAndPaginate(filteredPayments, {
    query,
    page,
    pageSize: 8,
    getSearchText: (p: PaymentRow) => {
      const bk = bookingById.get(p.booking_id);
      return `${p.provider} ${p.provider_reference ?? ''} ${p.status} ${p.failure_code ?? ''} ${p.idempotency_key} ${bk?.booking_code ?? ''} ${bk?.contact_name ?? ''}`;
    },
  });

  const pagedRefunds = filterAndPaginate(refunds, {
    query,
    page,
    pageSize: 8,
    getSearchText: (r: RefundRow) => {
      const bk = bookingById.get(r.booking_id);
      return `${r.reason} ${r.status} ${r.provider_reference ?? ''} ${bk?.booking_code ?? ''}`;
    },
  });

  return (
    <AdminShell
      activeSection="payments"
      title={bi('Quản lý Thanh toán & Hoàn tiền', 'Payments & Refunds Management')}
      subtitle={bi(
        'Theo dõi các lần thanh toán mô phỏng, mã lỗi xử lý (failure_code), khóa chống trùng (idempotency_key) và hoàn tiền để hỗ trợ kiểm thử & vận hành.',
        'Monitor simulated payment attempts, failure codes, idempotency keys, and refunds for testing and operations.',
      )}
      onQuickSearch={(txt) => {
        setQuery(txt);
        setPage(1);
      }}
    >
      <View style={adminStyles.chipRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'payments' }}
          onPress={() => {
            setTab('payments');
            setPage(1);
          }}
          style={[adminStyles.chip, tab === 'payments' && adminStyles.chipSelected]}
        >
          <Text style={[adminStyles.chipText, tab === 'payments' && adminStyles.chipTextSelected]}>
            {bi(`Giao dịch thanh toán (${payments.length})`, `Payments (${payments.length})`)}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'refunds' }}
          onPress={() => {
            setTab('refunds');
            setPage(1);
          }}
          style={[adminStyles.chip, tab === 'refunds' && adminStyles.chipSelected]}
        >
          <Text style={[adminStyles.chipText, tab === 'refunds' && adminStyles.chipTextSelected]}>
            {bi(`Hoàn tiền (${refunds.length})`, `Refunds (${refunds.length})`)}
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
          'Tìm theo mã PNR, mã tham chiếu cổng TT, mã lỗi (failure_code) hoặc idempotency_key…',
          'Search by PNR, provider reference, failure_code, or idempotency_key…',
        )}
        onRefresh={() => void payQuery.refetch()}
      />

      {tab === 'payments' && (
        <View style={adminStyles.chipRow}>
          {(['all', 'succeeded', 'initiated', 'failed', 'cancelled'] as PaymentStatusFilter[]).map(
            (st) => {
              const selected = statusFilter === st;
              return (
                <Pressable
                  key={st}
                  accessibilityRole="button"
                  onPress={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  style={[adminStyles.chip, selected && adminStyles.chipSelected]}
                >
                  <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                    {st.toUpperCase()}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>
      )}

      {payQuery.isPending ? (
        <AdminLoadingState />
      ) : payQuery.isError ? (
        <View style={adminStyles.card}>
          <Notice text={formatAdminError(payQuery.error, language)} />
          <ActionButton
            title={ta('admin.action.retry')}
            secondary
            onPress={() => void payQuery.refetch()}
          />
        </View>
      ) : tab === 'payments' ? (
        pagedPayments.items.length === 0 ? (
          <View style={adminStyles.card}>
            <Text style={adminStyles.muted}>{ta('admin.empty')}</Text>
          </View>
        ) : (
          <>
            {pagedPayments.items.map((p) => {
              const bk = bookingById.get(p.booking_id);
              return (
                <View key={p.id} style={adminStyles.itemCard}>
                  <View style={adminStyles.rowBetween}>
                    <Text style={adminStyles.bold}>
                      {money(p.amount, p.currency)} · {p.provider.toUpperCase()}
                      {bk ? ` · PNR #${bk.booking_code}` : ''}
                    </Text>
                    <AdminStatusBadge
                      active={p.status === 'succeeded'}
                      customLabel={p.status.toUpperCase()}
                    />
                  </View>

                  <Text style={adminStyles.muted}>
                    {bi('Khách liên hệ:', 'Contact:')} {bk?.contact_name ?? '—'} (
                    {bk?.contact_email ?? '—'}) · Ref: {p.provider_reference ?? '—'}
                  </Text>

                  {!!p.failure_code && (
                    <Notice
                      text={bi(
                        `Mã lỗi thanh toán mô phỏng (failure_code): ${p.failure_code}`,
                        `Simulated payment failure_code: ${p.failure_code}`,
                      )}
                    />
                  )}

                  <Text style={adminStyles.helperText}>
                    Idempotency: {p.idempotency_key} · {bi('Tạo lúc:', 'Created:')}{' '}
                    {airportTime(p.created_at, 'Asia/Ho_Chi_Minh')}
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
                          {bi(`Xem đơn #${bk.booking_code} →`, `Inspect Booking #${bk.booking_code} →`)}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}

            <AdminPaginationBar
              page={pagedPayments.page}
              totalPages={pagedPayments.totalPages}
              total={pagedPayments.total}
              onPageChange={setPage}
            />
          </>
        )
      ) : pagedRefunds.items.length === 0 ? (
        <View style={adminStyles.card}>
          <Text style={adminStyles.muted}>{ta('admin.empty')}</Text>
        </View>
      ) : (
        <>
          {pagedRefunds.items.map((r) => {
            const bk = bookingById.get(r.booking_id);
            return (
              <View key={r.id} style={adminStyles.itemCard}>
                <View style={adminStyles.rowBetween}>
                  <Text style={adminStyles.bold}>
                    {money(r.amount, r.currency)}
                    {bk ? ` · PNR #${bk.booking_code}` : ''}
                  </Text>
                  <AdminStatusBadge
                    active={r.status === 'succeeded'}
                    customLabel={r.status.toUpperCase()}
                  />
                </View>
                <Text style={adminStyles.muted}>
                  {bi('Lý do hoàn tiền:', 'Refund reason:')} {r.reason}
                </Text>
                <Text style={adminStyles.helperText}>
                  {bi('Tạo lúc:', 'Created:')} {airportTime(r.created_at, 'Asia/Ho_Chi_Minh')}
                </Text>
              </View>
            );
          })}

          <AdminPaginationBar
            page={pagedRefunds.page}
            totalPages={pagedRefunds.totalPages}
            total={pagedRefunds.total}
            onPageChange={setPage}
          />
        </>
      )}
    </AdminShell>
  );
}
