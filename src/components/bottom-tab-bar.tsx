import { router, usePathname } from 'expo-router';
import { useStore } from 'zustand';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  return <SymbolView
    name={tabSymbols[name]}
    size={24}
    tintColor={active ? ACTIVE_COLOR : INACTIVE_COLOR}
    accessible={false}
  />;
}

export function BottomTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { searchOpen, openSearch, closeSearch } = useStore(searchStore);

  const isProfileActive = pathname === '/account' || pathname.startsWith('/account');
  const isHomeActive = !isProfileActive && (pathname === '/' || pathname === '') && !searchOpen;
  const isExploreActive = !isProfileActive && (searchOpen || pathname.includes('search'));

  const handlePressHome = () => {
    closeSearch();
    if (pathname !== '/' && pathname !== '') {
      router.replace('/');
    }
  };

  const handlePressExplore = () => {
    openSearch();
    if (pathname !== '/' && pathname !== '') {
      router.replace({ pathname: '/', params: { search: '1' } });
    }
  };

  const handlePressProfile = () => {
    if (!isProfileActive) {
      closeSearch();
      router.push('/account');
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
          style={styles.tabButton}
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
          style={styles.tabButton}
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
          style={styles.tabButton}
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
    gap: 4,
    paddingVertical: 4,
    minHeight: 46,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: INACTIVE_COLOR,
  },
  tabLabelActive: {
    color: ACTIVE_COLOR,
    fontWeight: '700',
  },
});

