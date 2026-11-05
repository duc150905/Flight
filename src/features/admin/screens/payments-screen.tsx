import { loadAllRows } from '../complete-data';
import { AdminVnpayReview } from '../vnpay-review';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Platform, Pressable, Text, View } from 'react-native';
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
  adminStyles,
} from '../ui';

type PaymentTab = 'payments' | 'refunds' | 'review';
type PaymentStatusFilter = 'all' | PaymentRow['status'];
type SortOrder = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';

const PAYMENT_STATUS_OPTIONS: { key: PaymentStatusFilter; vi: string; en: string }[] = [
  { key: 'all', vi: 'Tất cả', en: 'All' },
  { key: 'succeeded', vi: 'Thành công', en: 'Succeeded' },
  { key: 'pending', vi: 'Chờ thanh toán', en: 'Pending' },
  { key: 'failed', vi: 'Thất bại', en: 'Failed' },
  { key: 'cancelled', vi: 'Đã hủy', en: 'Cancelled' },
];

const SORT_OPTIONS: { key: SortOrder; vi: string; en: string }[] = [
  { key: 'newest', vi: 'Mới nhất', en: 'Newest' },
  { key: 'oldest', vi: 'Cũ nhất', en: 'Oldest' },
  { key: 'amount_desc', vi: 'Số tiền: Cao ➔ Thấp', en: 'Amount: High ➔ Low' },
  { key: 'amount_asc', vi: 'Số tiền: Thấp ➔ Cao', en: 'Amount: Low ➔ High' },
];

function formatPaymentProvider(provider: string, bi: (vi: string, en: string) => string) {
  const norm = (provider || '').toLowerCase();
  if (norm.includes('vnpay')) return bi('Cổng VNPAY (Thử nghiệm)', 'VNPAY Sandbox');
  if (norm === 'mock') return bi('Thử nghiệm (Mock)', 'Test Payment (Mock)');
  return provider.toUpperCase();
}

function getPaymentStatusMeta(
  status: PaymentRow['status'],
  bi: (vi: string, en: string) => string,
  bookingStatus?: string,
) {
  if (status === 'pending' && (bookingStatus === 'cancelled' || bookingStatus === 'expired')) {
    return {
      label: bi('Đã hủy (Hết hạn giữ chỗ)', 'Cancelled (Hold Expired)'),
      bg: '#F1F5F9',
      border: '#CBD5E1',
      text: '#475569',
    };
  }
  switch (status) {
    case 'succeeded':
      return {
        label: bi('Thành công', 'Succeeded'),
        bg: '#ECFDF5',
        border: '#A7F3D0',
        text: '#047857',
      };
    case 'pending':
      return {
        label: bi('Chờ thanh toán', 'Pending'),
        bg: '#FEF3C7',
        border: '#FDE68A',
        text: '#B45309',
      };
    case 'failed':
      return {
        label: bi('Thất bại', 'Failed'),
        bg: '#FEE2E2',
        border: '#FECACA',
        text: '#B91C1C',
      };
    case 'cancelled':
      return {
        label: bi('Đã hủy', 'Cancelled'),
        bg: '#F1F5F9',
        border: '#CBD5E1',
        text: '#475569',
      };
    default:
      return {
        label: String(status).toUpperCase(),
        bg: '#F1F5F9',
        border: '#CBD5E1',
        text: '#475569',
      };
  }
}

function getRefundStatusMeta(status: RefundRow['status'], bi: (vi: string, en: string) => string) {
  switch (status) {
    case 'succeeded':
      return {
        label: bi('Hoàn tiền thành công', 'Refund Succeeded'),
        bg: '#ECFDF5',
        border: '#A7F3D0',
        text: '#047857',
      };
    case 'failed':
      return {
        label: bi('Hoàn tiền thất bại', 'Refund Failed'),
        bg: '#FEE2E2',
        border: '#FECACA',
        text: '#B91C1C',
      };
    default:
      return {
        label: bi('Đang xử lý', 'Processing'),
        bg: '#FEF3C7',
        border: '#FDE68A',
        text: '#B45309',
      };
  }
}

async function loadPaymentsBundle() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const [payRes, refRes, bkRes] = await Promise.all([
    loadAllRows((from, to) => (supabase!.from('payments').select('*').order('created_at', { ascending: false })).order('id').range(from, to)),
    loadAllRows((from, to) => (supabase!.from('refunds').select('*').order('created_at', { ascending: false })).order('id').range(from, to)),
    loadAllRows((from, to) => (supabase!.from('bookings').select('id,booking_code,contact_name,contact_email,status')).order('id').range(from, to)),
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
  const params = useLocalSearchParams<{ q?: string; paymentId?: string; tab?: string }>();
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  const paymentId = typeof params.paymentId === 'string' ? params.paymentId : undefined;
  const initialTab = params.tab === 'review' || params.tab === 'refunds' ? params.tab : 'payments';
  return <AdminPaymentsContent key={JSON.stringify([initialQuery, paymentId, initialTab])} initialQuery={initialQuery} paymentId={paymentId} initialTab={initialTab} />;
}
function AdminPaymentsContent({ initialQuery, paymentId, initialTab }: { initialQuery: string; paymentId?: string; initialTab: PaymentTab }) {
  const { language, ta, bi, money, airportTime } = useAdminI18n();

  const [tab, setTab] = useState<PaymentTab>(initialTab);
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('all');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [query, setQuery] = useState(initialQuery);
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

  const isPaymentCancelledByBooking = (p: PaymentRow) => {
    const bk = bookingById.get(p.booking_id);
    return p.status === 'pending' && (bk?.status === 'cancelled' || bk?.status === 'expired');
  };

  const filteredPayments = payments.filter((p) => {
    if (paymentId && p.id !== paymentId) return false;
    if (statusFilter === 'all') return true;
    const isCancelled = isPaymentCancelledByBooking(p);
    if (statusFilter === 'cancelled') {
      return p.status === 'cancelled' || isCancelled;
    }
    if (statusFilter === 'pending') {
      return p.status === 'pending' && !isCancelled;
    }
    return p.status === statusFilter;
  });

  const sortedPayments = [...filteredPayments].sort((a, b) => {
    if (sort === 'oldest') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    if (sort === 'amount_desc') {
      return b.amount - a.amount;
    }
    if (sort === 'amount_asc') {
      return a.amount - b.amount;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pagedPayments = filterAndPaginate(sortedPayments, {
    query,
    page,
    pageSize: 8,
    getSearchText: (p: PaymentRow) => {
      const bk = bookingById.get(p.booking_id);
      return `${p.id} ${p.booking_id} ${p.provider} ${p.provider_reference ?? ''} ${p.status} ${p.failure_code ?? ''} ${p.idempotency_key} ${bk?.booking_code ?? ''} ${bk?.contact_name ?? ''}`;
    },
  });

  const pagedRefunds = filterAndPaginate(refunds.filter(row => (!paymentId || row.payment_id === paymentId) && (statusFilter === 'all' || row.status === statusFilter)), {
    query,
    page,
    pageSize: 8,
    getSearchText: (r: RefundRow) => {
      const bk = bookingById.get(r.booking_id);
      return `${r.id} ${r.payment_id} ${r.reason} ${r.status} ${r.provider_reference ?? ''} ${bk?.booking_code ?? ''}`;
    },
  });

  return (
    <AdminShell
      activeSection="payments"
      title={bi('Quản lý Thanh toán & Hoàn tiền', 'Payments & Refunds Management')}
      subtitle={bi(
        'Theo dõi giao dịch theo nhà cung cấp, mã lỗi, khóa chống trùng và hoàn tiền; trạng thái đối soát cổng được hiển thị riêng.',
        'Monitor provider payment attempts, failure codes, idempotency keys and refunds, alongside detailed gateway reconciliation.',
      )}
      onQuickSearch={(txt) => {
        setQuery(txt);
        setPage(1);
      }}
    >
      {paymentId && <View style={adminStyles.card}><Text selectable style={adminStyles.muted}>Payment: {paymentId}</Text><ActionButton secondary title={bi('Bỏ lọc giao dịch', 'Clear payment filter')} onPress={() => router.replace('/admin/payments')} /></View>}
      <View style={adminStyles.chipRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'payments' }}
          onPress={() => {
            setTab('payments');
            setStatusFilter('all');
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
            setStatusFilter('all');
            setPage(1);
          }}
          style={[adminStyles.chip, tab === 'refunds' && adminStyles.chipSelected]}
        >
          <Text style={[adminStyles.chipText, tab === 'refunds' && adminStyles.chipTextSelected]}>
            {bi(`Hoàn tiền (${refunds.length})`, `Refunds (${refunds.length})`)}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: tab === 'review' }} onPress={() => { setTab('review'); setPage(1); }} style={[adminStyles.chip, {minHeight: 44, justifyContent: 'center'}, tab === 'review' && adminStyles.chipSelected]}>
          <Text style={[adminStyles.chipText, tab === 'review' && adminStyles.chipTextSelected]}>{bi('Đối soát cổng', 'Gateway reconciliation')}</Text>
        </Pressable>
      </View>

      <AdminSearchFilterBar
        query={query}
        onQueryChange={(val) => {
          setQuery(val);
          setPage(1);
        }}
        placeholder={bi(
          'Tìm theo mã PNR, tên khách hàng, mã tham chiếu cổng TT, mã lỗi…',
          'Search by PNR, customer, provider reference, failure code…',
        )}
        onRefresh={() => void payQuery.refetch()}
      />

      {tab !== 'review' && (
        <View style={{ gap: 10 }}>
          {/* Lọc theo trạng thái */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569', marginRight: 4 }}>
              {bi('Trạng thái:', 'Status:')}
            </Text>
            {PAYMENT_STATUS_OPTIONS.filter((opt) => tab === 'payments' || opt.key !== 'cancelled').map((opt) => {
              const selected = statusFilter === opt.key;
              const rows = tab === 'payments' ? payments : refunds;
              const scopedRows = rows.filter((row) => !paymentId || ('payment_id' in row ? row.payment_id === paymentId : row.id === paymentId));
              const count = opt.key === 'all'
                ? scopedRows.length
                : scopedRows.filter((row) => {
                    if (tab === 'payments' && 'booking_id' in row) {
                      const isCancelled = isPaymentCancelledByBooking(row as PaymentRow);
                      if (opt.key === 'cancelled') return row.status === 'cancelled' || isCancelled;
                      if (opt.key === 'pending') return row.status === 'pending' && !isCancelled;
                    }
                    return row.status === opt.key;
                  }).length;
              return (
                <Pressable
                  key={opt.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setStatusFilter(opt.key);
                    setPage(1);
                  }}
                  style={[adminStyles.chip, selected && adminStyles.chipSelected]}
                >
                  <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                    {tab === 'refunds' && opt.key === 'pending' ? bi('Đang xử lý', 'Processing') : bi(opt.vi, opt.en)} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Sắp xếp */}
          {tab === 'payments' && <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569', marginRight: 4 }}>
              {bi('Sắp xếp:', 'Sort by:')}
            </Text>
            {SORT_OPTIONS.map((opt) => {
              const selected = sort === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setSort(opt.key);
                    setPage(1);
                  }}
                  style={[adminStyles.chip, selected && adminStyles.chipSelected]}
                >
                  <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                    {bi(opt.vi, opt.en)}
                  </Text>
                </Pressable>
              );
            })}
          </View>}
        </View>
      )}

      {tab === 'review' ? <AdminVnpayReview searchQuery={paymentId ?? query} /> : payQuery.isPending ? (
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
              const statusMeta = getPaymentStatusMeta(p.status, bi, bk?.status);
              return (
                <View key={p.id} style={[adminStyles.itemCard, { gap: 10 }]}>
                  {/* Top row: Số tiền, Cổng thanh toán, Huy hiệu trạng thái */}
                  <View style={adminStyles.rowBetween}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <Text style={[adminStyles.bold, { fontSize: 16, color: '#007E91' }]}>
                        {money(p.amount, p.currency)}
                      </Text>
                      <View style={{
                        backgroundColor: '#F1F5F9',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155' }}>
                          💳 {formatPaymentProvider(p.provider, bi)}
                        </Text>
                      </View>
                    </View>
                    <View style={[
                      adminStyles.badge,
                      {
                        backgroundColor: statusMeta.bg,
                        borderColor: statusMeta.border,
                      },
                    ]}>
                      <Text style={[adminStyles.badgeText, { color: statusMeta.text }]}>
                        {statusMeta.label}
                      </Text>
                    </View>
                  </View>

                  {/* Khung thông tin khách hàng & đơn hàng */}
                  <View style={{
                    backgroundColor: '#F8FAFC',
                    padding: 10,
                    borderRadius: 8,
                    gap: 6,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>
                        🎫 {bi('Mã đơn đặt vé (PNR):', 'Booking Code (PNR):')}{' '}
                        <Text style={{ color: '#007E91', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                          #{bk?.booking_code ?? bi('Chưa có mã', 'No code')}
                        </Text>
                      </Text>
                      {bk && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            router.push(
                              `/admin/bookings?bookingId=${encodeURIComponent(bk.id)}` as Href,
                            )
                          }
                          style={[adminStyles.secondaryBtnSmall, { minHeight: 44, justifyContent: 'center', paddingVertical: 4, paddingHorizontal: 10 }]}
                        >
                          <Text style={[adminStyles.secondaryBtnText, { fontSize: 12, fontWeight: '700', color: '#007E91' }]}>
                            {bi('Xem đơn vé ➔', 'View Booking ➔')}
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    <Text style={{ fontSize: 13, color: '#334155' }}>
                      👤 <Text style={{ fontWeight: '600' }}>{bi('Khách liên hệ:', 'Contact:')}</Text>{' '}
                      {bk?.contact_name || bi('Chưa có tên', 'No name')}
                      {bk?.contact_email ? ` (${bk.contact_email})` : ''}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>
                        🕒 <Text style={{ fontWeight: '600' }}>{bi('Thời gian:', 'Time:')}</Text>{' '}
                        {airportTime(p.created_at, 'Asia/Ho_Chi_Minh')}
                      </Text>
                      {!!p.provider_reference && (
                        <Text style={{ fontSize: 12, color: '#64748B' }}>
                          🧾 <Text style={{ fontWeight: '600' }}>{bi('Mã GD cổng:', 'Gateway Ref:')}</Text>{' '}
                          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                            {p.provider_reference}
                          </Text>
                        </Text>
                      )}
                    </View>

                    {bk && (bk.status === 'cancelled' || bk.status === 'expired') && p.status === 'pending' && (
                      <View style={{
                        backgroundColor: '#FEF2F2',
                        borderColor: '#FECACA',
                        borderWidth: 1,
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        marginTop: 2,
                      }}>
                        <Text style={{ fontSize: 12, color: '#B91C1C', fontWeight: '600' }}>
                          ⚠️ {bi(
                            'Đơn đặt vé này đã bị hủy do hết hạn giữ chỗ (15 phút). Giao dịch cổng này không còn hiệu lực.',
                            'This booking was cancelled because the 15-minute seat hold expired. Gateway attempt is no longer valid.',
                          )}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Thông báo lỗi thanh toán nếu có */}
                  {!!p.failure_code && (
                    <Notice
                      text={bi(
                        `Mã lỗi thanh toán (failure_code): ${p.failure_code}`,
                        `Payment failure_code: ${p.failure_code}`,
                      )}
                    />
                  )}

                  {/* Thông tin kỹ thuật */}
                  <Text style={[adminStyles.helperText, { fontSize: 11, color: '#94A3B8' }]}>
                    {bi('Mã khóa kỹ thuật (Idempotency Key):', 'Technical Idempotency Key:')} {p.idempotency_key}
                  </Text>
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
            const refMeta = getRefundStatusMeta(r.status, bi);
            return (
              <View key={r.id} style={[adminStyles.itemCard, { gap: 8 }]}>
                <View style={adminStyles.rowBetween}>
                  <Text style={[adminStyles.bold, { fontSize: 16, color: '#047857' }]}>
                    {money(r.amount, r.currency)}
                  </Text>
                  <View style={[
                    adminStyles.badge,
                    {
                      backgroundColor: refMeta.bg,
                      borderColor: refMeta.border,
                    },
                  ]}>
                    <Text style={[adminStyles.badgeText, { color: refMeta.text }]}>
                      {refMeta.label}
                    </Text>
                  </View>
                </View>

                <View style={{
                  backgroundColor: '#F8FAFC',
                  padding: 10,
                  borderRadius: 8,
                  gap: 6,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                }}>
                  {bk && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>
                        🎫 {bi('Mã đơn đặt vé (PNR):', 'Booking Code (PNR):')}{' '}
                        <Text style={{ color: '#007E91', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                          #{bk.booking_code}
                        </Text>
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          router.push(
                            `/admin/bookings?bookingId=${encodeURIComponent(bk.id)}` as Href,
                          )
                        }
                        style={[adminStyles.secondaryBtnSmall, { minHeight: 44, justifyContent: 'center', paddingVertical: 4, paddingHorizontal: 10 }]}
                      >
                        <Text style={[adminStyles.secondaryBtnText, { fontSize: 12, fontWeight: '700', color: '#007E91' }]}>
                          {bi('Xem đơn vé ➔', 'View Booking ➔')}
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  <Text style={{ fontSize: 13, color: '#334155' }}>
                    📋 <Text style={{ fontWeight: '600' }}>{bi('Lý do hoàn tiền:', 'Refund reason:')}</Text>{' '}
                    {r.reason}
                  </Text>

                  <Text style={{ fontSize: 12, color: '#64748B' }}>
                    🕒 <Text style={{ fontWeight: '600' }}>{bi('Thời gian tạo:', 'Created at:')}</Text>{' '}
                    {airportTime(r.created_at, 'Asia/Ho_Chi_Minh')}
                  </Text>
                </View>
                <Text style={adminStyles.helperText}>
                  {bi('Hoàn tất:', 'Completed:')} {r.completed_at ? airportTime(r.completed_at, 'Asia/Ho_Chi_Minh') : '—'}
                </Text>
                <ActionButton secondary title={bi('Xem đối soát hoàn tiền', 'Inspect refund reconciliation')} onPress={() => router.push({ pathname: '/admin/payments', params: { tab: 'review', q: r.id } })} />
                <Text selectable style={adminStyles.muted}>Ref: {r.provider_reference ?? '—'} · Payment: {r.payment_id}</Text>
                {!bk && <ActionButton secondary title={bi('Xem đơn', 'Open booking')} onPress={() => router.push({ pathname: '/admin/bookings', params: { bookingId: r.booking_id } })} />}
                <ActionButton secondary title={bi('Xem giao dịch', 'Open payment')} onPress={() => router.push({ pathname: '/admin/payments', params: { paymentId: r.payment_id } })} />
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
