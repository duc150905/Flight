import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateFlightSearch } from '@/features/cache/policy';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ActionButton, Notice } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import { getTimezoneOffsetString, parseZonedFlight } from '../geo-data';
import { useAdminI18n } from '../i18n';
import {
  CABIN_TEMPLATES,
  CabinClass,
  getCabinInfo,
  getSeatPositionInfo,
} from '../seat-fare-data';
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
  AdminToast,
  adminStyles,
} from '../ui';

type FlightStatus = 'draft' | 'scheduled' | 'delayed' | 'departed' | 'arrived' | 'cancelled';

const FLIGHT_STATUS_OPTIONS: { key: FlightStatus; vi: string; en: string; icon: string }[] = [
  { key: 'scheduled', vi: 'Đã lên lịch (SCHEDULED)', en: 'Scheduled', icon: '🕒' },
  { key: 'draft', vi: 'Bản nháp (DRAFT)', en: 'Draft', icon: '📝' },
  { key: 'delayed', vi: 'Bị hoãn (DELAYED)', en: 'Delayed', icon: '⏳' },
  { key: 'cancelled', vi: 'Đã hủy (CANCELLED)', en: 'Cancelled', icon: '❌' },
];

function formatFlightStatus(status: FlightStatus, bi: (vi: string, en: string) => string) {
  switch (status) {
    case 'scheduled':
      return bi('Đã lên lịch', 'Scheduled');
    case 'draft':
      return bi('Bản nháp', 'Draft');
    case 'delayed':
      return bi('Bị hoãn', 'Delayed');
    case 'cancelled':
      return bi('Đã hủy', 'Cancelled');
    case 'departed':
      return bi('Đã cất cánh', 'Departed');
    case 'arrived':
      return bi('Đã hạ cánh', 'Arrived');
    default:
      return String(status).toUpperCase();
  }
}

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

function FlightSeatsManager({
  flight,
  seats,
  seatFeeDrafts,
  setSeatFeeDrafts,
  busy,
  money,
  ta,
  bi,
  onUpdateSeat,
  onReloadSeats,
}: {
  flight: FlightInstanceRow;
  seats: FlightSeatRow[];
  seatFeeDrafts: Record<string, string>;
  setSeatFeeDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  busy: boolean;
  money: (amount: number) => string;
  ta: (key: string, params?: Record<string, string | number>) => string;
  bi: (v: string, e: string) => string;
  onUpdateSeat: (seat: FlightSeatRow, nextBlocked?: boolean) => Promise<void>;
  onReloadSeats: () => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [cabinFilter, setCabinFilter] = useState<'all' | CabinClass>('all');
  const [posFilter, setPosFilter] = useState<'all' | 'window' | 'aisle' | 'middle' | 'exit'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'blocked'>('all');
  const [page, setPage] = useState(1);
  const [showBatchTools, setShowBatchTools] = useState(false);
  const [batchFeeInput, setBatchFeeInput] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMsg, setBatchMsg] = useState('');

  // Stats
  const totalSeats = seats.length;
  const blockedCount = useMemo(() => seats.filter((s) => s.is_blocked).length, [seats]);
  const availableCount = totalSeats - blockedCount;
  const feeCount = useMemo(() => seats.filter((s) => s.selection_fee_amount > 0).length, [seats]);

  const cabinCounts = useMemo(() => {
    const c: Record<CabinClass, number> = {
      first: 0,
      business: 0,
      premium_economy: 0,
      economy: 0,
    };
    for (const s of seats) {
      if (c[s.cabin_class] !== undefined) c[s.cabin_class]++;
    }
    return c;
  }, [seats]);

  // Filtering
  const filteredSeats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return seats.filter((s) => {
      if (cabinFilter !== 'all' && s.cabin_class !== cabinFilter) return false;
      if (posFilter === 'exit' && !s.is_exit_row) return false;
      if (posFilter !== 'all' && posFilter !== 'exit' && s.position !== posFilter) return false;
      if (statusFilter === 'available' && s.is_blocked) return false;
      if (statusFilter === 'blocked' && !s.is_blocked) return false;
      if (q) {
        const codeMatch = s.seat_code.toLowerCase().includes(q);
        const rowMatch = String(s.row_number) === q;
        const posInfo = getSeatPositionInfo(s.position, s.is_exit_row, bi);
        const cabinInfo = getCabinInfo(s.cabin_class, bi);
        return (
          codeMatch ||
          rowMatch ||
          posInfo.fullLabel.toLowerCase().includes(q) ||
          cabinInfo.label.toLowerCase().includes(q) ||
          String(s.selection_fee_amount).includes(q)
        );
      }
      return true;
    });
  }, [seats, cabinFilter, posFilter, statusFilter, search, bi]);

  const PAGE_SIZE = 24;
  const totalPages = Math.max(1, Math.ceil(filteredSeats.length / PAGE_SIZE));
  const validPage = Math.min(Math.max(1, page), totalPages);
  const pagedSeats = useMemo(() => {
    const start = (validPage - 1) * PAGE_SIZE;
    return filteredSeats.slice(start, start + PAGE_SIZE);
  }, [filteredSeats, validPage]);

  // Batch actions
  const handleBatchBlock = async (block: boolean) => {
    if (!supabase || filteredSeats.length === 0) return;
    setBatchLoading(true);
    setBatchMsg('');
    try {
      const targets = filteredSeats.filter((s) => s.is_blocked !== block);
      for (const seat of targets) {
        await adminUpdateFlightSeat(supabase, {
          flightSeatId: seat.id,
          isBlocked: block,
          selectionFeeAmount: seat.selection_fee_amount,
        });
      }
      setBatchMsg(
        bi(
          `Đã ${block ? 'khóa' : 'mở'} ${targets.length} ghế thành công!`,
          `Successfully ${block ? 'blocked' : 'unblocked'} ${targets.length} seats!`,
        ),
      );
      await onReloadSeats();
    } catch {
      setBatchMsg(bi('Lỗi khi cập nhật ghế hàng loạt.', 'Batch update failed.'));
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchSetFee = async () => {
    const feeVal = Number(batchFeeInput);
    if (!supabase || isNaN(feeVal) || feeVal < 0 || filteredSeats.length === 0) return;
    setBatchLoading(true);
    setBatchMsg('');
    try {
      for (const seat of filteredSeats) {
        await adminUpdateFlightSeat(supabase, {
          flightSeatId: seat.id,
          isBlocked: seat.is_blocked,
          selectionFeeAmount: feeVal,
        });
      }
      setBatchMsg(
        bi(
          `Đã cập nhật phí ${feeVal.toLocaleString('vi-VN')} đ cho ${filteredSeats.length} ghế!`,
          `Updated fee for ${filteredSeats.length} seats!`,
        ),
      );
      await onReloadSeats();
    } catch {
      setBatchMsg(bi('Lỗi khi đặt phí hàng loạt.', 'Batch fee update failed.'));
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <View style={[adminStyles.card, { marginTop: 8, gap: 12 }]}>
      {/* Title */}
      <View style={{ gap: 2 }}>
        <Text style={adminStyles.bold}>
          {bi(
            `Kho ghế chuyến bay ${flight.flight_number} (${totalSeats} ghế)`,
            `Seat Inventory for ${flight.flight_number} (${totalSeats} seats)`,
          )}
        </Text>
        <Text style={adminStyles.muted}>
          {bi(
            'Quản lý kho ghế theo số ghế (1A, 12C...), hạng khoang (Thương gia, Phổ thông...) và vị trí (cửa sổ, lối đi, thoát hiểm).',
            'Manage seats by seat code (1A, 12C...), cabin class, and seat position (window, aisle, exit row).',
          )}
        </Text>
      </View>

      {totalSeats === 0 ? (
        <Text style={adminStyles.muted}>
          {bi(
            'Chưa có kho ghế (hãy bật Công bố mở bán chuyến bay để tự động tạo kho ghế từ tàu bay).',
            'No seat inventory initialized yet (publish the flight to initialize from aircraft template).',
          )}
        </Text>
      ) : (
        <>
          {/* Summary Metric Pills */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <View
              style={{
                backgroundColor: '#F8FAFC',
                borderColor: '#E2E8F0',
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                minWidth: 100,
              }}
            >
              <Text style={{ fontSize: 11, color: '#64748B' }}>
                {bi('Tổng kho ghế', 'Total Seats')}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>
                💺 {totalSeats}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#F0FDF4',
                borderColor: '#BBF7D0',
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                minWidth: 100,
              }}
            >
              <Text style={{ fontSize: 11, color: '#166534' }}>
                {bi('Đang mở chọn', 'Available')}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#15803D' }}>
                🟢 {availableCount}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#FEF2F2',
                borderColor: '#FECACA',
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                minWidth: 100,
              }}
            >
              <Text style={{ fontSize: 11, color: '#991B1B' }}>
                {bi('Đang khóa', 'Blocked')}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#B91C1C' }}>
                🔒 {blockedCount}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#F0FDFA',
                borderColor: '#99F6E4',
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                minWidth: 100,
              }}
            >
              <Text style={{ fontSize: 11, color: '#0F766E' }}>
                {bi('Có phí chọn', 'With Fee')}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0D9488' }}>
                🏷️ {feeCount}
              </Text>
            </View>
          </View>

          {/* Cabin Breakdown Filter Chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(['first', 'business', 'premium_economy', 'economy'] as CabinClass[]).map((cb) => {
              const cInfo = getCabinInfo(cb, bi);
              const count = cabinCounts[cb] ?? 0;
              if (count === 0 && cb === 'first') return null;
              const isSelected = cabinFilter === cb;
              return (
                <Pressable
                  key={cb}
                  accessibilityRole="button"
                  onPress={() => {
                    setCabinFilter(isSelected ? 'all' : cb);
                    setPage(1);
                  }}
                  style={[
                    adminStyles.chip,
                    isSelected && {
                      backgroundColor: cInfo.bgColor,
                      borderColor: cInfo.color,
                      borderWidth: 1.5,
                    },
                  ]}
                >
                  <Text
                    style={[
                      adminStyles.chipText,
                      isSelected && { color: cInfo.color, fontWeight: '700' },
                    ]}
                  >
                    {cInfo.icon} {cInfo.shortLabel}: {count} {bi('ghế', 'seats')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Search and Position Filters */}
          <View style={{ gap: 8 }}>
            <TextInput
              value={search}
              onChangeText={(t) => {
                setSearch(t);
                setPage(1);
              }}
              placeholder={bi(
                '🔍 Tìm mã ghế (VD: 1A, 12, Cửa sổ, Thoát hiểm, 60000)...',
                '🔍 Search seat (e.g. 1A, 12, Window, Exit, 60000)...',
              )}
              style={[adminStyles.input, { backgroundColor: '#FFFFFF' }]}
            />

            <View style={adminStyles.chipRow}>
              {[
                { key: 'all', label: bi('Tất cả vị trí', 'All positions') },
                { key: 'window', label: bi('🪟 Cửa sổ', '🪟 Window') },
                { key: 'aisle', label: bi('🚶 Lối đi', '🚶 Aisle') },
                { key: 'middle', label: bi('👥 Ở giữa', '👥 Middle') },
                { key: 'exit', label: bi('🚪 Thoát hiểm', '🚪 Exit Row') },
              ].map((pos) => {
                const isSelected = posFilter === pos.key;
                return (
                  <Pressable
                    key={pos.key}
                    accessibilityRole="button"
                    onPress={() => {
                      setPosFilter(pos.key as any);
                      setPage(1);
                    }}
                    style={[adminStyles.chip, isSelected && adminStyles.chipSelected]}
                  >
                    <Text
                      style={[
                        adminStyles.chipText,
                        isSelected && adminStyles.chipTextSelected,
                      ]}
                    >
                      {pos.label}
                    </Text>
                  </Pressable>
                );
              })}

              {[
                { key: 'all', label: bi('Tất cả TT', 'All status') },
                { key: 'available', label: bi('🟢 Mở chọn', '🟢 Available') },
                { key: 'blocked', label: bi('🔒 Đang khóa', '🔒 Blocked') },
              ].map((st) => {
                const isSelected = statusFilter === st.key;
                return (
                  <Pressable
                    key={st.key}
                    accessibilityRole="button"
                    onPress={() => {
                      setStatusFilter(st.key as any);
                      setPage(1);
                    }}
                    style={[adminStyles.chip, isSelected && adminStyles.chipSelected]}
                  >
                    <Text
                      style={[
                        adminStyles.chipText,
                        isSelected && adminStyles.chipTextSelected,
                      ]}
                    >
                      {st.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Batch Tools Bar */}
          <View style={{ gap: 6 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowBatchTools((v) => !v)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F766E' }}>
                ⚡{' '}
                {bi(
                  `Công cụ thao tác nhanh (${filteredSeats.length} ghế đang lọc)`,
                  `Batch Actions (${filteredSeats.length} matching seats)`,
                )}{' '}
                {showBatchTools ? '▲' : '▼'}
              </Text>
            </Pressable>

            {showBatchTools && (
              <View
                style={{
                  backgroundColor: '#F8FAFC',
                  borderColor: '#CBD5E1',
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 12,
                  gap: 10,
                }}
              >
                {batchMsg ? (
                  <Text style={{ fontSize: 13, color: '#0F766E', fontWeight: '700' }}>
                    {batchMsg}
                  </Text>
                ) : null}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={batchLoading || busy}
                    onPress={() => void handleBatchBlock(true)}
                    style={adminStyles.dangerBtnSmall}
                  >
                    <Text style={adminStyles.dangerBtnText}>
                      🔒 {bi(`Khóa tất cả ${filteredSeats.length} ghế này`, `Block all ${filteredSeats.length} seats`)}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={batchLoading || busy}
                    onPress={() => void handleBatchBlock(false)}
                    style={adminStyles.primaryBtnSmall}
                  >
                    <Text style={adminStyles.primaryBtnText}>
                      🟢 {bi(`Mở tất cả ${filteredSeats.length} ghế này`, `Unblock all ${filteredSeats.length} seats`)}
                    </Text>
                  </Pressable>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>
                    {bi('Đặt phí đồng loạt (VND):', 'Set uniform fee (VND):')}
                  </Text>
                  <TextInput
                    value={batchFeeInput}
                    onChangeText={setBatchFeeInput}
                    placeholder="50000"
                    keyboardType="numeric"
                    style={[
                      adminStyles.input,
                      { width: 120, minHeight: 34, paddingVertical: 4, backgroundColor: '#FFFFFF' },
                    ]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={batchLoading || busy || !batchFeeInput}
                    onPress={() => void handleBatchSetFee()}
                    style={adminStyles.secondaryBtnSmall}
                  >
                    <Text style={adminStyles.secondaryBtnText}>
                      {bi(
                        `Áp dụng cho ${filteredSeats.length} ghế`,
                        `Apply to ${filteredSeats.length} seats`,
                      )}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* Seat Cards List */}
          {filteredSeats.length === 0 ? (
            <Text style={{ fontSize: 13, color: '#64748B', fontStyle: 'italic', paddingVertical: 8 }}>
              {bi('Không tìm thấy ghế nào phù hợp với bộ lọc.', 'No seats match current filters.')}
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {pagedSeats.map((seat) => {
                const cabinInfo = getCabinInfo(seat.cabin_class, bi);
                const posInfo = getSeatPositionInfo(seat.position, seat.is_exit_row, bi);

                return (
                  <View
                    key={seat.id}
                    style={{
                      backgroundColor: seat.is_blocked ? '#FFF5F5' : '#FFFFFF',
                      borderColor: seat.is_blocked ? '#FEB2B2' : '#E2E8F0',
                      borderWidth: 1.5,
                      borderRadius: 12,
                      padding: 12,
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {/* Seat Code Box */}
                        <View
                          style={{
                            backgroundColor: cabinInfo.bgColor,
                            borderColor: cabinInfo.borderColor,
                            borderWidth: 1.5,
                            borderRadius: 8,
                            minWidth: 54,
                            height: 42,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: '800',
                              color: cabinInfo.color,
                            }}
                          >
                            {seat.seat_code}
                          </Text>
                        </View>

                        {/* Seat Meta */}
                        <View style={{ gap: 3 }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              flexWrap: 'wrap',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '700',
                                color: cabinInfo.color,
                              }}
                            >
                              {cabinInfo.icon} {cabinInfo.shortLabel}
                            </Text>
                            <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>
                              · {posInfo.label}
                            </Text>
                            {seat.is_exit_row && (
                              <View
                                style={{
                                  backgroundColor: '#FEF3C7',
                                  borderColor: '#FCD34D',
                                  borderWidth: 1,
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '700',
                                    color: '#B45309',
                                  }}
                                >
                                  🚪 {bi('Thoát hiểm / Chân rộng', 'Exit Row')}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>
                            {bi(
                              `Hàng ${seat.row_number} · Cột ${seat.column_number}`,
                              `Row ${seat.row_number} · Column ${seat.column_number}`,
                            )}
                          </Text>
                        </View>
                      </View>

                      {/* Status Badge */}
                      <View
                        style={{
                          backgroundColor: seat.is_blocked ? '#FEE2E2' : '#DCFCE7',
                          borderColor: seat.is_blocked ? '#F87171' : '#86EFAC',
                          borderWidth: 1,
                          borderRadius: 6,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: seat.is_blocked ? '#991B1B' : '#166534',
                          }}
                        >
                          {seat.is_blocked
                            ? bi('🔒 Đang khóa (Blocked)', '🔒 Blocked')
                            : bi('🟢 Mở chọn (Available)', '🟢 Available')}
                        </Text>
                      </View>
                    </View>

                    {/* Controls Row */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        flexWrap: 'wrap',
                        gap: 8,
                        borderTopWidth: 1,
                        borderTopColor: '#F1F5F9',
                        paddingTop: 8,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>
                          {bi('Phí chọn ghế:', 'Fee:')}
                        </Text>
                        <TextInput
                          value={
                            seatFeeDrafts[seat.id] ?? String(seat.selection_fee_amount)
                          }
                          onChangeText={(t) =>
                            setSeatFeeDrafts((prev) => ({ ...prev, [seat.id]: t }))
                          }
                          keyboardType="numeric"
                          style={[
                            adminStyles.input,
                            {
                              width: 100,
                              minHeight: 34,
                              paddingVertical: 4,
                              textAlign: 'right',
                            },
                          ]}
                        />
                        <Text style={{ fontSize: 12, color: '#64748B' }}>đ</Text>
                        <Pressable
                          accessibilityRole="button"
                          disabled={busy}
                          onPress={() => void onUpdateSeat(seat)}
                          style={adminStyles.secondaryBtnSmall}
                        >
                          <Text style={adminStyles.secondaryBtnText}>
                            {bi('Lưu phí', 'Save Fee')}
                          </Text>
                        </Pressable>
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => void onUpdateSeat(seat, !seat.is_blocked)}
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
                          {seat.is_blocked ? bi('Mở khóa', 'Unblock') : bi('Khóa ghế', 'Block')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 8,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 13, color: '#64748B' }}>
                {bi(
                  `Trang ${validPage} / ${totalPages} (Tổng ${filteredSeats.length} ghế)`,
                  `Page ${validPage} of ${totalPages} (${filteredSeats.length} seats)`,
                )}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable
                  accessibilityRole="button"
                  disabled={validPage <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  style={[adminStyles.secondaryBtnSmall, validPage <= 1 && { opacity: 0.5 }]}
                >
                  <Text style={adminStyles.secondaryBtnText}>
                    ← {bi('Trang trước', 'Previous')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={validPage >= totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={[
                    adminStyles.secondaryBtnSmall,
                    validPage >= totalPages && { opacity: 0.5 },
                  ]}
                >
                  <Text style={adminStyles.secondaryBtnText}>{bi('Trang sau', 'Next')} →</Text>
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

export function AdminFlightsScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { language, ta, bi, money, airportTime } = useAdminI18n();
  const queryClient = useQueryClient();

  const flightsQuery = useQuery({
    queryKey: ['admin-flights-bundle'],
    queryFn: loadFlightsBundle,
  });

  const airports = useMemo(() => flightsQuery.data?.airports ?? [], [flightsQuery.data?.airports]);
  const airlines = flightsQuery.data?.airlines ?? [];
  const aircraftList = flightsQuery.data?.aircraftList ?? [];
  const flights = useMemo(() => flightsQuery.data?.flights ?? [], [flightsQuery.data?.flights]);
  const faresByFlight = flightsQuery.data?.faresByFlight ?? {};
  const referenceNowMs = flightsQuery.data?.fetchedAtMs ?? 0;
  const airportById = useMemo(() => new Map(airports.map((a) => [a.id, a])), [airports]);

  const [seatsByFlight, setSeatsByFlight] = useState<Record<string, FlightSeatRow[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
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

  const [showAdvancedIso, setShowAdvancedIso] = useState(false);

  // Operational timezone based on selected departure airport
  const depAirport = airportById.get(flightForm.departureAirportId);
  const operationalTz = depAirport?.timezone || 'Asia/Ho_Chi_Minh';
  const tzOffset = useMemo(
    () => getTimezoneOffsetString(flightForm.departureAt || new Date(), operationalTz),
    [flightForm.departureAt, operationalTz],
  );

  const depZoned = useMemo(
    () => parseZonedFlight(flightForm.departureAt, operationalTz),
    [flightForm.departureAt, operationalTz],
  );
  const arrZoned = useMemo(
    () => parseZonedFlight(flightForm.arrivalAt, operationalTz),
    [flightForm.arrivalAt, operationalTz],
  );
  const closeZoned = useMemo(
    () => (flightForm.salesCloseAt ? parseZonedFlight(flightForm.salesCloseAt, operationalTz) : null),
    [flightForm.salesCloseAt, operationalTz],
  );

  const flightDate = depZoned.dateStr || '2026-06-15';
  const departureTime = depZoned.timeStr || '08:00';
  const arrivalTime = arrZoned.timeStr || '10:10';
  const salesCloseTime = closeZoned?.timeStr || '06:30';

  const updateDateTime = (updates: {
    date?: string;
    depTime?: string;
    arrTime?: string;
    closeTime?: string;
  }) => {
    const nextDate = updates.date ?? flightDate;
    const nextDepTime = updates.depTime ?? departureTime;
    const nextArrTime = updates.arrTime ?? arrivalTime;
    const nextCloseTime = updates.closeTime !== undefined ? updates.closeTime : salesCloseTime;

    let nextArrDate = nextDate;
    if (nextArrTime < nextDepTime && nextArrTime.length === 5 && nextDepTime.length === 5) {
      const d = new Date(`${nextDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      nextArrDate = d.toISOString().slice(0, 10);
    }

    const currentOffset = tzOffset || '+07:00';
    setFlightForm((prev) => ({
      ...prev,
      departureAt: `${nextDate}T${nextDepTime}:00${currentOffset}`,
      arrivalAt: `${nextArrDate}T${nextArrTime}:00${currentOffset}`,
      salesCloseAt: nextCloseTime ? `${nextDate}T${nextCloseTime}:00${currentOffset}` : '',
    }));
  };

  const sameAircraftFlights = useMemo(() => {
    if (!flightForm.aircraftId || !flightDate) return [];
    return flights
      .filter((f) => {
        if (f.aircraft_id !== flightForm.aircraftId) return false;
        if (f.id === flightForm.flightId) return false;
        if (f.status === 'cancelled') return false;
        const depZ = parseZonedFlight(f.departure_at, operationalTz);
        const arrZ = parseZonedFlight(f.arrival_at, operationalTz);
        return depZ.dateStr === flightDate || arrZ.dateStr === flightDate;
      })
      .map((f) => {
        const depZ = parseZonedFlight(f.departure_at, operationalTz);
        const arrZ = parseZonedFlight(f.arrival_at, operationalTz);
        return {
          ...f,
          zonedDepDate: depZ.dateStr,
          zonedDepTime: depZ.timeStr,
          zonedArrDate: arrZ.dateStr,
          zonedArrTime: arrZ.timeStr,
          zonedDepMin: depZ.minutes,
          zonedArrMin:
            arrZ.dateStr === depZ.dateStr ? arrZ.minutes : arrZ.minutes + 1440,
        };
      })
      .sort((a, b) => new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime());
  }, [flights, flightForm.aircraftId, flightDate, flightForm.flightId, operationalTz]);

  const conflictingFlight = useMemo(() => {
    if (!flightForm.departureAt || !flightForm.arrivalAt) return null;
    const curDep = new Date(flightForm.departureAt).getTime();
    const curArr = new Date(flightForm.arrivalAt).getTime();
    if (isNaN(curDep) || isNaN(curArr) || curArr <= curDep) return null;

    return (
      sameAircraftFlights.find((f) => {
        const fDep = new Date(f.departure_at).getTime();
        const fArr = new Date(f.arrival_at).getTime();
        return curDep < fArr && curArr > fDep;
      }) ?? null
    );
  }, [flightForm.departureAt, flightForm.arrivalAt, sameAircraftFlights]);

  const freeSlots = useMemo(() => {
    if (!flightForm.aircraftId || !flightDate) return [];
    if (sameAircraftFlights.length === 0) {
      return [
        { label: bi('Sáng sớm: 06:00 ➔ 08:15', 'Early: 06:00 ➔ 08:15'), dep: '06:00', arr: '08:15' },
        { label: bi('Buổi sáng: 09:00 ➔ 11:15', 'Morning: 09:00 ➔ 11:15'), dep: '09:00', arr: '11:15' },
        { label: bi('Buổi trưa: 12:00 ➔ 14:15', 'Noon: 12:00 ➔ 14:15'), dep: '12:00', arr: '14:15' },
        { label: bi('Buổi chiều: 15:00 ➔ 17:15', 'Afternoon: 15:00 ➔ 17:15'), dep: '15:00', arr: '17:15' },
        { label: bi('Buổi tối: 18:30 ➔ 20:45', 'Evening: 18:30 ➔ 20:45'), dep: '18:30', arr: '20:45' },
      ];
    }

    const suggestions: { label: string; dep: string; arr: string }[] = [];
    const DAY_START_MIN = 5 * 60 + 30; // 05:30
    const DAY_END_MIN = 23 * 60 + 30; // 23:30
    const TURNAROUND_MIN = 40; // 40 minutes turnaround buffer
    const MIN_FLIGHT_MIN = 60; // minimum flight duration

    const formatFromMin = (min: number) => {
      const h = Math.floor(min / 60) % 24;
      const m = min % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // Slot 1: Before first flight
    const firstFlight = sameAircraftFlights[0];
    const firstDepMin = firstFlight.zonedDepMin;
    if (firstDepMin - DAY_START_MIN >= MIN_FLIGHT_MIN + TURNAROUND_MIN) {
      const depMin = DAY_START_MIN;
      const maxArrMin = firstDepMin - TURNAROUND_MIN;
      const arrMin = Math.min(depMin + 130, maxArrMin);
      if (arrMin > depMin) {
        suggestions.push({
          label: bi(
            `Trước ${firstFlight.flight_number}: ${formatFromMin(depMin)} ➔ ${formatFromMin(arrMin)}`,
            `Before ${firstFlight.flight_number}: ${formatFromMin(depMin)} ➔ ${formatFromMin(arrMin)}`,
          ),
          dep: formatFromMin(depMin),
          arr: formatFromMin(arrMin),
        });
      }
    }

    // Slots between consecutive flights
    for (let i = 0; i < sameAircraftFlights.length - 1; i++) {
      const prevFlight = sameAircraftFlights[i];
      const nextFlight = sameAircraftFlights[i + 1];
      const earliestDep = prevFlight.zonedArrMin + TURNAROUND_MIN;
      const latestArr = nextFlight.zonedDepMin - TURNAROUND_MIN;
      const gap = latestArr - earliestDep;
      if (gap >= MIN_FLIGHT_MIN) {
        const arr = Math.min(earliestDep + 130, latestArr);
        suggestions.push({
          label: bi(
            `Sau ${prevFlight.flight_number}: ${formatFromMin(earliestDep)} ➔ ${formatFromMin(arr)}`,
            `After ${prevFlight.flight_number}: ${formatFromMin(earliestDep)} ➔ ${formatFromMin(arr)}`,
          ),
          dep: formatFromMin(earliestDep),
          arr: formatFromMin(arr),
        });
      }
    }

    // Slot after last flight
    const lastFlight = sameAircraftFlights[sameAircraftFlights.length - 1];
    const lastArrMin = lastFlight.zonedArrMin + TURNAROUND_MIN;
    if (DAY_END_MIN - lastArrMin >= MIN_FLIGHT_MIN) {
      const depMin = lastArrMin;
      const arrMin = Math.min(depMin + 130, DAY_END_MIN);
      suggestions.push({
        label: bi(
          `Sau ${lastFlight.flight_number}: ${formatFromMin(depMin)} ➔ ${formatFromMin(arrMin)}`,
          `After ${lastFlight.flight_number}: ${formatFromMin(depMin)} ➔ ${formatFromMin(arrMin)}`,
        ),
        dep: formatFromMin(depMin),
        arr: formatFromMin(arrMin),
      });
    }

    return suggestions;
  }, [sameAircraftFlights, flightForm.aircraftId, flightDate, bi]);

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
    await invalidateFlightSearch(queryClient);
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
        .order('row_number', { ascending: true })
        .order('column_number', { ascending: true });
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
    const depAirportId = airports[0]?.id ?? '';
    const arrAirportId = airports[1]?.id ?? airports[0]?.id ?? '';
    const airportObj = airportById.get(depAirportId);
    const tz = airportObj?.timezone || 'Asia/Ho_Chi_Minh';
    const offset = getTimezoneOffsetString(new Date(), tz);

    setFlightForm({
      flightId: null,
      airlineId: firstAirline,
      aircraftId: matchingAircraft,
      flightNumber: '',
      departureAirportId: depAirportId,
      arrivalAirportId: arrAirportId,
      departureAt: `2026-06-15T08:00:00${offset}`,
      arrivalAt: `2026-06-15T10:10:00${offset}`,
      salesCloseAt: `2026-06-15T06:30:00${offset}`,
      status: 'scheduled',
      publish: true,
    });
    setShowFlightForm(true);
    setError(null);
    setInfo(null);
  };

  const openEditFlight = (item: FlightInstanceRow) => {
    const airportObj = airportById.get(item.departure_airport_id);
    const tz = airportObj?.timezone || 'Asia/Ho_Chi_Minh';
    const offset = getTimezoneOffsetString(item.departure_at, tz);
    const depZ = parseZonedFlight(item.departure_at, tz);
    const arrZ = parseZonedFlight(item.arrival_at, tz);
    const depIso = `${depZ.dateStr}T${depZ.timeStr}:00${offset}`;
    const arrIso = `${arrZ.dateStr}T${arrZ.timeStr}:00${offset}`;
    let closeIso = '';
    if (item.sales_close_at) {
      const closeZ = parseZonedFlight(item.sales_close_at, tz);
      closeIso = `${closeZ.dateStr}T${closeZ.timeStr}:00${offset}`;
    }

    setFlightForm({
      flightId: item.id,
      airlineId: item.airline_id,
      aircraftId: item.aircraft_id,
      flightNumber: item.flight_number,
      departureAirportId: item.departure_airport_id,
      arrivalAirportId: item.arrival_airport_id,
      departureAt: depIso,
      arrivalAt: arrIso,
      salesCloseAt: closeIso,
      status: item.status,
      publish: item.published_at != null,
    });
    setShowFlightForm(true);
    setError(null);
    setInfo(null);
  };

  const handleSaveFlight = async () => {
    if (conflictingFlight) {
      setError(
        bi(
          `Tàu bay này đang bị trùng lịch với chuyến bay ${conflictingFlight.flight_number} (${conflictingFlight.zonedDepTime} ➔ ${conflictingFlight.zonedArrTime}). Vui lòng chọn khung giờ khác!`,
          `Schedule conflict with flight ${conflictingFlight.flight_number} (${conflictingFlight.zonedDepTime} ➔ ${conflictingFlight.zonedArrTime}). Please choose another time!`,
        ),
      );
      return;
    }
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
    const tpl = CABIN_TEMPLATES.economy;
    const p = tpl.presets[0];
    setFareForm({
      fareId: null,
      flightId,
      fareCode: p.code,
      cabinClass: 'economy',
      name: bi(p.nameVi, p.nameEn),
      adultBaseAmount: String(p.adultBase),
      childBaseAmount: String(p.childBase),
      infantBaseAmount: String(p.infantBase),
      adultTaxAmount: String(p.adultTax),
      childTaxAmount: String(Math.round(p.adultTax * 0.7)),
      infantTaxAmount: '0',
      adultFeeAmount: String(p.adultFee),
      childFeeAmount: String(Math.round(p.adultFee * 0.8)),
      infantFeeAmount: '0',
      cabinPieces: String(p.cabinPieces),
      cabinKg: String(p.cabinKg),
      checkedPieces: String(p.checkedPieces),
      checkedKg: String(p.checkedKg),
      cancellationAllowed: p.cancellationAllowed,
      cancellationCutoffMinutes: String(p.cancellationCutoffMinutes),
      cancellationFeeAmount: String(p.cancellationFeeAmount),
      isActive: true,
    });
    setExpandedFareFlightId(flightId);
    setShowFareForm(true);
    setError(null);
    setInfo(null);
  };

  const applyCabinClassPreset = (cb: CabinClass, presetIdx = 0) => {
    const tpl = CABIN_TEMPLATES[cb];
    const p = tpl.presets[presetIdx] ?? tpl.presets[0];
    setFareForm((s) => ({
      ...s,
      cabinClass: cb,
      fareCode: p.code,
      name: bi(p.nameVi, p.nameEn),
      adultBaseAmount: String(p.adultBase),
      childBaseAmount: String(p.childBase),
      infantBaseAmount: String(p.infantBase),
      adultTaxAmount: String(p.adultTax),
      childTaxAmount: String(Math.round(p.adultTax * 0.7)),
      infantTaxAmount: '0',
      adultFeeAmount: String(p.adultFee),
      childFeeAmount: String(Math.round(p.adultFee * 0.8)),
      infantFeeAmount: '0',
      cabinPieces: String(p.cabinPieces),
      cabinKg: String(p.cabinKg),
      checkedPieces: String(p.checkedPieces),
      checkedKg: String(p.checkedKg),
      cancellationAllowed: p.cancellationAllowed,
      cancellationCutoffMinutes: String(p.cancellationCutoffMinutes),
      cancellationFeeAmount: String(p.cancellationFeeAmount),
    }));
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


  return (
    <AdminShell
      activeSection="flights"
      title={bi('Quản lý Lịch bay, Bảng giá & Kho ghế', 'Flight Schedules, Fares & Seat Inventory')}
      subtitle={bi(
        'Tạo lịch bay theo múi giờ sân bay IANA, đóng/mở bán chuyến bay an toàn, quản lý hạng vé (flight_fares) và khóa/mở ghế (flight_seats).',
        'Schedule flights with IANA airport timezones, stop/reopen sales safely, manage flight_fares, and block/unblock flight_seats.',
      )}
      onQuickSearch={(txt) => {
        setQuery(txt);
        setPage(1);
      }}
    >
      <AdminToast text={info} success onClose={() => setInfo(null)} />
      <AdminToast text={error} error onClose={() => setError(null)} />

      {flightsQuery.isError && !error && (
        <View style={adminStyles.card}>
          <Notice text={formatAdminError(flightsQuery.error, language)} />
          <Pressable
            accessibilityRole="button"
            onPress={() => void flightsQuery.refetch()}
            style={adminStyles.secondaryBtnSmall}
          >
            <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.retry')}</Text>
          </Pressable>
        </View>
      )}

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

          {/* Lịch trình tàu bay & Kiểm tra trùng lịch */}
          <View style={{
            backgroundColor: conflictingFlight ? '#FEF2F2' : '#F0FDFA',
            borderColor: conflictingFlight ? '#FCA5A5' : '#5EEAD4',
            borderWidth: 1.5,
            borderRadius: 12,
            padding: 14,
            gap: 10,
            marginVertical: 4,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '700',
                color: conflictingFlight ? '#B91C1C' : '#0F766E',
              }}>
                {conflictingFlight ? '⚠️ ' + bi('TRÙNG LỊCH TÀU BAY!', 'AIRCRAFT SCHEDULE CONFLICT!') : '✈️ ' + bi('Lịch trình tàu bay trong ngày', 'Aircraft Daily Schedule')}
              </Text>
              <Text style={{ fontSize: 12, color: conflictingFlight ? '#991B1B' : '#115E59' }}>
                {bi('Ngày:', 'Date:')} {flightDate}
              </Text>
            </View>

            {conflictingFlight && (
              <Text style={{ fontSize: 13, color: '#991B1B', lineHeight: 18, fontWeight: '600' }}>
                {bi(
                  `Chuyến bay này đang bị trùng giờ với chuyến ${conflictingFlight.flight_number} (${conflictingFlight.zonedDepTime} ➔ ${conflictingFlight.zonedArrTime}). Vui lòng chọn khung giờ khác!`,
                  `Conflicts with flight ${conflictingFlight.flight_number} (${conflictingFlight.zonedDepTime} ➔ ${conflictingFlight.zonedArrTime}). Please select another time slot!`,
                )}
              </Text>
            )}

            {/* Các chuyến bay hiện có trong ngày */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: conflictingFlight ? '#7F1D1D' : '#134E4A' }}>
                {bi('Các chuyến bay đã xếp cho tàu bay này trong ngày:', 'Scheduled flights for this aircraft today:')}
              </Text>
              {sameAircraftFlights.length === 0 ? (
                <Text style={{ fontSize: 13, color: '#0D9488', fontStyle: 'italic' }}>
                  {bi('✨ Tàu bay hoàn toàn rảnh rỗi cả ngày (Chưa có chuyến bay nào).', '✨ Aircraft is completely free all day (No flights scheduled).')}
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {sameAircraftFlights.map((f) => (
                    <View
                      key={f.id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#CCFBF1',
                        borderWidth: 1,
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: '#134E4A', fontWeight: '600' }}>
                        🛫 {f.flight_number}: {f.zonedDepTime} ➔ {f.zonedArrTime}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Gợi ý khung giờ rảnh */}
            <View style={{ gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: conflictingFlight ? '#991B1B' : '#0F766E' }}>
                💡 {bi('Gợi ý khung giờ tàu bay rảnh (Bấm vào để chọn nhanh):', 'Suggested free slots (Tap to apply):')}
              </Text>
              {freeSlots.length === 0 ? (
                <Text style={{ fontSize: 12, color: '#64748B' }}>
                  {bi('Tàu bay đã kín lịch các khung giờ chính trong ngày.', 'No large free gaps found for this aircraft today.')}
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {freeSlots.map((slot, idx) => (
                    <Pressable
                      key={idx}
                      accessibilityRole="button"
                      onPress={() => {
                        const [h, m] = slot.dep.split(':').map(Number);
                        let closeH = h - 1;
                        if (closeH < 0) closeH += 24;
                        const autoClose = `${String(closeH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        updateDateTime({ depTime: slot.dep, arrTime: slot.arr, closeTime: autoClose });
                      }}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#0D9488',
                        borderWidth: 1.5,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#0D9488' }}>
                        ⚡ {slot.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Chọn ngày bay thân thiện */}
          <View style={adminStyles.fieldGroup}>
            <Text style={adminStyles.label}>{bi('Ngày bay (YYYY-MM-DD)', 'Flight Date (YYYY-MM-DD)')}</Text>
            <TextInput
              value={flightDate}
              onChangeText={(val) => updateDateTime({ date: val })}
              style={adminStyles.input}
              placeholder="2026-06-15"
            />
            <View style={adminStyles.chipRow}>
              {[
                { label: bi('Hôm nay', 'Today'), days: 0 },
                { label: bi('Ngày mai', 'Tomorrow'), days: 1 },
                { label: bi('+3 ngày', '+3 days'), days: 3 },
                { label: bi('+1 tuần', '+1 week'), days: 7 },
                { label: bi('+1 tháng', '+1 month'), days: 30 },
              ].map((preset) => (
                <Pressable
                  key={preset.days}
                  accessibilityRole="button"
                  onPress={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + preset.days);
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    updateDateTime({ date: `${yyyy}-${mm}-${dd}` });
                  }}
                  style={adminStyles.chip}
                >
                  <Text style={adminStyles.chipText}>{preset.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Giờ cất cánh & Giờ hạ cánh */}
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <View style={[adminStyles.fieldGroup, { flex: 1, minWidth: 160 }]}>
              <Text style={adminStyles.label}>{bi('Giờ cất cánh (HH:mm)', 'Departure Time (HH:mm)')}</Text>
              <TextInput
                value={departureTime}
                onChangeText={(val) => updateDateTime({ depTime: val })}
                style={adminStyles.input}
                placeholder="08:00"
              />
              <View style={adminStyles.chipRow}>
                {['06:00', '08:00', '10:30', '13:00', '15:30', '18:00', '20:30'].map((time) => (
                  <Pressable
                    key={time}
                    accessibilityRole="button"
                    onPress={() => updateDateTime({ depTime: time })}
                    style={[adminStyles.chip, departureTime === time && adminStyles.chipSelected]}
                  >
                    <Text style={[adminStyles.chipText, departureTime === time && adminStyles.chipTextSelected]}>
                      {time}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={[adminStyles.fieldGroup, { flex: 1, minWidth: 160 }]}>
              <Text style={adminStyles.label}>{bi('Giờ hạ cánh (HH:mm)', 'Arrival Time (HH:mm)')}</Text>
              <TextInput
                value={arrivalTime}
                onChangeText={(val) => updateDateTime({ arrTime: val })}
                style={adminStyles.input}
                placeholder="10:10"
              />
              <View style={adminStyles.chipRow}>
                {[
                  { label: '+1h15m', minutes: 75 },
                  { label: '+2h10m (SGN-HAN)', minutes: 130 },
                  { label: '+2h30m', minutes: 150 },
                ].map((preset) => (
                  <Pressable
                    key={preset.minutes}
                    accessibilityRole="button"
                    onPress={() => {
                      const [h, m] = departureTime.split(':').map(Number);
                      if (!isNaN(h) && !isNaN(m)) {
                        const total = h * 60 + m + preset.minutes;
                        const newH = Math.floor(total / 60) % 24;
                        const newM = total % 60;
                        const formatted = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
                        updateDateTime({ arrTime: formatted });
                      }
                    }}
                    style={adminStyles.chip}
                  >
                    <Text style={adminStyles.chipText}>{preset.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Thời điểm đóng bán vé */}
          <View style={adminStyles.fieldGroup}>
            <Text style={adminStyles.label}>
              {bi('Thời điểm đóng bán vé (tùy chọn - HH:mm)', 'Sales Close Time (optional - HH:mm)')}
            </Text>
            <TextInput
              value={salesCloseTime}
              onChangeText={(val) => updateDateTime({ closeTime: val })}
              style={adminStyles.input}
              placeholder="06:30"
            />
            <View style={adminStyles.chipRow}>
              {[
                { label: bi('Trước bay 1 tiếng', '1h before'), minutes: 60 },
                { label: bi('Trước bay 1.5 tiếng', '1.5h before'), minutes: 90 },
                { label: bi('Trước bay 2 tiếng', '2h before'), minutes: 120 },
              ].map((preset) => (
                <Pressable
                  key={preset.minutes}
                  accessibilityRole="button"
                  onPress={() => {
                    const [h, m] = departureTime.split(':').map(Number);
                    if (!isNaN(h) && !isNaN(m)) {
                      let total = h * 60 + m - preset.minutes;
                      if (total < 0) total += 24 * 60;
                      const newH = Math.floor(total / 60) % 24;
                      const newM = total % 60;
                      const formatted = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
                      updateDateTime({ closeTime: formatted });
                    }
                  }}
                  style={adminStyles.chip}
                >
                  <Text style={adminStyles.chipText}>{preset.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Nút xem/tùy chỉnh chuỗi ISO 8601 nâng cao */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowAdvancedIso((v) => !v)}
            style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
          >
            <Text style={{ fontSize: 12, color: '#007E91', fontWeight: '600' }}>
              {showAdvancedIso
                ? bi('▲ Thu gọn định dạng ISO 8601', '▲ Hide ISO 8601 format')
                : bi('▼ Xem & Tùy chỉnh chuỗi ISO 8601 nâng cao', '▼ View & Custom ISO 8601 string')}
            </Text>
          </Pressable>

          {showAdvancedIso && (
            <View style={{ gap: 8, padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <AdminTextField
                label={bi('Giờ khởi hành (ISO 8601)', 'Departure Timestamp (ISO 8601)')}
                value={flightForm.departureAt}
                onChangeText={(text) => setFlightForm((s) => ({ ...s, departureAt: text }))}
                placeholder="2026-06-15T08:00:00+07:00"
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
            </View>
          )}

          {/* Trạng thái vận hành tiếng Việt */}
          <View style={adminStyles.fieldGroup}>
            <Text style={adminStyles.label}>{bi('Trạng thái vận hành', 'Flight Status')}</Text>
            <View style={adminStyles.chipRow}>
              {FLIGHT_STATUS_OPTIONS.map((st) => {
                const selected = flightForm.status === st.key;
                return (
                  <Pressable
                    key={st.key}
                    accessibilityRole="button"
                    onPress={() => setFlightForm((s) => ({ ...s, status: st.key }))}
                    style={[adminStyles.chip, selected && adminStyles.chipSelected]}
                  >
                    <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                      {st.icon} {bi(st.vi, st.en)}
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

          {/* HẠNG KHOANG */}
          <View style={adminStyles.fieldGroup}>
            <Text style={adminStyles.label}>{bi('Hạng khoang (cabin_class)', 'Cabin Class')}</Text>
            <View style={adminStyles.chipRow}>
              {(['economy', 'premium_economy', 'business', 'first'] as CabinClass[]).map((cb) => {
                const selected = fareForm.cabinClass === cb;
                const info = getCabinInfo(cb, bi);
                return (
                  <Pressable
                    key={cb}
                    accessibilityRole="button"
                    onPress={() => applyCabinClassPreset(cb, 0)}
                    style={[
                      adminStyles.chip,
                      selected && {
                        backgroundColor: info.bgColor,
                        borderColor: info.color,
                        borderWidth: 1.5,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        adminStyles.chipText,
                        selected && { color: info.color, fontWeight: '700' },
                      ]}
                    >
                      {info.icon} {info.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Quick preset packages for selected cabin */}
            <View style={{ gap: 4, marginTop: 4 }}>
              <Text style={{ fontSize: 12, color: '#0F766E', fontWeight: '700' }}>
                💡 {bi(`Gói giá vé mẫu cho ${getCabinInfo(fareForm.cabinClass, bi).shortLabel} (Bấm để áp dụng nhanh tên & giá):`, `Preset packages for ${getCabinInfo(fareForm.cabinClass, bi).shortLabel} (Tap to apply):`)}
              </Text>
              <View style={adminStyles.chipRow}>
                {CABIN_TEMPLATES[fareForm.cabinClass].presets.map((preset, idx) => {
                  const isSelected = fareForm.fareCode === preset.code;
                  return (
                    <Pressable
                      key={preset.code}
                      accessibilityRole="button"
                      onPress={() => applyCabinClassPreset(fareForm.cabinClass, idx)}
                      style={[
                        adminStyles.chip,
                        isSelected && adminStyles.chipSelected,
                        { borderColor: isSelected ? '#0D9488' : '#CBD5E1' },
                      ]}
                    >
                      <Text
                        style={[
                          adminStyles.chipText,
                          isSelected && adminStyles.chipTextSelected,
                        ]}
                      >
                        ⚡ {bi(preset.nameVi, preset.nameEn)} ({preset.code})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <AdminTextField
            label={bi('Mã hạng vé (fare_code)', 'Fare Code')}
            value={fareForm.fareCode}
            onChangeText={(text) => setFareForm((s) => ({ ...s, fareCode: text }))}
            placeholder="ECO_SAVER"
            autoCapitalize="characters"
          />

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
                          ? bi(`Đang mở bán (${formatFlightStatus(flight.status, bi)})`, `Open (${flight.status})`)
                          : bi(`Ngừng mở bán (${formatFlightStatus(flight.status, bi)})`, `Closed (${flight.status})`)
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
                  <FlightSeatsManager
                    flight={flight}
                    seats={flightSeats}
                    seatFeeDrafts={seatFeeDrafts}
                    setSeatFeeDrafts={setSeatFeeDrafts}
                    busy={busy}
                    money={money}
                    ta={ta}
                    bi={bi}
                    onUpdateSeat={(seat, nextBlocked) =>
                      handleUpdateFlightSeat(flight.id, seat, nextBlocked)
                    }
                    onReloadSeats={() => loadFlightSeats(flight.id)}
                  />
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
