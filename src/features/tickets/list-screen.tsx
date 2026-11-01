import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-provider';
import { ActionButton, colors, Notice } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import { createTicketService, ticketErrorMessage, TICKET_PAGE_SIZE, type BookingSummary } from './model';
import { bookingStatusLabel, formatDateTime, formatMoney, tripTypeLabel } from './presentation';
import { TicketBack, TicketState, ticketStyles } from './ui';

type ListState = { ownerId: string; status: 'loading' | 'ready' | 'error'; bookings: BookingSummary[];
  nextPage: number; hasMore: boolean; loadingMore: boolean; error: string; moreError: string };
const service = supabase ? createTicketService(supabase) : null;

export function TicketsListScreen() {
  const { session, status, error: authError, retry: retryAuth } = useAuth();
  const userId = session?.user.id ?? '';
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ListState>({ ownerId: '', status: 'loading', bookings: [],
    nextPage: 0, hasMore: false, loadingMore: false, error: '', moreError: '' });
  useEffect(() => {
    let active = true;
    if (!service || !userId || status !== 'ready') return;
    service.list(userId).then(bookings => {
      if (active) setState({ ownerId: userId, status: 'ready', bookings, nextPage: 1,
        hasMore: bookings.length === TICKET_PAGE_SIZE, loadingMore: false, error: '', moreError: '' });
    }).catch(error => {
      if (active) setState({ ownerId: userId, status: 'error', bookings: [], nextPage: 0,
        hasMore: false, loadingMore: false, error: ticketErrorMessage(error), moreError: '' });
    });
    return () => { active = false; };
  }, [userId, status, attempt]);

  const refresh = () => {
    setState({ ownerId: userId, status: 'loading', bookings: [], nextPage: 0,
      hasMore: false, loadingMore: false, error: '', moreError: '' });
    setAttempt(value => value + 1);
  };
  const current = state.ownerId === userId ? state : { ...state, status: 'loading' as const, bookings: [] };
  const loadMore = async () => {
    if (!service || current.loadingMore || !current.hasMore || current.status !== 'ready') return;
    const page = current.nextPage;
    setState(previous => ({ ...previous, loadingMore: true, moreError: '' }));
    try {
      const bookings = await service.list(userId, page);
      setState(previous => previous.ownerId !== userId || previous.nextPage !== page ? previous : {
        ...previous, bookings: [...previous.bookings, ...bookings], nextPage: page + 1,
        hasMore: bookings.length === TICKET_PAGE_SIZE, loadingMore: false,
      });
    } catch (error) {
      setState(previous => previous.ownerId !== userId ? previous : {
        ...previous, loadingMore: false, moreError: ticketErrorMessage(error),
      });
    }
  };

  if (status === 'loading') return <TicketState title="Vé của tôi" description="Đang kiểm tra phiên đăng nhập…" loading />;
  if (status === 'error') return <TicketState title="Vé của tôi" description={authError ?? 'Không thể khôi phục phiên.'}
    action="Thử lại" onAction={retryAuth} />;
  if (!session) return <TicketState title="Vé của tôi" description="Đăng nhập để xem các đơn vé của bạn."
    action="Về đăng nhập" onAction={() => router.replace('/')} />;
  if (!service) return <TicketState title="Vé của tôi" description="Chưa cấu hình kết nối Supabase."
    action="Về trang chủ" onAction={() => router.replace('/')} />;
  if (current.status === 'loading') return <TicketState title="Vé của tôi" description="Đang tải danh sách đơn vé…" loading />;
  if (current.status === 'error') return <TicketState title="Vé của tôi" description={current.error}
    action="Thử lại" onAction={refresh} />;

  return <SafeAreaView style={ticketStyles.safe}>
    <FlatList data={current.bookings} keyExtractor={item => item.id}
      contentContainerStyle={ticketStyles.content}
      ListHeaderComponent={<View style={{ gap: 6 }}>
        <TicketBack label="Trang chủ" onPress={() => router.replace('/')} />
        <Text accessibilityRole="header" style={ticketStyles.title}>Vé của tôi</Text>
        <Text style={ticketStyles.subtitle}>Theo dõi các đơn đặt vé của bạn.</Text>
        <ActionButton title="Làm mới" secondary onPress={refresh} />
      </View>}
      ListEmptyComponent={<View style={ticketStyles.card}>
        <Text style={ticketStyles.cardTitle}>Chưa có đơn vé</Text>
        <Text style={ticketStyles.body}>Các đơn bạn đặt sẽ xuất hiện ở đây.</Text>
        <ActionButton title="Về trang chủ" onPress={() => router.replace('/')} />
      </View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button"
        accessibilityLabel={`Xem đơn ${item.booking_code}`}
        onPress={() => router.push({ pathname: '/tickets/[id]', params: { id: item.id } })}
        style={({ pressed }) => [ticketStyles.card, pressed && { opacity: 0.8 }]}>
        <View style={ticketStyles.row}>
          <Text style={ticketStyles.cardTitle}>{item.booking_code}</Text>
          <Text style={ticketStyles.status}>{bookingStatusLabel(item.status)}</Text>
        </View>
        <Text style={ticketStyles.label}>{tripTypeLabel(item.trip_type)} · Đặt lúc {formatDateTime(item.created_at)}</Text>
        <Text style={ticketStyles.strong}>{formatMoney(item.total_amount, item.currency)}</Text>
        {item.status === 'pending_payment' && <Text style={[ticketStyles.label, { color: colors.error }]}>
          Hạn thanh toán: {formatDateTime(item.expires_at)}
        </Text>}
        <Text style={ticketStyles.backText}>Xem chi tiết ›</Text>
      </Pressable>}
      ListFooterComponent={current.hasMore || current.moreError ? <View style={{ gap: 8 }}>
        <Notice text={current.moreError} />
        <ActionButton title="Xem thêm" busy={current.loadingMore} onPress={() => void loadMore()} />
      </View> : undefined}
    />
  </SafeAreaView>;
}
