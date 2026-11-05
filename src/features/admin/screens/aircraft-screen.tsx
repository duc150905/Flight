import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton, Notice, colors } from '@/features/auth/ui';
import { cabinLabels } from '@/features/discovery/model';
import { supabase } from '@/lib/supabase';
import { useAdminI18n } from '../i18n';
import { loadAircraftAndSeats } from '../aircraft-data';
import {
  buildStandardSeatTemplate,
  filterAndPaginate,
  formatAdminError,
  type AircraftRow,
  type SeatRow,
  type StatusFilter,
} from '../model';
import {
  adminUpsertAircraft,
  adminUpsertAircraftSeats,
  type SeatTemplateItemSchema,
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

type CabinClass = 'first' | 'business' | 'premium_economy' | 'economy';

type VisualSeatItem = {
  seat_code: string;
  row_number: number;
  column_number: number;
  cabin_class: CabinClass;
  position: 'window' | 'middle' | 'aisle';
  is_exit_row: boolean;
};

const CABIN_THEME: Record<
  CabinClass,
  {
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    shortLabel: string;
    viName: string;
    enName: string;
    layoutText: string;
  }
> = {
  first: {
    bg: '#FEF3C7',
    border: '#F59E0B',
    text: '#92400E',
    badgeBg: '#FDE68A',
    shortLabel: 'FIRST',
    viName: 'Hạng Nhất (First)',
    enName: 'First Class',
    layoutText: '2 - 2 (A C | D F · 4 ghế/hàng)',
  },
  business: {
    bg: '#EDE9FE',
    border: '#8B5CF6',
    text: '#5B21B6',
    badgeBg: '#DDD6FE',
    shortLabel: 'BIZ',
    viName: 'Thương gia (Business)',
    enName: 'Business Class',
    layoutText: '2 - 2 (A C | D F · 4 ghế/hàng)',
  },
  premium_economy: {
    bg: '#E0F2FE',
    border: '#0284C7',
    text: '#075985',
    badgeBg: '#BAE6FD',
    shortLabel: 'PREM',
    viName: 'Phổ thông Đặc biệt',
    enName: 'Premium Economy',
    layoutText: '3 - 3 (A B C | D E F · 6 ghế/hàng)',
  },
  economy: {
    bg: '#F8FAFC',
    border: '#94A3B8',
    text: '#1E293B',
    badgeBg: '#E2E8F0',
    shortLabel: 'ECO',
    viName: 'Phổ thông (Economy)',
    enName: 'Economy Class',
    layoutText: '3 - 3 (A B C | D E F · 6 ghế/hàng)',
  },
};

function deriveRowCountsFromSeats(seats: SeatRow[]) {
  if (seats.length === 0) {
    return {
      firstRows: '1',
      businessRows: '2',
      premEcoRows: '2',
      economyRows: '10',
      exitRow: '10',
    };
  }
  const rowsByCabin: Record<CabinClass, Set<number>> = {
    first: new Set(),
    business: new Set(),
    premium_economy: new Set(),
    economy: new Set(),
  };
  let foundExitRow: number | null = null;

  for (const s of seats) {
    rowsByCabin[s.cabin_class].add(s.row_number);
    if (s.is_exit_row && foundExitRow === null) {
      foundExitRow = s.row_number;
    }
  }

  return {
    firstRows: String(rowsByCabin.first.size),
    businessRows: String(rowsByCabin.business.size),
    premEcoRows: String(rowsByCabin.premium_economy.size),
    economyRows: String(Math.max(1, rowsByCabin.economy.size)),
    exitRow: foundExitRow ? String(foundExitRow) : '',
  };
}

function groupSeatsIntoRows(seats: VisualSeatItem[]) {
  const rowMap = new Map<
    number,
    {
      rowNumber: number;
      cabinClass: CabinClass;
      isExitRow: boolean;
      byCol: Map<number, VisualSeatItem>;
    }
  >();

  for (const seat of seats) {
    let entry = rowMap.get(seat.row_number);
    if (!entry) {
      entry = {
        rowNumber: seat.row_number,
        cabinClass: seat.cabin_class,
        isExitRow: seat.is_exit_row,
        byCol: new Map(),
      };
      rowMap.set(seat.row_number, entry);
    }
    if (seat.is_exit_row) entry.isExitRow = true;
    entry.byCol.set(seat.column_number, seat);
  }

  return Array.from(rowMap.values()).sort((a, b) => a.rowNumber - b.rowNumber);
}

export function AdminAircraftScreen() {
  const { ta, bi, language } = useAdminI18n();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Aircraft Editor
  const [showAircraftForm, setShowAircraftForm] = useState(false);
  const [editingAircraft, setEditingAircraft] = useState<AircraftRow | null>(null);
  const [airlineId, setAirlineId] = useState('');
  const [regCode, setRegCode] = useState('');
  const [modelName, setModelName] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Seat Template Editor
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [firstRows, setFirstRows] = useState('1');
  const [businessRows, setBusinessRows] = useState('2');
  const [premEcoRows, setPremEcoRows] = useState('2');
  const [economyRows, setEconomyRows] = useState('10');
  const [exitRow, setExitRow] = useState('10');
  const [viewMode, setViewMode] = useState<'saved' | 'preview'>('saved');
  const [showAllRows, setShowAllRows] = useState(false);

  const dataQuery = useQuery({
    queryKey: ['admin-aircraft'],
    queryFn: () => {
      if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
      return loadAircraftAndSeats(supabase);
    },
  });

  const airlines = dataQuery.data?.airlines ?? [];
  const aircraftList = dataQuery.data?.aircraft ?? [];
  const seatsList = dataQuery.data?.seats ?? [];

  const airlineById = new Map(airlines.map((a) => [a.id, a]));

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-aircraft'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-f09-summary'] });
  };

  const openAircraftEditor = (ac?: AircraftRow) => {
    setError('');
    setSuccess('');
    setEditingAircraft(ac ?? null);
    setAirlineId(ac?.airline_id ?? airlines[0]?.id ?? '');
    setRegCode(ac?.registration_code ?? '');
    setModelName(ac?.model_name ?? '');
    setIsActive(ac?.is_active ?? true);
    setShowAircraftForm(true);
  };

  const toggleSeatMap = (ac: AircraftRow, acSeats: SeatRow[]) => {
    if (selectedAircraftId === ac.id) {
      setSelectedAircraftId(null);
      return;
    }
    const derived = deriveRowCountsFromSeats(acSeats);
    setFirstRows(derived.firstRows);
    setBusinessRows(derived.businessRows);
    setPremEcoRows(derived.premEcoRows);
    setEconomyRows(derived.economyRows);
    setExitRow(derived.exitRow);
    setViewMode(acSeats.length > 0 ? 'saved' : 'preview');
    setShowAllRows(false);
    setSelectedAircraftId(ac.id);
    setError('');
    setSuccess('');
  };

  const applyPreset = (preset: 'four_cabin' | 'two_cabin' | 'all_economy') => {
    if (preset === 'four_cabin') {
      setFirstRows('1');
      setBusinessRows('2');
      setPremEcoRows('2');
      setEconomyRows('10');
      setExitRow('10');
    } else if (preset === 'two_cabin') {
      setFirstRows('0');
      setBusinessRows('3');
      setPremEcoRows('0');
      setEconomyRows('15');
      setExitRow('10');
    } else {
      setFirstRows('0');
      setBusinessRows('0');
      setPremEcoRows('0');
      setEconomyRows('20');
      setExitRow('12');
    }
    setViewMode('preview');
  };

  const submitAircraft = async () => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await adminUpsertAircraft(supabase, {
        aircraftId: editingAircraft?.id ?? null,
        airlineId,
        registrationCode: regCode,
        modelName,
        isActive,
      });
      await refreshAll();
      setShowAircraftForm(false);
      setSuccess(ta('admin.saved'));
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const submitSeatTemplate = async (targetAircraftId: string) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const generatedSeats = buildStandardSeatTemplate({
        firstRows: Number(firstRows) || 0,
        businessRows: Number(businessRows) || 0,
        premiumEconomyRows: Number(premEcoRows) || 0,
        economyRows: Math.max(1, Number(economyRows) || 1),
        exitRowNumber: Number(exitRow) > 0 ? Number(exitRow) : null,
      });
      const count = await adminUpsertAircraftSeats(supabase, {
        aircraftId: targetAircraftId,
        seats: generatedSeats,
      });
      await refreshAll();
      setViewMode('saved');
      setSuccess(
        bi(
          `Đã cập nhật sơ đồ ghế mẫu (${count} ghế).`,
          `Updated aircraft seat template (${count} seats).`,
        ),
      );
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const pagedAircraft = filterAndPaginate(aircraftList, {
    query,
    statusFilter,
    page,
    pageSize: 8,
    getSearchText: (ac) => {
      const al = airlineById.get(ac.airline_id);
      return `${ac.registration_code} ${ac.model_name} ${al?.iata_code ?? ''} ${al?.name ?? ''}`;
    },
    getIsActive: (ac) => ac.is_active,
  });

  // Preview seats calculated live from form inputs
  const previewSeats: SeatTemplateItemSchema[] = buildStandardSeatTemplate({
    firstRows: Math.max(0, Number(firstRows) || 0),
    businessRows: Math.max(0, Number(businessRows) || 0),
    premiumEconomyRows: Math.max(0, Number(premEcoRows) || 0),
    economyRows: Math.max(1, Number(economyRows) || 1),
    exitRowNumber: Number(exitRow) > 0 ? Number(exitRow) : null,
  });

  return (
    <AdminShell
      activeSection="aircraft"
      title={bi('Quản lý Máy bay & Sơ đồ ghế mẫu', 'Aircraft & Seat Templates')}
      subtitle={bi(
        'Thiết lập đội tàu bay theo hãng và sơ đồ khoang ghế trực quan 4 hạng ghế. Sơ đồ của tàu bay đã mở bán chuyến được bảo vệ không bị ghi đè.',
        'Manage airline fleet and visual 4-cabin seat maps. Templates for aircraft with published flights are protected.',
      )}
      onQuickSearch={(txt) => {
        setQuery(txt);
        setPage(1);
      }}
    >
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
        onRefresh={() => void dataQuery.refetch()}
        onCreate={() => openAircraftEditor()}
        placeholder={bi(
          'Tìm mã đăng ký, dòng máy bay hoặc hãng…',
          'Search registration, model, or airline…',
        )}
      />

      <Notice text={success} success />
      <Notice text={error} />

      {dataQuery.isPending && <AdminLoadingState />}
      {dataQuery.isError && (
        <View style={adminStyles.card}>
          <Notice text={formatAdminError(dataQuery.error, language)} />
          <ActionButton
            title={ta('admin.action.retry')}
            secondary
            onPress={() => void dataQuery.refetch()}
          />
        </View>
      )}

      {showAircraftForm && (
        <View style={adminStyles.card}>
          <Text style={adminStyles.sectionTitle}>
            {editingAircraft
              ? bi(
                  `Sửa máy bay ${editingAircraft.registration_code}`,
                  `Edit aircraft ${editingAircraft.registration_code}`,
                )
              : bi('Thêm máy bay mới', 'Create new aircraft')}
          </Text>
          <Text style={adminStyles.label}>{bi('Hãng hàng không sở hữu', 'Operating airline')}</Text>
          <View style={adminStyles.chipRow}>
            {airlines.map((al) => {
              const selected = airlineId === al.id;
              return (
                <Pressable
                  key={al.id}
                  accessibilityRole="button"
                  onPress={() => setAirlineId(al.id)}
                  style={[adminStyles.chip, selected && adminStyles.chipSelected]}
                >
                  <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                    {al.iata_code} · {al.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <AdminTextField
            label={bi('Mã đăng ký tàu bay (registration_code)', 'Registration code')}
            value={regCode}
            onChangeText={setRegCode}
            placeholder="VN-A861"
            autoCapitalize="characters"
          />
          <AdminTextField
            label={bi('Dòng máy bay (model_name)', 'Aircraft model')}
            value={modelName}
            onChangeText={setModelName}
            placeholder="Airbus A350-900"
            autoCapitalize="words"
          />
          <View style={adminStyles.rowGap}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsActive((v) => !v)}
              style={[adminStyles.chip, isActive && adminStyles.chipSelected]}
            >
              <Text style={adminStyles.chipText}>
                {isActive ? ta('admin.status.active') : ta('admin.status.inactive')}
              </Text>
            </Pressable>
          </View>
          <View style={adminStyles.rowGap}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void submitAircraft()}
              style={adminStyles.primaryBtnSmall}
            >
              <Text style={adminStyles.primaryBtnText}>{ta('admin.action.save')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => setShowAircraftForm(false)}
              style={adminStyles.secondaryBtnSmall}
            >
              <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!dataQuery.isPending && (
        <>
          {pagedAircraft.items.length === 0 && (
            <View style={adminStyles.card}>
              <Text style={adminStyles.muted}>{ta('admin.empty')}</Text>
            </View>
          )}
          {pagedAircraft.items.map((ac) => {
            const al = airlineById.get(ac.airline_id);
            const acSeats = seatsList.filter((s) => s.aircraft_id === ac.id && s.is_active);
            const countByCabin = {
              first: acSeats.filter((s) => s.cabin_class === 'first').length,
              business: acSeats.filter((s) => s.cabin_class === 'business').length,
              premium_economy: acSeats.filter((s) => s.cabin_class === 'premium_economy').length,
              economy: acSeats.filter((s) => s.cabin_class === 'economy').length,
            };
            const isSeatOpen = selectedAircraftId === ac.id;

            const activeVisualSeats: VisualSeatItem[] =
              viewMode === 'preview' ? previewSeats : acSeats;
            const visualRows = groupSeatsIntoRows(activeVisualSeats);
            const displayedRows = showAllRows ? visualRows : visualRows.slice(0, 12);

            const fRowsNum = Math.max(0, Number(firstRows) || 0);
            const bRowsNum = Math.max(0, Number(businessRows) || 0);
            const peRowsNum = Math.max(0, Number(premEcoRows) || 0);
            const eRowsNum = Math.max(1, Number(economyRows) || 1);
            const totalConfigRows = fRowsNum + bRowsNum + peRowsNum + eRowsNum;

            return (
              <View key={ac.id} style={adminStyles.itemCard}>
                <View style={adminStyles.rowBetween}>
                  <Text style={adminStyles.bold}>
                    {ac.registration_code} · {ac.model_name}
                  </Text>
                  <AdminStatusBadge active={ac.is_active} />
                </View>
                <Text style={adminStyles.muted}>
                  {bi('Hãng bay', 'Airline')}: {al ? `${al.name} (${al.iata_code})` : '—'} ·{' '}
                  {bi('Tổng ghế mẫu', 'Template seats')}: {acSeats.length}
                </Text>

                {/* Mini cabin badges on the aircraft card */}
                <View style={adminStyles.rowGap}>
                  {(['first', 'business', 'premium_economy', 'economy'] as CabinClass[]).map(
                    (cb) => {
                      const theme = CABIN_THEME[cb];
                      const count = countByCabin[cb];
                      return (
                        <View
                          key={cb}
                          style={[
                            seatMapStyles.cabinSummaryPill,
                            { backgroundColor: theme.bg, borderColor: theme.border },
                          ]}
                        >
                          <Text style={[seatMapStyles.cabinSummaryText, { color: theme.text }]}>
                            {cabinLabels[cb]}: {count}
                          </Text>
                        </View>
                      );
                    },
                  )}
                </View>

                <View style={adminStyles.rowGap}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openAircraftEditor(ac)}
                    style={adminStyles.secondaryBtnSmall}
                  >
                    <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.edit')}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => toggleSeatMap(ac, acSeats)}
                    style={adminStyles.primaryBtnSmall}
                  >
                    <Text style={adminStyles.primaryBtnText}>
                      {isSeatOpen
                        ? bi('Đóng sơ đồ ghế', 'Close seat map')
                        : bi(
                            `Thiết kế & Xem sơ đồ ghế (${acSeats.length} ghế)`,
                            `Design & View seat map (${acSeats.length} seats)`,
                          )}
                    </Text>
                  </Pressable>
                </View>

                {isSeatOpen && (
                  <View
                    style={[
                      adminStyles.card,
                      { marginTop: 10, backgroundColor: colors.background },
                    ]}
                  >
                    <View style={adminStyles.rowBetween}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={adminStyles.sectionTitle}>
                          {bi(
                            `Thiết kế sơ đồ khoang ghế — ${ac.registration_code} (${ac.model_name})`,
                            `Cabin Seat Map Designer — ${ac.registration_code} (${ac.model_name})`,
                          )}
                        </Text>
                        <Text style={adminStyles.muted}>
                          {bi(
                            'Lưu sẽ thay toàn bộ cấu hình: ghế bị bỏ được ngừng dùng, ghế giữ lại giữ nguyên ID. Chỉ sửa khi tàu bay chưa có chuyến công bố hoặc kho ghế chuyến bay.',
                            'Saving replaces the full template: omitted seats become inactive and retained seats keep their IDs. Editable only before any published flight or flight seat inventory exists.',
                          )}
                        </Text>
                      </View>
                    </View>

                    {/* Preset templates */}
                    <View style={adminStyles.fieldGroup}>
                      <Text style={adminStyles.label}>
                        {bi('Chọn nhanh cấu hình mẫu:', 'Quick Cabin Presets:')}
                      </Text>
                      <View style={adminStyles.chipRow}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => applyPreset('four_cabin')}
                          style={adminStyles.chip}
                        >
                          <Text style={adminStyles.chipText}>
                            {bi(
                              '✈️ Đủ 4 hạng ghế (15 hàng · 84 ghế)',
                              '✈️ 4-Cabin Standard (15 rows · 84 seats)',
                            )}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => applyPreset('two_cabin')}
                          style={adminStyles.chip}
                        >
                          <Text style={adminStyles.chipText}>
                            {bi(
                              '🛫 2 hạng: Thương gia + Phổ thông (18 hàng · 102 ghế)',
                              '🛫 2-Cabin: Business + Economy (18 rows · 102 seats)',
                            )}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => applyPreset('all_economy')}
                          style={adminStyles.chip}
                        >
                          <Text style={adminStyles.chipText}>
                            {bi(
                              '💺 100% Phổ thông (20 hàng · 120 ghế)',
                              '💺 All-Economy (20 rows · 120 seats)',
                            )}
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* Color-coded input cards per cabin */}
                    <View style={adminStyles.rowGap}>
                      <View
                        style={[
                          seatMapStyles.configBox,
                          {
                            backgroundColor: CABIN_THEME.first.bg,
                            borderColor: CABIN_THEME.first.border,
                          },
                        ]}
                      >
                        <Text
                          style={[seatMapStyles.configBoxTitle, { color: CABIN_THEME.first.text }]}
                        >
                          1. {bi('Hạng Nhất (First)', 'First Class')}
                        </Text>
                        <Text style={seatMapStyles.configBoxSub}>
                          {bi('4 ghế/hàng (A C | D F)', '4 seats/row (A C | D F)')}
                        </Text>
                        <AdminTextField
                          label={bi('Số hàng ghế', 'Number of rows')}
                          value={firstRows}
                          onChangeText={(t) => {
                            setFirstRows(t);
                            setViewMode('preview');
                          }}
                          keyboardType="numeric"
                        />
                        <Text
                          style={[seatMapStyles.configBoxResult, { color: CABIN_THEME.first.text }]}
                        >
                          = {fRowsNum * 4} {bi('ghế', 'seats')}
                        </Text>
                      </View>

                      <View
                        style={[
                          seatMapStyles.configBox,
                          {
                            backgroundColor: CABIN_THEME.business.bg,
                            borderColor: CABIN_THEME.business.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            seatMapStyles.configBoxTitle,
                            { color: CABIN_THEME.business.text },
                          ]}
                        >
                          2. {bi('Thương gia (Business)', 'Business Class')}
                        </Text>
                        <Text style={seatMapStyles.configBoxSub}>
                          {bi('4 ghế/hàng (A C | D F)', '4 seats/row (A C | D F)')}
                        </Text>
                        <AdminTextField
                          label={bi('Số hàng ghế', 'Number of rows')}
                          value={businessRows}
                          onChangeText={(t) => {
                            setBusinessRows(t);
                            setViewMode('preview');
                          }}
                          keyboardType="numeric"
                        />
                        <Text
                          style={[
                            seatMapStyles.configBoxResult,
                            { color: CABIN_THEME.business.text },
                          ]}
                        >
                          = {bRowsNum * 4} {bi('ghế', 'seats')}
                        </Text>
                      </View>

                      <View
                        style={[
                          seatMapStyles.configBox,
                          {
                            backgroundColor: CABIN_THEME.premium_economy.bg,
                            borderColor: CABIN_THEME.premium_economy.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            seatMapStyles.configBoxTitle,
                            { color: CABIN_THEME.premium_economy.text },
                          ]}
                        >
                          3. {bi('Phổ thông Đặc biệt', 'Premium Economy')}
                        </Text>
                        <Text style={seatMapStyles.configBoxSub}>
                          {bi('6 ghế/hàng (A B C | D E F)', '6 seats/row (A B C | D E F)')}
                        </Text>
                        <AdminTextField
                          label={bi('Số hàng ghế', 'Number of rows')}
                          value={premEcoRows}
                          onChangeText={(t) => {
                            setPremEcoRows(t);
                            setViewMode('preview');
                          }}
                          keyboardType="numeric"
                        />
                        <Text
                          style={[
                            seatMapStyles.configBoxResult,
                            { color: CABIN_THEME.premium_economy.text },
                          ]}
                        >
                          = {peRowsNum * 6} {bi('ghế', 'seats')}
                        </Text>
                      </View>

                      <View
                        style={[
                          seatMapStyles.configBox,
                          {
                            backgroundColor: CABIN_THEME.economy.bg,
                            borderColor: CABIN_THEME.economy.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            seatMapStyles.configBoxTitle,
                            { color: CABIN_THEME.economy.text },
                          ]}
                        >
                          4. {bi('Phổ thông (Economy)', 'Economy Class')}
                        </Text>
                        <Text style={seatMapStyles.configBoxSub}>
                          {bi('6 ghế/hàng (A B C | D E F)', '6 seats/row (A B C | D E F)')}
                        </Text>
                        <AdminTextField
                          label={bi('Số hàng ghế', 'Number of rows')}
                          value={economyRows}
                          onChangeText={(t) => {
                            setEconomyRows(t);
                            setViewMode('preview');
                          }}
                          keyboardType="numeric"
                        />
                        <Text
                          style={[
                            seatMapStyles.configBoxResult,
                            { color: CABIN_THEME.economy.text },
                          ]}
                        >
                          = {eRowsNum * 6} {bi('ghế', 'seats')}
                        </Text>
                      </View>

                      <View
                        style={[
                          seatMapStyles.configBox,
                          {
                            backgroundColor: '#FFF7ED',
                            borderColor: '#EA580C',
                          },
                        ]}
                      >
                        <Text style={[seatMapStyles.configBoxTitle, { color: '#C2410C' }]}>
                          🚪 {bi('Hàng cửa thoát hiểm', 'Emergency Exit Row')}
                        </Text>
                        <Text style={seatMapStyles.configBoxSub}>
                          {bi(
                            `Chọn số thứ tự hàng (1–${totalConfigRows})`,
                            `Row number (1–${totalConfigRows})`,
                          )}
                        </Text>
                        <AdminTextField
                          label={bi('Hàng thoát hiểm số', 'Exit row #')}
                          value={exitRow}
                          onChangeText={(t) => {
                            setExitRow(t);
                            setViewMode('preview');
                          }}
                          keyboardType="numeric"
                        />
                        <Text style={[seatMapStyles.configBoxResult, { color: '#C2410C' }]}>
                          {Number(exitRow) > 0
                            ? bi(`Hàng số ${exitRow} (EXIT)`, `Row #${exitRow} (EXIT)`)
                            : bi('Không chỉ định', 'None')}
                        </Text>
                      </View>
                    </View>

                    {/* Live formula bar & Save button */}
                    <View style={seatMapStyles.summaryBar}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={adminStyles.bold}>
                          {bi('Tổng cộng cấu hình đang thiết kế:', 'Configured Total:')} {totalConfigRows}{' '}
                          {bi('hàng ghế', 'rows')} = {previewSeats.length} {bi('ghế', 'seats')}
                        </Text>
                        <Text style={adminStyles.muted}>
                          {bi(
                            `Công thức: (${fRowsNum} × 4) + (${bRowsNum} × 4) + (${peRowsNum} × 6) + (${eRowsNum} × 6) = ${previewSeats.length} ghế`,
                            `Formula: (${fRowsNum} × 4) + (${bRowsNum} × 4) + (${peRowsNum} × 6) + (${eRowsNum} × 6) = ${previewSeats.length} seats`,
                          )}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => void submitSeatTemplate(ac.id)}
                        style={adminStyles.primaryBtnSmall}
                      >
                        <Text style={adminStyles.primaryBtnText}>
                          {bi('💾 Sinh & Lưu sơ đồ ghế mẫu', '💾 Generate & Save Seat Map')}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Toggle Saved vs Live Preview */}
                    <View style={adminStyles.rowBetween}>
                      <View style={adminStyles.chipRow}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setViewMode('saved')}
                          style={[
                            adminStyles.chip,
                            viewMode === 'saved' && adminStyles.chipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              adminStyles.chipText,
                              viewMode === 'saved' && adminStyles.chipTextSelected,
                            ]}
                          >
                            {bi(
                              `Sơ đồ đang lưu trên tàu bay (${acSeats.length} ghế)`,
                              `Saved Aircraft Map (${acSeats.length} seats)`,
                            )}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setViewMode('preview')}
                          style={[
                            adminStyles.chip,
                            viewMode === 'preview' && adminStyles.chipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              adminStyles.chipText,
                              viewMode === 'preview' && adminStyles.chipTextSelected,
                            ]}
                          >
                            {bi(
                              `Xem trước cấu hình mới (${previewSeats.length} ghế)`,
                              `Live Preview (${previewSeats.length} seats)`,
                            )}
                          </Text>
                        </Pressable>
                      </View>

                      {visualRows.length > 12 && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setShowAllRows((v) => !v)}
                          style={adminStyles.secondaryBtnSmall}
                        >
                          <Text style={adminStyles.secondaryBtnText}>
                            {showAllRows
                              ? bi('Thu gọn (12 hàng đầu)', 'Collapse (first 12 rows)')
                              : bi(
                                  `Xem toàn bộ ${visualRows.length} hàng ghế`,
                                  `Show all ${visualRows.length} rows`,
                                )}
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    {/* Visual Fuselage Diagram */}
                    <View style={seatMapStyles.fuselage}>
                      <View style={seatMapStyles.cockpitBanner}>
                        <Text style={seatMapStyles.cockpitText}>
                          ▲ {bi('ĐẦU MÁY BAY (BUỒNG LÁI / COCKPIT)', 'AIRCRAFT NOSE (COCKPIT)')} ▲
                        </Text>
                      </View>

                      {/* Column Headers: A B C | AISLE | D E F */}
                      <View style={seatMapStyles.seatRowContainer}>
                        <View style={seatMapStyles.sideWing}>
                          <View style={seatMapStyles.colHeaderBox}>
                            <Text style={seatMapStyles.colHeaderLetter}>A</Text>
                            <Text style={seatMapStyles.colHeaderSub}>
                              {bi('Cửa sổ', 'Win')}
                            </Text>
                          </View>
                          <View style={seatMapStyles.colHeaderBox}>
                            <Text style={seatMapStyles.colHeaderLetter}>B</Text>
                            <Text style={seatMapStyles.colHeaderSub}>
                              {bi('Giữa', 'Mid')}
                            </Text>
                          </View>
                          <View style={seatMapStyles.colHeaderBox}>
                            <Text style={seatMapStyles.colHeaderLetter}>C</Text>
                            <Text style={seatMapStyles.colHeaderSub}>
                              {bi('Lối đi', 'Aisle')}
                            </Text>
                          </View>
                        </View>

                        <View style={seatMapStyles.aisleBox}>
                          <Text style={seatMapStyles.aisleHeaderText}>
                            {bi('LỐI ĐI', 'AISLE')}
                          </Text>
                        </View>

                        <View style={seatMapStyles.sideWing}>
                          <View style={seatMapStyles.colHeaderBox}>
                            <Text style={seatMapStyles.colHeaderLetter}>D</Text>
                            <Text style={seatMapStyles.colHeaderSub}>
                              {bi('Lối đi', 'Aisle')}
                            </Text>
                          </View>
                          <View style={seatMapStyles.colHeaderBox}>
                            <Text style={seatMapStyles.colHeaderLetter}>E</Text>
                            <Text style={seatMapStyles.colHeaderSub}>
                              {bi('Giữa', 'Mid')}
                            </Text>
                          </View>
                          <View style={seatMapStyles.colHeaderBox}>
                            <Text style={seatMapStyles.colHeaderLetter}>F</Text>
                            <Text style={seatMapStyles.colHeaderSub}>
                              {bi('Cửa sổ', 'Win')}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Render Rows grouped with Cabin Headers */}
                      {displayedRows.map((rowItem, idx) => {
                        const prevCabin = idx > 0 ? displayedRows[idx - 1].cabinClass : null;
                        const showCabinDivider = prevCabin !== rowItem.cabinClass;
                        const theme = CABIN_THEME[rowItem.cabinClass];

                        const renderSeatSlot = (colNum: number) => {
                          const seat = rowItem.byCol.get(colNum);
                          if (!seat) {
                            // Empty middle space in 4-abreast First/Business cabins
                            return (
                              <View key={colNum} style={seatMapStyles.emptySeatSlot}>
                                <Text style={seatMapStyles.emptySeatDash}>—</Text>
                              </View>
                            );
                          }
                          return (
                            <View
                              key={colNum}
                              style={[
                                seatMapStyles.seatBox,
                                {
                                  backgroundColor: theme.bg,
                                  borderColor: rowItem.isExitRow ? '#EA580C' : theme.border,
                                },
                              ]}
                            >
                              <Text style={[seatMapStyles.seatCodeText, { color: theme.text }]}>
                                {seat.seat_code}
                              </Text>
                              <Text style={[seatMapStyles.seatSubText, { color: theme.text }]}>
                                {rowItem.isExitRow ? 'EXIT' : theme.shortLabel}
                              </Text>
                            </View>
                          );
                        };

                        return (
                          <View key={rowItem.rowNumber} style={{ gap: 6 }}>
                            {showCabinDivider && (
                              <View
                                style={[
                                  seatMapStyles.cabinSectionBanner,
                                  {
                                    backgroundColor: theme.badgeBg,
                                    borderColor: theme.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    seatMapStyles.cabinSectionTitle,
                                    { color: theme.text },
                                  ]}
                                >
                                  {language === 'vi' ? theme.viName : theme.enName} ·{' '}
                                  {theme.layoutText}
                                </Text>
                              </View>
                            )}

                            <View
                              style={[
                                seatMapStyles.seatRowContainer,
                                rowItem.isExitRow && seatMapStyles.exitRowHighlight,
                              ]}
                            >
                              <View style={seatMapStyles.sideWing}>
                                {[1, 2, 3].map(renderSeatSlot)}
                              </View>

                              <View style={seatMapStyles.aisleBox}>
                                <View
                                  style={[
                                    seatMapStyles.rowNumberCircle,
                                    rowItem.isExitRow && seatMapStyles.rowNumberExitCircle,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      seatMapStyles.rowNumberText,
                                      rowItem.isExitRow && { color: '#FFFFFF' },
                                    ]}
                                  >
                                    {rowItem.rowNumber}
                                  </Text>
                                </View>
                                {rowItem.isExitRow && (
                                  <Text style={seatMapStyles.exitRowTag}>EXIT</Text>
                                )}
                              </View>

                              <View style={seatMapStyles.sideWing}>
                                {[4, 5, 6].map(renderSeatSlot)}
                              </View>
                            </View>
                          </View>
                        );
                      })}

                      {!showAllRows && visualRows.length > 12 && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setShowAllRows(true)}
                          style={seatMapStyles.expandMoreBanner}
                        >
                          <Text style={seatMapStyles.expandMoreText}>
                            ▼{' '}
                            {bi(
                              `Nhấn để xem tiếp ${visualRows.length - 12} hàng ghế phía sau (${visualRows.length} hàng tổng cộng)`,
                              `Tap to view remaining ${visualRows.length - 12} rear rows (${visualRows.length} total rows)`,
                            )}{' '}
                            ▼
                          </Text>
                        </Pressable>
                      )}

                      <View style={seatMapStyles.tailBanner}>
                        <Text style={seatMapStyles.cockpitText}>
                          ▼ {bi('ĐUÔI MÁY BAY (REAR GALLEY)', 'AIRCRAFT TAIL (REAR GALLEY)')} ▼
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
          <AdminPaginationBar
            page={pagedAircraft.page}
            totalPages={pagedAircraft.totalPages}
            total={pagedAircraft.total}
            onPageChange={setPage}
          />
        </>
      )}
    </AdminShell>
  );
}

const seatMapStyles = StyleSheet.create({
  cabinSummaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  cabinSummaryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  configBox: {
    flex: 1,
    minWidth: 155,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  configBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  configBoxSub: {
    fontSize: 11,
    color: colors.muted,
  },
  configBoxResult: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fuselage: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    padding: 12,
    gap: 8,
  },
  cockpitBanner: {
    backgroundColor: '#EFF6FF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 8,
    alignItems: 'center',
  },
  tailBanner: {
    backgroundColor: '#F8FAFC',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  cockpitText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
    letterSpacing: 0.8,
  },
  cabinSectionBanner: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 4,
  },
  cabinSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  seatRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  exitRowHighlight: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingVertical: 4,
  },
  sideWing: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  colHeaderBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  colHeaderLetter: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  colHeaderSub: {
    fontSize: 10,
    color: colors.muted,
  },
  aisleBox: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aisleHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
  },
  rowNumberCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowNumberExitCircle: {
    backgroundColor: '#EA580C',
  },
  rowNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  exitRowTag: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C2410C',
    marginTop: 1,
  },
  seatBox: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  seatCodeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  seatSubText: {
    fontSize: 9,
    fontWeight: '600',
  },
  emptySeatSlot: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  emptySeatDash: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  expandMoreBanner: {
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
  },
  expandMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
