import { router, usePathname } from 'expo-router';
import { useStore } from 'zustand';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/features/i18n/provider';
import { searchStore } from '@/features/discovery/search-state';

const ACTIVE_COLOR = '#007E91';
const INACTIVE_COLOR = '#64748B';

function createSvgUri(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}

function HomeIcon({ active, size = 24 }: { active: boolean; size?: number }) {
  const color = active ? ACTIVE_COLOR : INACTIVE_COLOR;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5z"/></svg>`;
  return <Image source={{ uri: createSvgUri(svg) }} style={{ width: size, height: size }} contentFit="contain" accessible={false} alt="" />;
}

function ExploreIcon({ active, size = 24 }: { active: boolean; size?: number }) {
  const color = active ? ACTIVE_COLOR : INACTIVE_COLOR;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`;
  return <Image source={{ uri: createSvgUri(svg) }} style={{ width: size, height: size }} contentFit="contain" accessible={false} alt="" />;
}

function ProfileIcon({ active, size = 24 }: { active: boolean; size?: number }) {
  const color = active ? ACTIVE_COLOR : INACTIVE_COLOR;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-7A4.5 4.5 0 0 0 4 19.5V21"/><circle cx="12" cy="7.5" r="4"/></svg>`;
  return <Image source={{ uri: createSvgUri(svg) }} style={{ width: size, height: size }} contentFit="contain" accessible={false} alt="" />;
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
          <HomeIcon active={isHomeActive} />
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
          <ExploreIcon active={isExploreActive} />
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
          <ProfileIcon active={isProfileActive} />
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

