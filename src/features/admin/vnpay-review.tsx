import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/auth-provider';
import { ActionButton, Notice } from '../auth/ui';
import { useAdminI18n } from './i18n';
import { formatAdminError } from './model';
import { loadAdminVnpayReviewPage, type ReconciliationState } from './reconciliation-data';
import { AdminPaginationBar, AdminLoadingState, adminStyles } from './ui';

export function AdminVnpayReview({ searchQuery = '' }: { searchQuery?: string }) {
  return <AdminVnpayReviewContent key={searchQuery} searchQuery={searchQuery} />;
}
function AdminVnpayReviewContent({ searchQuery }: { searchQuery: string }) {
  const { session } = useAuth();
  const { bi, language, money, airportTime } = useAdminI18n();
  const [page, setPage] = useState(1);
  const [state, setState] = useState<ReconciliationState>('all');
  const query = useQuery({
    queryKey: ['admin-vnpay-review', session?.user.id, searchQuery, state, page],
    enabled: !!session,
    retry: false,
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase configuration missing');
      return loadAdminVnpayReviewPage(supabase, { query: searchQuery, state, page, pageSize: 20 });
    },
  });
  return <View style={adminStyles.card}>
    <Text style={adminStyles.sectionTitle}>{bi('Đối soát VNPAY Sandbox', 'VNPAY Sandbox reconciliation')}</Text>
    <Text style={adminStyles.helperText}>{bi('Dùng ô tìm kiếm chung để tra PNR, ID giao dịch, mã tham chiếu và trạng thái. Số tiền cổng đã thu gồm cả khoản trùng/chậm cần bồi hoàn.', 'Use the shared search to find PNR, transaction IDs, references and states. Gateway captures include duplicate/late funds awaiting compensation.')}</Text>
    <Text style={adminStyles.helperText}>{bi('Lọc theo trạng thái xử lý hoàn tiền; “Bồi hoàn” hiển thị khoản thu trùng/chậm. “Thành công” là hoàn tiền thành công, không phải thanh toán thành công.', 'Filter by refund job state; “Compensation” shows duplicate/late captures. “Succeeded” means a successful refund, not a successful payment.')}</Text>
    <View style={[adminStyles.chipRow, { gap: 8 }]}>
      {(['all', 'review', 'unknown', 'processing', 'failed', 'succeeded', 'compensation', 'ready', 'submitted'] as ReconciliationState[]).map(value => <Pressable
        key={value} accessibilityRole="button" accessibilityState={{ selected: state === value }}
        onPress={() => { setState(value); setPage(1); }} style={[adminStyles.chip, { minHeight: 44, justifyContent: 'center' }, state === value && adminStyles.chipSelected]}>
        <Text style={[adminStyles.chipText, state === value && adminStyles.chipTextSelected]}>{({
          all: bi('Tất cả', 'All'), review: bi('Cần kiểm tra', 'Review'), unknown: bi('Chưa rõ kết quả', 'Unknown'),
          processing: bi('Đang xử lý', 'Processing'), failed: bi('Thất bại', 'Failed'), succeeded: bi('Thành công', 'Succeeded'),
          compensation: bi('Bồi hoàn', 'Compensation'), ready: bi('Sẵn sàng', 'Ready'), submitted: bi('Đã gửi', 'Submitted'),
        })[value]}</Text>
      </Pressable>)}
    </View>
    {query.isPending ? <AdminLoadingState /> : query.isError ? <Notice text={formatAdminError(query.error, language)} /> : <>
      {query.data.items.length === 0 && <Text style={adminStyles.muted}>{bi('Không có bản ghi khớp.', 'No matching records.')}</Text>}
      {query.data.items.map(row => <View key={`${row.payment_id}:${row.refund_id ?? ''}`} style={adminStyles.itemCard}>
        <Text style={adminStyles.bold}>{row.booking_code} · {money(row.amount, row.currency)}</Text>
        <Text style={adminStyles.label}>{row.payment_status} · {row.settlement} · {bi('Cổng đã thu', 'Gateway captured')}: {row.gateway_paid ? bi('Có', 'Yes') : bi('Chưa', 'No')}</Text>
        <Text selectable style={adminStyles.muted}>Payment: {row.payment_id}</Text>
        <Text selectable style={adminStyles.muted}>TxnRef: {row.txn_ref} · TransactionNo: {row.transaction_no ?? '—'} · Ref: {row.provider_reference ?? '—'}</Text>
        <Text style={adminStyles.muted}>{bi('Hoàn tiền công khai / job', 'Public refund / job')}: {row.refund_status ?? '—'} / {row.refund_state ?? '—'} · {row.last_code ?? '—'}</Text>
        {row.refund_id && <>
          <Text selectable style={adminStyles.muted}>Refund: {row.refund_id} · {row.refund_amount == null ? '—' : money(row.refund_amount, row.currency)}</Text>
          <Text selectable style={adminStyles.muted}>{bi('Mã hoàn / hoàn tất', 'Refund ref / completed')}: {row.refund_provider_reference ?? '—'} · {row.completed_at ? airportTime(row.completed_at, 'Asia/Ho_Chi_Minh') : '—'}</Text>
        </>}
        <View style={[adminStyles.rowGap, { gap: 8 }]}>
          <ActionButton secondary title={bi('Xem đúng đơn', 'Open booking')} onPress={() => router.push({ pathname: '/admin/bookings', params: { bookingId: row.booking_id } })} />
          <ActionButton secondary title={bi('Xem giao dịch', 'Open payment')} onPress={() => router.push({ pathname: '/admin/payments', params: { paymentId: row.payment_id } })} />
        </View>
      </View>)}
      <AdminPaginationBar page={page} totalPages={query.data.totalPages} total={query.data.total} onPageChange={setPage} />
    </>}
    <ActionButton secondary title={bi('Tải lại đối soát', 'Refresh reconciliation')} onPress={() => { void query.refetch(); }} />
  </View>;
}
