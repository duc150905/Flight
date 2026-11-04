import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cacheKeys, cacheTimes } from '@/features/cache/policy';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Notice } from '@/features/auth/ui';
import { CurrencyRateNote, MoneyText } from '@/features/currency/ui';
import { useLanguage } from '@/features/i18n/provider';
import { localeFor } from '@/features/i18n/translate';
import { searchOneWay } from './data';
import { cabinLabels, searchSchema, type FlightOffer, type SearchCriteria } from './model';
import { saveLastSearch } from './last-search-storage';
import { FlightButton, flightColors, Page, styles } from './ui';

type Sort = 'price' | 'departure' | 'duration';
const emptyOffers: FlightOffer[] = [];

function timeAt(iso: string, timezone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit' })
    .format(new Date(iso));
}

function durationMinutes(offer: FlightOffer) {
  return Math.round((Date.parse(offer.flight.arrival_at) - Date.parse(offer.flight.departure_at)) / 60_000);
}

export function ResultsScreen({ input }: { input: Record<string, string | string[] | undefined> }) {
  const { t } = useLanguage();
  const searchKey = [input.originId, input.destinationId, input.departureDate, input.adults,
    input.children, input.infants, input.cabinClass].join('|');
  const parsed = searchSchema.safeParse(input);
  const criteria = parsed.success ? parsed.data : null;

  useEffect(() => {
    if (criteria) {
      void saveLastSearch({
        type: 'one_way',
        params: input,
      });
    }
  }, [criteria]);

  const searchQuery = useQuery({
    queryKey: cacheKeys.flightSearch(searchKey), queryFn: () => searchOneWay(criteria), enabled: !!criteria,
    staleTime: cacheTimes.search,
  });
  const offers = searchQuery.data?.offers ?? emptyOffers;
  const loading = searchQuery.isPending && !!criteria;
  const error = searchQuery.isError ? 'Không thể tìm chuyến bay. Hãy kiểm tra kết nối và thử lại.' : '';
  const [sort, setSort] = useState<Sort>('price');
  const [airlineId, setAirlineId] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const airlines = useMemo(() => [...new Map(offers.map(offer =>
    [offer.airline.id, offer.airline.name])).entries()], [offers]);
  const visible = useMemo(() => offers.filter(offer => !airlineId || offer.airline.id === airlineId)
    .sort((a, b) => sort === 'price' ? a.total - b.total
      : sort === 'departure' ? Date.parse(a.flight.departure_at) - Date.parse(b.flight.departure_at)
        : durationMinutes(a) - durationMinutes(b)), [offers, airlineId, sort]);

  if (!criteria) return <Page>
    <Text style={styles.title}>{t('Thông tin tìm kiếm không hợp lệ')}</Text>
    <FlightButton title={t('Về trang chủ')} onPress={() => router.replace('/')} />
  </Page>;

  const origin = offers[0]?.origin.iata_code ?? t('Sân bay đi');
  const destination = offers[0]?.destination.iata_code ?? t('Sân bay đến');
  return <SafeAreaView style={r.safe}>
    <ScrollView contentContainerStyle={r.scroll}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Sửa tìm kiếm')}
        onPress={() => router.back()} style={r.routeHeader}>
        <Text style={r.backArrow}>←</Text>
        <View><Text accessibilityRole="header" style={r.routeTitle}>{origin} — {destination}</Text>
          <Text style={r.routeSubtitle}>{criteria.departureDate} · {t('{count} hành khách', {
            count: criteria.adults + criteria.children + criteria.infants,
          })} · {t(cabinLabels[criteria.cabinClass])}</Text></View>
      </Pressable>
      <View style={r.filterBar}>
        <Pressable accessibilityRole="button" onPress={() => setFiltersOpen(true)} style={r.filterButton}>
          <Text style={r.filterLabel}>☷ {t('Sắp xếp & lọc')}</Text></Pressable>
        {([['price', 'Giá thấp nhất'], ['departure', 'Giờ khởi hành'], ['duration', 'Thời gian bay']] as [Sort, string][])
          .map(([value, label]) => <Pressable key={value} accessibilityRole="button"
            accessibilityState={{ selected: sort === value }} onPress={() => setSort(value)}
            style={[r.sortChip, sort === value && r.activeChip]}>
            <Text style={[r.sortText, sort === value && r.activeChipText]}>{t(label)}</Text></Pressable>)}
      </View>
      {loading && <ActivityIndicator color={flightColors.primary} accessibilityLabel={t('Đang tìm chuyến bay')} />}
      <Notice text={t(error)} />
      {!!error && <FlightButton title={t('Thử lại')} secondary onPress={() => void searchQuery.refetch()} />}
      {!loading && !error && offers.length === 0 && <View style={r.emptyCard}>
        <Text style={r.emptyTitle}>{t('Chưa có chuyến bay phù hợp')}</Text>
        <Text style={r.helper}>{t('Hãy thử ngày khác, hạng ghế khác hoặc tuyến khác.')}</Text>
      </View>}
      {!loading && !error && offers.length > 0 && <>
        <Text style={r.resultCount}>{t('{count} lựa chọn', { count: visible.length })}</Text>
        {visible.map(offer => <FlightCard key={offer.fare.id} offer={offer} criteria={criteria} />)}
        {visible.length === 0 && <Text style={r.helper}>{t('Chưa có chuyến bay phù hợp')}</Text>}
        <Text style={r.helper}>{t('Giá hiển thị là ước tính cho nhóm hành khách. Giá cuối cùng được kiểm tra lại khi đặt vé.')}</Text>
      </>}
      <CurrencyRateNote />
    </ScrollView>
    <Modal visible={filtersOpen} animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
      <SafeAreaView style={r.safe}>
        <View style={r.modalHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Đóng')} onPress={() => setFiltersOpen(false)}
            style={r.modalClose}><Text style={r.modalCloseText}>×</Text></Pressable>
          <Text accessibilityRole="header" style={r.modalTitle}>{t('Sắp xếp & lọc')}</Text>
          <View style={r.modalClose} />
        </View>
        <ScrollView contentContainerStyle={r.modalContent}>
          <Text style={r.filterHeading}>{t('Sắp xếp theo')}</Text>
          {([['price', 'Giá thấp nhất'], ['departure', 'Giờ khởi hành'], ['duration', 'Thời gian bay']] as [Sort, string][])
            .map(([value, label]) => <Pressable key={value} accessibilityRole="radio"
              accessibilityState={{ checked: sort === value }} onPress={() => setSort(value)} style={r.filterOption}>
              <Text style={r.optionText}>{t(label)}</Text><Text style={r.check}>{sort === value ? '✓' : ''}</Text>
            </Pressable>)}
          <Text style={r.filterHeading}>{t('Hãng bay')}</Text>
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: !airlineId }}
            onPress={() => setAirlineId('')} style={r.filterOption}>
            <Text style={r.optionText}>{t('Tất cả')}</Text><Text style={r.check}>{!airlineId ? '✓' : ''}</Text>
          </Pressable>
          {airlines.map(([id, name]) => <Pressable key={id} accessibilityRole="radio"
            accessibilityState={{ checked: airlineId === id }} onPress={() => setAirlineId(id)} style={r.filterOption}>
            <Text style={r.optionText}>{name}</Text><Text style={r.check}>{airlineId === id ? '✓' : ''}</Text>
          </Pressable>)}
        </ScrollView>
        <View style={r.modalFooter}>
          <Pressable accessibilityRole="button" onPress={() => { setSort('price'); setAirlineId(''); }}
            style={r.clearButton}><Text style={r.clearText}>{t('Xóa lọc')}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setFiltersOpen(false)} style={r.applyButton}>
            <Text style={r.applyText}>{t('Xem {count} chuyến', { count: visible.length })}</Text></Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

function FlightCard({ offer, criteria }: { offer: FlightOffer; criteria: SearchCriteria }) {
  const { t, language } = useLanguage();
  const minutes = durationMinutes(offer);
  return <Pressable accessibilityRole="button" style={r.flightCard} onPress={() => router.push({
    pathname: '/flights/[id]', params: {
      id: offer.flight.id, fareId: offer.fare.id,
      originId: criteria.originId, destinationId: criteria.destinationId,
      departureDate: criteria.departureDate, adults: String(criteria.adults),
      children: String(criteria.children), infants: String(criteria.infants), cabinClass: criteria.cabinClass,
    },
  })}>
    <View style={r.cardTop}>
      <View style={r.airlineMark}><Text style={r.airlineInitial}>{offer.airline.name.charAt(0)}</Text></View>
      <View style={r.airlineDetails}><Text style={r.airlineName}>{offer.airline.name}</Text>
        <Text style={r.flightNumber}>{offer.flight.flight_number}</Text></View>
      <Text style={r.duration}>{t('{hours}g {minutes}p', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })}</Text>
    </View>
    <View style={r.flightTimes}>
      <View><Text style={r.time}>{timeAt(offer.flight.departure_at, offer.origin.timezone, localeFor(language))}</Text>
        <Text style={r.airportCode}>{offer.origin.iata_code}</Text></View>
      <View style={r.routeLine}><View style={r.line} /><Text style={r.direct}>{t('Bay thẳng')}</Text></View>
      <View style={r.timeEnd}><Text style={r.time}>{timeAt(offer.flight.arrival_at, offer.destination.timezone, localeFor(language))}</Text>
        <Text style={r.airportCode}>{offer.destination.iata_code}</Text></View>
    </View>
    <View style={r.cardBottom}>
      <View style={r.cardBottomLeft}>
        <Text style={r.fareName}>{t(offer.fare.name)}</Text>
        <Text style={r.taxNotice}>{t('Fare including taxes and fees')}</Text>
      </View>
      <MoneyText amount={offer.total} currency={offer.fare.currency} style={r.price} />
    </View>
  </Pressable>;
}

const r = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 46, gap: 18 },
  routeHeader: { minHeight: 76, borderRadius: 9, backgroundColor: '#F2F3F5', paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 18 },
  backArrow: { color: '#536570', fontSize: 24 },
  routeTitle: { color: '#353B46', fontSize: 17, fontWeight: '700' },
  routeSubtitle: { color: '#758294', fontSize: 12, marginTop: 5 },
  filterBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterButton: { minHeight: 44, borderWidth: 1, borderColor: '#353B46', borderRadius: 8,
    paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  filterLabel: { color: '#353B46', fontSize: 13, fontWeight: '600' },
  sortChip: { minHeight: 44, borderWidth: 1, borderColor: '#BBC5D1', borderRadius: 8,
    paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  activeChip: { borderColor: '#007E91', backgroundColor: '#E4F5F6' },
  sortText: { color: '#536570', fontSize: 12 }, activeChipText: { color: '#007E91', fontWeight: '700' },
  resultCount: { color: '#536570', fontSize: 13 },
  flightCard: { borderWidth: 1, borderColor: '#E9EDF1', borderRadius: 16,
    backgroundColor: '#FFFFFF', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  airlineMark: { width: 36, height: 36, borderRadius: 7, backgroundColor: '#D4F0F5', alignItems: 'center', justifyContent: 'center' },
  airlineInitial: { color: '#007E91', fontSize: 19, fontWeight: '800' },
  airlineDetails: { flex: 1 }, airlineName: { color: '#353B46', fontSize: 14, fontWeight: '700' },
  flightNumber: { color: '#8B95A5', fontSize: 12, marginTop: 3 },
  duration: { color: '#8B95A5', fontSize: 12 },
  flightTimes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, gap: 8 },
  time: { color: '#353B46', fontSize: 20, fontWeight: '700' },
  airportCode: { color: '#8B95A5', fontSize: 12, marginTop: 6 },
  routeLine: { flex: 1, alignItems: 'center', gap: 6 }, line: { height: 1, backgroundColor: '#BBC5D1', width: '100%' },
  direct: { color: '#8B95A5', fontSize: 11 }, timeEnd: { alignItems: 'flex-end' },
  cardBottom: { borderTopWidth: 1, borderTopColor: '#E9EDF1', padding: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardBottomLeft: { flex: 1, gap: 4 },
  fareName: { color: '#536570', fontSize: 13 },
  taxNotice: { color: '#8B95A5', fontSize: 12 },
  price: { color: '#253540', fontSize: 20, fontWeight: '800' },
  helper: { color: '#758294', fontSize: 13, lineHeight: 19 },
  emptyCard: { padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E9EDF1', gap: 8 },
  emptyTitle: { color: '#353B46', fontSize: 17, fontWeight: '700' },
  modalHeader: { minHeight: 64, borderBottomWidth: 1, borderBottomColor: '#E9EDF1', flexDirection: 'row', alignItems: 'center' },
  modalClose: { width: 60, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: '#8B95A5', fontSize: 27 },
  modalTitle: { flex: 1, textAlign: 'center', color: '#353B46', fontSize: 18, fontWeight: '700' },
  modalContent: { paddingBottom: 32 },
  filterHeading: { color: '#353B46', fontSize: 17, fontWeight: '700', paddingHorizontal: 20, paddingTop: 30, paddingBottom: 12 },
  filterOption: { minHeight: 56, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#E9EDF1',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { color: '#434A54', fontSize: 15 }, check: { color: '#007E91', fontSize: 20, fontWeight: '700' },
  modalFooter: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#E9EDF1',
    flexDirection: 'row', alignItems: 'center', gap: 14 },
  clearButton: { minHeight: 48, justifyContent: 'center' }, clearText: { color: '#536570', fontSize: 14, fontWeight: '700' },
  applyButton: { flex: 1, minHeight: 48, borderRadius: 8, backgroundColor: '#007E91', alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
