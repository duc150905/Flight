import { router, type Href } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/features/auth/ui';
import { LanguagePicker, useAdminI18n } from './i18n';
import type { StatusFilter } from './model';

export type AdminSectionKey = 'home' | 'catalogues' | 'aircraft' | 'flights' | 'addons';

const navRoutes: { key: AdminSectionKey; href: '/admin' | '/admin/catalogues' | '/admin/aircraft' | '/admin/flights' | '/admin/addons'; labelKey: string }[] = [
  { key: 'home', href: '/admin', labelKey: 'admin.nav.home' },
  { key: 'catalogues', href: '/admin/catalogues', labelKey: 'admin.nav.catalogues' },
  { key: 'aircraft', href: '/admin/aircraft', labelKey: 'admin.nav.aircraft' },
  { key: 'flights', href: '/admin/flights', labelKey: 'admin.nav.flights' },
  { key: 'addons', href: '/admin/addons', labelKey: 'admin.nav.addons' },
];

export function AdminShell({
  activeSection,
  title,
  subtitle,
  rightAction,
  children,
}: PropsWithChildren<{
  activeSection: AdminSectionKey;
  title: string;
  subtitle?: string;
  rightAction?: ReactNode;
}>) {
  const { ta } = useAdminI18n();

  return (
    <SafeAreaView style={adminStyles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={adminStyles.safe}
      >
        <ScrollView contentContainerStyle={adminStyles.scroll} keyboardShouldPersistTaps="handled">
          <View style={adminStyles.container}>
            <View style={adminStyles.topBar}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/account')}
                style={adminStyles.backBtn}
              >
                <Text style={adminStyles.backLink}>{ta('admin.backToAccount')}</Text>
              </Pressable>
              <LanguagePicker />
            </View>

            <View style={adminStyles.navBar}>
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
                    <Text style={[adminStyles.navTabText, selected && adminStyles.navTabTextActive]}>
                      {ta(item.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

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
          style={[adminStyles.input, { flex: 1 }]}
        />
        {onRefresh && (
          <Pressable accessibilityRole="button" onPress={onRefresh} style={adminStyles.secondaryBtnSmall}>
            <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.refresh')}</Text>
          </Pressable>
        )}
        {onCreate && (
          <Pressable accessibilityRole="button" onPress={onCreate} style={adminStyles.primaryBtnSmall}>
            <Text style={adminStyles.primaryBtnText}>{createLabel ?? ta('admin.action.create')}</Text>
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

export function AdminStatusBadge({ active, customLabel }: { active: boolean; customLabel?: string }) {
  const { ta } = useAdminI18n();
  return (
    <View style={[adminStyles.badge, active ? adminStyles.badgeActive : adminStyles.badgeInactive]}>
      <Text style={[adminStyles.badgeText, active ? adminStyles.badgeTextActive : adminStyles.badgeTextInactive]}>
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
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={adminStyles.muted}>{text ?? ta('admin.loading')}</Text>
    </View>
  );
}

export const adminStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: 16 },
  container: { width: '100%', maxWidth: 960, alignSelf: 'center', gap: 14 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  backBtn: { paddingVertical: 6 },
  backLink: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  navBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  navTabActive: {
    backgroundColor: colors.primary,
  },
  navTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  navTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: '#E0F2FE',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextSelected: { color: colors.primary, fontWeight: '700' },
  fieldGroup: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  helperText: { fontSize: 12, color: colors.muted },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  bold: { fontSize: 15, fontWeight: '700', color: colors.text },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputDisabled: {
    backgroundColor: '#F1F5F9',
    color: colors.muted,
  },
  primaryBtnSmall: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  secondaryBtnSmall: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  dangerBtnSmall: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: { color: colors.error, fontSize: 13, fontWeight: '700' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
  },
  badgeInactive: {
    backgroundColor: '#F1F5F9',
    borderColor: colors.border,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextActive: { color: colors.success },
  badgeTextInactive: { color: colors.muted },
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
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
});
