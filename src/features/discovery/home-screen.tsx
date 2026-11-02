import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { Notice } from '@/features/auth/ui';
import { listAirports, listDestinations } from './data';
import { cabinLabels, localDate, type Airport, type CabinClass, type Destination } from './model';
import { validateTripSearch, type TripLeg, type TripSearch } from './trip-search';
import { Brand, FlightButton, flightColors, Page, styles } from './ui';

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
  const [tripType, setTripType] = useState<TripSearch['tripType']>('one_way');
  const [legs, setLegs] = useState<TripLeg[]>([{ originId: '', destinationId: '', departureDate: todayOnDevice() }]);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [cabinClass, setCabinClass] = useState<CabinClass>('economy');
  const [showOptions, setShowOptions] = useState(false);
  const [choosing, setChoosing] = useState<{ index: number; field: 'originId' | 'destinationId' } | null>(null);
  const [query, setQuery] = useState('');
  const [validationError, setValidationError] = useState('');

  const airportById = useMemo(() => new Map(airports.map(airport => [airport.id, airport])), [airports]);
  const matches = airports.filter(airport => {
    const text = `${airport.city} ${airport.name} ${airport.iata_code}`.toLocaleLowerCase('vi-VN');
    return text.includes(query.trim().toLocaleLowerCase('vi-VN'));
  }).slice(0, 8);
  const updateLeg = (index: number, field: keyof TripLeg, value: string) => {
    setLegs(previous => {
      const next = previous.map(leg => ({ ...leg }));
      next[index][field] = value;
      if (tripType === 'round_trip' && index === 0 && field !== 'departureDate') {
        next[1].originId = next[0].destinationId;
        next[1].destinationId = next[0].originId;
      }
      return next;
    });
    setValidationError('');
  };
  const changeTripType = (value: TripSearch['tripType']) => {
    const first = legs[0];
    setTripType(value);
    setLegs(value === 'one_way' ? [first] : [first, {
      originId: first.destinationId, destinationId: value === 'round_trip' ? first.originId : '',
      departureDate: first.departureDate,
    }]);
    setChoosing(null); setValidationError('');
  };
  const chooseAirport = (airport: Airport) => {
    if (choosing) updateLeg(choosing.index, choosing.field, airport.id);
    setChoosing(null); setQuery(''); setValidationError('');
  };
  const search = () => {
    try {
      const trip = validateTripSearch({ tripType, legs, adults, children, infants, cabinClass },
        new Map(airports.map(airport => [airport.id, airport.timezone])));
      setValidationError('');
      if (trip.tripType === 'one_way') {
        const leg = trip.legs[0];
        router.push({ pathname: '/results', params: {
          ...leg, adults: String(trip.adults), children: String(trip.children),
          infants: String(trip.infants), cabinClass: trip.cabinClass,
        } });
      } else router.push({ pathname: '/itinerary-results', params: { search: JSON.stringify(trip) } });
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
      <View style={styles.chipRow}>{([
        ['round_trip', 'Khứ hồi'], ['one_way', 'Một chiều'], ['multi_city', 'Nhiều chặng'],
      ] as [TripSearch['tripType'], string][]).map(([value, label]) => <Pressable key={value}
        accessibilityRole="button" accessibilityState={{ selected: tripType === value }}
        onPress={() => changeTripType(value)} style={[styles.chip, tripType === value && styles.selectedChip]}>
        <Text style={styles.chipText}>{label}</Text>
      </Pressable>)}</View>
      {legs.map((leg, index) => <View key={index} style={{ gap: 10 }}>
        {tripType !== 'one_way' && <Text style={styles.sectionTitle}>
          {tripType === 'round_trip' ? index === 0 ? 'Chiều đi' : 'Chiều về' : `Chặng ${index + 1}`}
        </Text>}
        <Text style={styles.label}>Sân bay đi</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Chọn sân bay đi chặng ${index + 1}`}
          disabled={tripType === 'round_trip' && index > 0} style={styles.picker}
          onPress={() => { setChoosing({ index, field: 'originId' }); setQuery(''); }}>
          <Text style={styles.pickerText}>{airportLabel(leg.originId)}</Text>
        </Pressable>
        {index === 0 && <Pressable accessibilityRole="button" style={styles.picker} onPress={() => {
          updateLeg(0, 'originId', leg.destinationId);
          updateLeg(0, 'destinationId', leg.originId);
        }}><Text style={styles.link}>⇄ Hoán đổi sân bay</Text></Pressable>}
        <Text style={styles.label}>Sân bay đến</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Chọn sân bay đến chặng ${index + 1}`}
          disabled={tripType === 'round_trip' && index === 1} style={styles.picker}
          onPress={() => { setChoosing({ index, field: 'destinationId' }); setQuery(''); }}>
          <Text style={styles.pickerText}>{airportLabel(leg.destinationId)}</Text>
        </Pressable>
        <Text style={styles.label}>{tripType === 'round_trip' && index === 1 ? 'Ngày về' : 'Ngày khởi hành'}</Text>
        <TextInput value={leg.departureDate} onChangeText={value => updateLeg(index, 'departureDate', value)}
          accessibilityLabel={`Ngày khởi hành chặng ${index + 1}`} placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation" placeholderTextColor={flightColors.muted} style={styles.input} />
      </View>)}
      {tripType === 'multi_city' && <View style={styles.chipRow}>
        {legs.length < 12 && <Pressable accessibilityRole="button" style={styles.picker} onPress={() => {
          const last = legs.at(-1)!;
          setLegs(previous => [...previous, { originId: last.destinationId, destinationId: '', departureDate: last.departureDate }]);
        }}><Text style={styles.link}>+ Thêm chặng</Text></Pressable>}
        {legs.length > 2 && <Pressable accessibilityRole="button" style={styles.picker}
          onPress={() => setLegs(previous => previous.slice(0, -1))}><Text style={styles.link}>Bớt chặng cuối</Text></Pressable>}
      </View>}
      {choosing && <View style={styles.card}>
        <Text style={styles.label}>Tìm sân bay {choosing.field === 'originId' ? 'đi' : 'đến'} chặng {choosing.index + 1}</Text>
        <TextInput value={query} onChangeText={setQuery} autoFocus autoCapitalize="none"
          accessibilityLabel="Tìm theo thành phố, tên sân bay hoặc mã IATA"
          placeholder="Thành phố, sân bay hoặc mã IATA" placeholderTextColor={flightColors.muted} style={styles.input} />
        {matches.length === 0 && <Text style={styles.muted}>Không tìm thấy sân bay phù hợp.</Text>}
        {matches.map(airport => <Pressable key={airport.id} accessibilityRole="button"
          onPress={() => chooseAirport(airport)} style={styles.picker}>
          <Text style={styles.pickerText}>{airport.city} ({airport.iata_code})</Text>
          <Text style={styles.muted}>{airport.name}</Text>
        </Pressable>)}
        <Pressable accessibilityRole="button" onPress={() => setChoosing(null)}><Text style={styles.link}>Đóng</Text></Pressable>
      </View>}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showOptions }} style={styles.picker}
        onPress={() => setShowOptions(value => !value)}>
        <Text style={styles.pickerText}>
          {adults + children + infants} hành khách · {cabinLabels[cabinClass]} {showOptions ? '⌃' : '⌄'}
        </Text>
      </Pressable>
      {showOptions && <View style={{ gap: 12 }}>
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
      </View>}
      <Notice text={error} />
      {!!error && <FlightButton title="Thử tải sân bay" secondary onPress={() => void airportsQuery.refetch()} />}
      {!loading && !error && airports.length === 0 && <Text style={styles.muted}>Chưa có sân bay để tìm chuyến.</Text>}
      <Notice text={validationError} />
      <FlightButton title="Tìm chuyến bay" disabled={loading || !!error || airports.length === 0} onPress={search} />
    </View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Điểm đến gợi ý</Text>
      {destinationsQuery.isPending && <ActivityIndicator color={flightColors.primary} accessibilityLabel="Đang tải điểm đến" />}
      <Notice text={destinationsQuery.isError ? 'Không thể tải điểm đến gợi ý.' : ''} />
      {destinationsQuery.isError && <FlightButton title="Thử tải lại" secondary
        onPress={() => void destinationsQuery.refetch()} />}
      {!destinationsQuery.isPending && !destinationsQuery.isError && destinations.length === 0
        && <Text style={styles.muted}>Chưa có điểm đến gợi ý.</Text>}
      {destinations.map(destination => {
        const airport = airportById.get(destination.airport_id);
        return airport && <Pressable key={destination.id} accessibilityRole="button" style={styles.picker}
          onPress={() => updateLeg(0, 'destinationId', airport.id)}>
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
