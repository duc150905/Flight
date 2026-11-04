import { router, usePathname } from 'expo-router';
import { useStore } from 'zustand';
import { SymbolView } from 'expo-symbols';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/features/i18n/provider';
import { searchStore } from '@/features/discovery/search-state';

const ACTIVE_COLOR = '#007E91';
const INACTIVE_COLOR = '#64748B';

type TabIconName = 'home' | 'explore' | 'profile';

const tabSymbols = {
  home: { ios: 'house', android: 'home', web: 'home' },
  explore: { ios: 'globe.americas.fill', android: 'public', web: 'public' },
  profile: { ios: 'person', android: 'person', web: 'person' },
} as const;

function TabIcon({ name, active }: { name: TabIconName; active: boolean }) {
  return (
    <View style={[styles.iconPill, active && styles.iconPillActive]}>
      <SymbolView
        name={tabSymbols[name]}
        size={22}
        tintColor={active ? ACTIVE_COLOR : INACTIVE_COLOR}
        accessible={false}
      />
    </View>
  );
}

export function BottomTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { searchOpen, openSearch, closeSearch } = useStore(searchStore);

  const isProfileActive = pathname === '/account' || pathname.startsWith('/account');
  const isHomeActive = !isProfileActive && (pathname === '/' || pathname === '') && !searchOpen;
  const isExploreActive = !isProfileActive && (searchOpen || pathname.includes('search'));
  const isFlightSelectionActive = pathname === '/results' || pathname === '/itinerary-results' || pathname === '/detail';

  const confirmIfInSearch = (onConfirm: () => void) => {
    if (isFlightSelectionActive) {
      const title = t('Rời khỏi kết quả tìm kiếm?');
      const message = t('Bạn đang xem danh sách chuyến bay. Bạn có thể quay lại xem tiếp từ Trang chủ hoặc Khám phá bất cứ lúc nào.');
      if (typeof Platform !== 'undefined' && Platform?.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm?.(`${title}\n${message}`)) {
          onConfirm();
        }
      } else if (typeof Alert !== 'undefined' && Alert?.alert) {
        Alert.alert(
          title,
          message,
          [
            { text: t('Ở lại'), style: 'cancel' },
            { text: t('Rời đi'), style: 'default', onPress: onConfirm },
          ],
          { cancelable: true }
        );
      } else {
        onConfirm();
      }
    } else {
      onConfirm();
    }
  };

  const handlePressHome = () => {
    confirmIfInSearch(() => {
      closeSearch();
      if (pathname !== '/' && pathname !== '') {
        router.replace('/');
      }
    });
  };

  const handlePressExplore = () => {
    confirmIfInSearch(() => {
      openSearch();
      if (pathname !== '/' && pathname !== '') {
        router.replace({ pathname: '/', params: { search: '1' } });
      }
    });
  };

  const handlePressProfile = () => {
    if (!isProfileActive) {
      confirmIfInSearch(() => {
        closeSearch();
        router.replace('/account');
      });
    }
  };

  return (
    <View style={[styles.barContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.barInner}>
        {/* Home Tab */}
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel={t('Trang chủ')}
          accessibilityState={{ selected: isHomeActive }}
          onPress={handlePressHome}
          style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}
        >
          <TabIcon name="home" active={isHomeActive} />
          <Text style={[styles.tabLabel, isHomeActive && styles.tabLabelActive]}>
            {t('Trang chủ')}
          </Text>
        </Pressable>

        {/* Explore Tab */}
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel={t('Khám phá')}
          accessibilityState={{ selected: isExploreActive }}
          onPress={handlePressExplore}
          style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}
        >
          <TabIcon name="explore" active={isExploreActive} />
          <Text style={[styles.tabLabel, isExploreActive && styles.tabLabelActive]}>
            {t('Khám phá')}
          </Text>
        </Pressable>

        {/* Profile Tab */}
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel={t('Hồ sơ')}
          accessibilityState={{ selected: isProfileActive }}
          onPress={handlePressProfile}
          style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}
        >
          <TabIcon name="profile" active={isProfileActive} />
          <Text style={[styles.tabLabel, isProfileActive && styles.tabLabelActive]}>
            {t('Hồ sơ')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  barInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
    minHeight: 46,
  },
  tabButtonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.94 }],
  },
  iconPill: {
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: '#E6F4F6',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: INACTIVE_COLOR,
  },
  tabLabelActive: {
    color: ACTIVE_COLOR,
    fontWeight: '700',
  },
});

