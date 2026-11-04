import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '@/features/i18n/provider';
import { clearLastSearch, getLastSearch, type LastSearchData } from './last-search-storage';

export function RecentSearchCard({ style }: { style?: any }) {
  const { t } = useLanguage();
  const [lastSearch, setLastSearch] = useState<LastSearchData | null>(null);

  const refresh = useCallback(() => {
    void getLastSearch().then(setLastSearch);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (!lastSearch) return null;

  const handleReturn = () => {
    if (lastSearch.type === 'one_way') {
      router.push({
        pathname: '/results',
        params: lastSearch.params,
      });
    } else {
      router.push({
        pathname: '/itinerary-results',
        params: { search: lastSearch.searchJson },
      });
    }
  };

  const handleDismiss = async () => {
    await clearLastSearch();
    setLastSearch(null);
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>🔍</Text>
          <Text style={styles.title}>{t('Bạn vừa tìm kiếm chuyến bay')}</Text>
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
        {lastSearch.label
          ? `${t('Chuyến bay:')} ${lastSearch.label}`
          : t('Danh sách chuyến bay bạn vừa tìm kiếm vẫn được lưu. Bạn có thể quay lại xem tiếp bất cứ lúc nào!')}
      </Text>
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          onPress={handleReturn}
          style={styles.returnButton}
        >
          <Text style={styles.returnText}>{t('Quay lại danh sách chuyến bay ➔')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginVertical: 10,
    shadowColor: '#334155',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
  icon: {
    fontSize: 18,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '600',
  },
  desc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 2,
  },
  returnButton: {
    backgroundColor: '#007E91',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    flex: 1,
  },
  returnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

