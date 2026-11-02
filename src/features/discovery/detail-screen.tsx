import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Notice } from '@/features/auth/ui';
import { useLanguage } from '@/features/i18n/provider';
import { formatTime } from '@/features/i18n/translate';
import { CurrencyControls, MoneyText } from '@/features/currency/ui';
import { useDisplayMoney } from '@/features/currency/provider';
import { inlineMoney } from '@/features/currency/presentation';
import { loadFlightOffer } from './data';
import { cabinLabels, checkoutHrefForOffer, searchSchema, type FlightOffer } from './model';
import { FlightButton, flightColors, Page, styles } from './ui';

function baggageText(value: unknown, t: (key: string, params?: Record<string, string | number>) => string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return t('Xem điều kiện tại bước đặt vé.');
  const fields = value as Record<string, unknown>;
  const cabin = typeof fields.cabin_kg === 'number' ? fields.cabin_kg : 0;
  const checked = typeof fields.checked_kg === 'number' ? fields.checked_kg : 0;
  return t('Xách tay {cabin} kg · Ký gửi {checked} kg', { cabin, checked });
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
    queryKey: ['flight-detail', key],
    queryFn: () => loadFlightOffer(id, fareId, criteria!),
    enabled: !!criteria && !!id && !!fareId,
  });
  const offer: FlightOffer | undefined = detailQuery.data;
  const loading = detailQuery.isPending && !!criteria && !!id && !!fareId;
  const error = detailQuery.isError ? 'Không thể tải chi tiết chuyến bay. Hãy thử lại.' : '';

  if (!criteria || !id || !fareId) return <Page>
    <Text style={styles.title}>{t('Thông tin chuyến bay không hợp lệ')}</Text>
    <FlightButton title={t('Về trang chủ')} onPress={() => router.replace('/')} />
  </Page>;
  return <Page>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.link}>← {t('Kết quả tìm kiếm')}</Text></Pressable>
    <Text accessibilityRole="header" style={styles.title}>{t('Chi tiết chuyến bay')}</Text>
    <CurrencyControls />
    {loading && <ActivityIndicator color={flightColors.primary} accessibilityLabel={t('Đang tải chi tiết chuyến bay')} />}
    <Notice text={t(error)} />
    {!!error && <FlightButton title={t('Thử lại')} secondary onPress={() => void detailQuery.refetch()} />}
    {offer && !loading && !error && <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{offer.airline.name} · {offer.flight.flight_number}</Text>
        <Text style={styles.subtitle}>{offer.origin.city} ({offer.origin.iata_code}) → {offer.destination.city} ({offer.destination.iata_code})</Text>
        <Text style={styles.label}>{t('Khởi hành')}</Text>
        <Text style={styles.muted}>{formatTime(language, offer.flight.departure_at, offer.origin.timezone)}</Text>
        <Text style={styles.label}>{t('Đến nơi')}</Text>
        <Text style={styles.muted}>{formatTime(language, offer.flight.arrival_at, offer.destination.timezone)}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{offer.fare.name} · {t(cabinLabels[offer.fare.cabin_class])}</Text>
        <Text style={styles.label}>{t('Hành lý bao gồm')}</Text>
        <Text style={styles.muted}>{baggageText(offer.fare.baggage_allowance, t)}</Text>
        <Text style={styles.label}>{t('Điều kiện hủy')}</Text>
        <Text style={styles.muted}>{offer.fare.cancellation_allowed
          ? t('Được yêu cầu hủy trước giờ bay ít nhất {minutes} phút. Phí hủy theo điều kiện vé: {fee}. Server sẽ xác nhận số tiền cuối cùng.', {
            minutes: offer.fare.cancellation_cutoff_minutes, fee: inlineMoney(displayMoney(offer.fare.cancellation_fee_amount, offer.fare.currency)),
          }) : t('Không cho phép yêu cầu hủy theo điều kiện vé này.')}</Text>
        <View style={styles.divider} />
        <Text style={styles.label}>{t('Tổng ước tính cho {count} hành khách', { count: criteria.adults + criteria.children + criteria.infants })}</Text>
        <MoneyText amount={offer.total} currency={offer.fare.currency} style={[styles.title, { color: flightColors.primary }]} />
        <Text style={styles.muted}>{t('Giá và khả năng giữ chỗ sẽ được kiểm tra lại khi tạo đơn.')}</Text>
        <FlightButton title={t('Tiếp tục đặt vé')} onPress={() => router.push(checkoutHrefForOffer(offer, criteria))} />
      </View>
    </>}
  </Page>;
}
