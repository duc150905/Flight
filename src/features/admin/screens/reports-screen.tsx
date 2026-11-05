import { loadAllRows, loadAllAuditLogs } from '../complete-data';
import { useState } from 'react';
import { loadAdminAccounts } from '../account-service';
import { loadAdminPaymentLedger } from '../reconciliation-data';
import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { ActionButton, Notice } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import { useAdminI18n } from '../i18n';
import {
  filterAndPaginate,
  formatAdminError,
  summarizeAdminBookingsAndRevenue,
  type AddonProductRow,
  type AirlineRow,
  type AirportRow,
  type ProfileRow,
} from '../model';
import {
  type AdminAuditLogRow,
  type AircraftRow,
  type FlightInstanceRow,
} from '../rpc';
import {
  AdminLoadingState,
  AdminPaginationBar,
  AdminSearchFilterBar,
  AdminShell,
  AdminStatusBadge,
  adminStyles,
} from '../ui';

type ReportTab = 'revenue' | 'audit';

async function loadReportsAndAuditBundle() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const [
    bookings,
    payments,
    refunds,
    profiles,
    flights,
    airports,
    airlines,
    aircraft,
    addonProducts,
    auditLogs,
    accounts,
  ] = await Promise.all([
    loadAllRows((from, to) => (supabase!
      .from('bookings')
      .select('id,status,total_amount,created_at,confirmed_at')
      .order('created_at', { ascending: false })).order('id').range(from, to)),
    loadAdminPaymentLedger(supabase),
    loadAllRows((from, to) => (supabase!.from('refunds').select('id,status,amount,created_at,completed_at')).order('id').range(from, to)),
    loadAllRows((from, to) => (supabase!.from('profiles').select('id,full_name,contact_phone,created_at')).order('id').range(from, to)),
    loadAllRows((from, to) => (supabase!
      .from('flight_instances')
      .select('id,flight_number,departure_airport_id,arrival_airport_id,departure_at')).order('id').range(from, to)),
    loadAllRows((from, to) => (supabase!.from('airports').select('id,iata_code,name,city')).order('id').range(from, to)),
    loadAllRows((from, to) => (supabase!.from('airlines').select('id,iata_code,name')).order('id').range(from, to)),
    loadAllRows((from, to) => (supabase!.from('aircraft').select('id,registration_code,model_name')).order('id').range(from, to)),
    loadAllRows((from, to) => (supabase!.from('addon_products').select('id,code,name')).order('id').range(from, to)),
    loadAllAuditLogs(supabase),
    loadAdminAccounts(supabase),
  ]);

  const firstError =
    bookings.error ??
    refunds.error ??
    profiles.error ??
    flights.error ??
    airports.error ??
    airlines.error ??
    aircraft.error ??
    addonProducts.error;
  if (firstError) throw firstError;

  return {
    bookings: bookings.data ?? [],
    payments,
    refunds: refunds.data ?? [],
    profiles: (profiles.data ?? []) as Pick<
      ProfileRow,
      'id' | 'full_name' | 'contact_phone' | 'created_at'
    >[],
    flights: (flights.data ?? []) as Pick<
      FlightInstanceRow,
      'id' | 'flight_number' | 'departure_airport_id' | 'arrival_airport_id' | 'departure_at'
    >[],
    airports: (airports.data ?? []) as Pick<AirportRow, 'id' | 'iata_code' | 'name' | 'city'>[],
    airlines: (airlines.data ?? []) as Pick<AirlineRow, 'id' | 'iata_code' | 'name'>[],
    aircraft: (aircraft.data ?? []) as Pick<
      AircraftRow,
      'id' | 'registration_code' | 'model_name'
    >[],
    addonProducts: (addonProducts.data ?? []) as Pick<AddonProductRow, 'id' | 'code' | 'name'>[],
    auditLogs,
    accounts,
    fetchedAtMs: Date.now(),
  };
}

type AuditLookupContext = {
  flightById: Map<
    string,
    Pick<
      FlightInstanceRow,
      'id' | 'flight_number' | 'departure_airport_id' | 'arrival_airport_id' | 'departure_at'
    >
  >;
  airportById: Map<string, Pick<AirportRow, 'id' | 'iata_code' | 'name' | 'city'>>;
  airlineById: Map<string, Pick<AirlineRow, 'id' | 'iata_code' | 'name'>>;
  aircraftById: Map<string, Pick<AircraftRow, 'id' | 'registration_code' | 'model_name'>>;
  addonById: Map<string, Pick<AddonProductRow, 'id' | 'code' | 'name'>>;
  profileById: Map<
    string,
    Pick<ProfileRow, 'id' | 'full_name' | 'contact_phone' | 'created_at'>
  >;
  bi: (vi: string, en: string) => string;
  money: (amount: number, currency?: string) => string;
  airportTime: (instant: string, timezone: string) => string;
};

type ChangeComparisonItem = {
  field: string;
  before: string;
  after: string;
};

type HumanAuditDescription = {
  categoryLabel: string;
  title: string;
  badgeLabel: string;
  badgeActive: boolean;
  targetDescription: string;
  comparisons: ChangeComparisonItem[];
  actorLabel: string;
  searchTokens: string;
};

function asRecord(val: unknown): Record<string, unknown> {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

function formatFlightStatusLabel(status: string, bi: (vi: string, en: string) => string): string {
  switch (status) {
    case 'scheduled':
      return bi('Đang mở bán (Scheduled)', 'Scheduled');
    case 'draft':
      return bi('Bản nháp (Draft)', 'Draft');
    case 'delayed':
      return bi('Chậm chuyến (Delayed)', 'Delayed');
    case 'departed':
      return bi('Đã cất cánh (Departed)', 'Departed');
    case 'arrived':
      return bi('Đã hạ cánh (Arrived)', 'Arrived');
    case 'cancelled':
      return bi('Đã hủy (Cancelled)', 'Cancelled');
    default:
      return status;
  }
}

function formatCabinLabel(cabin: string, bi: (vi: string, en: string) => string): string {
  switch (cabin) {
    case 'first':
      return bi('Hạng Nhất (First)', 'First Class');
    case 'business':
      return bi('Thương gia (Business)', 'Business Class');
    case 'premium_economy':
      return bi('Phổ thông Đặc biệt (Premium Eco)', 'Premium Economy');
    case 'economy':
      return bi('Phổ thông (Economy)', 'Economy');
    default:
      return cabin;
  }
}

function formatFieldVal(
  key: string,
  val: unknown,
  ctx: AuditLookupContext,
): string {
  const { bi, money, airportTime } = ctx;
  if (val === null || val === undefined || val === '') {
    return bi('Trống', 'Empty');
  }
  if (key === 'is_active') {
    return val ? bi('Đang hoạt động', 'Active') : bi('Ngừng hoạt động', 'Inactive');
  }
  if (key === 'open_sales') {
    return val
      ? bi('Đang mở bán trực tuyến', 'Open for online sales')
      : bi('Ngừng mở bán trực tuyến', 'Closed for online sales');
  }
  if (key === 'is_blocked') {
    return val
      ? bi('Đã khóa ghế (Không cho chọn)', 'Blocked from selection')
      : bi('Đang mở (Cho phép chọn)', 'Available for selection');
  }
  if (key === 'status' && typeof val === 'string') {
    return formatFlightStatusLabel(val, bi);
  }
  if (key === 'cabin_class' && typeof val === 'string') {
    return formatCabinLabel(val, bi);
  }
  if (
    (key === 'departure_at' || key === 'arrival_at' || key === 'sales_close_at') &&
    typeof val === 'string'
  ) {
    return airportTime(val, 'Asia/Ho_Chi_Minh');
  }
  if (
    (key === 'adult_base_amount' ||
      key === 'child_base_amount' ||
      key === 'infant_base_amount' ||
      key === 'selection_fee_amount' ||
      key === 'unit_amount') &&
    typeof val === 'number'
  ) {
    return money(val);
  }
  return String(val);
}

function buildAuditComparisons(
  log: AdminAuditLogRow,
  changes: Record<string, unknown>,
  ctx: AuditLookupContext,
): ChangeComparisonItem[] {
  const { bi, money, airportTime } = ctx;
  const comparisons: ChangeComparisonItem[] = [];

  const beforeObj =
    changes.before && typeof changes.before === 'object' && !Array.isArray(changes.before)
      ? (changes.before as Record<string, unknown>)
      : null;
  const afterObj =
    changes.after && typeof changes.after === 'object' && !Array.isArray(changes.after)
      ? (changes.after as Record<string, unknown>)
      : null;

  // 1. If explicit before & after snapshots exist in safe_changes, diff all tracked fields
  if (
    beforeObj &&
    afterObj &&
    log.action !== 'flight.close_sales' &&
    log.action !== 'flight.open_sales'
  ) {
    const fieldDefinitions: { key: string; label: string }[] = [
      { key: 'open_sales', label: bi('Trạng thái mở bán vé', 'Ticket sales status') },
      { key: 'is_active', label: bi('Trạng thái hoạt động', 'Active status') },
      { key: 'status', label: bi('Trạng thái chuyến bay', 'Flight status') },
      { key: 'departure_at', label: bi('Giờ khởi hành', 'Departure time') },
      { key: 'arrival_at', label: bi('Giờ hạ cánh', 'Arrival time') },
      { key: 'flight_number', label: bi('Số hiệu chuyến bay', 'Flight number') },
      { key: 'iata_code', label: bi('Mã IATA', 'IATA code') },
      { key: 'name', label: bi('Tên gọi', 'Name') },
      { key: 'city', label: bi('Thành phố', 'City') },
      { key: 'timezone', label: bi('Múi giờ IANA', 'IANA Timezone') },
      { key: 'registration_code', label: bi('Số đăng bạ tàu bay', 'Registration code') },
      { key: 'model_name', label: bi('Dòng máy bay', 'Aircraft model') },
      { key: 'fare_code', label: bi('Mã hạng vé', 'Fare code') },
      { key: 'cabin_class', label: bi('Hạng khoang', 'Cabin class') },
      { key: 'adult_base_amount', label: bi('Giá cơ bản người lớn', 'Adult base fare') },
      { key: 'child_base_amount', label: bi('Giá cơ bản trẻ em', 'Child base fare') },
      { key: 'infant_base_amount', label: bi('Giá cơ bản em bé', 'Infant base fare') },
      { key: 'is_blocked', label: bi('Trạng thái khóa ghế', 'Seat block status') },
      { key: 'selection_fee_amount', label: bi('Phí chọn ghế', 'Seat selection fee') },
      { key: 'unit_amount', label: bi('Đơn giá dịch vụ', 'Service unit price') },
      { key: 'weight_kg', label: bi('Trọng lượng hành lý (kg)', 'Baggage weight (kg)') },
    ];

    for (const def of fieldDefinitions) {
      if (def.key in beforeObj || def.key in afterObj) {
        const bVal = beforeObj[def.key];
        const aVal = afterObj[def.key];
        if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
          comparisons.push({
            field: def.label,
            before: formatFieldVal(def.key, bVal, ctx),
            after: formatFieldVal(def.key, aVal, ctx),
          });
        }
      }
    }

    if (comparisons.length > 0) {
      return comparisons;
    }
  }

  // 2. Fallback inference for existing audit logs (recorded before explicit `before` snapshot) or create actions
  if (log.action === 'flight.close_sales') {
    comparisons.push({
      field: bi('Trạng thái mở bán vé', 'Ticket sales status'),
      before: bi('Đang mở bán', 'Open for sales'),
      after: bi('Ngừng mở bán', 'Closed for sales'),
    });
    return comparisons;
  }

  if (log.action === 'flight.open_sales') {
    comparisons.push({
      field: bi('Trạng thái mở bán vé', 'Ticket sales status'),
      before: bi('Ngừng mở bán', 'Closed for sales'),
      after: bi('Đang mở bán', 'Open for sales'),
    });
    return comparisons;
  }

  if (log.action === 'flight_seat.update') {
    const seatCode = typeof changes.seat_code === 'string' ? ` (${changes.seat_code})` : '';
    if (typeof changes.is_blocked === 'boolean') {
      comparisons.push({
        field: bi(`Trạng thái ghế${seatCode}`, `Seat status${seatCode}`),
        before: changes.is_blocked
          ? bi('Đang mở (Cho phép chọn)', 'Available for selection')
          : bi('Đã khóa ghế (Không cho chọn)', 'Blocked from selection'),
        after: changes.is_blocked
          ? bi('Đã khóa ghế (Không cho chọn)', 'Blocked from selection')
          : bi('Đang mở (Cho phép chọn)', 'Available for selection'),
      });
    }
    if (typeof changes.selection_fee_amount === 'number') {
      comparisons.push({
        field: bi(`Phí chọn ghế${seatCode}`, `Selection fee${seatCode}`),
        before: bi('Mức phí trước cập nhật', 'Previous fee'),
        after: money(changes.selection_fee_amount),
      });
    }
    return comparisons;
  }

  if (log.action === 'seats.upsert_template') {
    comparisons.push({
      field: bi('Sơ đồ ghế mẫu tàu bay', 'Aircraft seat template'),
      before: bi('Cấu hình sơ đồ ghế trước đó', 'Previous seat template'),
      after: bi(
        `Lưu thành công ${Number(changes.upserted_seat_count ?? 0)} ghế mẫu`,
        `Saved ${Number(changes.upserted_seat_count ?? 0)} template seats`,
      ),
    });
    return comparisons;
  }

  if (log.action.endsWith('.create') || log.action.endsWith('.insert')) {
    const summaryParts: string[] = [];
    if (typeof changes.flight_number === 'string') summaryParts.push(changes.flight_number);
    if (typeof changes.registration_code === 'string') summaryParts.push(changes.registration_code);
    if (typeof changes.fare_code === 'string') summaryParts.push(changes.fare_code);
    if (typeof changes.adult_base_amount === 'number')
      summaryParts.push(money(changes.adult_base_amount));
    if (typeof changes.is_active === 'boolean') {
      summaryParts.push(
        changes.is_active ? bi('Đang hoạt động', 'Active') : bi('Ngừng hoạt động', 'Inactive'),
      );
    }
    comparisons.push({
      field: bi('Khởi tạo dữ liệu', 'Record creation'),
      before: bi('Chưa tồn tại (Tạo mới)', 'Did not exist (New)'),
      after:
        summaryParts.length > 0
          ? summaryParts.join(' · ')
          : bi('Đã tạo mới & kích hoạt', 'Created & active'),
    });
    return comparisons;
  }

  // Generic update fallback (e.g. airports.update, airlines.update, aircraft.update, fare.update, flight.update)
  if (typeof changes.is_active === 'boolean') {
    comparisons.push({
      field: bi('Trạng thái hoạt động', 'Active status'),
      before: changes.is_active
        ? bi('Ngừng hoạt động', 'Inactive')
        : bi('Đang hoạt động', 'Active'),
      after: changes.is_active
        ? bi('Đang hoạt động', 'Active')
        : bi('Ngừng hoạt động', 'Inactive'),
    });
  }
  if (typeof changes.status === 'string') {
    comparisons.push({
      field: bi('Trạng thái chuyến bay', 'Flight status'),
      before: bi('Trạng thái trước cập nhật', 'Previous flight status'),
      after: formatFlightStatusLabel(changes.status, bi),
    });
  }
  if (typeof changes.adult_base_amount === 'number') {
    comparisons.push({
      field: bi(
        `Giá vé người lớn${typeof changes.fare_code === 'string' ? ` (${changes.fare_code})` : ''}`,
        `Adult base fare${typeof changes.fare_code === 'string' ? ` (${changes.fare_code})` : ''}`,
      ),
      before: bi('Mức giá trước cập nhật', 'Previous fare amount'),
      after: money(changes.adult_base_amount),
    });
  }
  if (typeof changes.departure_at === 'string') {
    comparisons.push({
      field: bi('Giờ khởi hành', 'Departure time'),
      before: bi('Lịch khởi hành trước cập nhật', 'Previous departure time'),
      after: airportTime(changes.departure_at, 'Asia/Ho_Chi_Minh'),
    });
  }

  if (log.entity_type === 'user_roles') {
    if (log.action === 'role.grant' || log.action === 'role.revoke') {
      comparisons.push({
        field: bi('Vai trò tài khoản', 'Account Role'),
        before:
          log.action === 'role.grant'
            ? bi('Khách hàng (Customer)', 'Customer')
            : bi('Quản trị viên (Admin)', 'Administrator'),
        after:
          log.action === 'role.grant'
            ? bi('Quản trị viên (Admin)', 'Administrator')
            : bi('Khách hàng (Customer)', 'Customer'),
      });
    } else if (log.action === 'role.suspend' || log.action === 'role.reactivate') {
      comparisons.push({
        field: bi('Trạng thái tài khoản', 'Account Status'),
        before:
          log.action === 'role.suspend'
            ? bi('Đang hoạt động (Active)', 'Active')
            : bi('Đã tạm dừng (Suspended)', 'Suspended'),
        after:
          log.action === 'role.suspend'
            ? bi('Đã tạm dừng (Suspended)', 'Suspended')
            : bi('Đang hoạt động (Active)', 'Active'),
      });
    }
  }

  return comparisons;
}

function describeAuditLog(
  log: AdminAuditLogRow,
  ctx: AuditLookupContext,
): HumanAuditDescription {
  const { bi } = ctx;
  const changes = asRecord(log.safe_changes);

  const formatFlightLabel = (flightId: string | null | undefined): string | null => {
    if (!flightId) return null;
    const fl = ctx.flightById.get(flightId);
    if (!fl) return null;
    const dep = ctx.airportById.get(fl.departure_airport_id)?.iata_code ?? '???';
    const arr = ctx.airportById.get(fl.arrival_airport_id)?.iata_code ?? '???';
    return `${fl.flight_number} (${dep} → ${arr})`;
  };

  const formatAircraftLabel = (aircraftId: string | null | undefined): string | null => {
    if (!aircraftId) return null;
    const ac = ctx.aircraftById.get(aircraftId);
    if (!ac) return null;
    return `${ac.registration_code} · ${ac.model_name}`;
  };

  // Resolve actor
  const actorProfile = log.actor_user_id ? ctx.profileById.get(log.actor_user_id) : undefined;
  const shortActorId = log.actor_user_id ? `#${log.actor_user_id.slice(0, 8)}` : '';
  const actorLabel = actorProfile?.full_name?.trim()
    ? `${actorProfile.full_name.trim()} (${shortActorId})`
    : log.actor_user_id
      ? bi(`Quản trị viên (${shortActorId})`, `Administrator (${shortActorId})`)
      : bi('Hệ thống tự động', 'System');

  // Resolve category label
  const categoryMap: Record<string, string> = {
    flight_instances: bi('Chuyến bay', 'Flight Schedule'),
    flight_fares: bi('Bảng giá vé', 'Flight Fares'),
    flight_seats: bi('Kho ghế chuyến bay', 'Flight Seat Inventory'),
    aircraft: bi('Tàu bay & Sơ đồ ghế', 'Aircraft & Seat Map'),
    seats: bi('Sơ đồ ghế mẫu', 'Template Seat Map'),
    airports: bi('Danh mục Sân bay', 'Airport Catalogue'),
    airlines: bi('Danh mục Hãng bay', 'Airline Catalogue'),
    destinations: bi('Điểm đến nổi bật', 'Featured Destination'),
    addon_products: bi('Sản phẩm Dịch vụ', 'Add-on Product'),
    flight_addon_offers: bi('Gói Dịch vụ chuyến bay', 'Flight Add-on Offer'),
    user_roles: bi('Phân quyền & Tài khoản', 'Access Control & Roles'),
  };
  const categoryLabel = categoryMap[log.entity_type] ?? log.entity_type;

  // Resolve target entity description
  const directFlightLabel =
    log.entity_type === 'flight_instances'
      ? formatFlightLabel(log.entity_id)
      : typeof changes.flight_id === 'string'
        ? formatFlightLabel(changes.flight_id)
        : null;

  const directAircraftLabel =
    log.entity_type === 'aircraft' || log.entity_type === 'seats'
      ? formatAircraftLabel(log.entity_id)
      : typeof changes.aircraft_id === 'string'
        ? formatAircraftLabel(changes.aircraft_id)
        : null;

  let targetDescription = '';
  if (directFlightLabel) {
    targetDescription = bi(`Chuyến bay ${directFlightLabel}`, `Flight ${directFlightLabel}`);
  } else if (directAircraftLabel) {
    targetDescription = bi(`Tàu bay ${directAircraftLabel}`, `Aircraft ${directAircraftLabel}`);
  } else if (log.entity_type === 'airports' && log.entity_id) {
    const ap = ctx.airportById.get(log.entity_id);
    targetDescription = ap
      ? bi(`Sân bay ${ap.iata_code} — ${ap.name} (${ap.city})`, `Airport ${ap.iata_code} — ${ap.name}`)
      : bi(`Sân bay (Mã #${log.entity_id.slice(0, 8)})`, `Airport (#${log.entity_id.slice(0, 8)})`);
  } else if (log.entity_type === 'airlines' && log.entity_id) {
    const al = ctx.airlineById.get(log.entity_id);
    targetDescription = al
      ? bi(`Hãng hàng không ${al.iata_code} — ${al.name}`, `Airline ${al.iata_code} — ${al.name}`)
      : bi(`Hãng hàng không (Mã #${log.entity_id.slice(0, 8)})`, `Airline (#${log.entity_id.slice(0, 8)})`);
  } else if (log.entity_type === 'addon_products' && log.entity_id) {
    const ad = ctx.addonById.get(log.entity_id);
    targetDescription = ad
      ? bi(`Dịch vụ ${ad.code} — ${ad.name}`, `Add-on ${ad.code} — ${ad.name}`)
      : bi(`Dịch vụ bổ sung (#${log.entity_id.slice(0, 8)})`, `Add-on (#${log.entity_id.slice(0, 8)})`);
  } else if (log.entity_type === 'user_roles') {
    const tName =
      typeof changes.target_name === 'string'
        ? changes.target_name
        : typeof changes.account === 'string'
          ? changes.account
          : log.entity_id
            ? ctx.profileById.get(log.entity_id)?.full_name ?? `#${log.entity_id.slice(0, 8)}`
            : bi('Tài khoản người dùng', 'User account');
    const tEmail = typeof changes.email === 'string' ? ` (${changes.email})` : '';
    targetDescription = `${tName}${tEmail}`;
  } else if (log.entity_id) {
    targetDescription = `${categoryLabel} (#${log.entity_id.slice(0, 8)})`;
  } else {
    targetDescription = categoryLabel;
  }

  // Action title & badge
  let title = '';
  let badgeLabel = '';
  let badgeActive = true;

  switch (log.action) {
    case 'flight.create':
      title = directFlightLabel
        ? bi(`Tạo mới chuyến bay ${directFlightLabel}`, `Created flight ${directFlightLabel}`)
        : bi('Tạo mới lịch chuyến bay', 'Created flight schedule');
      badgeLabel = bi('TẠO CHUYẾN BAY', 'FLIGHT CREATED');
      badgeActive = true;
      break;
    case 'flight.update':
      title = directFlightLabel
        ? bi(`Cập nhật lịch chuyến bay ${directFlightLabel}`, `Updated flight ${directFlightLabel}`)
        : bi('Cập nhật thông tin chuyến bay', 'Updated flight schedule');
      badgeLabel = bi('CẬP NHẬT CHUYẾN', 'FLIGHT UPDATED');
      badgeActive = true;
      break;
    case 'flight.open_sales':
      title = directFlightLabel
        ? bi(`Mở bán vé chuyến bay ${directFlightLabel}`, `Opened ticket sales for ${directFlightLabel}`)
        : bi('Mở bán lại chuyến bay', 'Reopened flight sales');
      badgeLabel = bi('MỞ BÁN VÉ', 'SALES OPENED');
      badgeActive = true;
      break;
    case 'flight.close_sales':
      title = directFlightLabel
        ? bi(`Ngừng mở bán vé chuyến bay ${directFlightLabel}`, `Closed ticket sales for ${directFlightLabel}`)
        : bi('Ngừng mở bán chuyến bay', 'Closed flight sales');
      badgeLabel = bi('NGỪNG MỞ BÁN', 'SALES CLOSED');
      badgeActive = false;
      break;
    case 'fare.create':
    case 'flight_fare.create':
      title = directFlightLabel
        ? bi(`Thêm hạng giá vé mới cho chuyến ${directFlightLabel}`, `Added fare class to ${directFlightLabel}`)
        : bi('Thêm hạng giá vé mới', 'Created flight fare');
      badgeLabel = bi('THÊM GIÁ VÉ', 'FARE CREATED');
      badgeActive = true;
      break;
    case 'fare.update':
    case 'flight_fare.update':
      title = directFlightLabel
        ? bi(`Cập nhật giá vé chuyến ${directFlightLabel}`, `Updated fare for ${directFlightLabel}`)
        : bi('Cập nhật bảng giá vé', 'Updated flight fare');
      badgeLabel = bi('CẬP NHẬT GIÁ VÉ', 'FARE UPDATED');
      badgeActive = changes.is_active !== false;
      break;
    case 'flight_seat.update':
      if (changes.is_blocked === true) {
        title = bi(
          `Khóa ghế ${String(changes.seat_code ?? '')} ${directFlightLabel ? `trên chuyến ${directFlightLabel}` : ''}`.trim(),
          `Blocked seat ${String(changes.seat_code ?? '')} ${directFlightLabel ? `on ${directFlightLabel}` : ''}`.trim(),
        );
        badgeLabel = bi('KHÓA GHẾ', 'SEAT BLOCKED');
        badgeActive = false;
      } else {
        title = bi(
          `Mở khóa / Cập nhật phí ghế ${String(changes.seat_code ?? '')} ${directFlightLabel ? `trên chuyến ${directFlightLabel}` : ''}`.trim(),
          `Updated seat ${String(changes.seat_code ?? '')} ${directFlightLabel ? `on ${directFlightLabel}` : ''}`.trim(),
        );
        badgeLabel = bi('CẬP NHẬT GHẾ', 'SEAT UPDATED');
        badgeActive = true;
      }
      break;
    case 'aircraft.create':
      title = directAircraftLabel
        ? bi(`Thêm tàu bay mới ${directAircraftLabel}`, `Added aircraft ${directAircraftLabel}`)
        : bi('Thêm tàu bay mới vào đội bay', 'Created aircraft');
      badgeLabel = bi('THÊM TÀU BAY', 'AIRCRAFT CREATED');
      badgeActive = true;
      break;
    case 'aircraft.update':
      title = directAircraftLabel
        ? bi(`Cập nhật tàu bay ${directAircraftLabel}`, `Updated aircraft ${directAircraftLabel}`)
        : bi('Cập nhật thông tin tàu bay', 'Updated aircraft');
      badgeLabel = bi('CẬP NHẬT TÀU BAY', 'AIRCRAFT UPDATED');
      badgeActive = changes.is_active !== false;
      break;
    case 'seats.upsert_template':
      title = directAircraftLabel
        ? bi(`Lưu sơ đồ ghế mẫu cho tàu bay ${directAircraftLabel}`, `Saved seat template for ${directAircraftLabel}`)
        : bi('Cập nhật sơ đồ ghế mẫu tàu bay', 'Saved aircraft seat template');
      badgeLabel = bi('LƯU SƠ ĐỒ GHẾ', 'SEAT MAP SAVED');
      badgeActive = true;
      break;
    case 'role.grant': {
      const name = String(changes.target_name ?? changes.granted_to ?? changes.account ?? bi('tài khoản', 'account'));
      title = bi(`Cấp quyền Quản trị viên cho ${name}`, `Granted Administrator role to ${name}`);
      badgeLabel = bi('CẤP QUYỀN ADMIN', 'ADMIN GRANTED');
      badgeActive = true;
      break;
    }
    case 'role.revoke': {
      const name = String(changes.target_name ?? changes.revoked_from ?? changes.account ?? bi('tài khoản', 'account'));
      title = bi(`Thu hồi quyền Quản trị viên của ${name}`, `Revoked Administrator role from ${name}`);
      badgeLabel = bi('THU HỒI QUYỀN', 'ROLE REVOKED');
      badgeActive = false;
      break;
    }
    case 'role.suspend': {
      const name = String(changes.target_name ?? changes.account ?? bi('tài khoản', 'account'));
      title = bi(`Tạm dừng hoạt động tài khoản ${name}`, `Suspended account ${name}`);
      badgeLabel = bi('TẠM DỪNG TÀI KHOẢN', 'ACCOUNT SUSPENDED');
      badgeActive = false;
      break;
    }
    case 'role.reactivate': {
      const name = String(changes.target_name ?? changes.account ?? bi('tài khoản', 'account'));
      title = bi(`Kích hoạt lại tài khoản ${name}`, `Re-activated account ${name}`);
      badgeLabel = bi('KÍCH HOẠT LẠI', 'ACCOUNT RE-ACTIVATED');
      badgeActive = true;
      break;
    }
    default: {
      const actionStr = typeof log?.action === 'string' ? log.action : '';
      if (actionStr.endsWith('.insert')) {
        title = bi(`Thêm mới ${targetDescription}`, `Created ${targetDescription}`);
        badgeLabel = bi('THÊM MỚI', 'CREATED');
        badgeActive = true;
      } else if (actionStr.endsWith('.update')) {
        title = bi(`Cập nhật ${targetDescription}`, `Updated ${targetDescription}`);
        badgeLabel =
          changes.is_active === false
            ? bi('NGỪNG HOẠT ĐỘNG', 'DEACTIVATED')
            : bi('CẬP NHẬT', 'UPDATED');
        badgeActive = changes.is_active !== false;
      } else {
        title = actionStr ? `${categoryLabel}: ${actionStr}` : categoryLabel;
        badgeLabel = actionStr ? actionStr.toUpperCase() : bi('HOẠT ĐỘNG', 'ACTIVITY');
      }
    }
  }

  const comparisons = buildAuditComparisons(log, changes, ctx);
  const compTokens = comparisons
    .map((c) => `${c.field} ${c.before} ${c.after}`)
    .join(' ');

  return {
    categoryLabel,
    title,
    badgeLabel,
    badgeActive,
    targetDescription,
    comparisons,
    actorLabel,
    searchTokens: `${title} ${categoryLabel} ${targetDescription} ${compTokens} ${actorLabel} ${log.entity_type} ${log.action} ${log.entity_id ?? ''}`,
  };
}

export function AdminReportsScreen() {
  const { language, ta, bi, money, airportTime } = useAdminI18n();
  const [tab, setTab] = useState<ReportTab>('revenue');
  const [daysWindow, setDaysWindow] = useState<number>(30);
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const reportQuery = useQuery({
    queryKey: ['admin-reports-audit-bundle'],
    queryFn: loadReportsAndAuditBundle,
  });

  const data = reportQuery.data;
  const summary = data
    ? summarizeAdminBookingsAndRevenue({
        bookings: data.bookings,
        payments: data.payments,
        refunds: data.refunds,
        profiles: data.accounts.filter(row => row.role === 'customer').map(row => ({id: row.id, created_at: row.createdAt})),
        nowMs: data.fetchedAtMs,
        daysWindow,
      })
    : null;

  const lookupCtx: AuditLookupContext = {
    flightById: new Map((data?.flights ?? []).map((f) => [f.id, f])),
    airportById: new Map((data?.airports ?? []).map((a) => [a.id, a])),
    airlineById: new Map((data?.airlines ?? []).map((a) => [a.id, a])),
    aircraftById: new Map((data?.aircraft ?? []).map((a) => [a.id, a])),
    addonById: new Map((data?.addonProducts ?? []).map((a) => [a.id, a])),
    profileById: new Map((data?.profiles ?? []).map((p) => [p.id, p])),
    bi,
    money,
    airportTime,
  };

  const auditFilterChips: { key: string; label: string }[] = [
    { key: 'all', label: bi('Tất cả hoạt động', 'All activities') },
    { key: 'user_roles', label: bi('🛡 Phân quyền', '🛡 Roles & Access') },
    { key: 'flight_instances', label: bi('✈ Chuyến bay', '✈ Flights') },
    { key: 'flight_fares', label: bi('🏷 Giá vé', '🏷 Fares') },
    { key: 'flight_seats', label: bi('💺 Kho ghế chuyến', '💺 Flight Seats') },
    { key: 'aircraft', label: bi('🛩 Tàu bay & Ghế mẫu', '🛩 Aircraft & Seats') },
    { key: 'airports', label: bi('🛫 Sân bay', '🛫 Airports') },
    { key: 'airlines', label: bi('🏢 Hãng bay', '🏢 Airlines') },
    { key: 'addon_products', label: bi('🧳 Dịch vụ & Hành lý', '🧳 Add-ons') },
  ];

  const allAuditRows = data?.auditLogs ?? [];
  const auditLogs = allAuditRows.map((log) => ({
    raw: log,
    human: describeAuditLog(log, lookupCtx),
  }));

  const filteredAudit = auditLogs.filter((item) => {
    if (entityFilter === 'all') return true;
    if (entityFilter === 'aircraft') {
      return item.raw.entity_type === 'aircraft' || item.raw.entity_type === 'seats';
    }
    if (entityFilter === 'addon_products') {
      return (
        item.raw.entity_type === 'addon_products' ||
        item.raw.entity_type === 'flight_addon_offers'
      );
    }
    return item.raw.entity_type === entityFilter;
  });

  const pagedAudit = filterAndPaginate(filteredAudit, {
    query,
    page,
    pageSize: 10,
    getSearchText: (item) => item.human.searchTokens,
  });

  return (
    <AdminShell
      activeSection="reports"
      title={bi('Báo cáo Đối soát & Nhật ký Quản trị', 'Reconciliation Reports & Audit Logs')}
      subtitle={bi(
        'Giá trị đơn hiện còn xác nhận được tách riêng với tiền cổng thanh toán đã thu và hoàn tất hoàn tiền theo thời điểm từng sự kiện; kèm nhật ký quản trị từ máy chủ.',
        'Current confirmed booking value, provider captures and completed refunds by event time, with server audit logs.',
      )}
      onQuickSearch={(txt) => {
        setQuery(txt);
        setPage(1);
      }}
    >
      <View style={adminStyles.chipRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'revenue' }}
          onPress={() => setTab('revenue')}
          style={[adminStyles.chip, tab === 'revenue' && adminStyles.chipSelected]}
        >
          <Text style={[adminStyles.chipText, tab === 'revenue' && adminStyles.chipTextSelected]}>
            📊 {bi('Báo cáo Đơn & Dòng tiền', 'Booking & Cash Report')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'audit' }}
          onPress={() => setTab('audit')}
          style={[adminStyles.chip, tab === 'audit' && adminStyles.chipSelected]}
        >
          <Text style={[adminStyles.chipText, tab === 'audit' && adminStyles.chipTextSelected]}>
            🛡 {bi(`Nhật ký thao tác Admin (${auditLogs.length})`, `Admin Audit Logs (${auditLogs.length})`)}
          </Text>
        </Pressable>
      </View>

      {reportQuery.isPending ? (
        <AdminLoadingState />
      ) : reportQuery.isError ? (
        <View style={adminStyles.card}>
          <Notice text={formatAdminError(reportQuery.error, language)} />
          <ActionButton
            title={ta('admin.action.retry')}
            secondary
            onPress={() => void reportQuery.refetch()}
          />
        </View>
      ) : tab === 'revenue' && summary ? (
        <View style={adminStyles.card}>
          <View style={adminStyles.rowBetween}>
            <Text style={adminStyles.sectionTitle}>
              {bi(`Kỳ báo cáo: ${daysWindow} ngày gần nhất`, `Reporting Window: Last ${daysWindow} days`)}
            </Text>
            <View style={adminStyles.chipRow}>
              {[7, 30, 90, 365].map((d) => {
                const selected = daysWindow === d;
                return (
                  <Pressable
                    key={d}
                    accessibilityRole="button"
                    onPress={() => setDaysWindow(d)}
                    style={[adminStyles.chip, selected && adminStyles.chipSelected]}
                  >
                    <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                      {d} {bi('ngày', 'days')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={adminStyles.itemCard}>
            <View style={adminStyles.rowBetween}>
              <Text style={adminStyles.label}>
                1. {bi('Tổng số Booking phát sinh trong kỳ', 'Total Bookings Created in Period')}
              </Text>
              <Text style={adminStyles.bold}>{summary.totalBookings}</Text>
            </View>
            <View style={adminStyles.rowBetween}>
              <Text style={adminStyles.muted}>
                • {bi('Đơn hiện còn xác nhận', 'Currently confirmed')}
              </Text>
              <Text style={adminStyles.bold}>{summary.confirmedCount}</Text>
            </View>
            <View style={adminStyles.rowBetween}>
              <Text style={adminStyles.muted}>
                • {bi('Đơn chờ thanh toán (pending_payment — chưa tính thu)', 'Pending Payment (excluded)')}
              </Text>
              <Text style={adminStyles.label}>{summary.pendingCount}</Text>
            </View>
            <View style={adminStyles.rowBetween}>
              <Text style={adminStyles.muted}>
                • {bi('Đơn đã hủy / hết hạn (cancelled / expired — loại trừ)', 'Cancelled / Expired (excluded)')}
              </Text>
              <Text style={adminStyles.label}>
                {summary.cancelledCount + summary.expiredCount} ({summary.cancelledCount} cancelled /{' '}
                {summary.expiredCount} expired)
              </Text>
            </View>
          </View>

          <View style={adminStyles.itemCard}>
            <View style={adminStyles.rowBetween}>
              <Text style={adminStyles.label}>
                2. {bi('Giá trị đơn hiện còn xác nhận (tạo trong kỳ)', 'Current confirmed value (orders created in period)')}
              </Text>
              <Text style={adminStyles.bold}>{money(summary.confirmedGrossAmount)}</Text>
            </View>
            <View style={adminStyles.rowBetween}>
              <Text style={adminStyles.label}>{bi('Tiền cổng thanh toán đã thu trong kỳ', 'Provider captures in period')}</Text>
              <Text style={adminStyles.bold}>{money(summary.successfulReceiptAmount)}</Text>
            </View>
            <Text style={adminStyles.helperText}>{bi('Tiền thu gồm cả khoản trùng/chậm cần bồi hoàn; không cộng lại vào giá trị đơn. Khoản hoàn chỉ tính khi hoàn tất, có thể thuộc đơn từ kỳ trước.', 'Captures include duplicate/late funds awaiting compensation; booking value stays separate. Refunds count on completion and can relate to earlier orders.')}</Text>
            <View style={adminStyles.rowBetween}>
              <Text style={adminStyles.muted}>
                − {bi('Trừ các khoản hoàn tiền đã hoàn tất (Completed Refunds)', 'Less Completed Refunds')}
              </Text>
              <Text style={adminStyles.label}>− {money(summary.completedRefundAmount)}</Text>
            </View>
            <View style={adminStyles.divider} />
            <View style={adminStyles.rowBetween}>
              <Text style={adminStyles.bold}>
                = {bi('Thu ròng = tiền đã thu − hoàn tất', 'Net cash = captures − completed refunds')}
              </Text>
              <Text style={[adminStyles.title, { fontSize: 20 }]}>
                {money(summary.netCashAmount)}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <>
          <AdminSearchFilterBar
            query={query}
            onQueryChange={(val) => {
              setQuery(val);
              setPage(1);
            }}
            placeholder={bi(
              'Tìm theo số hiệu chuyến bay (VJ624), tàu bay, hành động hoặc người thực hiện…',
              'Search by flight number (VJ624), aircraft, action, or administrator…',
            )}
            onRefresh={() => void reportQuery.refetch()}
          />

          <View style={adminStyles.chipRow}>
            {auditFilterChips.map((chip) => {
              const selected = entityFilter === chip.key;
              return (
                <Pressable
                  key={chip.key}
                  accessibilityRole="button"
                  onPress={() => {
                    setEntityFilter(chip.key);
                    setPage(1);
                  }}
                  style={[adminStyles.chip, selected && adminStyles.chipSelected]}
                >
                  <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {pagedAudit.items.length === 0 ? (
            <View style={adminStyles.card}>
              <Text style={adminStyles.muted}>{ta('admin.empty')}</Text>
            </View>
          ) : (
            <>
              {pagedAudit.items.map(({ raw, human }) => (
                <View key={raw.id} style={adminStyles.itemCard}>
                  <View style={adminStyles.rowBetween}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={adminStyles.helperText}>
                        {human.categoryLabel.toUpperCase()}
                      </Text>
                      <Text style={adminStyles.bold}>{human.title}</Text>
                    </View>
                    <AdminStatusBadge
                      active={human.badgeActive}
                      customLabel={human.badgeLabel}
                    />
                  </View>

                  <Text style={adminStyles.muted}>
                    🎯 {bi('Đối tượng:', 'Target:')} {human.targetDescription}
                  </Text>

                  {(human.comparisons ?? []).length > 0 && (
                    <View
                      style={{
                        backgroundColor: '#F8FAFC',
                        borderRadius: 12,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        gap: 8,
                      }}
                    >
                      {(human.comparisons ?? []).map((comp, idx) => (
                        <View
                          key={idx}
                          style={{
                            gap: 6,
                            paddingBottom: idx < (human.comparisons ?? []).length - 1 ? 8 : 0,
                            borderBottomWidth: idx < (human.comparisons ?? []).length - 1 ? 1 : 0,
                            borderBottomColor: '#E2E8F0',
                          }}
                        >
                          <Text style={[adminStyles.label, { fontSize: 12 }]}>
                            • {comp.field}
                          </Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 8,
                            }}
                          >
                            {/* BEFORE PILL */}
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: '#F1F5F9',
                                borderWidth: 1,
                                borderColor: '#CBD5E1',
                                borderRadius: 8,
                                paddingHorizontal: 9,
                                paddingVertical: 5,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '700',
                                  color: '#64748B',
                                }}
                              >
                                {bi('Trước:', 'Before:')}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '600',
                                  color: '#475569',
                                }}
                              >
                                {comp.before}
                              </Text>
                            </View>

                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: '800',
                                color: '#0891B2',
                              }}
                            >
                              ➔
                            </Text>

                            {/* AFTER PILL */}
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: '#ECFEFF',
                                borderWidth: 1,
                                borderColor: '#A5F3FC',
                                borderRadius: 8,
                                paddingHorizontal: 9,
                                paddingVertical: 5,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '800',
                                  color: '#0E7490',
                                }}
                              >
                                {bi('Sau:', 'After:')}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '700',
                                  color: '#0F172A',
                                }}
                              >
                                {comp.after}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={adminStyles.rowBetween}>
                    <Text style={adminStyles.helperText}>
                      👤 {bi('Thực hiện bởi:', 'Performed by:')} {human.actorLabel}
                    </Text>
                    <Text style={adminStyles.helperText}>
                      🕒 {airportTime(raw.created_at, 'Asia/Ho_Chi_Minh')}
                    </Text>
                  </View>
                </View>
              ))}

              <AdminPaginationBar
                page={pagedAudit.page}
                totalPages={pagedAudit.totalPages}
                total={pagedAudit.total}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}
    </AdminShell>
  );
}
