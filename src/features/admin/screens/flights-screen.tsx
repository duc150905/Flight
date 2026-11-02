import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ActionButton, Notice } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import { useAdminI18n } from '../i18n';
import {
  filterAndPaginate,
  formatAdminError,
  type FlightFareRow,
  type FlightInstanceRow,
  type FlightSeatRow,
  type StatusFilter,
} from '../model';
import {
  adminSaveFlightFare,
  adminSaveFlightInstance,
  adminSetFlightSales,
  adminUpdateFlightSeat,
} from '../rpc';
import {
  AdminLoadingState,
  AdminPaginationBar,
  AdminSearchFilterBar,
  AdminShell,
  AdminStatusBadge,
  AdminTextField,
  adminStyles,
} from '../ui';

type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';
type FlightStatus = 'draft' | 'scheduled' | 'delayed' | 'departed' | 'arrived' | 'cancelled';

type BaggageAllowanceShape = {
  cabin_pieces?: number;
  cabin_kg?: number;
  checked_pieces?: number;
  checked_kg?: number;
};

function readBaggageAllowance(json: unknown): Required<BaggageAllowanceShape> {
  const obj = json && typeof json === 'object' ? (json as BaggageAllowanceShape) : {};
  return {
    cabin_pieces: typeof obj.cabin_pieces === 'number' ? obj.cabin_pieces : 1,
    cabin_kg: typeof obj.cabin_kg === 'number' ? obj.cabin_kg : 7,
    checked_pieces: typeof obj.checked_pieces === 'number' ? obj.checked_pieces : 0,
    checked_kg: typeof obj.checked_kg === 'number' ? obj.checked_kg : 0,
  };
}

function isFlightSalesOpen(flight: FlightInstanceRow, nowMs: number): boolean {
  return (
    flight.published_at != null &&
    (flight.status === 'scheduled' || flight.status === 'delayed') &&
    (!flight.sales_close_at || Date.parse(flight.sales_close_at) > nowMs)
  );
}

async function loadFlightsBundle() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const [apRes, alRes, acRes, flRes, frRes] = await Promise.all([
    supabase.from('airports').select('*').order('iata_code', { ascending: true }),
    supabase.from('airlines').select('*').order('iata_code', { ascending: true }),
    supabase.from('aircraft').select('*').order('registration_code', { ascending: true }),
    supabase.from('flight_instances').select('*').order('departure_at', { ascending: true }),
    supabase.from('flight_fares').select('*').order('adult_base_amount', { ascending: true }),
  ]);

  if (apRes.error) throw apRes.error;
  if (alRes.error) throw alRes.error;
  if (acRes.error) throw acRes.error;
  if (flRes.error) throw flRes.error;
  if (frRes.error) throw frRes.error;

  const groupedFares: Record<string, FlightFareRow[]> = {};
  for (const fare of frRes.data ?? []) {
    const list = groupedFares[fare.flight_id] ?? [];
    list.push(fare);
    groupedFares[fare.flight_id] = list;
  }

  return {
    airports: apRes.data ?? [],
    airlines: alRes.data ?? [],
    aircraftList: acRes.data ?? [],
    flights: flRes.data ?? [],
    faresByFlight: groupedFares,
    fetchedAtMs: Date.now(),
  };
}

export function AdminFlightsScreen() {
  const { language, ta, bi, money, airportTime } = useAdminI18n();
  const queryClient = useQueryClient();

  const flightsQuery = useQuery({
    queryKey: ['admin-flights-bundle'],
    queryFn: loadFlightsBundle,
  });

  const airports = flightsQuery.data?.airports ?? [];
  const airlines = flightsQuery.data?.airlines ?? [];
  const aircraftList = flightsQuery.data?.aircraftList ?? [];
  const flights = flightsQuery.data?.flights ?? [];
  const faresByFlight = flightsQuery.data?.faresByFlight ?? {};
  const referenceNowMs = flightsQuery.data?.fetchedAtMs ?? 0;

  const [seatsByFlight, setSeatsByFlight] = useState<Record<string, FlightSeatRow[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  // Flight form state
  const [showFlightForm, setShowFlightForm] = useState(false);
  const [flightForm, setFlightForm] = useState({
    flightId: null as string | null,
    airlineId: '',
    aircraftId: '',
    flightNumber: '',
    departureAirportId: '',
    arrivalAirportId: '',
    departureAt: '2026-06-15T08:00:00+07:00',
    arrivalAt: '2026-06-15T10:10:00+07:00',
    salesCloseAt: '2026-06-15T06:30:00+07:00',
    status: 'scheduled' as FlightStatus,
    publish: true,
  });

  // Expanded panels per flight
  const [expandedFareFlightId, setExpandedFareFlightId] = useState<string | null>(null);
  const [expandedSeatFlightId, setExpandedSeatFlightId] = useState<string | null>(null);
  const [seatFeeDrafts, setSeatFeeDrafts] = useState<Record<string, string>>({});

  // Fare form state
  const [showFareForm, setShowFareForm] = useState(false);
  const [fareForm, setFareForm] = useState({
    fareId: null as string | null,
    flightId: '',
    fareCode: 'ECO_SAVER',
    cabinClass: 'economy' as CabinClass,
    name: 'Phổ thông Tiết kiệm',
    adultBaseAmount: '1290000',
    childBaseAmount: '980000',
    infantBaseAmount: '150000',
    adultTaxAmount: '180000',
    childTaxAmount: '120000',
    infantTaxAmount: '0',
    adultFeeAmount: '100000',
    childFeeAmount: '80000',
    infantFeeAmount: '0',
    cabinPieces: '1',
    cabinKg: '7',
    checkedPieces: '1',
    checkedKg: '23',
    cancellationAllowed: true,
    cancellationCutoffMinutes: '180',
    cancellationFeeAmount: '300000',
    isActive: true,
  });

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-flights-bundle'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-f09-summary'] });
  };

  const loadFlightSeats = async (flightId: string) => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: seatErr } = await supabase
        .from('flight_seats')
        .select('*')
        .eq('flight_id', flightId)
        .order('seat_id', { ascending: true });
      if (seatErr) throw seatErr;
      setSeatsByFlight((prev) => ({ ...prev, [flightId]: data ?? [] }));
      const nextDrafts: Record<string, string> = {};
      for (const seat of data ?? []) {
        nextDrafts[seat.id] = String(seat.selection_fee_amount);
      }
      setSeatFeeDrafts((prev) => ({ ...prev, ...nextDrafts }));
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const openCreateFlight = () => {
    const firstAirline = airlines[0]?.id ?? '';
    const matchingAircraft =
      aircraftList.find((ac) => ac.airline_id === firstAirline)?.id ?? aircraftList[0]?.id ?? '';
    const depAirport = airports[0]?.id ?? '';
    const arrAirport = airports[1]?.id ?? airports[0]?.id ?? '';

    setFlightForm({
      flightId: null,
      airlineId: firstAirline,
      aircraftId: matchingAircraft,
      flightNumber: '',
      departureAirportId: depAirport,
      arrivalAirportId: arrAirport,
      departureAt: '2026-06-15T08:00:00+07:00',
      arrivalAt: '2026-06-15T10:10:00+07:00',
      salesCloseAt: '2026-06-15T06:30:00+07:00',
      status: 'scheduled',
      publish: true,
    });
    setShowFlightForm(true);
    setError(null);
    setInfo(null);
  };

  const openEditFlight = (item: FlightInstanceRow) => {
    setFlightForm({
      flightId: item.id,
      airlineId: item.airline_id,
      aircraftId: item.aircraft_id,
      flightNumber: item.flight_number,
      departureAirportId: item.departure_airport_id,
      arrivalAirportId: item.arrival_airport_id,
      departureAt: item.departure_at,
      arrivalAt: item.arrival_at,
      salesCloseAt: item.sales_close_at ?? '',
      status: item.status,
      publish: item.published_at != null,
    });
    setShowFlightForm(true);
    setError(null);
    setInfo(null);
  };

  const handleSaveFlight = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await adminSaveFlightInstance(supabase, {
        flightId: flightForm.flightId,
        airlineId: flightForm.airlineId,
        aircraftId: flightForm.aircraftId,
        flightNumber: flightForm.flightNumber,
        departureAirportId: flightForm.departureAirportId,
        arrivalAirportId: flightForm.arrivalAirportId,
        departureAt: flightForm.departureAt,
        arrivalAt: flightForm.arrivalAt,
        salesCloseAt: flightForm.salesCloseAt.trim() ? flightForm.salesCloseAt.trim() : null,
        status: flightForm.status,
        publish: flightForm.publish,
      });
      setShowFlightForm(false);
      setInfo(ta('admin.saved'));
      await refreshAll();
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleSales = async (flight: FlightInstanceRow) => {
    const isCurrentlyOpen = isFlightSalesOpen(flight, Date.now());

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await adminSetFlightSales(supabase, {
        flightId: flight.id,
        openSales: !isCurrentlyOpen,
        salesCloseAt: !isCurrentlyOpen ? null : new Date().toISOString(),
      });
      setInfo(
        !isCurrentlyOpen
          ? bi(
              `Đã mở bán lại chuyến bay ${flight.flight_number}.`,
              `Reopened sales for flight ${flight.flight_number}.`,
            )
          : bi(
              `Đã ngừng mở bán chuyến bay ${flight.flight_number}.`,
              `Stopped sales for flight ${flight.flight_number}.`,
            ),
      );
      await refreshAll();
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const openCreateFare = (flightId: string) => {
    setFareForm({
      fareId: null,
      flightId,
      fareCode: 'ECO_SAVER',
      cabinClass: 'economy',
      name: 'Phổ thông Tiết kiệm',
      adultBaseAmount: '1290000',
      childBaseAmount: '980000',
      infantBaseAmount: '150000',
      adultTaxAmount: '180000',
      childTaxAmount: '120000',
      infantTaxAmount: '0',
      adultFeeAmount: '100000',
      childFeeAmount: '80000',
      infantFeeAmount: '0',
      cabinPieces: '1',
      cabinKg: '7',
      checkedPieces: '1',
      checkedKg: '23',
      cancellationAllowed: true,
      cancellationCutoffMinutes: '180',
      cancellationFeeAmount: '300000',
      isActive: true,
    });
    setExpandedFareFlightId(flightId);
    setShowFareForm(true);
    setError(null);
    setInfo(null);
  };

  const openEditFare = (fare: FlightFareRow) => {
    const bag = readBaggageAllowance(fare.baggage_allowance);
    setFareForm({
      fareId: fare.id,
      flightId: fare.flight_id,
      fareCode: fare.fare_code,
      cabinClass: fare.cabin_class,
      name: fare.name,
      adultBaseAmount: String(fare.adult_base_amount),
      childBaseAmount: String(fare.child_base_amount),
      infantBaseAmount: String(fare.infant_base_amount),
      adultTaxAmount: String(fare.adult_tax_amount),
      childTaxAmount: String(fare.child_tax_amount),
      infantTaxAmount: String(fare.infant_tax_amount),
      adultFeeAmount: String(fare.adult_fee_amount),
      childFeeAmount: String(fare.child_fee_amount),
      infantFeeAmount: String(fare.infant_fee_amount),
      cabinPieces: String(bag.cabin_pieces),
      cabinKg: String(bag.cabin_kg),
      checkedPieces: String(bag.checked_pieces),
      checkedKg: String(bag.checked_kg),
      cancellationAllowed: fare.cancellation_allowed,
      cancellationCutoffMinutes: String(fare.cancellation_cutoff_minutes),
      cancellationFeeAmount: String(fare.cancellation_fee_amount),
      isActive: fare.is_active,
    });
    setExpandedFareFlightId(fare.flight_id);
    setShowFareForm(true);
    setError(null);
    setInfo(null);
  };

  const handleSaveFare = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await adminSaveFlightFare(supabase, {
        fareId: fareForm.fareId,
        flightId: fareForm.flightId,
        fareCode: fareForm.fareCode,
        cabinClass: fareForm.cabinClass,
        name: fareForm.name,
        adultBaseAmount: Number(fareForm.adultBaseAmount || 0),
        childBaseAmount: Number(fareForm.childBaseAmount || 0),
        infantBaseAmount: Number(fareForm.infantBaseAmount || 0),
        adultTaxAmount: Number(fareForm.adultTaxAmount || 0),
        childTaxAmount: Number(fareForm.childTaxAmount || 0),
        infantTaxAmount: Number(fareForm.infantTaxAmount || 0),
        adultFeeAmount: Number(fareForm.adultFeeAmount || 0),
        childFeeAmount: Number(fareForm.childFeeAmount || 0),
        infantFeeAmount: Number(fareForm.infantFeeAmount || 0),
        baggageAllowance: {
          cabin_pieces: Number(fareForm.cabinPieces || 0),
          cabin_kg: Number(fareForm.cabinKg || 0),
          checked_pieces: Number(fareForm.checkedPieces || 0),
          checked_kg: Number(fareForm.checkedKg || 0),
        },
        cancellationAllowed: fareForm.cancellationAllowed,
        cancellationCutoffMinutes: Number(fareForm.cancellationCutoffMinutes || 0),
        cancellationFeeAmount: Number(fareForm.cancellationFeeAmount || 0),
        isActive: fareForm.isActive,
      });
      setShowFareForm(false);
      setInfo(ta('admin.saved'));
      await refreshAll();
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleFareActive = async (fare: FlightFareRow) => {
    const bag = readBaggageAllowance(fare.baggage_allowance);
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await adminSaveFlightFare(supabase, {
        fareId: fare.id,
        flightId: fare.flight_id,
        fareCode: fare.fare_code,
        cabinClass: fare.cabin_class,
        name: fare.name,
        adultBaseAmount: fare.adult_base_amount,
        childBaseAmount: fare.child_base_amount,
        infantBaseAmount: fare.infant_base_amount,
        adultTaxAmount: fare.adult_tax_amount,
        childTaxAmount: fare.child_tax_amount,
        infantTaxAmount: fare.infant_tax_amount,
        adultFeeAmount: fare.adult_fee_amount,
        childFeeAmount: fare.child_fee_amount,
        infantFeeAmount: fare.infant_fee_amount,
        baggageAllowance: bag,
        cancellationAllowed: fare.cancellation_allowed,
        cancellationCutoffMinutes: fare.cancellation_cutoff_minutes,
        cancellationFeeAmount: fare.cancellation_fee_amount,
        isActive: !fare.is_active,
      });
      setInfo(ta('admin.saved'));
      await refreshAll();
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateFlightSeat = async (
    flightId: string,
    seat: FlightSeatRow,
    nextBlocked?: boolean,
  ) => {
    const feeVal = Number(seatFeeDrafts[seat.id] ?? seat.selection_fee_amount);
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await adminUpdateFlightSeat(supabase, {
        flightSeatId: seat.id,
        isBlocked: nextBlocked !== undefined ? nextBlocked : seat.is_blocked,
        selectionFeeAmount: Number.isNaN(feeVal) ? seat.selection_fee_amount : feeVal,
      });
      setInfo(ta('admin.saved'));
      await loadFlightSeats(flightId);
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const pagedFlights = filterAndPaginate(flights, {
    query,
    statusFilter,
    page,
    pageSize: 6,
    getSearchText: (item) => {
      const origin = airports.find((a) => a.id === item.departure_airport_id);
      const dest = airports.find((a) => a.id === item.arrival_airport_id);
      const airline = airlines.find((a) => a.id === item.airline_id);
      const ac = aircraftList.find((a) => a.id === item.aircraft_id);
      return `${item.flight_number} ${origin?.iata_code ?? ''} ${origin?.city ?? ''} ${dest?.iata_code ?? ''} ${dest?.city ?? ''} ${airline?.name ?? ''} ${ac?.registration_code ?? ''} ${item.status}`;
    },
    getIsActive: (item) => isFlightSalesOpen(item, referenceNowMs),
  });

  const selectableAircraft = aircraftList.filter(
    (ac) => !flightForm.airlineId || ac.airline_id === flightForm.airlineId,
  );

  const displayError =
    error || (flightsQuery.isError ? formatAdminError(flightsQuery.error, language) : null);

  return (
    <AdminShell
      activeSection="flights"
      title={bi('Quản lý Lịch bay, Bảng giá & Kho ghế', 'Flight Schedules, Fares & Seat Inventory')}
      subtitle={bi(
        'Tạo lịch bay theo múi giờ sân bay IANA, đóng/mở bán chuyến bay an toàn, quản lý hạng vé (flight_fares) và khóa/mở ghế (flight_seats).',
        'Schedule flights with IANA airport timezones, stop/reopen sales safely, manage flight_fares, and block/unblock flight_seats.',
      )}
    >
      {!!displayError && (
        <View style={adminStyles.card}>
          <Notice text={displayError} />
          <Pressable
            accessibilityRole="button"
            onPress={() => void flightsQuery.refetch()}
            style={adminStyles.secondaryBtnSmall}
          >
            <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.retry')}</Text>
          </Pressable>
        </View>
      )}
      {!!info && <Notice text={info} success />}

      <AdminSearchFilterBar
        query={query}
        onQueryChange={(val) => {
          setQuery(val);
          setPage(1);
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(val) => {
          setStatusFilter(val);
          setPage(1);
        }}
        placeholder={bi(
          'Tìm theo số hiệu chuyến (VN210), sân bay (SGN, HAN) hoặc hãng bay…',
          'Search by flight number (VN210), airport (SGN, HAN), or airline…',
        )}
        onRefresh={() => void flightsQuery.refetch()}
        onCreate={openCreateFlight}
      />

      {showFlightForm && (
        <View style={adminStyles.card}>
          <Text style={adminStyles.sectionTitle}>
            {flightForm.flightId
              ? bi('Cập nhật chuyến bay', 'Edit Flight Instance')
              : bi('Thêm chuyến bay mới', 'Create Flight Instance')}
          </Text>

          <View style={adminStyles.fieldGroup}>
            <Text style={adminStyles.label}>{bi('Hãng hàng không', 'Airline')}</Text>
            <View style={adminStyles.chipRow}>
              {airlines.map((al) => {
                const selected = flightForm.airlineId === al.id;
                return (
                  <Pressable
                    key={al.id}
                    accessibilityRole="button"
                    onPress={() => {
                      const firstAc =
                        aircraftList.find((ac) => ac.airline_id === al.id)?.id ??
                        flightForm.aircraftId;
                      setFlightForm((s) => ({
                        ...s,
                        airlineId: al.id,
                        aircraftId: firstAc,
                      }));
                    }}
                    style={[adminStyles.chip, selected && adminStyles.chipSelected]}
                  >
                    <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                      {al.iata_code} · {al.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={adminStyles.fieldGroup}>
            <Text style={adminStyles.label}>{bi('Tàu bay khai thác', 'Operating Aircraft')}</Text>
            <View style={adminStyles.chipRow}>
              {selectableAircraft.map((ac) => {
                const selected = flightForm.aircraftId === ac.id;
                return (
                  <Pressable
                    key={ac.id}
                    accessibilityRole="button"
                    onPress={() => setFlightForm((s) => ({ ...s, aircraftId: ac.id }))}
                    style={[adminStyles.chip, selected && adminStyles.chipSelected]}
                  >
                    <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                      {ac.registration_code} ({ac.model_name})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <AdminTextField
            label={bi('Số hiệu chuyến bay (ví dụ: VN210)', 'Flight Number (e.g., VN210)')}
            value={flightForm.flightNumber}
            onChangeText={(text) => setFlightForm((s) => ({ ...s, flightNumber: text }))}
            placeholder="VN210"
            autoCapitalize="characters"
          />

          <View style={adminStyles.fieldGroup}>
            <Text style={adminStyles.label}>{bi('Sân bay khởi hành', 'Departure Airport')}</Text>
            <View style={adminStyles.chipRow}>
              {airports.map((ap) => {
                const selected = flightForm.departureAirportId === ap.id;
                return (
                  <Pressable
                    key={ap.id}
                    accessibilityRole="button"
                    onPress={() => setFlightForm((s) => ({ ...s, departureAirportId: ap.id }))}
                    style={[adminStyles.chip, selected && adminStyles.chipSelected]}
                  >
                    <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                      {ap.iata_code} ({ap.city})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={adminStyles.fieldGroup}>
            <Text style={adminStyles.label}>{bi('Sân bay đến', 'Arrival Airport')}</Text>
            <View style={adminStyles.chipRow}>
              {airports.map((ap) => {
                const selected = flightForm.arrivalAirportId === ap.id;
                return (
                  <Pressable
                    key={ap.id}
                    accessibilityRole="button"
                    onPress={() => setFlightForm((s) => ({ ...s, arrivalAirportId: ap.id }))}
                    style={[adminStyles.chip, selected && adminStyles.chipSelected]}
                  >
                    <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                      {ap.iata_code} ({ap.city})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <AdminTextField
            label={bi('Giờ khởi hành (ISO 8601)', 'Departure Timestamp (ISO 8601)')}
            value={flightForm.departureAt}
            onChangeText={(text) => setFlightForm((s) => ({ ...s, departureAt: text }))}
            placeholder="2026-06-15T08:00:00+07:00"
            helperText={bi(
              'Gợi ý: Nhập định dạng YYYY-MM-DDTHH:mm:ss+07:00',
              'Format: YYYY-MM-DDTHH:mm:ss+07:00',
            )}
          />

          <AdminTextField
            label={bi('Giờ hạ cánh (ISO 8601)', 'Arrival Timestamp (ISO 8601)')}
            value={flightForm.arrivalAt}
            onChangeText={(text) => setFlightForm((s) => ({ ...s, arrivalAt: text }))}
            placeholder="2026-06-15T10:10:00+07:00"
          />

          <AdminTextField
            label={bi('Thời điểm đóng bán vé (tùy chọn)', 'Sales Close Timestamp (optional)')}
            value={flightForm.salesCloseAt}
            onChangeText={(text) => setFlightForm((s) => ({ ...s, salesCloseAt: text }))}
            placeholder="2026-06-15T06:30:00+07:00"
          />

          <View style={adminStyles.fieldGroup}>
            <Text style={adminStyles.label}>{bi('Trạng thái vận hành', 'Flight Status')}</Text>
            <View style={adminStyles.chipRow}>
              {(['draft', 'scheduled', 'delayed', 'cancelled'] as FlightStatus[]).map((st) => {
                const selected = flightForm.status === st;
                return (
                  <Pressable
                    key={st}
                    accessibilityRole="button"
                    onPress={() => setFlightForm((s) => ({ ...s, status: st }))}
                    style={[adminStyles.chip, selected && adminStyles.chipSelected]}
                  >
                    <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                      {st.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={adminStyles.chipRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setFlightForm((s) => ({ ...s, publish: !s.publish }))}
              style={[adminStyles.chip, flightForm.publish && adminStyles.chipSelected]}
            >
              <Text
                style={[adminStyles.chipText, flightForm.publish && adminStyles.chipTextSelected]}
              >
                {flightForm.publish
                  ? bi(
                      '✓ Công bố mở bán & khởi tạo kho ghế (flight_seats)',
                      '✓ Publish & initialize seat inventory (flight_seats)',
                    )
                  : bi('Bản nháp (Chưa mở bán)', 'Draft (Unpublished)')}
              </Text>
            </Pressable>
          </View>

          <View style={adminStyles.rowGap}>
            <ActionButton
              title={ta('admin.action.save')}
              disabled={busy}
              onPress={() => void handleSaveFlight()}
            />
            <ActionButton
              title={ta('admin.action.cancel')}
              secondary
              disabled={busy}
              onPress={() => setShowFlightForm(false)}
            />
          </View>
        </View>
      )}

      {showFareForm && (
        <View style={adminStyles.card}>
          <Text style={adminStyles.sectionTitle}>
            {fareForm.fareId
              ? bi('Cập nhật hạng vé & giá (flight_fares)', 'Edit Flight Fare')
              : bi('Thêm hạng vé mới (flight_fares)', 'Add Flight Fare')}
          </Text>

          <AdminTextField
            label={bi('Mã hạng vé (fare_code)', 'Fare Code')}
            value={fareForm.fareCode}
            onChangeText={(text) => setFareForm((s) => ({ ...s, fareCode: text }))}
            placeholder="ECO_SAVER"
            autoCapitalize="characters"
          />

          <View style={adminStyles.fieldGroup}>
            <Text style={adminStyles.label}>{bi('Hạng khoang (cabin_class)', 'Cabin Class')}</Text>
            <View style={adminStyles.chipRow}>
              {(['economy', 'premium_economy', 'business', 'first'] as CabinClass[]).map((cb) => {
                const selected = fareForm.cabinClass === cb;
                return (
                  <Pressable
                    key={cb}
                    accessibilityRole="button"
                    onPress={() => setFareForm((s) => ({ ...s, cabinClass: cb }))}
                    style={[adminStyles.chip, selected && adminStyles.chipSelected]}
                  >
                    <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                      {cb}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <AdminTextField
            label={bi('Tên hiển thị hạng vé', 'Fare Display Name')}
            value={fareForm.name}
            onChangeText={(text) => setFareForm((s) => ({ ...s, name: text }))}
            placeholder="Phổ thông Tiết kiệm"
            autoCapitalize="words"
          />

          <View style={adminStyles.rowGap}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <AdminTextField
                label={bi('Giá cơ bản Người lớn (VND)', 'Adult Base (VND)')}
                value={fareForm.adultBaseAmount}
                onChangeText={(t) => setFareForm((s) => ({ ...s, adultBaseAmount: t }))}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1, minWidth: 160 }}>
              <AdminTextField
                label={bi('Giá cơ bản Trẻ em (VND)', 'Child Base (VND)')}
                value={fareForm.childBaseAmount}
                onChangeText={(t) => setFareForm((s) => ({ ...s, childBaseAmount: t }))}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1, minWidth: 160 }}>
              <AdminTextField
                label={bi('Giá cơ bản Em bé (VND)', 'Infant Base (VND)')}
                value={fareForm.infantBaseAmount}
                onChangeText={(t) => setFareForm((s) => ({ ...s, infantBaseAmount: t }))}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={adminStyles.rowGap}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <AdminTextField
                label={bi('Thuế Người lớn (VND)', 'Adult Tax (VND)')}
                value={fareForm.adultTaxAmount}
                onChangeText={(t) => setFareForm((s) => ({ ...s, adultTaxAmount: t }))}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1, minWidth: 160 }}>
              <AdminTextField
                label={bi('Phí Người lớn (VND)', 'Adult Fee (VND)')}
                value={fareForm.adultFeeAmount}
                onChangeText={(t) => setFareForm((s) => ({ ...s, adultFeeAmount: t }))}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1, minWidth: 160 }}>
              <AdminTextField
                label={bi('Hành lý xách tay (kg)', 'Cabin Baggage (kg)')}
                value={fareForm.cabinKg}
                onChangeText={(t) => setFareForm((s) => ({ ...s, cabinKg: t }))}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1, minWidth: 160 }}>
              <AdminTextField
                label={bi('Hành lý ký gửi (kg)', 'Checked Baggage (kg)')}
                value={fareForm.checkedKg}
                onChangeText={(t) => setFareForm((s) => ({ ...s, checkedKg: t }))}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={adminStyles.rowGap}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <AdminTextField
                label={bi('Phí hoàn/hủy vé (VND)', 'Cancellation Fee (VND)')}
                value={fareForm.cancellationFeeAmount}
                onChangeText={(t) => setFareForm((s) => ({ ...s, cancellationFeeAmount: t }))}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1, minWidth: 160 }}>
              <AdminTextField
                label={bi('Hạn hủy trước giờ bay (phút)', 'Cutoff Before Departure (min)')}
                value={fareForm.cancellationCutoffMinutes}
                onChangeText={(t) => setFareForm((s) => ({ ...s, cancellationCutoffMinutes: t }))}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={adminStyles.chipRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setFareForm((s) => ({ ...s, cancellationAllowed: !s.cancellationAllowed }))
              }
              style={[adminStyles.chip, fareForm.cancellationAllowed && adminStyles.chipSelected]}
            >
              <Text
                style={[
                  adminStyles.chipText,
                  fareForm.cancellationAllowed && adminStyles.chipTextSelected,
                ]}
              >
                {fareForm.cancellationAllowed
                  ? bi('✓ Cho phép hoàn/hủy vé', '✓ Cancellation allowed')
                  : bi('Không hoàn hủy', 'Non-refundable')}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setFareForm((s) => ({ ...s, isActive: !s.isActive }))}
              style={[adminStyles.chip, fareForm.isActive && adminStyles.chipSelected]}
            >
              <Text
                style={[adminStyles.chipText, fareForm.isActive && adminStyles.chipTextSelected]}
              >
                {fareForm.isActive ? ta('admin.status.active') : ta('admin.status.inactive')}
              </Text>
            </Pressable>
          </View>

          <View style={adminStyles.rowGap}>
            <ActionButton
              title={ta('admin.action.save')}
              disabled={busy}
              onPress={() => void handleSaveFare()}
            />
            <ActionButton
              title={ta('admin.action.cancel')}
              secondary
              disabled={busy}
              onPress={() => setShowFareForm(false)}
            />
          </View>
        </View>
      )}

      {flightsQuery.isPending ? (
        <AdminLoadingState />
      ) : pagedFlights.items.length === 0 ? (
        <View style={adminStyles.card}>
          <Text style={adminStyles.muted}>{ta('admin.empty')}</Text>
        </View>
      ) : (
        <>
          {pagedFlights.items.map((flight) => {
            const origin = airports.find((a) => a.id === flight.departure_airport_id);
            const dest = airports.find((a) => a.id === flight.arrival_airport_id);
            const airline = airlines.find((a) => a.id === flight.airline_id);
            const ac = aircraftList.find((a) => a.id === flight.aircraft_id);
            const flightFares = faresByFlight[flight.id] ?? [];
            const flightSeats = seatsByFlight[flight.id] ?? [];
            const isSalesOpen = isFlightSalesOpen(flight, referenceNowMs);

            return (
              <View key={flight.id} style={adminStyles.itemCard}>
                <View style={adminStyles.rowBetween}>
                  <Text style={adminStyles.bold}>
                    {flight.flight_number} · {origin?.iata_code ?? '???'} →{' '}
                    {dest?.iata_code ?? '???'}
                  </Text>
                  <View style={adminStyles.rowGap}>
                    <AdminStatusBadge
                      active={isSalesOpen}
                      customLabel={
                        isSalesOpen
                          ? bi(`Đang mở bán (${flight.status})`, `Open (${flight.status})`)
                          : bi(`Ngừng mở bán (${flight.status})`, `Closed (${flight.status})`)
                      }
                    />
                  </View>
                </View>

                <Text style={adminStyles.muted}>
                  {airline?.name ?? flight.airline_id} ·{' '}
                  {ac ? `${ac.registration_code} (${ac.model_name})` : flight.aircraft_id}
                </Text>

                <Text style={adminStyles.muted}>
                  {bi('Khởi hành:', 'Departure:')}{' '}
                  {airportTime(flight.departure_at, origin?.timezone ?? 'Asia/Ho_Chi_Minh')}
                </Text>
                <Text style={adminStyles.muted}>
                  {bi('Hạ cánh:', 'Arrival:')}{' '}
                  {airportTime(flight.arrival_at, dest?.timezone ?? 'Asia/Ho_Chi_Minh')}
                </Text>

                <View style={adminStyles.rowGap}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => openEditFlight(flight)}
                    style={adminStyles.secondaryBtnSmall}
                  >
                    <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.edit')}</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void handleToggleSales(flight)}
                    style={isSalesOpen ? adminStyles.dangerBtnSmall : adminStyles.primaryBtnSmall}
                  >
                    <Text
                      style={
                        isSalesOpen ? adminStyles.dangerBtnText : adminStyles.primaryBtnText
                      }
                    >
                      {isSalesOpen
                        ? bi('Ngừng mở bán', 'Stop Sales')
                        : bi('Mở bán lại', 'Reopen Sales')}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      setExpandedFareFlightId((cur) => (cur === flight.id ? null : flight.id))
                    }
                    style={adminStyles.secondaryBtnSmall}
                  >
                    <Text style={adminStyles.secondaryBtnText}>
                      {bi(
                        `Bảng giá (${flightFares.length})`,
                        `Fares (${flightFares.length})`,
                      )}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      const nextId = expandedSeatFlightId === flight.id ? null : flight.id;
                      setExpandedSeatFlightId(nextId);
                      if (nextId) {
                        void loadFlightSeats(nextId);
                      }
                    }}
                    style={adminStyles.secondaryBtnSmall}
                  >
                    <Text style={adminStyles.secondaryBtnText}>
                      {bi('Kho ghế chuyến bay', 'Flight Seats')}
                    </Text>
                  </Pressable>
                </View>

                {expandedFareFlightId === flight.id && (
                  <View style={[adminStyles.card, { marginTop: 8 }]}>
                    <View style={adminStyles.rowBetween}>
                      <Text style={adminStyles.bold}>
                        {bi(
                          `Danh sách hạng vé chuyến ${flight.flight_number}`,
                          `Fares for ${flight.flight_number}`,
                        )}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openCreateFare(flight.id)}
                        style={adminStyles.primaryBtnSmall}
                      >
                        <Text style={adminStyles.primaryBtnText}>
                          {bi('+ Thêm hạng vé', '+ Add Fare')}
                        </Text>
                      </Pressable>
                    </View>

                    {flightFares.length === 0 ? (
                      <Text style={adminStyles.muted}>
                        {bi(
                          'Chưa có hạng vé nào trên chuyến bay này.',
                          'No fares configured for this flight yet.',
                        )}
                      </Text>
                    ) : (
                      flightFares.map((fare) => {
                        const bag = readBaggageAllowance(fare.baggage_allowance);
                        const totalAdult =
                          fare.adult_base_amount + fare.adult_tax_amount + fare.adult_fee_amount;
                        return (
                          <View key={fare.id} style={adminStyles.itemCard}>
                            <View style={adminStyles.rowBetween}>
                              <Text style={adminStyles.bold}>
                                {fare.fare_code} · {fare.name} ({fare.cabin_class})
                              </Text>
                              <AdminStatusBadge active={fare.is_active} />
                            </View>
                            <Text style={adminStyles.muted}>
                              {bi('Người lớn:', 'Adult:')} {money(totalAdult, fare.currency)} (
                              {bi('Giá gốc:', 'Base:')} {money(fare.adult_base_amount)} +{' '}
                              {bi('Thuế/Phí:', 'Tax/Fee:')}{' '}
                              {money(fare.adult_tax_amount + fare.adult_fee_amount)})
                            </Text>
                            <Text style={adminStyles.muted}>
                              {bi('Hành lý:', 'Baggage:')} {bag.cabin_kg}kg{' '}
                              {bi('xách tay', 'cabin')} / {bag.checked_kg}kg{' '}
                              {bi('ký gửi', 'checked')} ·{' '}
                              {fare.cancellation_allowed
                                ? bi(
                                    `Hoàn/hủy trước ${fare.cancellation_cutoff_minutes} phút (phí ${money(fare.cancellation_fee_amount)})`,
                                    `Cancel ≥${fare.cancellation_cutoff_minutes}m before (fee ${money(fare.cancellation_fee_amount)})`,
                                  )
                                : bi('Không hoàn hủy', 'Non-refundable')}
                            </Text>
                            <View style={adminStyles.rowGap}>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => openEditFare(fare)}
                                style={adminStyles.secondaryBtnSmall}
                              >
                                <Text style={adminStyles.secondaryBtnText}>
                                  {ta('admin.action.edit')}
                                </Text>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => void handleToggleFareActive(fare)}
                                style={
                                  fare.is_active
                                    ? adminStyles.dangerBtnSmall
                                    : adminStyles.primaryBtnSmall
                                }
                              >
                                <Text
                                  style={
                                    fare.is_active
                                      ? adminStyles.dangerBtnText
                                      : adminStyles.primaryBtnText
                                  }
                                >
                                  {fare.is_active
                                    ? ta('admin.action.deactivate')
                                    : ta('admin.action.activate')}
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {expandedSeatFlightId === flight.id && (
                  <View style={[adminStyles.card, { marginTop: 8 }]}>
                    <Text style={adminStyles.bold}>
                      {bi(
                        `Kho ghế chuyến bay ${flight.flight_number} (${flightSeats.length} ghế)`,
                        `Seat Inventory for ${flight.flight_number} (${flightSeats.length} seats)`,
                      )}
                    </Text>
                    <Text style={adminStyles.muted}>
                      {bi(
                        'Khóa/mở khóa ghế trống và điều chỉnh phí chọn ghế (VND). Không thể khóa ghế đang giữ hoặc đã đặt.',
                        'Block/unblock available seats and adjust seat selection fee (VND). Held or booked seats cannot be blocked.',
                      )}
                    </Text>

                    {flightSeats.length === 0 ? (
                      <Text style={adminStyles.muted}>
                        {bi(
                          'Chưa có kho ghế (hãy bật Công bố mở bán chuyến bay để tự động tạo kho ghế từ tàu bay).',
                          'No seat inventory initialized yet (publish the flight to initialize from aircraft template).',
                        )}
                      </Text>
                    ) : (
                      flightSeats.slice(0, 24).map((seat) => (
                        <View key={seat.id} style={adminStyles.rowBetween}>
                          <Text style={adminStyles.label}>
                            #{seat.seat_id.slice(0, 8)} ·{' '}
                            {seat.is_blocked
                              ? bi('Đang khóa (Blocked)', 'Blocked')
                              : bi('Mở chọn (Available)', 'Available')}
                          </Text>
                          <View style={adminStyles.rowGap}>
                            <TextInput
                              value={seatFeeDrafts[seat.id] ?? String(seat.selection_fee_amount)}
                              onChangeText={(t) =>
                                setSeatFeeDrafts((prev) => ({ ...prev, [seat.id]: t }))
                              }
                              keyboardType="numeric"
                              style={[adminStyles.input, { width: 110, minHeight: 36 }]}
                            />
                            <Pressable
                              accessibilityRole="button"
                              disabled={busy}
                              onPress={() => void handleUpdateFlightSeat(flight.id, seat)}
                              style={adminStyles.secondaryBtnSmall}
                            >
                              <Text style={adminStyles.secondaryBtnText}>
                                {bi('Lưu phí', 'Save Fee')}
                              </Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              disabled={busy}
                              onPress={() =>
                                void handleUpdateFlightSeat(flight.id, seat, !seat.is_blocked)
                              }
                              style={
                                seat.is_blocked
                                  ? adminStyles.primaryBtnSmall
                                  : adminStyles.dangerBtnSmall
                              }
                            >
                              <Text
                                style={
                                  seat.is_blocked
                                    ? adminStyles.primaryBtnText
                                    : adminStyles.dangerBtnText
                                }
                              >
                                {seat.is_blocked
                                  ? bi('Mở khóa', 'Unblock')
                                  : bi('Khóa ghế', 'Block')}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}

          <AdminPaginationBar
            page={pagedFlights.page}
            totalPages={pagedFlights.totalPages}
            total={pagedFlights.total}
            onPageChange={setPage}
          />
        </>
      )}
    </AdminShell>
  );
}
