import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAdmin } from './use-admin';
import { colors, styles } from './ui';

interface AdminGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component guard to protect Admin-only UI views or actions.
 * Only renders children when the authenticated user possesses the admin role.
 */
export function AdminGuard({ children, fallback }: AdminGuardProps) {
  const { isAdmin, loading, error, refetch } = useAdmin();

  if (loading) {
    return (
      <View style={guardStyles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.description, guardStyles.spacing]}>Đang kiểm tra quyền quản trị…</Text>
      </View>
    );
  }

  if (error || !isAdmin) {
    if (fallback) return <>{fallback}</>;
    return (
      <View style={guardStyles.centered}>
        <View style={guardStyles.warningBox}>
          <Text style={guardStyles.warningTitle}>Truy cập bị từ chối</Text>
          <Text style={styles.description}>
            {error ?? 'Tài khoản của bạn không có quyền quản trị viên để thực hiện thao tác này.'}
          </Text>
          <Text onPress={() => void refetch()} style={[styles.link, guardStyles.retry]}>
            Thử kiểm tra lại
          </Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const guardStyles = StyleSheet.create({
  centered: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacing: {
    marginTop: 12,
  },
  warningBox: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.errorBg,
    borderColor: colors.error,
    borderWidth: 1,
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.error,
    marginBottom: 6,
  },
  retry: {
    marginTop: 12,
    fontWeight: '600',
  },
});

