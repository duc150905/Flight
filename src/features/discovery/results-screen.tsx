import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ActionButton, Notice, colors } from '@/features/auth/ui';
import { searchOneWay } from './data';
import { cabinLabels, formatMoney, searchSchema, type FlightOffer, type SearchCriteria } from './model';
import { Page, styles } from './ui';

type Sort = 'price' | 'departure' | 'duration';
const emptyOffers: FlightOffer[] = [];

function timeAt(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })
    .format(new Date(iso));
}

function durationMinutes(offer: FlightOffer) {
  return Math.round((Date.parse(offer.flight.arrival_at) - Date.parse(offer.flight.departure_at)) / 60_000);
}

export function ResultsScreen({ input }: { input: Record<string, string | string[] | undefined> }) {
  const searchKey = [input.originId, input.destinationId, input.departureDate, input.adults,
    input.children, input.infants, input.cabinClass].join('|');
  const parsed = searchSchema.safeParse(input);
  const criteria = parsed.success ? parsed.data : null;
  const searchQuery = useQuery({
    queryKey: ['flight-search', searchKey],
    queryFn: () => searchOneWay(criteria), enabled: !!criteria,
  });
  const offers = searchQuery.data?.offers ?? emptyOffers;
  const loading = searchQuery.isPending && !!criteria;
  const error = searchQuery.isError ? 'Không thể tìm chuyến bay. Hãy kiểm tra kết nối và thử lại.' : '';
  const [sort, setSort] = useState<Sort>('price');
  const [airlineId, setAirlineId] = useState('');

  const airlines = useMemo(() => [...new Map(offers.map(offer =>
    [offer.airline.id, offer.airline.name])).entries()], [offers]);
  const visible = useMemo(() => offers.filter(offer => !airlineId || offer.airline.id === airlineId)
    .sort((a, b) => sort === 'price' ? a.total - b.total
      : sort === 'departure' ? Date.parse(a.flight.departure_at) - Date.parse(b.flight.departure_at)
        : durationMinutes(a) - durationMinutes(b)), [offers, airlineId, sort]);

  if (!criteria) return <Page>
    <Text style={styles.title}>Thông tin tìm kiếm không hợp lệ</Text>
    <ActionButton title="Về trang chủ" onPress={() => router.replace('/')} />
  </Page>;
  return <Page>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.link}>← Sửa tìm kiếm</Text></Pressable>
    <View>
      <Text accessibilityRole="header" style={styles.title}>Chuyến bay một chiều</Text>
      <Text style={styles.subtitle}>{criteria.departureDate} · {cabinLabels[criteria.cabinClass]} ·
        {' '}{criteria.adults + criteria.children + criteria.infants} hành khách</Text>
    </View>
    {loading && <View style={styles.card}><ActivityIndicator color={colors.primary} accessibilityLabel="Đang tìm chuyến bay" /></View>}
    <Notice text={error} />
    {!!error && <ActionButton title="Thử lại" secondary onPress={() => void searchQuery.refetch()} />}
    {!loading && !error && offers.length === 0 && <View style={styles.card}>
      <Text style={styles.sectionTitle}>Chưa có chuyến bay phù hợp</Text>
      <Text style={styles.muted}>Hãy thử ngày khác, hạng ghế khác hoặc tuyến khác.</Text>
    </View>}
    {!loading && !error && offers.length > 0 && <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{visible.length} lựa chọn</Text>
        <Text style={styles.label}>Sắp xếp</Text>
        <View style={styles.chipRow}>{([
          ['price', 'Giá thấp nhất'], ['departure', 'Giờ khởi hành'], ['duration', 'Thời gian bay'],
        ] as [Sort, string][]).map(([value, label]) =>
          <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: sort === value }}
            onPress={() => setSort(value)} style={[styles.chip, sort === value && styles.selectedChip]}>
            <Text style={styles.chipText}>{label}</Text>
          </Pressable>)}</View>
        <Text style={styles.label}>Hãng bay</Text>
        <View style={styles.chipRow}>
          <Pressable accessibilityRole="button" onPress={() => setAirlineId('')}
            style={[styles.chip, !airlineId && styles.selectedChip]}><Text style={styles.chipText}>Tất cả</Text></Pressable>
          {airlines.map(([id, name]) => <Pressable key={id} accessibilityRole="button"
            onPress={() => setAirlineId(id)} style={[styles.chip, airlineId === id && styles.selectedChip]}>
            <Text style={styles.chipText}>{name}</Text>
          </Pressable>)}
        </View>
      </View>
      {visible.map(offer => <FlightCard key={offer.fare.id} offer={offer} criteria={criteria} />)}
      <Text style={styles.muted}>Giá hiển thị là ước tính cho nhóm hành khách. Giá cuối cùng được kiểm tra lại khi đặt vé.</Text>
    </>}
  </Page>;
}

function FlightCard({ offer, criteria }: { offer: FlightOffer; criteria: SearchCriteria }) {
  const minutes = durationMinutes(offer);
  return <Pressable accessibilityRole="button" style={styles.card} onPress={() => router.push({
    pathname: '/flights/[id]', params: {
      id: offer.flight.id, fareId: offer.fare.id,
      originId: criteria.originId, destinationId: criteria.destinationId,
      departureDate: criteria.departureDate, adults: String(criteria.adults),
      children: String(criteria.children), infants: String(criteria.infants), cabinClass: criteria.cabinClass,
    },
  })}>
    <Text style={styles.label}>{offer.airline.name} · {offer.flight.flight_number}</Text>
    <View style={styles.row}>
      <View><Text style={styles.sectionTitle}>{timeAt(offer.flight.departure_at, offer.origin.timezone)}</Text>
        <Text style={styles.muted}>{offer.origin.iata_code}</Text></View>
      <Text style={styles.muted}>{Math.floor(minutes / 60)}g {minutes % 60}p · Bay thẳng</Text>
      <View><Text style={styles.sectionTitle}>{timeAt(offer.flight.arrival_at, offer.destination.timezone)}</Text>
        <Text style={styles.muted}>{offer.destination.iata_code}</Text></View>
    </View>
    <View style={styles.divider} />
    <View style={styles.row}>
      <Text style={styles.muted}>{offer.fare.name}</Text>
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>{formatMoney(offer.total, offer.fare.currency)}</Text>
    </View>
    <Text style={styles.link}>Xem chi tiết và điều kiện vé →</Text>
  </Pressable>;
}
