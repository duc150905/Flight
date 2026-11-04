import { useQuery } from '@tanstack/react-query';
import { cacheKeys, cacheTimes } from '@/features/cache/policy';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Notice } from '@/features/auth/ui';
import { useLanguage } from '@/features/i18n/provider';
import { localeFor } from '@/features/i18n/translate';
import { CurrencyRateNote, MoneyText } from '@/features/currency/ui';
import { useDisplayMoney } from '@/features/currency/provider';
import { inlineMoney } from '@/features/currency/presentation';
import { searchOneWay } from './data';
import { type FlightOffer } from './model';
import { checkoutHrefForTrip, criteriaForLeg, parseTripSearchParameter } from './trip-search';
import { savePendingSelection } from '../booking/pending-selection-storage';
import { saveLastSearch } from './last-search-storage';
import { FlightButton, flightColors, Page, styles } from './ui';

type Sort = 'price' | 'departure' | 'duration';
const emptyOffers: FlightOffer[] = [];

function timeAt(iso: string, timezone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { timeZone: timezone, day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function duration(offer: FlightOffer) {
  return Math.round((Date.parse(offer.flight.arrival_at) - Date.parse(offer.flight.departure_at)) / 60_000);
}

function baggage(offer: FlightOffer, t: (key: string, params?: Record<string, string | number>) => string) {
  const value = offer.fare.baggage_allowance;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return t('Xem điều kiện tại bước đặt vé.');
  const cabin = typeof value.cabin_kg === 'number' ? value.cabin_kg : 0;
  const checked = typeof value.checked_kg === 'number' ? value.checked_kg : 0;
  return t('Xách tay {cabin} kg · Ký gửi {checked} kg', { cabin, checked });
}

export function ItineraryResultsScreen({ rawSearch }: { rawSearch: unknown }) {
  const { t, language } = useLanguage();
  const displayMoney = useDisplayMoney();
  const parsed = useMemo(() => {
    try { return parseTripSearchParameter(rawSearch); } catch { return null; }
  }, [rawSearch]);

  useEffect(() => {
    if (parsed && typeof rawSearch === 'string') {
      void saveLastSearch({
        type: 'itinerary',
        searchJson: rawSearch,
      });
    }
  }, [parsed, rawSearch]);
  const [selected, setSelected] = useState<FlightOffer[]>([]);
  const [sort, setSort] = useState<Sort>('price');
  const [airlineId, setAirlineId] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const activeIndex = selected.length;
  const activeLeg = parsed?.legs[activeIndex];
  const searchQuery = useQuery({
    queryKey: cacheKeys.itinerarySearch(typeof rawSearch === 'string' ? rawSearch : '', activeIndex),
    queryFn: () => searchOneWay(criteriaForLeg(parsed!, activeIndex)),
    enabled: !!activeLeg,
    staleTime: cacheTimes.search,
  });
  const offers = searchQuery.data?.offers ?? emptyOffers;
  const previous = selected.at(-1);
  const eligible = useMemo(() => offers.filter(offer => !selected.some(chosen => chosen.flight.id === offer.flight.id)
    && (!previous || Date.parse(offer.flight.departure_at) > Date.parse(previous.flight.arrival_at))), [offers, previous, selected]);
  const airlines = useMemo(() => [...new Map(eligible.map(offer =>
    [offer.airline.id, offer.airline.name])).entries()], [eligible]);
  const visible = useMemo(() => eligible.filter(offer => !airlineId || offer.airline.id === airlineId)
    .sort((a, b) => sort === 'price' ? a.total - b.total
      : sort === 'departure' ? Date.parse(a.flight.departure_at) - Date.parse(b.flight.departure_at)
        : duration(a) - duration(b)), [eligible, airlineId, sort]);

  if (!parsed) return <Page>
    <Text accessibilityRole="header" style={styles.title}>{t('Thông tin tìm kiếm không hợp lệ')}</Text>
    <FlightButton title={t('Tìm lại')} onPress={() => router.replace('/')} />
  </Page>;

  const continueCheckout = () => {
    try {
      setSelectionError('');
      const href = checkoutHrefForTrip(parsed, selected);
      void savePendingSelection(href.params.selection);
      router.push(href);
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : 'Hãy chọn lại chuyến bay.');
    }
  };
  const goBack = () => {
    if (selected.length === 0) router.back();
    else { setSelected(previous => previous.slice(0, -1)); setAirlineId(''); setExpandedId(''); setSelectionError(''); }
  };
  const choose = (offer: FlightOffer) => {
    setSelected(previous => [...previous, offer]);
    setAirlineId(''); setExpandedId(''); setSelectionError('');
  };

  return <Page>
    <Pressable accessibilityRole="button" style={styles.picker} onPress={goBack}>
      <Text style={styles.link}>← {t(selected.length ? 'Chọn lại chặng trước' : 'Sửa tìm kiếm')}</Text>
    </Pressable>
    <View>
      <Text accessibilityRole="header" style={styles.title}>
        {t(parsed.tripType === 'round_trip' ? 'Chuyến bay khứ hồi' : 'Chuyến bay nhiều chặng')}
      </Text>
      <Text style={styles.subtitle}>{t('{selected}/{total} chặng đã chọn', { selected: selected.length, total: parsed.legs.length })} ·
        {' '}{t('{count} hành khách', { count: parsed.adults + parsed.children + parsed.infants })}</Text>
    </View>
    {selected.length > 0 && <View style={styles.card}>
      <Text style={styles.sectionTitle}>{t('Hành trình đã chọn')}</Text>
      {selected.map((offer, index) => <Text key={offer.flight.id} style={styles.muted}>
        {index + 1}. {offer.origin.iata_code} → {offer.destination.iata_code} ·
        {' '}{timeAt(offer.flight.departure_at, offer.origin.timezone, localeFor(language))} · {offer.flight.flight_number}
      </Text>)}
    </View>}
    {activeLeg ? <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {parsed.tripType === 'round_trip' ? t(activeIndex === 0 ? 'Chiều đi' : 'Chiều về') : t('Chặng {number}', { number: activeIndex + 1 })}
        </Text>
        <Text style={styles.subtitle}>{activeLeg.departureDate} · {t('Chọn chuyến phù hợp')}</Text>
      </View>
      {searchQuery.isPending && <ActivityIndicator color={flightColors.primary} accessibilityLabel={t('Đang tìm chuyến bay')} />}
      <Notice text={searchQuery.isError ? t('Không thể tìm chuyến bay. Hãy kiểm tra kết nối và thử lại.') : ''} />
      {searchQuery.isError && <FlightButton title={t('Thử lại')} secondary onPress={() => void searchQuery.refetch()} />}
      {!searchQuery.isPending && !searchQuery.isError && eligible.length === 0 && <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('Chưa có chuyến phù hợp')}</Text>
        <Text style={styles.muted}>{t('Hãy đổi ngày hoặc tuyến bay. Chặng sau phải cất cánh sau khi chặng trước đến nơi.')}</Text>
      </View>}
      {!searchQuery.isPending && !searchQuery.isError && eligible.length > 0 && <>
        <View style={styles.card}>
          <Text style={styles.label}>{t('Sắp xếp')}</Text>
          <View style={styles.chipRow}>{([
            ['price', 'Giá'], ['departure', 'Giờ bay'], ['duration', 'Thời lượng'],
          ] as [Sort, string][]).map(([value, label]) => <Pressable key={value} accessibilityRole="button"
            accessibilityState={{ selected: sort === value }} onPress={() => setSort(value)}
            style={[styles.chip, sort === value && styles.selectedChip]}><Text style={styles.chipText}>{t(label)}</Text></Pressable>)}</View>
          <Text style={styles.label}>{t('Hãng bay')}</Text>
          <View style={styles.chipRow}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: !airlineId }}
              style={[styles.chip, !airlineId && styles.selectedChip]} onPress={() => setAirlineId('')}>
              <Text style={styles.chipText}>{t('Tất cả')}</Text>
            </Pressable>
            {airlines.map(([id, name]) => <Pressable key={id} accessibilityRole="button"
              accessibilityState={{ selected: airlineId === id }} onPress={() => setAirlineId(id)}
              style={[styles.chip, airlineId === id && styles.selectedChip]}><Text style={styles.chipText}>{name}</Text></Pressable>)}
          </View>
        </View>
        {visible.map(offer => <View key={offer.fare.id} style={styles.card}>
          <Text style={styles.label}>{offer.airline.name} · {offer.flight.flight_number}</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>{offer.origin.iata_code}</Text>
              <Text style={styles.muted}>{timeAt(offer.flight.departure_at, offer.origin.timezone, localeFor(language))}</Text></View>
            <Text style={styles.muted}>→</Text>
            <View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={styles.sectionTitle}>{offer.destination.iata_code}</Text>
              <Text style={styles.muted}>{timeAt(offer.flight.arrival_at, offer.destination.timezone, localeFor(language))}</Text></View>
          </View>
          <Text style={styles.muted}>{t('Bay thẳng')} · {t('{hours}g {minutes}p', {
            hours: Math.floor(duration(offer) / 60), minutes: duration(offer) % 60,
          })} · {t(offer.fare.name)}</Text>
          <Text style={styles.muted}>{t('Fare including taxes and fees')}</Text>
          <MoneyText amount={offer.total} currency={offer.fare.currency} style={[styles.sectionTitle, { color: flightColors.primary }]} />
          <Pressable accessibilityRole="button" style={styles.picker}
            onPress={() => setExpandedId(previous => previous === offer.fare.id ? '' : offer.fare.id)}>
            <Text style={styles.link}>{t(expandedId === offer.fare.id ? 'Ẩn điều kiện vé' : 'Xem hành lý và điều kiện vé')}</Text>
          </Pressable>
          {expandedId === offer.fare.id && <View style={{ gap: 8 }}>
            <Text style={styles.muted}>{baggage(offer, t)}</Text>
            <Text style={styles.muted}>{offer.fare.cancellation_allowed
              ? t('Có thể yêu cầu hủy trước giờ bay ít nhất {minutes} phút. Phí theo điều kiện vé: {fee}.', {
                minutes: offer.fare.cancellation_cutoff_minutes,
                fee: inlineMoney(displayMoney(offer.fare.cancellation_fee_amount, offer.fare.currency)),
              }) : t('Không cho phép yêu cầu hủy theo điều kiện vé này.')}</Text>
          </View>}
          <FlightButton title={t('Chọn chặng {number}', { number: activeIndex + 1 })} onPress={() => choose(offer)} />
        </View>)}
        <Text style={styles.muted}>{t('Giá hiển thị là ước tính; server sẽ kiểm tra lại khi tạo đơn.')}</Text>
      </>}
    </> : <View style={styles.card}>
      <Text style={styles.sectionTitle}>{t('Đã chọn đủ chuyến bay')}</Text>
      <Text style={styles.muted}>{t('Kiểm tra thông tin hành khách và giá cuối cùng ở bước tiếp theo.')}</Text>
      {new Set(selected.map(offer => offer.fare.currency)).size === 1
        && <View style={{ gap: 4 }}><Text style={styles.sectionTitle}>{t('Estimated total')}</Text>
          <MoneyText amount={selected.reduce((sum, offer) => sum + offer.total, 0)} currency={selected[0].fare.currency} style={styles.sectionTitle} /></View>}
      <Notice text={t(selectionError)} />
      <FlightButton title={t('Tiếp tục đặt vé')} onPress={continueCheckout} />
    </View>}
    <CurrencyRateNote />
  </Page>;
}
