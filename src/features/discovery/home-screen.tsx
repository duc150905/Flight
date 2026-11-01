import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { ActionButton, Notice, colors } from '@/features/auth/ui';
import { listAirports, listDestinations } from './data';
import { cabinLabels, localDate, validateSearch, type Airport, type CabinClass, type Destination } from './model';
import { Brand, Page, styles } from './ui';

const emptyAirports: Airport[] = [];
const emptyDestinations: Destination[] = [];

function todayOnDevice() {
  return localDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
}

export function HomeScreen() {
  const { session } = useAuth();
  const airportsQuery = useQuery({ queryKey: ['airports'], queryFn: listAirports });
  const destinationsQuery = useQuery({ queryKey: ['featured-destinations'], queryFn: listDestinations });
  const airports = airportsQuery.data ?? emptyAirports;
  const destinations = destinationsQuery.data ?? emptyDestinations;
  const loading = airportsQuery.isPending;
  const error = airportsQuery.isError
    ? 'Không thể tải sân bay. Hãy kiểm tra kết nối hoặc cấu hình Supabase.' : '';
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [departureDate, setDepartureDate] = useState(todayOnDevice);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [cabinClass, setCabinClass] = useState<CabinClass>('economy');
  const [choosing, setChoosing] = useState<'origin' | 'destination' | null>(null);
  const [query, setQuery] = useState('');
  const [validationError, setValidationError] = useState('');

  const airportById = useMemo(() => new Map(airports.map(airport => [airport.id, airport])), [airports]);
  const matches = airports.filter(airport => {
    const text = `${airport.city} ${airport.name} ${airport.iata_code}`.toLocaleLowerCase('vi-VN');
    return text.includes(query.trim().toLocaleLowerCase('vi-VN'));
  }).slice(0, 8);
  const chooseAirport = (airport: Airport) => {
    if (choosing === 'origin') setOriginId(airport.id);
    else setDestinationId(airport.id);
    setChoosing(null); setQuery(''); setValidationError('');
  };
  const search = () => {
    try {
      const criteria = validateSearch({ originId, destinationId, departureDate, adults, children, infants, cabinClass },
        airportById.get(originId)?.timezone ?? 'UTC');
      setValidationError('');
      router.push({ pathname: '/results', params: {
        originId: criteria.originId, destinationId: criteria.destinationId,
        departureDate: criteria.departureDate, adults: String(criteria.adults),
        children: String(criteria.children), infants: String(criteria.infants), cabinClass: criteria.cabinClass,
      } });
    } catch (cause) {
      setValidationError(cause instanceof Error && 'issues' in cause
        ? (cause as { issues: { message: string }[] }).issues[0]?.message ?? 'Kiểm tra lại thông tin tìm kiếm.'
        : cause instanceof Error ? cause.message : 'Kiểm tra lại thông tin tìm kiếm.');
    }
  };
  const airportLabel = (id: string) => {
    const airport = airportById.get(id);
    return airport ? `${airport.city} (${airport.iata_code})` : 'Chọn sân bay';
  };

  return <Page>
    <View style={styles.row}>
      <Brand />
      <Pressable accessibilityRole="button" onPress={() => router.push('/account')}>
        <Text style={styles.link}>{session ? 'Tài khoản' : 'Đăng nhập'}</Text>
      </Pressable>
    </View>
    <View>
      <Text accessibilityRole="header" style={styles.title}>Bạn muốn bay tới đâu?</Text>
      <Text style={styles.subtitle}>Tìm chuyến bay và so sánh giá vé theo từng hạng.</Text>
    </View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Tìm chuyến bay</Text>
      <Text style={styles.muted}>Một chiều · Chọn sân bay, ngày và số hành khách.</Text>
      <Text style={styles.label}>Sân bay đi</Text>
      <Pressable accessibilityRole="button" style={styles.picker} onPress={() => { setChoosing('origin'); setQuery(''); }}>
        <Text style={styles.pickerText}>{airportLabel(originId)}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => {
        setOriginId(destinationId); setDestinationId(originId); setValidationError('');
      }}><Text style={styles.link}>⇄ Hoán đổi sân bay</Text></Pressable>
      <Text style={styles.label}>Sân bay đến</Text>
      <Pressable accessibilityRole="button" style={styles.picker} onPress={() => { setChoosing('destination'); setQuery(''); }}>
        <Text style={styles.pickerText}>{airportLabel(destinationId)}</Text>
      </Pressable>
      {choosing && <View style={styles.card}>
        <Text style={styles.label}>Tìm sân bay {choosing === 'origin' ? 'đi' : 'đến'}</Text>
        <TextInput value={query} onChangeText={setQuery} autoFocus autoCapitalize="none"
          accessibilityLabel="Tìm theo thành phố, tên sân bay hoặc mã IATA"
          placeholder="Thành phố, sân bay hoặc mã IATA" placeholderTextColor={colors.muted} style={styles.input} />
        {matches.length === 0 && <Text style={styles.muted}>Không tìm thấy sân bay phù hợp.</Text>}
        {matches.map(airport => <Pressable key={airport.id} accessibilityRole="button"
          onPress={() => chooseAirport(airport)} style={styles.picker}>
          <Text style={styles.pickerText}>{airport.city} ({airport.iata_code})</Text>
          <Text style={styles.muted}>{airport.name}</Text>
        </Pressable>)}
        <Pressable accessibilityRole="button" onPress={() => setChoosing(null)}><Text style={styles.link}>Đóng</Text></Pressable>
      </View>}
      <Text style={styles.label}>Ngày khởi hành</Text>
      <TextInput value={departureDate} onChangeText={setDepartureDate} accessibilityLabel="Ngày khởi hành"
        placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" placeholderTextColor={colors.muted}
        style={styles.input} />
      <Text style={styles.label}>Hành khách</Text>
      <PassengerCount label="Người lớn" value={adults} minimum={1} maximum={9} onChange={setAdults} />
      <PassengerCount label="Trẻ em" value={children} minimum={0} maximum={8} onChange={setChildren} />
      <PassengerCount label="Em bé" value={infants} minimum={0} maximum={9} onChange={setInfants} />
      <Text style={styles.label}>Hạng ghế</Text>
      <View style={styles.chipRow}>{(Object.keys(cabinLabels) as CabinClass[]).map(value =>
        <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: cabinClass === value }}
          onPress={() => setCabinClass(value)} style={[styles.chip, cabinClass === value && styles.selectedChip]}>
          <Text style={styles.chipText}>{cabinLabels[value]}</Text>
        </Pressable>)}</View>
      <Notice text={error} />
      {!!error && <ActionButton title="Thử tải sân bay" secondary onPress={() => void airportsQuery.refetch()} />}
      {!loading && !error && airports.length === 0 && <Text style={styles.muted}>Chưa có sân bay để tìm chuyến.</Text>}
      <Notice text={validationError} />
      <ActionButton title="Tìm chuyến bay" disabled={loading || !!error || airports.length === 0} onPress={search} />
    </View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Điểm đến gợi ý</Text>
      {destinationsQuery.isPending && <ActivityIndicator color={colors.primary} accessibilityLabel="Đang tải điểm đến" />}
      <Notice text={destinationsQuery.isError ? 'Không thể tải điểm đến gợi ý.' : ''} />
      {destinationsQuery.isError && <ActionButton title="Thử tải lại" secondary
        onPress={() => void destinationsQuery.refetch()} />}
      {!destinationsQuery.isPending && !destinationsQuery.isError && destinations.length === 0
        && <Text style={styles.muted}>Chưa có điểm đến gợi ý.</Text>}
      {destinations.map(destination => {
        const airport = airportById.get(destination.airport_id);
        return airport && <Pressable key={destination.id} accessibilityRole="button" style={styles.picker}
          onPress={() => { setDestinationId(airport.id); setValidationError(''); }}>
          <Text style={styles.pickerText}>{destination.title} · {airport.iata_code}</Text>
          {!!destination.description && <Text style={styles.muted}>{destination.description}</Text>}
        </Pressable>;
      })}
    </View>
  </Page>;
}

function PassengerCount({ label, value, minimum, maximum, onChange }: {
  label: string; value: number; minimum: number; maximum: number; onChange: (value: number) => void;
}) {
  return <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.row, { justifyContent: 'flex-end' }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Giảm ${label.toLowerCase()}`}
        disabled={value <= minimum} onPress={() => onChange(value - 1)} style={styles.chip}>
        <Text style={styles.chipText}>−</Text>
      </Pressable>
      <Text style={styles.pickerText}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Tăng ${label.toLowerCase()}`}
        disabled={value >= maximum} onPress={() => onChange(value + 1)} style={styles.chip}>
        <Text style={styles.chipText}>+</Text>
      </Pressable>
    </View>
  </View>;
}
