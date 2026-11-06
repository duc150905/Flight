import { useState } from 'react';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-provider';
import { ActionButton, colors, Notice } from '@/features/auth/ui';
import { cacheKeys, cacheTimes } from '@/features/cache/policy';
import { useLanguage } from '@/features/i18n/provider';
import { supabase } from '@/lib/supabase';
import { createTicketService, ticketErrorMessage, TICKET_PAGE_SIZE, type BookingSummary } from './model';
import { formatDateTime, formatMoney, resolveFlightTiming, tripTypeLabel } from './presentation';
import { FlightTimingBadge, TicketBack, TicketState, ticketStyles } from './ui';

const service = supabase ? createTicketService(supabase) : null;

export function TicketsListScreen() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const { session, status, error: authError, retry: retryAuth } = useAuth();
  const userId = session?.user.id ?? '';
  const query = useInfiniteQuery({
    queryKey: cacheKeys.tickets(userId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => service!.list(userId, pageParam),
    getNextPageParam: (lastPage, pages) => (lastPage.length === TICKET_PAGE_SIZE ? pages.length : undefined),
    enabled: !!service && !!userId && status === 'ready',
    staleTime: cacheTimes.ticket,
  });

  const bookings: BookingSummary[] = query.data?.pages.flat() ?? [];

  if (status === 'loading') {
    return <TicketState title={t('Vé của tôi')} description={t('Đang kiểm tra phiên đăng nhập…')} loading />;
  }
  if (status === 'error') {
    return (
      <TicketState
        title={t('Vé của tôi')}
        description={t(authError ?? 'Không thể khôi phục phiên.')}
        action={t('Thử lại')}
        onAction={retryAuth}
      />
    );
  }
  if (!session) {
    return (
      <TicketState
        title={t('Vé của tôi')}
        description={t('Đăng nhập để xem các đơn vé của bạn.')}
        action={t('Về đăng nhập')}
        onAction={() => router.replace('/account')}
      />
    );
  }
  if (!service) {
    return (
      <TicketState
        title={t('Vé của tôi')}
        description={t('Chưa cấu hình kết nối Supabase.')}
        action={t('Về trang chủ')}
        onAction={() => router.replace('/')}
      />
    );
  }
  if (query.isPending) {
    return <TicketState title={t('Vé của tôi')} description={t('Đang tải danh sách đơn vé…')} loading />;
  }
  if (query.isError && !query.data) {
    return (
      <TicketState
        title={t('Vé của tôi')}
        description={t(ticketErrorMessage(query.error))}
        action={t('Thử lại')}
        onAction={() => void query.refetch()}
      />
    );
  }

  // Pre-calculate flight timing for all bookings
  const resolvedList = bookings.map((item) => ({
    item,
    timing: resolveFlightTiming(item.booking_segments, item.status),
  }));

  const upcomingList = resolvedList.filter((x) => x.timing.isUpcoming);
  const pastList = resolvedList.filter((x) => !x.timing.isUpcoming);
  const currentList = activeTab === 'upcoming' ? upcomingList : pastList;

  return (
    <SafeAreaView style={ticketStyles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={currentList}
        keyExtractor={({ item }) => item.id}
        contentContainerStyle={ticketStyles.content}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <TicketBack label={t('Trang chủ')} onPress={() => router.replace('/')} />
            <Text accessibilityRole="header" style={ticketStyles.title}>
              {t('Vé của tôi')}
            </Text>
            <Text style={ticketStyles.subtitle}>{t('Theo dõi các đơn đặt vé của bạn.')}</Text>

            {/* Segmented Control Tabs */}
            <View style={ticketStyles.tabBar}>
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel={t('Sắp tới')}
                accessibilityState={{ selected: activeTab === 'upcoming' }}
                onPress={() => setActiveTab('upcoming')}
                style={[ticketStyles.tabButton, activeTab === 'upcoming' && ticketStyles.tabButtonActive]}
              >
                <Text style={[ticketStyles.tabText, activeTab === 'upcoming' && ticketStyles.tabTextActive]}>
                  {t('Sắp tới')}
                </Text>
                <View style={[ticketStyles.tabBadge, activeTab === 'upcoming' && ticketStyles.tabBadgeActive]}>
                  <Text style={[ticketStyles.tabBadgeText, activeTab === 'upcoming' && ticketStyles.tabBadgeTextActive]}>
                    {upcomingList.length}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="tab"
                accessibilityLabel={t('Lịch sử')}
                accessibilityState={{ selected: activeTab === 'past' }}
                onPress={() => setActiveTab('past')}
                style={[ticketStyles.tabButton, activeTab === 'past' && ticketStyles.tabButtonActive]}
              >
                <Text style={[ticketStyles.tabText, activeTab === 'past' && ticketStyles.tabTextActive]}>
                  {t('Lịch sử')}
                </Text>
                <View style={[ticketStyles.tabBadge, activeTab === 'past' && ticketStyles.tabBadgeActive]}>
                  <Text style={[ticketStyles.tabBadgeText, activeTab === 'past' && ticketStyles.tabBadgeTextActive]}>
                    {pastList.length}
                  </Text>
                </View>
              </Pressable>
            </View>

            <ActionButton title={t('Làm mới')} secondary onPress={() => void query.refetch()} />
          </View>
        }
        ListEmptyComponent={
          <View style={ticketStyles.card}>
            <Text style={ticketStyles.cardTitle}>
              {activeTab === 'upcoming' ? t('Chưa có chuyến bay sắp tới') : t('Chưa có lịch sử chuyến bay')}
            </Text>
            <Text style={ticketStyles.body}>
              {activeTab === 'upcoming'
                ? t('Các chuyến bay sắp tới của bạn sẽ xuất hiện ở đây.')
                : t('Các chuyến bay đã hoàn thành hoặc đã hủy sẽ nằm ở đây.')}
            </Text>
            <ActionButton title={t('Về trang chủ')} onPress={() => router.replace('/')} />
          </View>
        }
        renderItem={({ item: { item, timing } }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Xem đơn {code}', { code: item.booking_code })}
            onPress={() => router.push({ pathname: '/tickets/[id]', params: { id: item.id } })}
            style={({ pressed }) => [ticketStyles.card, pressed && { opacity: 0.8 }]}
          >
            {/* Header: Route or Booking Code + Real-time Timing Badge */}
            <View style={ticketStyles.routeHeader}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                {timing.routeText ? (
                  <>
                    <Text style={ticketStyles.routeText} numberOfLines={1}>
                      {timing.routeText}
                    </Text>
                    <Text style={ticketStyles.flightSub} numberOfLines={1}>
                      {timing.flightNumber ? `${timing.airlineName ? `${timing.airlineName} · ` : ''}${timing.flightNumber}` : item.booking_code}
                    </Text>
                  </>
                ) : (
                  <Text style={[ticketStyles.cardTitle, { flex: 1, minWidth: 0 }]} numberOfLines={2}>
                    {item.booking_code}
                  </Text>
                )}
              </View>

              <FlightTimingBadge timing={timing} />
            </View>

            <View style={ticketStyles.divider} />

            <View style={ticketStyles.row}>
              <Text style={ticketStyles.label}>
                {t(tripTypeLabel(item.trip_type))} · {item.booking_code}
              </Text>
              <Text style={[ticketStyles.label, { textAlign: 'right' }]}>
                {t('Đặt lúc')} {formatDateTime(item.created_at, null, language)}
              </Text>
            </View>

            <Text style={ticketStyles.strong}>{formatMoney(item.total_amount, item.currency, language)}</Text>

            {item.status === 'pending_payment' && (
              <Text style={[ticketStyles.label, { color: colors.error }]}>
                {t('Hạn thanh toán')}: {formatDateTime(item.expires_at, null, language)}
              </Text>
            )}

            <Text style={ticketStyles.backText}>{t('Xem chi tiết')} ›</Text>
          </Pressable>
        )}
        ListFooterComponent={
          query.hasNextPage || query.isFetchNextPageError ? (
            <View style={{ gap: 8 }}>
              <Notice text={query.isFetchNextPageError ? t(ticketErrorMessage(query.error)) : ''} />
              <ActionButton
                title={t('Xem thêm')}
                busy={query.isFetchingNextPage}
                onPress={() => void query.fetchNextPage()}
              />
            </View>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}
