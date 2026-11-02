import { loadAllRows, loadAllAuditLogs } from '../complete-data';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { ActionButton, Notice } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import { useAdminI18n } from '../i18n';
import { formatAdminError, summarizeAdminBookingsAndRevenue } from '../model';
import { adminChartSeries } from '../chart-series';
import { AdminLoadingState, AdminShell, AdminStatusBadge, adminStyles } from '../ui';

async function loadConsoleOverview() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const [bookings, payments, refunds, profiles, flights, airports, aircraft, auditLogs] =
    await Promise.all([
      loadAllRows((from, to) => (supabase!
        .from('bookings')
        .select('id,booking_code,contact_name,contact_email,status,total_amount,currency,created_at,confirmed_at')
        .order('created_at', { ascending: false })).order('id').range(from, to)),
      loadAllRows((from, to) => (supabase!.from('payments').select('id,status,amount,created_at')).order('id').range(from, to)),
      loadAllRows((from, to) => (supabase!.from('refunds').select('id,status,amount,created_at')).order('id').range(from, to)),
      loadAllRows((from, to) => (supabase!.from('profiles').select('id,full_name,created_at')).order('id').range(from, to)),
      loadAllRows((from, to) => (supabase!.from('flight_instances').select('id,status,published_at')).order('id').range(from, to)),
      loadAllRows((from, to) => (supabase!.from('airports').select('id,is_active')).order('id').range(from, to)),
      loadAllRows((from, to) => (supabase!.from('aircraft').select('id,is_active')).order('id').range(from, to)),
      loadAllAuditLogs(supabase),
    ]);

  const firstError =
    bookings.error ??
    payments.error ??
    refunds.error ??
    profiles.error ??
    flights.error ??
    airports.error ??
    aircraft.error;
  if (firstError) throw firstError;

  const adminActorIds = new Set<string>();
  for (const log of auditLogs) {
    if (log.actor_user_id) adminActorIds.add(log.actor_user_id);
  }

  return {
    bookings: bookings.data ?? [],
    payments: payments.data ?? [],
    refunds: refunds.data ?? [],
    profiles: profiles.data ?? [],
    adminActorIds: Array.from(adminActorIds),
    flightsTotal: flights.data?.length ?? 0,
    flightsPublished: flights.data?.filter((r) => r.published_at !== null).length ?? 0,
    airportsActive: airports.data?.filter((r) => r.is_active).length ?? 0,
    aircraftActive: aircraft.data?.filter((r) => r.is_active).length ?? 0,
    fetchedAtMs: Date.now(),
  };
}

type RangeTab = '7d' | '30d' | '90d';

const RANGE_DAYS: Record<RangeTab, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export function AdminHomeScreen() {
  const { ta, bi, language, money } = useAdminI18n();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [rangeTab, setRangeTab] = useState<RangeTab>('30d');

  const overviewQuery = useQuery({
    queryKey: ['admin-console-overview'],
    queryFn: loadConsoleOverview,
  });

  const data = overviewQuery.data;
  const adminIdSet = new Set<string>(data?.adminActorIds ?? []);
  if (session?.user?.id) {
    adminIdSet.add(session.user.id);
  }
  const customerProfiles = (data?.profiles ?? []).filter((p) => !adminIdSet.has(p.id));

  const metrics = data
    ? summarizeAdminBookingsAndRevenue({
        bookings: data.bookings,
        payments: data.payments,
        refunds: data.refunds,
        profiles: customerProfiles,
        nowMs: data.fetchedAtMs,
        daysWindow: RANGE_DAYS[rangeTab],
      })
    : null;

  const rawName = session?.user?.email?.split('@')[0] ?? 'Admin';
  const adminName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  const kpiCards = [
    {
      icon: '🎫',
      iconBg: '#ECFEFF',
      iconColor: '#0891B2',
      label: bi('Tổng booking', 'Total Bookings'),
      value: metrics ? `${metrics.totalBookings}` : '—',
      badge: metrics
        ? bi(`${metrics.confirmedCount} đã xác nhận`, `${metrics.confirmedCount} confirmed`)
        : '+12.8%',
      badgePositive: true,
      sub: bi(
        `trong ${RANGE_DAYS[rangeTab]} ngày qua`,
        `in the last ${RANGE_DAYS[rangeTab]} days`,
      ),
      href: '/admin/bookings' as const,
    },
    {
      icon: '💰',
      iconBg: '#EEF2FF',
      iconColor: '#4F46E5',
      label: bi('Doanh thu (Mô phỏng)', 'Simulated Revenue'),
      value: metrics ? money(metrics.simulatedNetAmount) : '—',
      badge: metrics
        ? bi(
            `${metrics.succeededPaymentsCount} giao dịch TT`,
            `${metrics.succeededPaymentsCount} paid`,
          )
        : '+8.4%',
      badgePositive: true,
      sub: bi(
        'đơn đã xác nhận (đã trừ hoàn/hủy)',
        'confirmed net of completed refunds',
      ),
      href: '/admin/payments' as const,
    },
    {
      icon: '👥',
      iconBg: '#FFF7ED',
      iconColor: '#EA580C',
      label: bi('Khách hàng', 'Customers'),
      value: metrics ? `${metrics.totalCustomers}` : '—',
      badge: metrics
        ? bi(`+${metrics.newCustomersInWindow} mới`, `+${metrics.newCustomersInWindow} new`)
        : '+4.2%',
      badgePositive: true,
      sub: bi('tài khoản hành khách đăng ký', 'registered traveler profiles'),
      href: '/admin/customers' as const,
    },
    {
      icon: '⏱',
      iconBg: '#FEF2F2',
      iconColor: '#DC2626',
      label: bi('Chờ xử lý & Vận hành', 'Pending & Operations'),
      value: metrics ? `${metrics.pendingCount}` : '—',
      badge: data
        ? bi(`${data.flightsPublished} chuyến mở bán`, `${data.flightsPublished} open flights`)
        : 'Active',
      badgePositive: (metrics?.pendingCount ?? 0) === 0,
      sub: bi('booking đang chờ thanh toán', 'bookings awaiting payment'),
      href: '/admin/bookings' as const,
    },
  ];

  const quickActions = [
    {
      href: '/admin/bookings' as const,
      icon: '🎫',
      iconBg: '#ECFEFF',
      title: bi('Tra cứu & Quản lý Booking', 'Search & Manage Bookings'),
      desc: bi(
        'Tìm theo mã PNR, tên hành khách, email hoặc trạng thái',
        'Filter by PNR code, passenger, email, or status',
      ),
    },
    {
      href: '/admin/flights' as const,
      icon: '✈️',
      iconBg: '#EDE9FE',
      title: bi('Thêm & Lập lịch chuyến bay', 'Schedule Flights & Fares'),
      desc: bi(
        'Cập nhật lịch bay mới, giờ IANA, đóng/mở bán & bảng giá',
        'Create flights, IANA timezones, stop/reopen sales & fares',
      ),
    },
    {
      href: '/admin/payments' as const,
      icon: '💳',
      iconBg: '#FEF3C7',
      title: bi('Đối soát Thanh toán & Hoàn tiền', 'Payments & Refunds'),
      desc: bi(
        'Theo dõi giao dịch mô phỏng, mã lỗi thanh toán & hoàn tiền',
        'Inspect simulated payment attempts, failure codes & refunds',
      ),
    },
    {
      href: '/admin/reports' as const,
      icon: '📈',
      iconBg: '#FCE7F3',
      title: bi('Báo cáo & Nhật ký Quản trị', 'Reports & Admin Audit Logs'),
      desc: bi(
        'Thống kê doanh thu mô phỏng & lịch sử thao tác Admin',
        'Simulated revenue breakdown & security audit trail',
      ),
    },
  ];

  const recentBookings = (data?.bookings ?? []).slice(0, 5);

  const chartBars = adminChartSeries(data?.bookings ?? [], data?.fetchedAtMs, RANGE_DAYS[rangeTab]);

  return (
    <AdminShell
      activeSection="home"
      title={bi(`Chào buổi sáng, ${adminName} ✦`, `Good morning, ${adminName} ✦`)}
      subtitle={bi(
        'Đây là tình hình vận hành Booking, Doanh thu mô phỏng, Khách hàng và Lịch bay của hệ thống hôm nay.',
        'Here is your booking, simulated revenue, customer, and flight operations overview today.',
      )}
      rightAction={
        <View style={adminStyles.rowGap}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/admin/reports' as Href)}
            style={adminStyles.secondaryBtnSmall}
          >
            <Text style={adminStyles.secondaryBtnText}>
              ⬇ {bi('Xem báo cáo', 'View Reports')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/admin/flights' as Href)}
            style={adminStyles.primaryBtnSmall}
          >
            <Text style={adminStyles.primaryBtnText}>
              + {bi('Tạo chuyến bay', 'Create Flight')}
            </Text>
          </Pressable>
        </View>
      }
    >
      {overviewQuery.isPending && <AdminLoadingState />}
      {overviewQuery.isError && (
        <View style={adminStyles.card}>
          <Notice text={formatAdminError(overviewQuery.error, language)} />
          <ActionButton
            title={ta('admin.action.retry')}
            secondary
            onPress={() => void overviewQuery.refetch()}
          />
        </View>
      )}

      {/* 4 KPI Cards Row */}
      <View style={dashStyles.kpiGrid}>
        {kpiCards.map((card) => (
          <Pressable
            key={card.label}
            accessibilityRole="button"
            onPress={() => router.push(card.href as Href)}
            style={[
              dashStyles.kpiCard,
              isWide ? { flex: 1, minWidth: 210 } : { width: '100%' },
            ]}
          >
            <View style={adminStyles.rowBetween}>
              <View style={[dashStyles.kpiIconBox, { backgroundColor: card.iconBg }]}>
                <Text style={{ fontSize: 16, color: card.iconColor }}>{card.icon}</Text>
              </View>
              <Text style={dashStyles.kpiDots}>•••</Text>
            </View>

            <Text style={dashStyles.kpiLabel}>{card.label}</Text>

            <View style={dashStyles.kpiValueRow}>
              <Text style={dashStyles.kpiValue}>{card.value}</Text>
              <View
                style={[
                  dashStyles.kpiTrendPill,
                  card.badgePositive ? dashStyles.kpiTrendUp : dashStyles.kpiTrendWarn,
                ]}
              >
                <Text
                  style={[
                    dashStyles.kpiTrendText,
                    card.badgePositive
                      ? dashStyles.kpiTrendTextUp
                      : dashStyles.kpiTrendTextWarn,
                  ]}
                >
                  ↗ {card.badge}
                </Text>
              </View>
            </View>

            <Text style={dashStyles.kpiSubtext}>{card.sub}</Text>
          </Pressable>
        ))}
      </View>

      {/* Main 2-Column Section: Booking Overview (Left) + Quick Actions (Right) */}
      <View style={[dashStyles.mainGrid, isWide && dashStyles.mainGridWide]}>
        {/* Left Card: Booking Overview */}
        <View style={[adminStyles.card, isWide ? { flex: 1.75 } : { width: '100%' }]}>
          <View style={adminStyles.rowBetween}>
            <View style={{ gap: 2 }}>
              <Text style={dashStyles.microTag}>PERFORMANCE</Text>
              <Text style={adminStyles.sectionTitle}>Booking overview</Text>
            </View>

            <View style={dashStyles.segmentGroup}>
              {(
                [
                  { key: '7d', label: bi('7 ngày', '7 days') },
                  { key: '30d', label: bi('30 ngày', '30 days') },
                  { key: '90d', label: bi('90 ngày', '90 days') },
                ] as const
              ).map((t) => {
                const active = rangeTab === t.key;
                return (
                  <Pressable
                    key={t.key}
                    accessibilityRole="button"
                    onPress={() => setRangeTab(t.key)}
                    style={[dashStyles.segmentBtn, active && dashStyles.segmentBtnActive]}
                  >
                    <Text
                      style={[
                        dashStyles.segmentBtnText,
                        active && dashStyles.segmentBtnTextActive,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={adminStyles.rowBetween}>
            <View style={adminStyles.rowGap}>
              <View style={dashStyles.legendItem}>
                <View style={[dashStyles.legendDot, { backgroundColor: '#0891B2' }]} />
                <Text style={dashStyles.legendText}>Booking</Text>
              </View>
              <View style={dashStyles.legendItem}>
                <View style={[dashStyles.legendDot, { backgroundColor: '#6366F1' }]} />
                <Text style={dashStyles.legendText}>
                  {bi('Doanh thu vé xác nhận (VND)', 'Confirmed gross revenue (VND)')}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={dashStyles.chartBigStat}>
                {metrics ? money(metrics.simulatedNetAmount) : '—'}
              </Text>
              <Text style={dashStyles.kpiSubtext}>
                {bi('doanh thu mô phỏng kỳ này', 'simulated revenue this period')}
              </Text>
            </View>
          </View>

          {/* Visual Dual-Series Chart */}
          <Text style={adminStyles.muted}>{bi('Theo ngày Việt Nam; mỗi chuỗi chuẩn hóa theo giá trị cao nhất của kỳ.', 'Vietnam reporting dates; each series is scaled to its period maximum.')}</Text>
          <View style={dashStyles.chartArea}>
            <View style={dashStyles.chartYAxis}>
              <Text style={dashStyles.chartAxisText}>100%</Text>
              <Text style={dashStyles.chartAxisText}>75%</Text>
              <Text style={dashStyles.chartAxisText}>50%</Text>
              <Text style={dashStyles.chartAxisText}>25%</Text>
              <Text style={dashStyles.chartAxisText}>0</Text>
            </View>

            <View style={dashStyles.chartBarsContainer}>
              {chartBars.map((point) => (
                <View key={point.day} style={dashStyles.chartCol} accessible accessibilityLabel={`${point.day}: ${point.bookings} bookings; ${point.revenue} VND`}>
                  <View style={dashStyles.chartBarPair}>
                    <View
                      style={[dashStyles.chartBarPrimary, { height: `${point.bookingPct}%` }]}
                    />
                    <View
                      style={[dashStyles.chartBarSecondary, { height: `${point.revPct}%` }]}
                    />
                  </View>
                  <Text style={dashStyles.chartDayLabel}>{point.day}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Recent Bookings Table inside Overview */}
          <View style={{ marginTop: 8, gap: 8 }}>
            <View style={adminStyles.rowBetween}>
              <Text style={adminStyles.bold}>
                {bi('Đơn đặt vé gần đây (Recent Bookings)', 'Recent Bookings')}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/admin/bookings' as Href)}
              >
                <Text style={adminStyles.backLink}>
                  {bi('Xem tất cả →', 'View all →')}
                </Text>
              </Pressable>
            </View>

            {recentBookings.length === 0 ? (
              <Text style={adminStyles.muted}>
                {bi(
                  'Chưa có đơn đặt vé nào trong hệ thống.',
                  'No bookings recorded in the system yet.',
                )}
              </Text>
            ) : (
              recentBookings.map((bk) => (
                <Pressable
                  key={bk.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(`/admin/bookings?q=${encodeURIComponent(bk.booking_code)}` as Href)
                  }
                  style={dashStyles.recentBookingRow}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={adminStyles.bold}>
                      #{bk.booking_code} · {bk.contact_name}
                    </Text>
                    <Text style={adminStyles.muted}>
                      {bk.contact_email} · {bk.created_at.slice(0, 10)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={adminStyles.bold}>
                      {money(bk.total_amount, bk.currency)}
                    </Text>
                    <AdminStatusBadge
                      active={bk.status === 'confirmed'}
                      customLabel={bk.status.toUpperCase()}
                    />
                  </View>
                </Pressable>
              ))
            )}
          </View>
        </View>

        {/* Right Card: Shortcuts / Quick Actions */}
        <View style={[adminStyles.card, isWide ? { flex: 1 } : { width: '100%' }]}>
          <View style={adminStyles.rowBetween}>
            <View style={{ gap: 2 }}>
              <Text style={dashStyles.microTag}>SHORTCUTS</Text>
              <Text style={adminStyles.sectionTitle}>Quick actions</Text>
            </View>
            <Text style={dashStyles.kpiDots}>☷</Text>
          </View>

          <View style={{ gap: 10 }}>
            {quickActions.map((act) => (
              <Pressable
                key={act.href}
                accessibilityRole="button"
                onPress={() => router.push(act.href as Href)}
                style={dashStyles.shortcutRow}
              >
                <View style={[dashStyles.shortcutIconBox, { backgroundColor: act.iconBg }]}>
                  <Text style={{ fontSize: 16 }}>{act.icon}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={dashStyles.shortcutTitle}>{act.title}</Text>
                  <Text style={dashStyles.shortcutSub} numberOfLines={1}>
                    {act.desc}
                  </Text>
                </View>
                <Text style={dashStyles.shortcutArrow}>›</Text>
              </Pressable>
            ))}
          </View>

          {/* Summary of Flight Infrastructure */}
          <View style={dashStyles.infraSummaryBox}>
            <Text style={dashStyles.microTag}>
              {bi('HẠ TẦNG KHAI THÁC BAY', 'FLIGHT INFRASTRUCTURE')}
            </Text>
            <Text style={adminStyles.muted}>
              ✈ {data?.flightsPublished ?? 0}/{data?.flightsTotal ?? 0}{' '}
              {bi('chuyến bay mở bán', 'published flights')} · 💺 {data?.aircraftActive ?? 0}{' '}
              {bi('tàu bay', 'aircraft')} · 🌍 {data?.airportsActive ?? 0}{' '}
              {bi('sân bay', 'airports')}
            </Text>
          </View>

          <View style={dashStyles.syncFooter}>
            <Text style={dashStyles.syncFooterText}>
              ↻ {bi('Đồng bộ trực tiếp với Supabase Cloud', 'Synced live with Supabase Cloud')}
            </Text>
          </View>
        </View>
      </View>
    </AdminShell>
  );
}

const dashStyles = StyleSheet.create({
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    gap: 8,
  },
  kpiIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiDots: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '700',
  },
  kpiLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
  },
  kpiValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  kpiTrendPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  kpiTrendUp: {
    backgroundColor: '#ECFDF5',
  },
  kpiTrendWarn: {
    backgroundColor: '#FFF7ED',
  },
  kpiTrendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  kpiTrendTextUp: {
    color: '#059669',
  },
  kpiTrendTextWarn: {
    color: '#D97706',
  },
  kpiSubtext: {
    fontSize: 12,
    color: '#94A3B8',
  },
  mainGrid: {
    flexDirection: 'column',
    gap: 16,
  },
  mainGridWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  microTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  segmentGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 3,
    borderRadius: 10,
    gap: 4,
  },
  segmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#0891B2',
    fontWeight: '700',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  chartBigStat: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  chartArea: {
    flexDirection: 'row',
    height: 175,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  chartYAxis: {
    justifyContent: 'space-between',
    paddingBottom: 22,
  },
  chartAxisText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  chartBarsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  chartCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  chartBarPair: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  chartBarPrimary: {
    width: 14,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: '#06B6D4',
  },
  chartBarSecondary: {
    width: 14,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: '#6366F1',
    opacity: 0.75,
  },
  chartDayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  recentBookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  shortcutIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  shortcutSub: {
    fontSize: 12,
    color: '#64748B',
  },
  shortcutArrow: {
    fontSize: 20,
    color: '#94A3B8',
    fontWeight: '600',
  },
  infraSummaryBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  syncFooter: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  syncFooterText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});
