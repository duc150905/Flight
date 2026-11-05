import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { cacheKeys, cacheTimes } from '@/features/cache/policy';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Notice } from '@/features/auth/ui';
import { CurrencyRateNote, MoneyText } from '@/features/currency/ui';
import { useDisplayMoney } from '@/features/currency/provider';
import { inlineMoney } from '@/features/currency/presentation';
import { useLanguage } from '@/features/i18n/provider';
import { formatTime, localeFor } from '@/features/i18n/translate';
import { loadFlightOffer } from './data';
import { cabinLabels, checkoutHrefForOffer, searchSchema, type FlightOffer } from './model';
import { savePendingSelection } from '../booking/pending-selection-storage';
import { FlightButton, flightColors, Page, styles } from './ui';
import { AirlineLogo } from './airline-logo';

function baggageText(value: unknown, t: (key: string, params?: Record<string, string | number>) => string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return t('Xem điều kiện tại bước đặt vé.');
  const fields = value as Record<string, unknown>;
  const cabin = typeof fields.cabin_kg === 'number' ? fields.cabin_kg : 0;
  const checked = typeof fields.checked_kg === 'number' ? fields.checked_kg : 0;
  return t('Xách tay {cabin} kg · Ký gửi {checked} kg', { cabin, checked });
}

function clockTime(iso: string, timezone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit' })
    .format(new Date(iso));
}

export function DetailScreen({ input }: { input: Record<string, string | string[] | undefined> }) {
  const { t, language } = useLanguage();
  const displayMoney = useDisplayMoney();
  const key = [input.id, input.fareId, input.originId, input.destinationId, input.departureDate,
    input.adults, input.children, input.infants, input.cabinClass].join('|');
  const parsed = searchSchema.safeParse(input);
  const criteria = parsed.success ? parsed.data : null;
  const id = typeof input.id === 'string' ? input.id : '';
  const fareId = typeof input.fareId === 'string' ? input.fareId : '';
  const detailQuery = useQuery({
    queryKey: cacheKeys.flightDetail(key), queryFn: () => loadFlightOffer(id, fareId, criteria!),
    enabled: !!criteria && !!id && !!fareId,
    staleTime: cacheTimes.search,
  });
  const offer: FlightOffer | undefined = detailQuery.data;
  const loading = detailQuery.isPending && !!criteria && !!id && !!fareId;
  const error = detailQuery.isError ? 'Không thể tải chi tiết chuyến bay. Hãy thử lại.' : '';

  if (!criteria || !id || !fareId) return <Page>
    <Text style={styles.title}>{t('Thông tin chuyến bay không hợp lệ')}</Text>
    <FlightButton title={t('Về trang chủ')} onPress={() => router.replace('/')} />
  </Page>;

  const minutes = offer ? Math.round((Date.parse(offer.flight.arrival_at) - Date.parse(offer.flight.departure_at)) / 60_000) : 0;
  return <SafeAreaView style={d.safe}>
    <View style={d.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Kết quả tìm kiếm')}
        onPress={() => router.back()} style={d.back}><Text style={d.backText}>←</Text></Pressable>
      <Text accessibilityRole="header" style={d.headerTitle}>{t('Chi tiết chuyến bay')}</Text>
      <View style={d.back} />
    </View>
    <ScrollView contentContainerStyle={d.scroll}>
      {loading && <ActivityIndicator color={flightColors.primary} accessibilityLabel={t('Đang tải chi tiết chuyến bay')} />}
      <Notice text={t(error)} />
      {!!error && <FlightButton title={t('Thử lại')} secondary onPress={() => void detailQuery.refetch()} />}
      {offer && !loading && !error && <>
        <View style={d.routeSummary}>
          <Text style={d.routeTitle}>{t(offer.origin.city)} — {t(offer.destination.city)}</Text>
          <Text style={d.routeSubtitle}>{formatTime(language, offer.flight.departure_at, offer.origin.timezone)}</Text>
          <Text style={d.tripBadge}>{t('Một chiều')}</Text>
        </View>
        <View style={d.passengerBar}>
          <Text style={d.passengerText}>{t('{count} hành khách', {
            count: criteria.adults + criteria.children + criteria.infants,
          })} · {t(cabinLabels[criteria.cabinClass])}</Text>
        </View>
        <View style={d.flightCard}>
          <View style={d.flightCardHeader}>
            <Text style={d.flightRoute}>{t(offer.origin.city)} – {t(offer.destination.city)}</Text>
            <View style={d.airline}><AirlineLogo name={offer.airline.name} logoPath={offer.airline.logo_path} /><Text style={d.airlineName}>{offer.airline.name}</Text>
              <Text style={d.flightNumber}>{offer.flight.flight_number}</Text></View>
          </View>
          <View style={d.times}>
            <View><Text style={d.clock}>{clockTime(offer.flight.departure_at, offer.origin.timezone, localeFor(language))}</Text>
              <Text style={d.code}>{offer.origin.iata_code}</Text></View>
            <View style={d.duration}><Text style={d.durationText}>{t('{hours}g {minutes}p', {
              hours: Math.floor(minutes / 60), minutes: minutes % 60,
            })}</Text><View style={d.routeLine} /><Text style={d.durationText}>{t('Bay thẳng')}</Text></View>
            <View style={d.arrival}><Text style={d.clock}>{clockTime(offer.flight.arrival_at, offer.destination.timezone, localeFor(language))}</Text>
              <Text style={d.code}>{offer.destination.iata_code}</Text></View>
          </View>
          <View style={d.cardNotes}>
            <Text style={d.note}>✓ {t('Hành lý bao gồm')}: {baggageText(offer.fare.baggage_allowance, t)}</Text>
            <Text style={d.note}>✓ {t(offer.fare.name)} · {t(cabinLabels[offer.fare.cabin_class])}</Text>
          </View>
        </View>
        <View style={d.section}>
          <Text style={d.sectionTitle}>{t('Hành lý có sẵn')}</Text>
          <Text style={d.sectionSubtitle}>{t('Đã bao gồm trong giá vé')}</Text>
          <Text style={d.baggageLine}>▣  {baggageText(offer.fare.baggage_allowance, t)}</Text>
        </View>
        <View style={d.section}>
          <Text style={d.sectionTitle}>{t('Hành lý mua thêm')}</Text>
          <Text style={d.sectionSubtitle}>{t('Chọn thêm hành lý ở bước đặt vé.')}</Text>
        </View>
        <View style={d.section}>
          <Text style={d.sectionTitle}>{t('Điều kiện vé')}</Text>
          <Text style={d.sectionSubtitle}>{t('Fare including taxes and fees')}</Text>
          <Text style={d.sectionSubtitle}>{t('Seat selection is optional. Your fare includes travel in the selected cabin; choosing a specific seat costs extra.')}</Text>
          <Text style={d.sectionSubtitle}>{offer.fare.cancellation_allowed
            ? t('Được yêu cầu hủy trước giờ bay ít nhất {minutes} phút. Phí hủy theo điều kiện vé: {fee}. Server sẽ xác nhận số tiền cuối cùng.', {
              minutes: offer.fare.cancellation_cutoff_minutes,
              fee: inlineMoney(displayMoney(offer.fare.cancellation_fee_amount, offer.fare.currency)),
            }) : t('Không cho phép yêu cầu hủy theo điều kiện vé này.')}</Text>
          <Text style={d.sectionSubtitle}>{t('Giá và khả năng giữ chỗ sẽ được kiểm tra lại khi tạo đơn.')}</Text>
        </View>
      </>}
    </ScrollView>
    {offer && !loading && !error && <View style={d.footer}>
      <View style={d.footerPrice}><MoneyText amount={offer.total} currency={offer.fare.currency} style={d.price} />
        <Text style={d.priceCaption}>{t('{count} hành khách', {
          count: criteria.adults + criteria.children + criteria.infants,
        })}</Text><CurrencyRateNote /></View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          const href = checkoutHrefForOffer(offer, criteria);
          void savePendingSelection(href.params.selection);
          router.push(href);
        }}
        style={d.selectButton}
      ><Text style={d.selectText}>{t('Tiếp tục đặt vé')}</Text></Pressable>
    </View>}
  </SafeAreaView>;
}

const d = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E9EDF1' },
  back: { width: 60, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#8B95A5', fontSize: 25 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#353B46', fontSize: 19, fontWeight: '700' },
  scroll: { paddingBottom: 40, gap: 0 },
  routeSummary: { padding: 20, gap: 8, borderBottomWidth: 1, borderBottomColor: '#E9EDF1' },
  routeTitle: { color: '#353B46', fontSize: 18, fontWeight: '700' },
  routeSubtitle: { color: '#8B95A5', fontSize: 14 },
  tripBadge: { color: '#FFFFFF', backgroundColor: '#353B46', borderRadius: 7, overflow: 'hidden',
    paddingHorizontal: 14, paddingVertical: 9, alignSelf: 'flex-start', fontSize: 13, fontWeight: '700' },
  passengerBar: { minHeight: 58, justifyContent: 'center', paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#E9EDF1' },
  passengerText: { color: '#434A54', fontSize: 14 },
  flightCard: { margin: 20, borderWidth: 1, borderColor: '#E9EDF1', borderRadius: 16, overflow: 'hidden' },
  flightCardHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  flightRoute: { flex: 1, color: '#353B46', fontSize: 14, fontWeight: '700' },
  airline: { alignItems: 'flex-end' }, airlineName: { color: '#8B95A5', fontSize: 12 },
  flightNumber: { color: '#8B95A5', fontSize: 12, marginTop: 3 },
  times: { minHeight: 90, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#E9EDF1',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  clock: { color: '#253540', fontSize: 20, fontWeight: '800' }, code: { color: '#8B95A5', fontSize: 12, marginTop: 4 },
  duration: { flex: 1, alignItems: 'center', gap: 5 }, durationText: { color: '#8B95A5', fontSize: 11 },
  routeLine: { width: '100%', height: 1, backgroundColor: '#BBC5D1' }, arrival: { alignItems: 'flex-end' },
  cardNotes: { padding: 16, borderTopWidth: 1, borderTopColor: '#E9EDF1', gap: 9 },
  note: { color: '#758294', fontSize: 13, lineHeight: 20 },
  section: { padding: 20, borderTopWidth: 1, borderTopColor: '#E9EDF1', gap: 12, minHeight: 124 },
  sectionTitle: { color: '#353B46', fontSize: 17, fontWeight: '700' },
  sectionSubtitle: { color: '#8B95A5', fontSize: 13, lineHeight: 20 },
  baggageLine: { color: '#434A54', fontSize: 14, lineHeight: 22 },
  footer: { borderTopWidth: 1, borderTopColor: '#E9EDF1', paddingHorizontal: 20, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 16 },
  footerPrice: { flex: 1 }, price: { color: '#253540', fontSize: 19, fontWeight: '800' },
  priceCaption: { color: '#8B95A5', fontSize: 11, marginTop: 3 },
  selectButton: { minWidth: 145, minHeight: 48, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: '#007E91', alignItems: 'center', justifyContent: 'center' },
  selectText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
