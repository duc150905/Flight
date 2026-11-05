import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-provider';
import { ActionButton, colors, Notice } from '@/features/auth/ui';
import { cacheKeys, cacheTimes } from '@/features/cache/policy';
import { useLanguage } from '@/features/i18n/provider';
import { supabase } from '@/lib/supabase';
import { createTicketService, ticketErrorMessage, TICKET_PAGE_SIZE } from './model';
import { bookingStatusLabel, formatDateTime, formatMoney, tripTypeLabel } from './presentation';
import { TicketBack, TicketState, ticketStyles } from './ui';

const service = supabase ? createTicketService(supabase) : null;

export function TicketsListScreen() {
  const { t, language } = useLanguage();
  const { session, status, error: authError, retry: retryAuth } = useAuth();
  const userId = session?.user.id ?? '';
  const query = useInfiniteQuery({
    queryKey: cacheKeys.tickets(userId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => service!.list(userId, pageParam),
    getNextPageParam: (lastPage, pages) => lastPage.length === TICKET_PAGE_SIZE ? pages.length : undefined,
    enabled: !!service && !!userId && status === 'ready',
    staleTime: cacheTimes.ticket,
  });
  const bookings = query.data?.pages.flat() ?? [];

  if (status === 'loading') return <TicketState title={t('Vé của tôi')} description={t('Đang kiểm tra phiên đăng nhập…')} loading />;
  if (status === 'error') return <TicketState title={t('Vé của tôi')} description={t(authError ?? 'Không thể khôi phục phiên.')}
    action={t('Thử lại')} onAction={retryAuth} />;
  if (!session) return <TicketState title={t('Vé của tôi')} description={t('Đăng nhập để xem các đơn vé của bạn.')}
    action={t('Về đăng nhập')} onAction={() => router.replace('/account')} />;
  if (!service) return <TicketState title={t('Vé của tôi')} description={t('Chưa cấu hình kết nối Supabase.')}
    action={t('Về trang chủ')} onAction={() => router.replace('/')} />;
  if (query.isPending) return <TicketState title={t('Vé của tôi')} description={t('Đang tải danh sách đơn vé…')} loading />;
  if (query.isError && !query.data) return <TicketState title={t('Vé của tôi')} description={t(ticketErrorMessage(query.error))}
    action={t('Thử lại')} onAction={() => void query.refetch()} />;

  return <SafeAreaView style={ticketStyles.safe} edges={['top', 'left', 'right']}>
    <FlatList data={bookings} keyExtractor={item => item.id}
      contentContainerStyle={ticketStyles.content}
      ListHeaderComponent={<View style={{ gap: 6 }}>
        <TicketBack label={t('Trang chủ')} onPress={() => router.replace('/')} />
        <Text accessibilityRole="header" style={ticketStyles.title}>{t('Vé của tôi')}</Text>
        <Text style={ticketStyles.subtitle}>{t('Theo dõi các đơn đặt vé của bạn.')}</Text>
        <ActionButton title={t('Làm mới')} secondary onPress={() => void query.refetch()} />
      </View>}
      ListEmptyComponent={<View style={ticketStyles.card}>
        <Text style={ticketStyles.cardTitle}>{t('Chưa có đơn vé')}</Text>
        <Text style={ticketStyles.body}>{t('Các đơn bạn đặt sẽ xuất hiện ở đây.')}</Text>
        <ActionButton title={t('Về trang chủ')} onPress={() => router.replace('/')} />
      </View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button"
        accessibilityLabel={t('Xem đơn {code}', { code: item.booking_code })}
        onPress={() => router.push({ pathname: '/tickets/[id]', params: { id: item.id } })}
        style={({ pressed }) => [ticketStyles.card, pressed && { opacity: 0.8 }]}>
        <View style={ticketStyles.row}>
          <Text style={[ticketStyles.cardTitle, { flex: 1, minWidth: 0 }]} numberOfLines={2}>
            {item.booking_code}
          </Text>
          <View style={ticketStyles.statusBadge}>
            <Text style={ticketStyles.status}>{t(bookingStatusLabel(item.status))}</Text>
          </View>
        </View>
        <Text style={ticketStyles.label}>{t(tripTypeLabel(item.trip_type))} · {t('Đặt lúc')} {formatDateTime(item.created_at, null, language)}</Text>
        <Text style={ticketStyles.strong}>{formatMoney(item.total_amount, item.currency, language)}</Text>
        {item.status === 'pending_payment' && <Text style={[ticketStyles.label, { color: colors.error }]}>
          {t('Hạn thanh toán')}: {formatDateTime(item.expires_at, null, language)}
        </Text>}
        <Text style={ticketStyles.backText}>{t('Xem chi tiết')} ›</Text>
      </Pressable>}
      ListFooterComponent={query.hasNextPage || query.isFetchNextPageError ? <View style={{ gap: 8 }}>
        <Notice text={query.isFetchNextPageError ? t(ticketErrorMessage(query.error)) : ''} />
        <ActionButton title={t('Xem thêm')} busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()} />
      </View> : undefined}
    />
  </SafeAreaView>;
}
