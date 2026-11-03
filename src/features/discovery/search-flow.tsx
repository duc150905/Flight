import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Notice } from '@/features/auth/ui';
import { useLanguage } from '@/features/i18n/provider';
import { monthAfter, monthGrid } from './search-calendar';
import { cabinLabels, localDate, type Airport, type CabinClass } from './model';
import { validateTripSearch, type TripLeg, type TripSearch } from './trip-search';

type AirportField = 'originId' | 'destinationId';
type AirportPicker = { index: number; field: AirportField } | null;
const colors = {
  ink: '#353B46', body: '#434A54', muted: '#758294', pale: '#B9C0CB',
  border: '#E9EDF1', field: '#F2F3F5', primary: '#007E91', tint: '#E4F5F6', white: '#FFFFFF',
};

function todayOnDevice() {
  return localDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
}

function shortDate(date: string, language: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function SearchFlow({ airports, loading, error, onRetry, onClose, initialDestinationId }: {
  airports: Airport[]; loading: boolean; error: boolean; onRetry: () => void;
  onClose: () => void; initialDestinationId: string;
}) {
  const { t, language } = useLanguage();
  const today = todayOnDevice();
  const [tripType, setTripType] = useState<TripSearch['tripType']>('one_way');
  const [legs, setLegs] = useState<TripLeg[]>([{
    originId: '', destinationId: initialDestinationId, departureDate: today,
  }]);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [cabinClass, setCabinClass] = useState<CabinClass>('economy');
  const [airportPicker, setAirportPicker] = useState<AirportPicker>(null);
  const [airportQuery, setAirportQuery] = useState('');
  const [datePicker, setDatePicker] = useState<number | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }));
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [validationError, setValidationError] = useState('');
  const airportById = useMemo(() => new Map(airports.map(airport => [airport.id, airport])), [airports]);
  const matches = airports.filter(airport =>
    `${airport.city} ${airport.name} ${t(airport.city)} ${t(airport.name)} ${airport.iata_code}`.toLocaleLowerCase('vi-VN')
      .includes(airportQuery.trim().toLocaleLowerCase('vi-VN'))).slice(0, 12);

  const updateLeg = (index: number, field: keyof TripLeg, value: string) => {
    setLegs(previous => {
      const next = previous.map(leg => ({ ...leg }));
      next[index][field] = value;
      if (tripType === 'round_trip' && index === 0) {
        if (field !== 'departureDate') {
          next[1].originId = next[0].destinationId;
          next[1].destinationId = next[0].originId;
        } else if (next[1].departureDate < value) next[1].departureDate = value;
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
      departureDate: legs[1]?.departureDate && legs[1].departureDate >= first.departureDate
        ? legs[1].departureDate : first.departureDate,
    }]);
    setValidationError('');
  };
  const swapAirports = () => {
    setLegs(previous => {
      const next = previous.map(leg => ({ ...leg }));
      [next[0].originId, next[0].destinationId] = [next[0].destinationId, next[0].originId];
      if (tripType === 'round_trip') {
        next[1].originId = next[0].destinationId;
        next[1].destinationId = next[0].originId;
      }
      return next;
    });
    setValidationError('');
  };
  const openDatePicker = (index: number) => {
    const date = legs[index].departureDate;
    setMonthCursor({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 });
    setDatePicker(index);
  };
  const search = () => {
    try {
      const trip = validateTripSearch({ tripType, legs, adults, children, infants, cabinClass },
        new Map(airports.map(airport => [airport.id, airport.timezone])));
      setValidationError('');
      if (trip.tripType === 'one_way') {
        router.push({ pathname: '/results', params: {
          ...trip.legs[0], adults: String(trip.adults), children: String(trip.children),
          infants: String(trip.infants), cabinClass: trip.cabinClass,
        } });
      } else router.push({ pathname: '/itinerary-results', params: { search: JSON.stringify(trip) } });
    } catch (cause) {
      setValidationError(cause instanceof Error && 'issues' in cause
        ? (cause as { issues: { message: string }[] }).issues[0]?.message ?? 'Kiểm tra lại thông tin tìm kiếm.'
        : cause instanceof Error ? cause.message : 'Kiểm tra lại thông tin tìm kiếm.');
    }
  };
  const airportLabel = (id: string, fallback: string) => {
    const airport = airportById.get(id);
    return airport ? `${t(airport.city)} (${airport.iata_code})` : t(fallback);
  };
  const indexedError = /^Chặng (\d+): (.+)$/.exec(validationError);
  const localizedError = indexedError
    ? t(`Chặng {number}: ${indexedError[2]}`, { number: indexedError[1] })
    : t(validationError);

  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Đóng')} onPress={onClose} style={s.headerAction}>
        <Text style={s.close}>×</Text></Pressable>
      <Text accessibilityRole="header" style={s.headerTitle}>{t('Tìm chuyến bay')}</Text>
      <View style={s.headerAction} />
    </View>
    <View style={s.tabs}>{([
      ['round_trip', 'Khứ hồi'], ['one_way', 'Một chiều'], ['multi_city', 'Nhiều chặng'],
    ] as [TripSearch['tripType'], string][]).map(([value, label]) => <Pressable key={value}
      accessibilityRole="tab" accessibilityState={{ selected: tripType === value }}
      onPress={() => changeTripType(value)} style={[s.tab, tripType === value && s.activeTab]}>
      <Text style={[s.tabText, tripType === value && s.activeTabText]}>{t(label)}</Text>
    </Pressable>)}</View>
    <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
      {legs.map((leg, index) => <View key={index} style={s.leg}>
        {tripType !== 'one_way' && <Text style={s.legTitle}>{tripType === 'multi_city'
          ? t('Chặng {number}', { number: index + 1 }) : t(index === 0 ? 'Chiều đi' : 'Chiều về')}</Text>}
        <View style={tripType === 'multi_city' ? s.twoColumns : undefined}>
          <AirportFieldButton label={airportLabel(leg.originId, 'Sân bay đi')} icon="↗"
            onPress={() => { setAirportPicker({ index, field: 'originId' }); setAirportQuery(''); }}
            disabled={tripType === 'round_trip' && index > 0} compact={tripType === 'multi_city'} />
          <AirportFieldButton label={airportLabel(leg.destinationId, 'Sân bay đến')} icon="↘"
            onPress={() => { setAirportPicker({ index, field: 'destinationId' }); setAirportQuery(''); }}
            disabled={tripType === 'round_trip' && index > 0} compact={tripType === 'multi_city'} />
          {index === 0 && tripType !== 'multi_city' && <Pressable accessibilityRole="button"
            accessibilityLabel={t('Hoán đổi sân bay')} onPress={swapAirports} style={s.swap}>
            <Text style={s.swapText}>↕</Text></Pressable>}
        </View>
        <AirportFieldButton label={shortDate(leg.departureDate, language)} icon="▦"
          onPress={() => openDatePicker(index)} />
      </View>)}
      {tripType === 'multi_city' && <View style={s.multiActions}>
        {legs.length < 12 && <Pressable accessibilityRole="button" onPress={() => setLegs(previous => [
          ...previous, { originId: previous.at(-1)!.destinationId, destinationId: '',
            departureDate: previous.at(-1)!.departureDate },
        ])} style={s.outlineButton}><Text style={s.outlineText}>+ {t('Thêm chặng')}</Text></Pressable>}
        {legs.length > 2 && <Pressable accessibilityRole="button" onPress={() => setLegs(previous => previous.slice(0, -1))}
          style={s.outlineButton}><Text style={s.outlineText}>{t('Bớt chặng cuối')}</Text></Pressable>}
      </View>}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: optionsOpen }}
        onPress={() => setOptionsOpen(true)} style={s.optionsRow}>
        <Text style={s.optionsText}>{t('{count} hành khách', { count: adults + children + infants })} · {t(cabinLabels[cabinClass])}</Text>
        <Text style={s.optionsText}>⌄</Text>
      </Pressable>
      <Notice text={error ? t('Không thể tải sân bay. Hãy kiểm tra kết nối hoặc cấu hình Supabase.') : ''} />
      {error && <Pressable accessibilityRole="button" onPress={onRetry}><Text style={s.outlineText}>{t('Thử tải sân bay')}</Text></Pressable>}
      <Notice text={localizedError} />
    </ScrollView>
    <View style={s.footer}><PrimaryButton title={t('Tìm chuyến bay')} onPress={search}
      disabled={loading || error || airports.length === 0} /></View>

    <Modal visible={airportPicker !== null} animationType="slide" onRequestClose={() => setAirportPicker(null)}>
      <SafeAreaView style={s.safe}>
        <ModalHeader title={t(airportPicker?.field === 'originId' ? 'Sân bay đi' : 'Sân bay đến')}
          onClose={() => setAirportPicker(null)} />
        <View style={s.modalSearch}><TextInput value={airportQuery} onChangeText={setAirportQuery}
          autoFocus autoCapitalize="none" placeholder={t('Thành phố, sân bay hoặc mã IATA')}
          accessibilityLabel={t('Tìm theo thành phố, tên sân bay hoặc mã IATA')}
          placeholderTextColor={colors.pale} style={s.searchInput} /></View>
        <Text style={s.modalSection}>{t('Kết quả phù hợp')}</Text>
        <ScrollView keyboardShouldPersistTaps="handled">
          {matches.length === 0 && <Text style={s.empty}>{t('Không tìm thấy sân bay phù hợp.')}</Text>}
          {matches.map(airport => <Pressable key={airport.id} accessibilityRole="button"
            onPress={() => { if (airportPicker) updateLeg(airportPicker.index, airportPicker.field, airport.id);
              setAirportPicker(null); }} style={s.airportRow}>
            <View style={s.airportIcon}><Text style={s.airportIconText}>↗</Text></View>
            <View style={s.airportCopy}><Text style={s.airportCity}>{t(airport.city)}</Text>
              <Text style={s.airportName}>{t(airport.name)}</Text></View>
            <Text style={s.airportCode}>{airport.iata_code}</Text>
          </Pressable>)}
        </ScrollView>
      </SafeAreaView>
    </Modal>

    <Modal visible={datePicker !== null} animationType="slide" onRequestClose={() => setDatePicker(null)}>
      <SafeAreaView style={s.safe}>
        <ModalHeader title={t('Chọn ngày')} onClose={() => setDatePicker(null)} />
        <ScrollView contentContainerStyle={s.calendarScroll}>
          <View style={s.monthNavigation}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Tháng trước')}
              disabled={`${monthCursor.year}-${String(monthCursor.month + 1).padStart(2, '0')}` <= today.slice(0, 7)}
              onPress={() => setMonthCursor(monthAfter(monthCursor.year, monthCursor.month, -1))} style={s.monthArrow}>
              <Text style={s.monthArrowText}>‹</Text></Pressable>
            <Text style={s.monthTitle}>{new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN',
              { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(monthCursor.year, monthCursor.month, 1)))}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Tháng sau')}
              onPress={() => setMonthCursor(monthAfter(monthCursor.year, monthCursor.month, 1))} style={s.monthArrow}>
              <Text style={s.monthArrowText}>›</Text></Pressable>
          </View>
          {[0, 1].map(offset => {
            const month = monthAfter(monthCursor.year, monthCursor.month, offset);
            const selected = datePicker === null ? '' : legs[datePicker].departureDate;
            const minimum = datePicker && legs[datePicker - 1]?.departureDate > today
              ? legs[datePicker - 1].departureDate : today;
            return <View key={offset} style={s.monthBlock}>
              {offset === 1 && <Text style={s.monthTitle}>{new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN',
                { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(month.year, month.month, 1)))}</Text>}
              <View style={s.calendarGrid}>
                {(language === 'en' ? ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
                  : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']).map(day => <Text key={day} style={s.weekday}>{day}</Text>)}
                {monthGrid(month.year, month.month).map((date, index) => <View key={date ?? `blank-${index}`} style={s.daySlot}>
                  {date && <Pressable accessibilityRole="button" accessibilityLabel={shortDate(date, language)}
                    accessibilityState={{ selected: date === selected, disabled: date < minimum }}
                    disabled={date < minimum} onPress={() => { if (datePicker !== null) updateLeg(datePicker, 'departureDate', date); setDatePicker(null); }}
                    style={[s.dayButton, date === selected && s.selectedDay]}>
                    <Text style={[s.dayText, date < minimum && s.disabledDay, date === selected && s.selectedDayText]}>{Number(date.slice(-2))}</Text>
                  </Pressable>}
                </View>)}
              </View>
            </View>;
          })}
        </ScrollView>
        <View style={s.footer}><PrimaryButton title={t('Xong')} onPress={() => setDatePicker(null)} /></View>
      </SafeAreaView>
    </Modal>

    <Modal visible={optionsOpen} animationType="slide" onRequestClose={() => setOptionsOpen(false)}>
      <SafeAreaView style={s.safe}>
        <ModalHeader title={t('Hành khách & hạng ghế')} onClose={() => setOptionsOpen(false)} />
        <ScrollView contentContainerStyle={s.optionsScroll}>
          <Text style={s.modalSection}>{t('Hành khách')}</Text>
          <Text style={s.airportName}>{t('Choose the correct age group: infant under 2, child 2–11, adult 12+. Age is calculated on each flight date.')}</Text>
          <CountRow label={t('Người lớn')} hint={t('Từ 12 tuổi')} value={adults} minimum={1}
            maximum={Math.min(9 - children, 9)} onChange={value => {
              setAdults(value); setInfants(previous => Math.min(previous, value));
            }} />
          <CountRow label={t('Trẻ em')} hint={t('2–11 tuổi')} value={children} minimum={0}
            maximum={Math.min(8, 9 - adults)} onChange={setChildren} />
          <CountRow label={t('Em bé')} hint={t('Dưới 2 tuổi')} value={infants} minimum={0}
            maximum={adults} onChange={setInfants} />
          <Text style={s.airportName}>{t('Each infant under 2 needs their own accompanying traveller aged 18 or over on that flight.')}</Text>
          <Text style={s.modalSection}>{t('Hạng ghế')}</Text>
          {(Object.keys(cabinLabels) as CabinClass[]).map(value => <Pressable key={value}
            accessibilityRole="radio" accessibilityState={{ checked: cabinClass === value }}
            onPress={() => setCabinClass(value)} style={s.cabinRow}>
            <Text style={s.cabinText}>{t(cabinLabels[value])}</Text>
            <Text style={s.check}>{cabinClass === value ? '✓' : ''}</Text>
          </Pressable>)}
        </ScrollView>
        <View style={s.footer}><PrimaryButton title={t('Xong')} onPress={() => setOptionsOpen(false)} /></View>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

function AirportFieldButton({ label, icon, onPress, disabled, compact }: {
  label: string; icon: string; onPress: () => void; disabled?: boolean; compact?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={[s.field, compact && s.compactField, disabled && s.disabledField]}>
    <Text style={s.fieldIcon}>{icon}</Text><Text numberOfLines={1} style={s.fieldText}>{label}</Text>
  </Pressable>;
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const { t } = useLanguage();
  return <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel={t('Đóng')}
    onPress={onClose} style={s.headerAction}><Text style={s.close}>×</Text></Pressable>
    <Text accessibilityRole="header" style={s.headerTitle}>{title}</Text><View style={s.headerAction} /></View>;
}

function PrimaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.primaryButton, (disabled || pressed) && s.pressedButton]}>
    <Text style={s.primaryText}>{title}</Text></Pressable>;
}

function CountRow({ label, hint, value, minimum, maximum, onChange }: {
  label: string; hint: string; value: number; minimum: number; maximum: number; onChange: (value: number) => void;
}) {
  const { t } = useLanguage();
  return <View style={s.countRow}><View style={s.countCopy}><Text style={s.cabinText}>{label}</Text><Text style={s.hint}>{hint}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Giảm {label}', { label: label.toLowerCase() })}
      disabled={value <= minimum} onPress={() => onChange(value - 1)} style={s.countButton}><Text style={s.countSymbol}>−</Text></Pressable>
    <Text style={s.countValue}>{value}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Tăng {label}', { label: label.toLowerCase() })}
      disabled={value >= maximum} onPress={() => onChange(value + 1)} style={s.countButton}><Text style={s.countSymbol}>+</Text></Pressable>
  </View>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  headerAction: { width: 64, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  close: { color: colors.muted, fontSize: 28 },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.ink, fontSize: 19, fontWeight: '700' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: colors.ink },
  tabText: { color: colors.muted, fontSize: 14 },
  activeTabText: { color: colors.ink, fontWeight: '700' },
  form: { paddingTop: 20, paddingBottom: 30, gap: 22 },
  leg: { paddingHorizontal: 20, gap: 10 },
  legTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  twoColumns: { flexDirection: 'row', gap: 8 },
  field: { minHeight: 52, borderRadius: 8, backgroundColor: colors.field, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 13 },
  compactField: { flex: 1, minWidth: 0 },
  disabledField: { opacity: 0.65 },
  fieldIcon: { color: colors.ink, fontSize: 20, width: 22, textAlign: 'center' },
  fieldText: { flex: 1, color: colors.body, fontSize: 16 },
  swap: { position: 'absolute', right: 40, top: 37, width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  swapText: { color: colors.ink, fontSize: 21 },
  multiActions: { paddingHorizontal: 20, gap: 10 },
  outlineButton: { minHeight: 48, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  optionsRow: { minHeight: 58, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
    paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionsText: { color: colors.body, fontSize: 14 },
  footer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.border },
  primaryButton: { minHeight: 48, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  pressedButton: { opacity: 0.65 },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  modalSearch: { padding: 20 },
  searchInput: { minHeight: 52, backgroundColor: colors.field, borderRadius: 8, paddingHorizontal: 18, fontSize: 16, color: colors.ink },
  modalSection: { color: colors.ink, fontSize: 17, fontWeight: '700', paddingHorizontal: 20, paddingVertical: 18 },
  airportRow: { minHeight: 72, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14,
    borderTopWidth: 1, borderTopColor: colors.border },
  airportIcon: { width: 38, alignItems: 'center' },
  airportIconText: { color: colors.muted, fontSize: 20 },
  airportCopy: { flex: 1 }, airportCity: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  airportName: { color: colors.muted, fontSize: 13, marginTop: 4 }, airportCode: { color: colors.ink, fontWeight: '700' },
  empty: { color: colors.muted, padding: 20 },
  calendarScroll: { paddingHorizontal: 14, paddingBottom: 28 },
  monthNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 },
  monthArrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  monthArrowText: { color: colors.ink, fontSize: 30 },
  monthTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  monthBlock: { marginBottom: 22 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', textAlign: 'center', color: colors.muted, fontSize: 12, paddingVertical: 12 },
  daySlot: { width: '14.2857%', alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  dayButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  selectedDay: { backgroundColor: colors.primary }, dayText: { color: colors.body, fontSize: 15 },
  disabledDay: { color: colors.pale }, selectedDayText: { color: colors.white, fontWeight: '700' },
  optionsScroll: { paddingBottom: 30 },
  countRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderTopWidth: 1,
    borderTopColor: colors.border, gap: 12 },
  countCopy: { flex: 1 }, cabinText: { color: colors.body, fontSize: 15 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 4 },
  countButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.field,
    alignItems: 'center', justifyContent: 'center' },
  countSymbol: { color: colors.body, fontSize: 22 }, countValue: { color: colors.ink, fontSize: 16, minWidth: 18, textAlign: 'center' },
  cabinRow: { minHeight: 58, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  check: { color: colors.primary, fontSize: 21, fontWeight: '700' },
});
