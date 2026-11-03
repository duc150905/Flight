import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBrand } from '@/components/app-brand';
import { useAuth } from '@/features/auth/auth-provider';
import { Notice } from '@/features/auth/ui';
import { LanguagePicker, useLanguage } from '@/features/i18n/provider';
import { listAirports, listDestinations } from './data';
import type { Airport, Destination } from './model';
import { SearchFlow } from './search-flow';
import { destinationImages } from './destination-images';
import { flightColors } from './ui';
import { consumeOpenSearch, searchStore } from './search-state';

const emptyAirports: Airport[] = [];
const emptyDestinations: Destination[] = [];

export function HomeScreen() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const isTablet = width >= 640 && width < 900;

  const airportsQuery = useQuery({ queryKey: ['airports'], queryFn: listAirports });
  const destinationsQuery = useQuery({ queryKey: ['featured-destinations'], queryFn: listDestinations });
  const airports = airportsQuery.data ?? emptyAirports;
  const destinations = destinationsQuery.data ?? emptyDestinations;
  const airportById = useMemo(() => new Map(airports.map(airport => [airport.id, airport])), [airports]);
  const params = useLocalSearchParams<{ search?: string }>();
  const { searchOpen, openSearch, closeSearch } = useStore(searchStore);
  const [initialDestinationId, setInitialDestinationId] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (consumeOpenSearch() || params.search === '1' || params.search === 'true') {
        setInitialDestinationId('');
        openSearch();
      }
    }, [params.search, openSearch])
  );

  const destinationCardWidth = isDesktop ? '23.4%' : isTablet ? '31.4%' : '47.5%';

  if (searchOpen) return <SearchFlow airports={airports} loading={airportsQuery.isPending}
    error={airportsQuery.isError} onRetry={() => void airportsQuery.refetch()}
    onClose={closeSearch} initialDestinationId={initialDestinationId} />;

  return (
    <SafeAreaView style={home.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={[home.scroll, isDesktop && home.scrollDesktop]}>
        <View style={[home.container, isDesktop && home.containerDesktop]}>
          {/* Top Header */}
          <View style={home.header}>
            <View style={home.heading}>
              <AppBrand />
              <Text style={home.headingSub}>{t('Hành trình tiếp theo bắt đầu từ đây.')}</Text>
            </View>
            <View style={home.headerActions}>
              {isDesktop && <LanguagePicker />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(session ? 'Tài khoản' : 'Đăng nhập')}
                onPress={() => router.push('/account')}
                style={home.avatar}
              >
                <Text style={home.avatarText}>
                  {session?.user?.email?.charAt(0).toUpperCase() || 'A'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Search Button / Hero CTA */}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setInitialDestinationId('');
              openSearch();
            }}
            style={[home.searchButton, isDesktop && home.searchButtonDesktop]}
          >
            <Text style={home.searchIcon}>⌕</Text>
            <View style={home.searchLabelBox}>
              <Text style={home.searchLabel}>{t('Tìm chuyến bay')}</Text>
              {isDesktop && (
                <Text style={home.searchSubLabel}>
                  {t('Khám phá vé máy bay giá tốt, lịch bay linh hoạt')}
                </Text>
              )}
            </View>
            {isDesktop && (
              <View style={home.searchButtonCta}>
                <Text style={home.searchButtonCtaText}>{t('Tìm kiếm')}</Text>
              </View>
            )}
          </Pressable>

          {!isDesktop && (
            <View style={home.controls}>
              <LanguagePicker />
            </View>
          )}

          {/* Featured Destinations */}
          <View style={home.sectionHeaderRow}>
            <Text accessibilityRole="header" style={home.sectionTitle}>
              {t('Điểm đến dành cho bạn')}
            </Text>
            {isDesktop && (
              <Text style={home.sectionSubTitle}>
                {t('Các điểm đến hấp dẫn được nhiều hành khách lựa chọn')}
              </Text>
            )}
          </View>

          {destinationsQuery.isPending && <ActivityIndicator color={flightColors.primary} />}
          <Notice text={destinationsQuery.isError ? t('Không thể tải điểm đến gợi ý.') : ''} />
          {destinationsQuery.isError && (
            <Pressable accessibilityRole="button" onPress={() => void destinationsQuery.refetch()}>
              <Text style={home.link}>{t('Thử tải lại')}</Text>
            </Pressable>
          )}
          {!destinationsQuery.isPending &&
            !destinationsQuery.isError &&
            destinations.length === 0 && (
              <Text style={home.empty}>{t('Chưa có điểm đến gợi ý.')}</Text>
            )}

          <View style={[home.destinations, isDesktop && home.destinationsDesktop]}>
            {destinations.map((destination) => {
              const airport = airportById.get(destination.airport_id);
              if (!airport) return null;
              return (
                <DestinationCard
                  key={destination.id}
                  destination={destination}
                  airport={airport}
                  cardWidthStyle={{ width: destinationCardWidth }}
                  onPress={() => {
                    setInitialDestinationId(airport.id);
                    openSearch();
                  }}
                />
              );
            })}
          </View>

          {/* Explore Journey Section */}
          <View style={home.exploreSection}>
            <Text style={home.sectionTitle}>{t('Khám phá hành trình')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setInitialDestinationId('');
                openSearch();
              }}
              style={[home.exploreCard, isDesktop && home.exploreCardDesktop]}
            >
              <View style={home.exploreIconBox}>
                <Text style={home.exploreSymbol}>↗</Text>
              </View>
              <View style={home.exploreContent}>
                <Text style={home.exploreTitle}>{t('Chọn nơi bạn muốn đến')}</Text>
                <Text style={home.exploreSub}>
                  {t('Tìm chuyến phù hợp với kế hoạch của bạn')}
                </Text>
              </View>
              {isDesktop && (
                <View style={home.exploreCta}>
                  <Text style={home.exploreCtaText}>{t('Khám phá ngay →')}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DestinationCard({
  destination,
  airport,
  onPress,
  cardWidthStyle,
}: {
  destination: Destination;
  airport: Airport;
  onPress: () => void;
  cardWidthStyle: any;
}) {
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);
  const imageUri =
    destination.image_path && /^https:\/\//i.test(destination.image_path)
      ? destination.image_path
      : null;
  const source = imageUri ? { uri: imageUri } : destinationImages[airport.iata_code];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        home.destinationCard,
        cardWidthStyle,
        hovered && home.destinationCardHover,
      ]}
    >
      <View style={[home.destinationArt, hovered && home.destinationArtHover]}>
        {source && (
          <Image
            source={source}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
            accessible={false}
            alt=""
            cachePolicy="memory-disk"
          />
        )}
        {!source && <Text style={home.destinationCode}>{airport.iata_code}</Text>}
      </View>
      <Text numberOfLines={2} style={home.destinationTitle}>
        {t(destination.title)}
      </Text>
      <Text style={home.destinationCity}>{t(airport.city)}</Text>
    </Pressable>
  );
}

const home = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
  },
  scrollDesktop: {
    paddingHorizontal: 36,
    paddingTop: 36,
    paddingBottom: 28,
  },
  container: {
    width: '100%',
    maxWidth: 1140,
    alignSelf: 'center',
    gap: 22,
  },
  containerDesktop: {
    gap: 26,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  heading: { flex: 1 },
  headingSub: { color: '#8B95A5', fontSize: 13, marginTop: 4 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#007E91',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  searchButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: '#F2F3F5',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 14,
  },
  searchButtonDesktop: {
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    paddingHorizontal: 24,
  },
  searchIcon: { color: '#007E91', fontSize: 26, fontWeight: '700' },
  searchLabelBox: { flex: 1, gap: 2 },
  searchLabel: { color: '#1E293B', fontSize: 16, fontWeight: '600' },
  searchSubLabel: { color: '#64748B', fontSize: 12 },
  searchButtonCta: {
    backgroundColor: '#007E91',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
  },
  searchButtonCtaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  controls: { width: '100%', gap: 8 },
  sectionHeaderRow: {
    marginTop: 6,
    gap: 4,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionSubTitle: {
    color: '#64748B',
    fontSize: 14,
  },
  destinations: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  destinationsDesktop: {
    gap: 16,
  },
  destinationCard: {
    minWidth: 140,
    gap: 6,
  },
  destinationCardHover: {
    transform: [{ translateY: -3 }],
  },
  destinationArt: {
    aspectRatio: 1.42,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#D4F0F5',
    justifyContent: 'flex-end',
    padding: 12,
  },
  destinationArtHover: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  destinationCode: { color: '#007E91', fontSize: 28, fontWeight: '800' },
  destinationTitle: { color: '#0F172A', fontSize: 14, fontWeight: '700', lineHeight: 19 },
  destinationCity: { color: '#64748B', fontSize: 13 },
  exploreSection: {
    gap: 12,
    marginTop: 10,
  },
  exploreCard: {
    minHeight: 140,
    borderRadius: 14,
    padding: 20,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    justifyContent: 'flex-end',
    gap: 8,
  },
  exploreCardDesktop: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 18,
    gap: 18,
  },
  exploreIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreSymbol: { color: '#007E91', fontSize: 26, fontWeight: '800' },
  exploreContent: { flex: 1, gap: 2 },
  exploreTitle: { color: '#0F172A', fontSize: 17, fontWeight: '700' },
  exploreSub: { color: '#475569', fontSize: 13 },
  exploreCta: {
    backgroundColor: '#007E91',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  exploreCtaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  link: { color: '#007E91', fontSize: 15, fontWeight: '700' },
  empty: { color: '#536570', fontSize: 14 },
});
