import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../i18n/provider';
import { cabinClassLabel } from '../tickets/presentation';
import type { CheckoutDraftState } from './draft';
import type { ItineraryLeg } from './itinerary-data';
import { seatEligibility, seatRows, type MapSeat } from './seats';
import { useCheckoutColors } from './ui';
export function SeatGrid({ map, draft, leg, passengerId, busy, onError }: { map: MapSeat[]; draft: CheckoutDraftState; leg: ItineraryLeg; passengerId: string; busy: boolean; onError(message: string): void }) {
  const { t } = useLanguage(); const c = useCheckoutColors(); const p = draft.passengers.find(p => p.id === passengerId)!;
  const choice = draft.seats.find(s => s.flightId === leg.flightId && s.passengerId === passengerId);
  const rows = seatRows(map);
  return <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginHorizontal: -8 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
    <View style={[styles.aircraft, { borderColor: c.border }]}>
      <View style={[styles.nose, { borderColor: c.border, backgroundColor: c.tint }]}>
        <View style={styles.cockpit}><View style={styles.window} /><View style={styles.window} /><View style={styles.window} /></View>
        <Text style={{ color: c.muted, fontSize: 12 }}>{t('Front of aircraft')}</Text>
      </View>
      <View style={styles.row}>{['A', 'B', 'C', '', 'D', 'E', 'F'].map((letter, i) => <Text key={i} style={[styles.column, { width: i === 3 ? 28 : 44, color: c.muted }]}>{letter}</Text>)}</View>
      {rows.map((row, index) => {
        const cabin = row.seats.find(Boolean)?.cabin_class;
        const previousCabin = rows[index - 1]?.seats.find(Boolean)?.cabin_class;
        const isExitRow = row.seats.some(seat => seat?.is_exit_row);
        return <View key={row.row} style={styles.rowGroup}>
        {cabin && cabin !== previousCabin && <View style={[styles.cabinLabel, { backgroundColor: cabin === leg.cabinClass ? c.tint : '#EFF2F5' }]}>
          <Text style={{ color: cabin === leg.cabinClass ? '#006D7D' : c.muted, fontSize: 12, fontWeight: '600' }}>
            {t(cabinClassLabel(cabin))}{cabin === leg.cabinClass ? ` · ${t('Your cabin')}` : ''}
          </Text>
        </View>}
        {isExitRow && <View style={styles.exitRowLabel} accessible accessibilityLabel={t('seats.exitRow', { row: row.row })}>
          <Text style={styles.exitText}>EXIT</Text>
          <Text style={styles.exitText}>{t('seats.exitRow', { row: row.row })}</Text>
          <Text style={styles.exitText}>EXIT</Text>
        </View>}
        <View style={[styles.row, isExitRow && styles.exitRow]}>
        {row.seats.flatMap((seat, col) => {
          let cell = <View key={`empty-${col}`} style={styles.empty} />;
          if (seat) {
            const selected = choice?.seatId === seat.flight_seat_id;
            const another = draft.seats.some(s => s.flightId === leg.flightId && s.seatId === seat.flight_seat_id && s.passengerId !== passengerId);
            const reason = seatEligibility(seat, p, leg, draft.passengers, draft.seats);
            const disabled = !!reason || busy;
            const otherCabin = seat.cabin_class !== leg.cabinClass;
            const state = otherCabin ? 'otherCabin' : selected ? 'selected' : another ? 'selectedOther' : seat.availability;
            cell = <Pressable key={seat.flight_seat_id} accessibilityRole="button" accessibilityState={{ selected, disabled }} aria-pressed={selected} aria-disabled={disabled}
              accessibilityLabel={`${seat.seat_code}, ${t(`seats.${state}`)}, ${seat.selection_fee_amount} VND${seat.is_exit_row ? `, ${t('seats.exitRow', { row: seat.row_number })}` : ''}${reason ? `, ${t(reason)}` : ''}`}
              disabled={disabled} hitSlop={2} onPress={() => {
                try { draft.setSeat(passengerId, leg.flightId, selected ? null : seat); onError(''); }
                catch (e) { onError(e instanceof Error ? e.message : 'seats.unavailable'); }
              }} style={({ pressed }) => [styles.seat, { backgroundColor: selected ? c.primary : another ? c.tint : disabled ? '#E8EBEF' : c.surface,
                borderColor: selected || another ? '#007D8E' : disabled ? '#DADEE4' : '#008597', opacity: pressed ? 0.65 : 1 }]}>
              <View style={[styles.seatBack, { backgroundColor: selected ? '#007D8E' : disabled ? '#CBD1D8' : '#A7E6ED' }]} />
              <Text style={{ color: otherCabin ? c.muted : selected ? '#00414B' : c.text, fontSize: 12, fontWeight: '700' }}>{otherCabin ? seat.seat_code : selected ? '✓' : another ? String(draft.passengers.findIndex(person => draft.seats.some(s => s.passengerId === person.id && s.flightId === leg.flightId && s.seatId === seat.flight_seat_id)) + 1) : seat.availability === 'held' ? '◷' : seat.availability === 'booked' ? '■' : disabled ? '×' : seat.seat_code}</Text>
            </Pressable>;
          }
          return col === 3 ? [<Text key={`row-${row.row}`} style={[styles.rowNumber, { color: c.muted }]}>{row.row}</Text>, cell] : [cell];
        })}
        </View></View>;
      })}
      <Text style={[styles.tail, { color: c.muted }]}>{t('Seat choices are not held.')}</Text>
    </View>
  </ScrollView>;
}
export function SeatLegend() {
  const { t } = useLanguage(); const c = useCheckoutColors();
  return <View style={styles.legend}>{(['available', 'selected', 'held', 'booked', 'blocked', 'otherCabin'] as const).map(state => <View key={state} style={styles.legendItem}>
    <Text style={[styles.legendSymbol, { color: state === 'selected' ? '#00414B' : c.text, backgroundColor: state === 'selected' ? c.primary : state === 'available' ? c.surface : '#E8EBEF' }]}>{state === 'selected' ? '✓' : state === 'available' ? '□' : state === 'held' ? '◷' : state === 'booked' ? '■' : state === 'otherCabin' ? '—' : '×'}</Text>
    <Text style={[styles.legendText, { color: c.muted }]}>{t(`seats.${state}`)}</Text></View>)}
    <View style={styles.legendItem}><Text style={[styles.legendSymbol, styles.exitLegend]}>EXIT</Text><Text style={[styles.legendText, { color: c.muted }]}>{t('seats.exitRowLegend')}</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSymbol: { width: 22, height: 24, borderRadius: 5, borderWidth: 1, borderColor: '#AAB2BC', textAlign: 'center', fontSize: 17 }, legendText: { fontSize: 12 },
  aircraft: { minWidth: 332, padding: 10, paddingTop: 0, borderWidth: 1, borderRadius: 40, gap: 10, backgroundColor: '#F9FCFD', alignItems: 'center' },
  nose: { width: 180, height: 88, borderTopLeftRadius: 100, borderTopRightRadius: 100, borderWidth: 1, borderBottomWidth: 0, alignItems: 'center', justifyContent: 'flex-end', gap: 14, paddingBottom: 12 },
  cockpit: { flexDirection: 'row', gap: 4 }, window: { width: 28, height: 12, backgroundColor: '#526D79', borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 }, column: { textAlign: 'center', fontSize: 12, fontWeight: '600' },
  rowGroup: { alignItems: 'center', gap: 10 },
  exitRow: { backgroundColor: '#EFFAF3', borderRadius: 8, paddingVertical: 6 },
  exitRowLabel: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 6, backgroundColor: '#EFFAF3', borderWidth: 1, borderColor: '#B6DBC3' },
  exitText: { color: '#166534', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  exitLegend: { width: 40, backgroundColor: '#EFFAF3', borderColor: '#B6DBC3', color: '#166534', fontSize: 12, fontWeight: '700', lineHeight: 22 },
  cabinLabel: { alignSelf: 'stretch', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  rowNumber: { width: 28, textAlign: 'center', fontSize: 12 }, empty: { width: 44, height: 52 },
  seat: { width: 44, minHeight: 52, borderWidth: 1.5, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 7 },
  seatBack: { width: 28, height: 5, borderRadius: 3 }, tail: { padding: 12, fontSize: 12, textAlign: 'center' },
});
