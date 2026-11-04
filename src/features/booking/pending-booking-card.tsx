import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '@/features/i18n/provider';
import { clearPendingSelection, getPendingSelection } from './pending-selection-storage';

export function PendingBookingCard({ style }: { style?: any }) {
  const { t } = useLanguage();
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void getPendingSelection().then(setPendingSelection);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (!pendingSelection) return null;

  const handleResume = () => {
    router.push({
      pathname: '/checkout',
      params: { selection: pendingSelection },
    });
  };

  const handleDismiss = async () => {
    await clearPendingSelection();
    setPendingSelection(null);
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.planeIcon}>✈</Text>
          <Text style={styles.title}>{t('Bạn có chuyến bay đang chọn dở')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Đóng')}
          onPress={handleDismiss}
          hitSlop={8}
          style={styles.closeBtn}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.desc}>
        {t('Lựa chọn chuyến bay của bạn vẫn đang được lưu tạm an toàn. Bạn có thể tiếp tục đặt vé ngay mà không cần tìm lại từ đầu!')}
      </Text>
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          onPress={handleResume}
          style={styles.resumeButton}
        >
          <Text style={styles.resumeText}>{t('Tiếp tục đặt vé ngay ➔')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#5EEAD4',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginVertical: 10,
    shadowColor: '#0F766E',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  planeIcon: {
    fontSize: 18,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F766E',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '600',
  },
  desc: {
    fontSize: 13,
    color: '#115E59',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 2,
  },
  resumeButton: {
    backgroundColor: '#0D9488',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    flex: 1,
  },
  resumeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

