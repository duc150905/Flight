import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ActionButton, Notice, colors } from '@/features/auth/ui';
import { loadFlightOffer } from './data';
import { cabinLabels, formatMoney, searchSchema, type FlightOffer } from './model';
import { Page, styles } from './ui';

function baggageText(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Xem điều kiện tại bước đặt vé.';
  const fields = value as Record<string, unknown>;
  const cabin = typeof fields.cabin_kg === 'number' ? fields.cabin_kg : 0;
  const checked = typeof fields.checked_kg === 'number' ? fields.checked_kg : 0;
  return `Xách tay ${cabin} kg · Ký gửi ${checked} kg`;
}

export function DetailScreen({ input }: { input: Record<string, string | string[] | undefined> }) {
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
    <Text style={styles.title}>Thông tin chuyến bay không hợp lệ</Text>
    <ActionButton title="Về trang chủ" onPress={() => router.replace('/')} />
  </Page>;
  return <Page>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.link}>← Kết quả tìm kiếm</Text></Pressable>
    <Text accessibilityRole="header" style={styles.title}>Chi tiết chuyến bay</Text>
    {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="Đang tải chi tiết chuyến bay" />}
    <Notice text={error} />
    {!!error && <ActionButton title="Thử lại" secondary onPress={() => void detailQuery.refetch()} />}
    {offer && !loading && !error && <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{offer.airline.name} · {offer.flight.flight_number}</Text>
        <Text style={styles.subtitle}>{offer.origin.city} ({offer.origin.iata_code}) → {offer.destination.city} ({offer.destination.iata_code})</Text>
        <Text style={styles.label}>Khởi hành</Text>
        <Text style={styles.muted}>{new Intl.DateTimeFormat('vi-VN', { timeZone: offer.origin.timezone,
          dateStyle: 'full', timeStyle: 'short' }).format(new Date(offer.flight.departure_at))}</Text>
        <Text style={styles.label}>Đến nơi</Text>
        <Text style={styles.muted}>{new Intl.DateTimeFormat('vi-VN', { timeZone: offer.destination.timezone,
          dateStyle: 'full', timeStyle: 'short' }).format(new Date(offer.flight.arrival_at))}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{offer.fare.name} · {cabinLabels[offer.fare.cabin_class]}</Text>
        <Text style={styles.label}>Hành lý bao gồm</Text>
        <Text style={styles.muted}>{baggageText(offer.fare.baggage_allowance)}</Text>
        <Text style={styles.label}>Điều kiện hủy</Text>
        <Text style={styles.muted}>{offer.fare.cancellation_allowed
          ? `Được yêu cầu hủy trước giờ bay ít nhất ${offer.fare.cancellation_cutoff_minutes} phút. Phí hủy theo điều kiện vé: ${formatMoney(offer.fare.cancellation_fee_amount, offer.fare.currency)}. Server sẽ xác nhận số tiền cuối cùng.`
          : 'Không cho phép yêu cầu hủy theo điều kiện vé này.'}</Text>
        <View style={styles.divider} />
        <Text style={styles.label}>Tổng ước tính cho {criteria.adults + criteria.children + criteria.infants} hành khách</Text>
        <Text style={[styles.title, { color: colors.primary }]}>{formatMoney(offer.total, offer.fare.currency)}</Text>
        <Text style={styles.muted}>Giá và khả năng giữ chỗ sẽ được server kiểm tra lại khi tạo đơn. Chức năng đặt vé do TV2 triển khai.</Text>
      </View>
    </>}
  </Page>;
}
