import { router, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ElementRef, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/auth-provider';
import { colors } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import { LanguagePicker, useAdminI18n } from './i18n';
import type { StatusFilter } from './model';

export type AdminSectionKey =
  | 'home'
  | 'bookings'
  | 'customers'
  | 'payments'
  | 'reports'
  | 'flights'
  | 'aircraft'
  | 'catalogues'
  | 'addons'
  | 'permissions';

const consolePalette = {
  brandTeal: '#0891B2',
  brandTealDark: '#0E7490',
  brandTealLight: '#ECFEFF',
  brandTealBorder: '#A5F3FC',
  canvasBg: '#F8FAFC',
  sidebarBg: '#FFFFFF',
  cardBorder: '#E2E8F0',
  subtleBg: '#F1F5F9',
  heading: '#0F172A',
  subtext: '#64748B',
};

type NavRouteItem = {
  key: AdminSectionKey;
  href: string;
  labelKey: string;
  icon: string;
  group: 'workspace' | 'flight_ops' | 'system';
  badge?: string;
};

const navRoutes: NavRouteItem[] = [
  // WORKSPACE (Commercial, Bookings, Customers, Payments, Reports — F10)
  { key: 'home', href: '/admin', labelKey: 'admin.nav.home', icon: '⊞', group: 'workspace' },
  {
    key: 'bookings',
    href: '/admin/bookings',
    labelKey: 'admin.nav.bookings',
    icon: '🎫',
    group: 'workspace',
  },
  {
    key: 'customers',
    href: '/admin/customers',
    labelKey: 'admin.nav.customers',
    icon: '👥',
    group: 'workspace',
  },
  {
    key: 'payments',
    href: '/admin/payments',
    labelKey: 'admin.nav.payments',
    icon: '💳',
    group: 'workspace',
  },
  {
    key: 'reports',
    href: '/admin/reports',
    labelKey: 'admin.nav.reports',
    icon: '📈',
    group: 'workspace',
  },

  // FLIGHT CATALOGUE & OPERATIONS
  {
    key: 'flights',
    href: '/admin/flights',
    labelKey: 'admin.nav.flights',
    icon: '✈',
    group: 'flight_ops',
  },
  {
    key: 'aircraft',
    href: '/admin/aircraft',
    labelKey: 'admin.nav.aircraft',
    icon: '💺',
    group: 'flight_ops',
  },
  {
    key: 'catalogues',
    href: '/admin/catalogues',
    labelKey: 'admin.nav.catalogues',
    icon: '🌍',
    group: 'flight_ops',
  },
  {
    key: 'addons',
    href: '/admin/addons',
    labelKey: 'admin.nav.addons',
    icon: '🧳',
    group: 'flight_ops',
  },

  // SYSTEM
  {
    key: 'permissions',
    href: '/admin/permissions',
    labelKey: 'admin.nav.permissions',
    icon: '🛡',
    group: 'system',
  },
];

export function AdminShell({
  activeSection,
  title,
  subtitle,
  rightAction,
  onQuickSearch,
  children,
}: PropsWithChildren<{
  activeSection: AdminSectionKey;
  title: string;
  subtitle?: string;
  rightAction?: ReactNode;
  onQuickSearch?: (queryText: string) => void;
}>) {
  const { ta, bi } = useAdminI18n();
  const { session, actions } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [topSearchText, setTopSearchText] = useState('');

  const userEmail = session?.user?.email ?? 'admin@flyora.vn';
  const [displayName, setDisplayName] = useState<string>('');
  const tabsScrollRef = useRef<ElementRef<typeof ScrollView>>(null);
  const [tabsScrollX, setTabsScrollX] = useState(0);

  useEffect(() => {
    if (isDesktop) return;
    const activeIndex = navRoutes.findIndex((r) => r.key === activeSection);
    if (activeIndex >= 0 && tabsScrollRef.current) {
      const targetX = Math.max(0, activeIndex * 125 - 40);
      tabsScrollRef.current.scrollTo({ x: targetX, animated: true });
    }
  }, [activeSection, isDesktop]);

  useEffect(() => {
    let active = true;
    if (!session?.user?.id || !supabase) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data: prof }) => {
        if (active) {
          setDisplayName(prof?.full_name?.trim() ?? '');
        }
      });

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const initials = displayName.trim()
    ? displayName
        .trim()
        .split(/\s+/)
        .map((w) => w[0]?.toUpperCase())
        .slice(-2)
        .join('') || displayName.slice(0, 2).toUpperCase()
    : userEmail.slice(0, 2).toUpperCase();
  const activeNav = navRoutes.find((n) => n.key === activeSection) ?? navRoutes[0];

  const handleSignOut = async () => {
    if (!actions || signingOut) return;
    setSigningOut(true);
    try {
      await actions.logout();
      setAccountMenuOpen(false);
      router.replace('/account' as Href);
    } finally {
      setSigningOut(false);
    }
  };

  const handleTopSearchSubmit = () => {
    const trimmed = topSearchText.trim();
    if (onQuickSearch) {
      onQuickSearch(trimmed);
      return;
    }
    if (!trimmed) {
      router.push('/admin/bookings' as Href);
      return;
    }
    // Smart routing: if it looks like a flight number (e.g., VN210, VJ624) and user is not on bookings
    if (/^(VN|VJ|QH|BL|SQ)[0-9]{2,4}$/i.test(trimmed)) {
      router.push(`/admin/flights?q=${encodeURIComponent(trimmed)}` as Href);
      return;
    }
    router.push(`/admin/bookings?q=${encodeURIComponent(trimmed)}` as Href);
  };

  const workspaceItems = navRoutes.filter((r) => r.group === 'workspace');
  const flightOpsItems = navRoutes.filter((r) => r.group === 'flight_ops');
  const systemItems = navRoutes.filter((r) => r.group === 'system');

  const renderNavGroup = (items: NavRouteItem[], onAfterSelect?: () => void) => (
    <View style={adminStyles.sidebarNavList}>
      {items.map((item) => {
        const selected = item.key === activeSection;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              onAfterSelect?.();
              router.replace(item.href as Href);
            }}
            style={[adminStyles.sidebarItem, selected && adminStyles.sidebarItemActive]}
          >
            <Text
              style={[adminStyles.sidebarItemIcon, selected && adminStyles.sidebarItemIconActive]}
            >
              {item.icon}
            </Text>
            <Text
              style={[adminStyles.sidebarItemText, selected && adminStyles.sidebarItemTextActive]}
            >
              {ta(item.labelKey)}
            </Text>
            {!!item.badge && (
              <View
                style={[adminStyles.sidebarBadge, selected && adminStyles.sidebarBadgeActive]}
              >
                <Text
                  style={[
                    adminStyles.sidebarBadgeText,
                    selected && adminStyles.sidebarBadgeTextActive,
                  ]}
                >
                  {item.badge}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );

  const renderSidebarContent = (onAfterSelect?: () => void) => (
    <View style={adminStyles.sidebarInner}>
      {/* Brand Logo */}
      <View style={adminStyles.brandRow}>
        <Image
          source={require('../../../assets/branding/logo.png')}
          accessible={false}
          alt=""
          contentFit="contain"
          style={adminStyles.brandLogo}
        />
        <View style={{ flex: 1 }}>
          <Text style={adminStyles.brandTitle}>
            Flyora<Text style={adminStyles.brandDot}>.</Text>
          </Text>
          <Text style={adminStyles.brandSubtitle}>ADMIN CONSOLE</Text>
        </View>
      </View>

      {/* WORKSPACE Nav Group */}
      <Text style={adminStyles.sidebarGroupLabel}>WORKSPACE</Text>
      {renderNavGroup(workspaceItems, onAfterSelect)}

      {/* FLIGHT OPS & CATALOGUE Nav Group */}
      <Text style={[adminStyles.sidebarGroupLabel, { marginTop: 10 }]}>
        {bi('KHAI THÁC BAY', 'FLIGHT OPS')}
      </Text>
      {renderNavGroup(flightOpsItems, onAfterSelect)}

      {/* SYSTEM Nav Group */}
      <Text style={[adminStyles.sidebarGroupLabel, { marginTop: 10 }]}>SYSTEM</Text>
      {renderNavGroup(systemItems, onAfterSelect)}
      <View style={adminStyles.sidebarNavList}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onAfterSelect?.();
            router.push('/');
          }}
          style={adminStyles.sidebarItem}
        >
          <Text style={adminStyles.sidebarItemIcon}>🏠</Text>
          <Text style={adminStyles.sidebarItemText}>
            {bi('Về trang Đặt vé', 'Customer Booking Home')}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={adminStyles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={adminStyles.safe}
      >
        <View style={adminStyles.rootLayout}>
          {/* Desktop Fixed Left Sidebar */}
          {isDesktop && (
            <ScrollView
              style={adminStyles.desktopSidebarScroll}
              contentContainerStyle={adminStyles.desktopSidebar}
              showsVerticalScrollIndicator={false}
            >
              {renderSidebarContent()}
            </ScrollView>
          )}

          {/* Right Main Workspace Column */}
          <View style={adminStyles.mainColumn}>
            {/* Top Console Bar */}
            <View style={[adminStyles.topConsoleBar, !isDesktop && adminStyles.topConsoleBarCompact]}>
              <View style={adminStyles.breadcrumbRow}>
                {!isDesktop && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={bi('Mở danh mục quản trị', 'Open admin navigation')}
                    onPress={() => setMobileMenuOpen((v) => !v)}
                    style={[
                      adminStyles.mobileMenuBtn,
                      mobileMenuOpen && adminStyles.mobileMenuBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        adminStyles.mobileMenuBtnText,
                        mobileMenuOpen && adminStyles.mobileMenuBtnTextActive,
                      ]}
                    >
                      {mobileMenuOpen ? '✕' : '☰'}
                    </Text>
                    <Text
                      style={[
                        adminStyles.mobileMenuBtnLabel,
                        mobileMenuOpen && adminStyles.mobileMenuBtnLabelActive,
                      ]}
                    >
                      {mobileMenuOpen ? bi('Đóng', 'Close') : 'Menu'}
                    </Text>
                  </Pressable>
                )}
                {isDesktop && (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.replace('/admin' as Href)}
                    >
                      <Text style={adminStyles.breadcrumbMuted}>Workspace</Text>
                    </Pressable>
                    <Text style={adminStyles.breadcrumbSeparator}>›</Text>
                    <Text style={adminStyles.breadcrumbCurrent} numberOfLines={1}>
                      {ta(activeNav.labelKey)}
                    </Text>
                  </>
                )}
              </View>

              <View style={[adminStyles.topBarRight, !isDesktop && adminStyles.topBarRightCompact]}>
                {/* Interactive Live Search Input right in the top bar */}
                <View
                  style={[
                    adminStyles.topSearchInputWrapper,
                    !isDesktop && adminStyles.topSearchInputWrapperCompact,
                  ]}
                >
                  <Text style={adminStyles.topSearchIcon}>🔍</Text>
                  <TextInput
                    value={topSearchText}
                    onChangeText={(txt) => {
                      setTopSearchText(txt);
                      onQuickSearch?.(txt);
                    }}
                    onSubmitEditing={handleTopSearchSubmit}
                    returnKeyType="search"
                    placeholder={
                      isDesktop
                        ? bi(
                            'Tìm booking, hành khách, chuyến bay…',
                            'Search bookings, passengers, flights…',
                          )
                        : bi('Tìm kiếm…', 'Search…')
                    }
                    placeholderTextColor={consolePalette.subtext}
                    autoCapitalize="none"
                    style={adminStyles.topSearchInput}
                  />
                  {topSearchText.length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setTopSearchText('');
                        onQuickSearch?.('');
                      }}
                      style={adminStyles.topSearchClearBtn}
                    >
                      <Text style={adminStyles.topSearchClearText}>✕</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleTopSearchSubmit}
                    style={adminStyles.topSearchGoBtn}
                  >
                    <Text style={adminStyles.topSearchGoText}>↵</Text>
                  </Pressable>
                </View>

                <LanguagePicker compact={!isDesktop} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={bi('Mở menu tài khoản', 'Open account menu')}
                  accessibilityState={{ expanded: accountMenuOpen }}
                  onPress={() => setAccountMenuOpen((v) => !v)}
                  style={[
                    adminStyles.avatarCircle,
                    accountMenuOpen && adminStyles.avatarCircleActive,
                  ]}
                >
                  <Text style={adminStyles.avatarText}>{initials}</Text>
                </Pressable>
              </View>
            </View>

            {/* Mobile Slide-down Drawer + Quick Horizontal Tabs */}
            {!isDesktop && (
              <>
                {mobileMenuOpen && (
                  <View style={adminStyles.mobileDrawerCard}>
                    {renderSidebarContent(() => setMobileMenuOpen(false))}
                  </View>
                )}
                <View style={adminStyles.mobileTabsWrapper}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={bi('Cuộn menu sang trái', 'Scroll menu left')}
                    onPress={() => {
                      tabsScrollRef.current?.scrollTo({
                        x: Math.max(0, tabsScrollX - 160),
                        animated: true,
                      });
                    }}
                    style={[adminStyles.mobileTabsChevron, adminStyles.mobileTabsChevronLeft]}
                  >
                    <Text style={adminStyles.mobileTabsChevronText}>‹</Text>
                  </Pressable>

                  <ScrollView
                    ref={tabsScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    onScroll={(e) => setTabsScrollX(e.nativeEvent.contentOffset.x)}
                    scrollEventThrottle={16}
                    contentContainerStyle={adminStyles.mobileTabsScroll}
                    style={{ flex: 1 }}
                  >
                    {navRoutes.map((item) => {
                      const selected = item.key === activeSection;
                      return (
                        <Pressable
                          key={item.key}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => router.replace(item.href as Href)}
                          style={[adminStyles.navTab, selected && adminStyles.navTabActive]}
                        >
                          <Text
                            style={[
                              adminStyles.navTabText,
                              selected && adminStyles.navTabTextActive,
                            ]}
                          >
                            {item.icon} {ta(item.labelKey)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={bi('Cuộn menu sang phải', 'Scroll menu right')}
                    onPress={() => {
                      tabsScrollRef.current?.scrollTo({
                        x: tabsScrollX + 160,
                        animated: true,
                      });
                    }}
                    style={[adminStyles.mobileTabsChevron, adminStyles.mobileTabsChevronRight]}
                  >
                    <Text style={adminStyles.mobileTabsChevronText}>›</Text>
                  </Pressable>
                </View>
              </>
            )}

            {/* Main Scrollable Content */}
            <ScrollView
              contentContainerStyle={[
                adminStyles.scroll,
                isDesktop && adminStyles.scrollDesktop,
              ]}
              keyboardShouldPersistTaps="handled"
            >
              <View style={adminStyles.container}>
                <View style={adminStyles.headerRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text accessibilityRole="header" style={adminStyles.title}>
                      {title}
                    </Text>
                    {!!subtitle && <Text style={adminStyles.subtitle}>{subtitle}</Text>}
                  </View>
                  {rightAction}
                </View>

                {children}
              </View>
            </ScrollView>

            {/* Floating Account Avatar Dropdown Popover Menu (Absolute Overlay) */}
            {accountMenuOpen && (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={bi('Đóng menu tài khoản', 'Close account menu')}
                  onPress={() => setAccountMenuOpen(false)}
                  style={adminStyles.accountMenuBackdrop}
                />
                <View style={adminStyles.accountMenuContainer}>
                  <View style={adminStyles.accountMenuHeader}>
                    <View style={adminStyles.avatarCircle}>
                      <Text style={adminStyles.avatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      {displayName ? (
                        <Text style={[adminStyles.accountMenuItemTitle, { fontSize: 14, fontWeight: '700' }]} numberOfLines={1}>
                          {displayName}
                        </Text>
                      ) : null}
                      <Text style={adminStyles.accountMenuRole}>
                        {bi('QUẢN TRỊ VIÊN · ADMIN', 'ADMINISTRATOR · ADMIN')}
                      </Text>
                      <Text style={adminStyles.accountMenuEmail} numberOfLines={1}>
                        {userEmail}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setAccountMenuOpen(false)}
                      style={adminStyles.topSearchClearBtn}
                    >
                      <Text style={adminStyles.topSearchClearText}>✕</Text>
                    </Pressable>
                  </View>

                  <View style={adminStyles.accountMenuDivider} />

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setAccountMenuOpen(false);
                      router.push('/account?mode=profile' as Href);
                    }}
                    style={adminStyles.accountMenuItem}
                  >
                    <Text style={adminStyles.accountMenuIcon}>✏️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={adminStyles.accountMenuItemTitle}>
                        {bi('Sửa hồ sơ', 'Edit Profile')}
                      </Text>
                      <Text style={adminStyles.accountMenuItemSub}>
                        {bi('Cập nhật họ tên & số điện thoại liên hệ', 'Update full name & phone')}
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setAccountMenuOpen(false);
                      router.push('/account?mode=password' as Href);
                    }}
                    style={adminStyles.accountMenuItem}
                  >
                    <Text style={adminStyles.accountMenuIcon}>🔒</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={adminStyles.accountMenuItemTitle}>
                        {bi('Đổi mật khẩu', 'Change Password')}
                      </Text>
                      <Text style={adminStyles.accountMenuItemSub}>
                        {bi('Thay đổi mật khẩu đăng nhập bảo mật', 'Update your account password')}
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setAccountMenuOpen(false);
                      router.push('/');
                    }}
                    style={adminStyles.accountMenuItem}
                  >
                    <Text style={adminStyles.accountMenuIcon}>🏠</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={adminStyles.accountMenuItemTitle}>
                        {bi('Về trang chủ', 'Back to Home')}
                      </Text>
                      <Text style={adminStyles.accountMenuItemSub}>
                        {bi('Chuyển sang giao diện đặt vé máy bay', 'Go to customer flight booking')}
                      </Text>
                    </View>
                  </Pressable>

                  <View style={adminStyles.accountMenuDivider} />

                  <Pressable
                    accessibilityRole="button"
                    disabled={signingOut}
                    onPress={() => void handleSignOut()}
                    style={[adminStyles.accountMenuItem, signingOut && adminStyles.disabled]}
                  >
                    <Text style={adminStyles.accountMenuIcon}>🚪</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[adminStyles.accountMenuItemTitle, { color: '#DC2626' }]}>
                        {signingOut
                          ? bi('Đang đăng xuất…', 'Signing out…')
                          : bi('Đăng xuất', 'Sign Out')}
                      </Text>
                      <Text style={adminStyles.accountMenuItemSub}>
                        {bi('Kết thúc phiên làm việc hiện tại', 'End current admin session')}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AdminSearchFilterBar({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  placeholder,
  onRefresh,
  onCreate,
  createLabel,
}: {
  query: string;
  onQueryChange: (val: string) => void;
  statusFilter?: StatusFilter;
  onStatusFilterChange?: (val: StatusFilter) => void;
  placeholder?: string;
  onRefresh?: () => void;
  onCreate?: () => void;
  createLabel?: string;
}) {
  const { ta } = useAdminI18n();
  const filters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: ta('admin.filter.all') },
    { value: 'active', label: ta('admin.filter.active') },
    { value: 'inactive', label: ta('admin.filter.inactive') },
  ];

  return (
    <View style={adminStyles.card}>
      <View style={adminStyles.filterTopRow}>
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder={placeholder ?? ta('admin.search.placeholder')}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={[adminStyles.input, { flex: 1, minWidth: 200 }]}
        />
        {onRefresh && (
          <Pressable
            accessibilityRole="button"
            onPress={onRefresh}
            style={adminStyles.secondaryBtnSmall}
          >
            <Text style={adminStyles.secondaryBtnText}>↻ {ta('admin.action.refresh')}</Text>
          </Pressable>
        )}
        {onCreate && (
          <Pressable
            accessibilityRole="button"
            onPress={onCreate}
            style={adminStyles.primaryBtnSmall}
          >
            <Text style={adminStyles.primaryBtnText}>
              {createLabel ?? ta('admin.action.create')}
            </Text>
          </Pressable>
        )}
      </View>

      {statusFilter !== undefined && onStatusFilterChange && (
        <View style={adminStyles.chipRow}>
          {filters.map((item) => {
            const selected = statusFilter === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onStatusFilterChange(item.value)}
                style={[adminStyles.chip, selected && adminStyles.chipSelected]}
              >
                <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function EllipsisJumpButton({
  targetPage,
  direction,
  onPress,
  bi,
}: {
  targetPage: number;
  direction: 'prev' | 'next';
  onPress: () => void;
  bi: (vi: string, en: string) => string;
}) {
  const [hovered, setHovered] = useState(false);
  const label = bi(`Chuyển đến trang ${targetPage}`, `Jump to page ${targetPage}`);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...({ title: label } as any)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={onPress}
      style={[
        adminStyles.pagePill,
        hovered && {
          backgroundColor: '#ECFEFF',
          borderColor: '#0891B2',
          minWidth: 44,
          paddingHorizontal: 8,
        },
      ]}
    >
      <Text
        style={[
          adminStyles.pagePillText,
          hovered && {
            color: '#0891B2',
            fontWeight: '700',
            fontSize: 12,
          },
        ]}
      >
        {hovered
          ? direction === 'prev'
            ? `« ${targetPage}`
            : `${targetPage} »`
          : '…'}
      </Text>
    </Pressable>
  );
}

export function AdminPaginationBar({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (nextPage: number) => void;
}) {
  const { ta, bi } = useAdminI18n();
  const { width } = useWindowDimensions();
  const isCompact = width < 680;
  const isMobile = width < 480;
  const [targetPageInput, setTargetPageInput] = useState('');

  const handleJumpSubmit = () => {
    const parsed = parseInt(targetPageInput.trim(), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      onPageChange(parsed);
      setTargetPageInput('');
    }
  };

  const getVisiblePages = (): (number | 'ellipsis-prev' | 'ellipsis-next')[] => {
    if (isMobile) {
      if (totalPages <= 5) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }
      const pages: (number | 'ellipsis-prev' | 'ellipsis-next')[] = [1];
      if (page > 3) {
        pages.push('ellipsis-prev');
      } else if (page === 3) {
        pages.push(2);
      }
      if (page > 1 && page < totalPages) {
        pages.push(page);
      }
      if (page < totalPages - 2) {
        pages.push('ellipsis-next');
      } else if (page === totalPages - 2) {
        pages.push(totalPages - 1);
      }
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
      return pages;
    }

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis-prev' | 'ellipsis-next')[] = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    if (start > 2) {
      pages.push('ellipsis-prev');
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (end < totalPages - 1) {
      pages.push('ellipsis-next');
    }
    pages.push(totalPages);
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <View style={[adminStyles.paginationRow, isCompact && { justifyContent: 'center' }]}>
      <Text style={[adminStyles.muted, isCompact && { textAlign: 'center', width: '100%', marginBottom: 4 }]}>
        {ta('admin.pagination.summary', { page, totalPages, total })}
      </Text>

      <View
        style={[
          adminStyles.rowGap,
          {
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: isCompact ? 'center' : 'flex-end',
            width: isCompact ? '100%' : 'auto',
          },
        ]}
      >
        <View style={[adminStyles.rowGap, { alignItems: 'center', justifyContent: 'center' }]}>
          {/* Previous page */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ta('admin.pagination.prev')}
            disabled={page <= 1}
            onPress={() => onPageChange(page - 1)}
            style={[
              adminStyles.secondaryBtnSmall,
              isCompact && { minWidth: 36, paddingHorizontal: 10 },
              page <= 1 && adminStyles.disabled,
            ]}
          >
            <Text style={adminStyles.secondaryBtnText}>
              {isCompact ? '←' : ta('admin.pagination.prev')}
            </Text>
          </Pressable>

          {/* Page numbers */}
          {visiblePages.map((item, idx) => {
            if (item === 'ellipsis-prev') {
              const target = Math.max(1, page - 5);
              return (
                <EllipsisJumpButton
                  key={`ellipsis-prev-${idx}`}
                  targetPage={target}
                  direction="prev"
                  onPress={() => onPageChange(target)}
                  bi={bi}
                />
              );
            }
            if (item === 'ellipsis-next') {
              const target = Math.min(totalPages, page + 5);
              return (
                <EllipsisJumpButton
                  key={`ellipsis-next-${idx}`}
                  targetPage={target}
                  direction="next"
                  onPress={() => onPageChange(target)}
                  bi={bi}
                />
              );
            }
            const isSelected = item === page;
            return (
              <Pressable
                key={`page-${item}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => onPageChange(item)}
                style={[adminStyles.pagePill, isSelected && adminStyles.pagePillActive]}
              >
                <Text
                  style={[
                    adminStyles.pagePillText,
                    isSelected && adminStyles.pagePillTextActive,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}

          {/* Next page */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ta('admin.pagination.next')}
            disabled={page >= totalPages}
            onPress={() => onPageChange(page + 1)}
            style={[
              adminStyles.secondaryBtnSmall,
              isCompact && { minWidth: 36, paddingHorizontal: 10 },
              page >= totalPages && adminStyles.disabled,
            ]}
          >
            <Text style={adminStyles.secondaryBtnText}>
              {isCompact ? '→' : ta('admin.pagination.next')}
            </Text>
          </Pressable>
        </View>

        {/* Direct page jump input */}
        {totalPages > 1 && (
          <View
            style={[
              adminStyles.pageJumpRow,
              isCompact && { marginLeft: 0, marginTop: 4, width: '100%', justifyContent: 'center' },
            ]}
          >
            <Text style={adminStyles.pageJumpLabel}>
              {bi('Đến trang:', 'Go to:')}
            </Text>
            <TextInput
              keyboardType="number-pad"
              value={targetPageInput}
              onChangeText={setTargetPageInput}
              onSubmitEditing={handleJumpSubmit}
              placeholder={String(page)}
              placeholderTextColor="#94A3B8"
              style={adminStyles.pageJumpInput}
            />
            <Pressable
              accessibilityRole="button"
              onPress={handleJumpSubmit}
              style={adminStyles.pageJumpBtn}
            >
              <Text style={adminStyles.pageJumpBtnText}>{bi('Đi', 'Go')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

export function AdminStatusBadge({
  active,
  customLabel,
}: {
  active: boolean;
  customLabel?: string;
}) {
  const { ta } = useAdminI18n();
  return (
    <View style={[adminStyles.badge, active ? adminStyles.badgeActive : adminStyles.badgeInactive]}>
      <Text
        style={[
          adminStyles.badgeText,
          active ? adminStyles.badgeTextActive : adminStyles.badgeTextInactive,
        ]}
      >
        {customLabel ?? (active ? ta('admin.status.active') : ta('admin.status.inactive'))}
      </Text>
    </View>
  );
}

export function AdminTextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = 'none',
  editable = true,
  helperText,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'numbers-and-punctuation';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  helperText?: string;
}) {
  return (
    <View style={adminStyles.fieldGroup}>
      <Text style={adminStyles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
        style={[adminStyles.input, !editable && adminStyles.inputDisabled]}
      />
      {!!helperText && <Text style={adminStyles.helperText}>{helperText}</Text>}
    </View>
  );
}

export function AdminLoadingState({ text }: { text?: string }) {
  const { ta } = useAdminI18n();
  return (
    <View style={[adminStyles.card, adminStyles.centered]}>
      <ActivityIndicator size="large" color={consolePalette.brandTeal} />
      <Text style={adminStyles.muted}>{text ?? ta('admin.loading')}</Text>
    </View>
  );
}

export const adminStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: consolePalette.canvasBg },
  rootLayout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: consolePalette.canvasBg,
  },
  desktopSidebarScroll: {
    width: 252,
    maxWidth: 252,
    flexGrow: 0,
    backgroundColor: consolePalette.sidebarBg,
    borderRightWidth: 1,
    borderRightColor: consolePalette.cardBorder,
  },
  desktopSidebar: {
    paddingVertical: 18,
    paddingHorizontal: 14,
  },
  sidebarInner: {
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  brandLogo: {
    width: 42,
    height: 42,
    borderRadius: 11,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#102A43',
    lineHeight: 24,
    letterSpacing: 1,
  },
  brandDot: {
    color: '#00B8D0',
    fontWeight: '900',
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0891B2',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  workspaceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: consolePalette.subtleBg,
    borderWidth: 1,
    borderColor: consolePalette.cardBorder,
    marginVertical: 4,
  },
  workspaceAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workspaceAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: consolePalette.brandTeal,
  },
  workspaceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: consolePalette.heading,
  },
  workspaceSub: {
    fontSize: 11,
    color: consolePalette.subtext,
  },
  workspaceChevron: {
    fontSize: 14,
    color: consolePalette.subtext,
    fontWeight: '700',
  },
  sidebarGroupLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  sidebarNavList: {
    gap: 3,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  sidebarItemActive: {
    backgroundColor: consolePalette.brandTealLight,
  },
  sidebarItemIcon: {
    fontSize: 14,
    color: consolePalette.subtext,
    width: 20,
    textAlign: 'center',
  },
  sidebarItemIconActive: {
    color: consolePalette.brandTeal,
  },
  sidebarItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  sidebarItemTextActive: {
    color: consolePalette.brandTealDark,
    fontWeight: '700',
  },
  sidebarBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: consolePalette.subtleBg,
  },
  sidebarBadgeActive: {
    backgroundColor: '#CFFAFE',
  },
  sidebarBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: consolePalette.subtext,
  },
  sidebarBadgeTextActive: {
    color: consolePalette.brandTealDark,
  },
  mainColumn: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
  },
  topConsoleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: consolePalette.cardBorder,
    gap: 10,
  },
  topConsoleBarCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    flexWrap: 'nowrap',
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breadcrumbMuted: {
    fontSize: 13,
    color: consolePalette.subtext,
    fontWeight: '500',
  },
  breadcrumbSeparator: {
    fontSize: 14,
    color: '#CBD5E1',
  },
  breadcrumbCurrent: {
    fontSize: 14,
    fontWeight: '700',
    color: consolePalette.heading,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  topBarRightCompact: {
    flex: 1,
    gap: 6,
    justifyContent: 'flex-end',
    flexWrap: 'nowrap',
  },
  topSearchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 6,
    height: 38,
    borderRadius: 999,
    backgroundColor: consolePalette.subtleBg,
    borderWidth: 1,
    borderColor: consolePalette.cardBorder,
    minWidth: 270,
    gap: 6,
  },
  topSearchInputWrapperCompact: {
    flex: 1,
    minWidth: 90,
    maxWidth: 240,
    height: 34,
    paddingLeft: 8,
    paddingRight: 4,
    gap: 4,
  },
  topSearchIcon: {
    fontSize: 13,
  },
  topSearchInput: {
    flex: 1,
    fontSize: 13,
    color: consolePalette.heading,
    paddingVertical: 4,
    minWidth: 120,
  },
  topSearchClearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topSearchClearText: {
    fontSize: 11,
    color: consolePalette.subtext,
    fontWeight: '700',
  },
  topSearchGoBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: consolePalette.brandTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topSearchGoText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarCircleActive: {
    borderColor: consolePalette.brandTeal,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3730A3',
  },
  accountMenuBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 90,
  },
  accountMenuContainer: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 300,
    maxWidth: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: consolePalette.cardBorder,
    paddingVertical: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    zIndex: 100,
  },
  accountMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  accountMenuRole: {
    fontSize: 10,
    fontWeight: '800',
    color: consolePalette.brandTeal,
    letterSpacing: 0.5,
  },
  accountMenuEmail: {
    fontSize: 13,
    fontWeight: '700',
    color: consolePalette.heading,
  },
  accountMenuDivider: {
    height: 1,
    backgroundColor: consolePalette.cardBorder,
    marginVertical: 4,
  },
  accountMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  accountMenuIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
  },
  accountMenuItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: consolePalette.heading,
  },
  accountMenuItemSub: {
    fontSize: 11,
    color: consolePalette.subtext,
  },
  mobileMenuBtn: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: consolePalette.subtleBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: consolePalette.cardBorder,
  },
  mobileMenuBtnActive: {
    backgroundColor: consolePalette.brandTealLight,
    borderColor: consolePalette.brandTealBorder,
  },
  mobileMenuBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: consolePalette.heading,
    lineHeight: 18,
  },
  mobileMenuBtnTextActive: {
    color: consolePalette.brandTeal,
  },
  mobileMenuBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: consolePalette.heading,
  },
  mobileMenuBtnLabelActive: {
    color: consolePalette.brandTealDark,
  },
  mobileDrawerCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: consolePalette.cardBorder,
  },
  mobileTabsWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: consolePalette.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mobileTabsChevron: {
    width: 26,
    height: '100%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    zIndex: 2,
  },
  mobileTabsChevronLeft: {
    borderRightWidth: 1,
    borderRightColor: consolePalette.cardBorder,
  },
  mobileTabsChevronRight: {
    borderLeftWidth: 1,
    borderLeftColor: consolePalette.cardBorder,
  },
  mobileTabsChevronText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#64748B',
    lineHeight: 20,
  },
  mobileTabsScroll: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  scroll: { flexGrow: 1, padding: 16 },
  scrollDesktop: { paddingHorizontal: 28, paddingVertical: 24 },
  container: { width: '100%', maxWidth: 1180, alignSelf: 'center', gap: 16 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  backBtn: { paddingVertical: 6 },
  backLink: { color: consolePalette.brandTeal, fontSize: 14, fontWeight: '700' },
  navBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: consolePalette.cardBorder,
  },
  navTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: consolePalette.subtleBg,
  },
  navTabActive: {
    backgroundColor: consolePalette.brandTealLight,
    borderWidth: 1,
    borderColor: consolePalette.brandTealBorder,
  },
  navTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  navTabTextActive: {
    color: consolePalette.brandTealDark,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: consolePalette.heading },
  subtitle: { fontSize: 14, color: consolePalette.subtext, lineHeight: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: consolePalette.heading },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: consolePalette.cardBorder,
    padding: 18,
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: consolePalette.cardBorder,
    padding: 16,
    gap: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowGap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: consolePalette.cardBorder,
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    borderColor: consolePalette.brandTeal,
    backgroundColor: consolePalette.brandTealLight,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: consolePalette.heading },
  chipTextSelected: { color: consolePalette.brandTealDark, fontWeight: '700' },
  fieldGroup: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: consolePalette.heading },
  helperText: { fontSize: 12, color: consolePalette.subtext },
  muted: { fontSize: 13, color: consolePalette.subtext, lineHeight: 19 },
  bold: { fontSize: 15, fontWeight: '700', color: consolePalette.heading },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: consolePalette.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: consolePalette.heading,
    backgroundColor: '#FFFFFF',
  },
  inputDisabled: {
    backgroundColor: consolePalette.subtleBg,
    color: consolePalette.subtext,
  },
  primaryBtnSmall: {
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: consolePalette.brandTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  secondaryBtnSmall: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: consolePalette.cardBorder,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: consolePalette.heading, fontSize: 13, fontWeight: '600' },
  dangerBtnSmall: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: { color: colors.error, fontSize: 13, fontWeight: '700' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeInactive: {
    backgroundColor: consolePalette.subtleBg,
    borderColor: consolePalette.cardBorder,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextActive: { color: '#047857' },
  badgeTextInactive: { color: consolePalette.subtext },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 6,
  },
  paginationBtnSmall: {
    minHeight: 36,
    minWidth: 42,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: consolePalette.cardBorder,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationBtnText: {
    color: '#0891B2',
    fontSize: 13,
    fontWeight: '700',
  },
  pagePill: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: consolePalette.cardBorder,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagePillActive: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  pagePillText: {
    color: consolePalette.heading,
    fontSize: 13,
    fontWeight: '600',
  },
  pagePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pageJumpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 6,
  },
  pageJumpLabel: {
    fontSize: 13,
    color: consolePalette.subtext,
    fontWeight: '500',
  },
  pageJumpInput: {
    width: 48,
    height: 36,
    borderWidth: 1,
    borderColor: consolePalette.cardBorder,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: consolePalette.heading,
    paddingVertical: 0,
    paddingHorizontal: 4,
  },
  pageJumpBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0891B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageJumpBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  disabled: { opacity: 0.5 },
  divider: { height: 1, backgroundColor: consolePalette.cardBorder, marginVertical: 6 },
});
