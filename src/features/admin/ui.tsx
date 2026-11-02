import { router, type Href } from 'expo-router';
import { useState, type PropsWithChildren, type ReactNode } from 'react';
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
  const initials = userEmail.slice(0, 2).toUpperCase();
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
        <View style={adminStyles.brandIconBox}>
          <Text style={adminStyles.brandIconText}>✈</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={adminStyles.brandTitle}>Flyora</Text>
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
            <View style={adminStyles.topConsoleBar}>
              <View style={adminStyles.breadcrumbRow}>
                {!isDesktop && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setMobileMenuOpen((v) => !v)}
                    style={adminStyles.mobileMenuBtn}
                  >
                    <Text style={adminStyles.mobileMenuBtnText}>
                      {mobileMenuOpen ? '✕' : '☰'}
                    </Text>
                  </Pressable>
                )}
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
              </View>

              <View style={adminStyles.topBarRight}>
                {/* Interactive Live Search Input right in the top bar */}
                <View
                  style={[
                    adminStyles.topSearchInputWrapper,
                    !isDesktop && { minWidth: 165, maxWidth: 210 },
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
                    placeholder={bi(
                      'Tìm booking, hành khách, chuyến bay…',
                      'Search bookings, passengers, flights…',
                    )}
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

                <LanguagePicker />
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
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={adminStyles.mobileTabsScroll}
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
  const { ta } = useAdminI18n();
  return (
    <View style={adminStyles.paginationRow}>
      <Text style={adminStyles.muted}>
        {ta('admin.pagination.summary', { page, totalPages, total })}
      </Text>
      <View style={adminStyles.rowGap}>
        <Pressable
          accessibilityRole="button"
          disabled={page <= 1}
          onPress={() => onPageChange(page - 1)}
          style={[adminStyles.secondaryBtnSmall, page <= 1 && adminStyles.disabled]}
        >
          <Text style={adminStyles.secondaryBtnText}>{ta('admin.pagination.prev')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={page >= totalPages}
          onPress={() => onPageChange(page + 1)}
          style={[adminStyles.secondaryBtnSmall, page >= totalPages && adminStyles.disabled]}
        >
          <Text style={adminStyles.secondaryBtnText}>{ta('admin.pagination.next')}</Text>
        </Pressable>
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
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  brandIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: consolePalette.brandTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: consolePalette.heading,
    lineHeight: 22,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: consolePalette.subtext,
    letterSpacing: 1,
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
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: consolePalette.subtleBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: consolePalette.cardBorder,
  },
  mobileMenuBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: consolePalette.heading,
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
  },
  mobileTabsScroll: {
    paddingHorizontal: 14,
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
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  disabled: { opacity: 0.5 },
  divider: { height: 1, backgroundColor: consolePalette.cardBorder, marginVertical: 6 },
});
