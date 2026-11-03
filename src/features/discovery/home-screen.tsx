import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBrand } from '@/components/app-brand';
import { useAuth } from '@/features/auth/auth-provider';
import { Notice } from '@/features/auth/ui';
import { CurrencyControls } from '@/features/currency/ui';
import { LanguagePicker, useLanguage } from '@/features/i18n/provider';
import { listAirports, listDestinations } from './data';
import type { Airport, Destination } from './model';
import { SearchFlow } from './search-flow';
import { flightColors } from './ui';

const emptyAirports: Airport[] = [];
const emptyDestinations: Destination[] = [];

export function HomeScreen() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const airportsQuery = useQuery({ queryKey: ['airports'], queryFn: listAirports });
  const destinationsQuery = useQuery({ queryKey: ['featured-destinations'], queryFn: listDestinations });
  const airports = airportsQuery.data ?? emptyAirports;
  const destinations = destinationsQuery.data ?? emptyDestinations;
  const airportById = useMemo(() => new Map(airports.map(airport => [airport.id, airport])), [airports]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [initialDestinationId, setInitialDestinationId] = useState('');

  if (searchOpen) return <SearchFlow airports={airports} loading={airportsQuery.isPending}
    error={airportsQuery.isError} onRetry={() => void airportsQuery.refetch()}
    onClose={() => setSearchOpen(false)} initialDestinationId={initialDestinationId} />;

  return <SafeAreaView style={home.safe}>
    <ScrollView contentContainerStyle={home.scroll}>
      <View style={home.header}>
        <View style={home.heading}><AppBrand />
          <Text style={home.headingSub}>{t('Hành trình tiếp theo bắt đầu từ đây.')}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={t(session ? 'Tài khoản' : 'Đăng nhập')}
          onPress={() => router.push('/account')} style={home.avatar}>
          <Text style={home.avatarText}>{session?.user?.email?.charAt(0).toUpperCase() || 'A'}</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={() => { setInitialDestinationId(''); setSearchOpen(true); }}
        style={home.searchButton}>
        <Text style={home.searchIcon}>⌕</Text><Text style={home.searchLabel}>{t('Tìm chuyến bay')}</Text>
      </Pressable>
      <View style={home.controls}><LanguagePicker /><View style={home.currency}><CurrencyControls /></View></View>

      <Text accessibilityRole="header" style={home.sectionTitle}>{t('Điểm đến dành cho bạn')}</Text>
      {destinationsQuery.isPending && <ActivityIndicator color={flightColors.primary} />}
      <Notice text={destinationsQuery.isError ? t('Không thể tải điểm đến gợi ý.') : ''} />
      {destinationsQuery.isError && <Pressable accessibilityRole="button" onPress={() => void destinationsQuery.refetch()}>
        <Text style={home.link}>{t('Thử tải lại')}</Text></Pressable>}
      {!destinationsQuery.isPending && !destinationsQuery.isError && destinations.length === 0 &&
        <Text style={home.empty}>{t('Chưa có điểm đến gợi ý.')}</Text>}
      <View style={home.destinations}>
        {destinations.map(destination => {
          const airport = airportById.get(destination.airport_id);
          if (!airport) return null;
          return <DestinationCard key={destination.id} destination={destination} airport={airport}
            onPress={() => { setInitialDestinationId(airport.id); setSearchOpen(true); }} />;
        })}
      </View>
      <Text style={home.sectionTitle}>{t('Khám phá hành trình')}</Text>
      <Pressable accessibilityRole="button" onPress={() => { setInitialDestinationId(''); setSearchOpen(true); }}
        style={home.exploreCard}>
        <Text style={home.exploreSymbol}>↗</Text>
        <View><Text style={home.exploreTitle}>{t('Chọn nơi bạn muốn đến')}</Text>
          <Text style={home.exploreSub}>{t('Tìm chuyến phù hợp với kế hoạch của bạn')}</Text></View>
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

function DestinationCard({ destination, airport, onPress }: {
  destination: Destination; airport: Airport; onPress: () => void;
}) {
  const imageUri = destination.image_path && /^https:\/\//i.test(destination.image_path)
    ? destination.image_path : null;
  return <Pressable accessibilityRole="button" onPress={onPress} style={home.destinationCard}>
    <View style={home.destinationArt}>
      {imageUri && <Image source={{ uri: imageUri }} contentFit="cover" style={StyleSheet.absoluteFill}
        accessible={false} alt="" />}
      {!imageUri && <Text style={home.destinationCode}>{airport.iata_code}</Text>}
    </View>
    <Text numberOfLines={2} style={home.destinationTitle}>{destination.title}</Text>
    <Text style={home.destinationCity}>{airport.city}</Text>
  </Pressable>;
}

const home = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 56, gap: 22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heading: { flex: 1 },
  headingSub: { color: '#8B95A5', fontSize: 12, marginTop: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4169E1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 20 },
  searchButton: { minHeight: 52, borderRadius: 8, backgroundColor: '#F2F3F5', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 12 },
  searchIcon: { color: '#8B95A5', fontSize: 25 },
  searchLabel: { color: '#8B95A5', fontSize: 17 },
  controls: { width: '100%', gap: 8 },
  currency: { width: '100%' },
  sectionTitle: { color: '#353B46', fontSize: 20, fontWeight: '700', marginTop: 10 },
  destinations: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  destinationCard: { width: '47%', minWidth: 145, gap: 5 },
  destinationArt: { height: 145, borderRadius: 10, backgroundColor: '#D4F0F5', justifyContent: 'flex-end', padding: 15 },
  destinationCode: { color: '#007E91', fontSize: 30, fontWeight: '800' },
  destinationTitle: { color: '#353B46', fontSize: 14, fontWeight: '700' },
  destinationCity: { color: '#8B95A5', fontSize: 13 },
  exploreCard: { minHeight: 180, borderRadius: 10, padding: 24, backgroundColor: '#BCE9F3', justifyContent: 'flex-end', gap: 8 },
  exploreSymbol: { color: '#007E91', fontSize: 48 },
  exploreTitle: { color: '#253540', fontSize: 18, fontWeight: '700' },
  exploreSub: { color: '#536570', fontSize: 13 },
  link: { color: '#007E91', fontSize: 15, fontWeight: '700' },
  empty: { color: '#536570', fontSize: 14 },
});
