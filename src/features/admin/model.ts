import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { matchesAdminSearch } from './admin-search.ts';
import { validateDestinationMedia, validateAirlineMedia } from '../discovery/media-paths.ts';
import { databaseIdSchema } from '../../lib/database-id.ts';
import type { Database } from '../../types/database.generated.ts';
import type { SeatTemplateItemSchema } from './rpc.ts';

type PublicTables = Database['public']['Tables'];
export type AirportRow = PublicTables['airports']['Row'];
export type AirlineRow = PublicTables['airlines']['Row'];
export type DestinationRow = PublicTables['destinations']['Row'];
export type AircraftRow = PublicTables['aircraft']['Row'];
export type SeatRow = PublicTables['seats']['Row'];
export type FlightInstanceRow = PublicTables['flight_instances']['Row'];
export type FlightFareRow = PublicTables['flight_fares']['Row'];
export type FlightSeatRow = PublicTables['flight_seats']['Row'];
export type AddonProductRow = PublicTables['addon_products']['Row'];
export type FlightAddonOfferRow = PublicTables['flight_addon_offers']['Row'];
export type BookingRow = PublicTables['bookings']['Row'];
export type BookingPassengerRow = PublicTables['booking_passengers']['Row'];
export type BookingSegmentRow = PublicTables['booking_segments']['Row'];
export type BookingAddonRow = PublicTables['booking_addons']['Row'];
export type BookingEventRow = PublicTables['booking_events']['Row'];
export type PaymentRow = PublicTables['payments']['Row'];
export type RefundRow = PublicTables['refunds']['Row'];
export type ProfileRow = PublicTables['profiles']['Row'];

export type StatusFilter = 'all' | 'active' | 'inactive';

export function isValidIanaTimezone(timezone: string): boolean {
  const trimmed = timezone.trim();
  if (!trimmed || !trimmed.includes('/')) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

export const airportInputSchema = z.object({
  id: databaseIdSchema('Mã sân bay không hợp lệ.').nullable().optional(),
  iataCode: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/, 'Mã IATA sân bay phải gồm đúng 3 chữ cái in hoa (ví dụ: SGN).')),
  name: z.string().trim().min(2, 'Nhập tên sân bay.').max(120, 'Tên sân bay tối đa 120 ký tự.'),
  city: z.string().trim().min(2, 'Nhập tên thành phố.').max(80, 'Tên thành phố tối đa 80 ký tự.'),
  countryCode: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}$/, 'Mã quốc gia ISO phải gồm đúng 2 chữ cái (ví dụ: VN).')),
  timezone: z
    .string()
    .trim()
    .refine(isValidIanaTimezone, 'Múi giờ IANA không hợp lệ (ví dụ: Asia/Ho_Chi_Minh).'),
  isActive: z.boolean().default(true),
});

export type AirportInput = z.input<typeof airportInputSchema>;

export const airlineInputSchema = z.object({
  id: databaseIdSchema('Mã hãng bay không hợp lệ.').nullable().optional(),
  iataCode: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(
      z
        .string()
        .regex(/^[A-Z0-9]{2}$/, 'Mã IATA hãng bay phải gồm đúng 2 ký tự chữ hoặc số (ví dụ: VN, VJ).'),
    ),
  name: z.string().trim().min(2, 'Nhập tên hãng hàng không.').max(100, 'Tên hãng tối đa 100 ký tự.'),
  logoPath: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  isActive: z.boolean().default(true),
}).superRefine((value,ctx)=>{
  // Existing relative paths are accepted here for compatibility; the screen/server verify they are unchanged.
  const result=validateAirlineMedia(value.logoPath,value.id?value.logoPath:null);
  if(!result.valid)ctx.addIssue({code:'custom',path:['logoPath'],message:result.message});
});

export type AirlineInput = z.input<typeof airlineInputSchema>;

export const destinationInputSchema = z.object({
  id: databaseIdSchema('Mã điểm đến không hợp lệ.').nullable().optional(),
  airportId: databaseIdSchema('Chọn sân bay gắn với điểm đến.'),
  slug: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .pipe(
      z
        .string()
        .regex(
          /^[a-z0-9]+(-[a-z0-9]+)*$/,
          'Slug chỉ gồm chữ thường, chữ số và dấu gạch ngang (ví dụ: da-nang).',
        ),
    ),
  title: z.string().trim().min(2, 'Nhập tiêu đề điểm đến.').max(120, 'Tiêu đề tối đa 120 ký tự.'),
  description: z
    .string()
    .trim()
    .max(400)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  imagePath: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(value=>validateDestinationMedia(value).valid,validateDestinationMedia('invalid').message),
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export type DestinationInput = z.input<typeof destinationInputSchema>;

export const addonProductInputSchema = z
  .object({
    id: databaseIdSchema('Mã sản phẩm dịch vụ không hợp lệ.').nullable().optional(),
    code: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(
        z
          .string()
          .regex(/^[A-Z0-9_]{2,32}$/, 'Mã dịch vụ gồm 2–32 ký tự chữ hoa, số hoặc gạch dưới.'),
      ),
    name: z.string().trim().min(2, 'Nhập tên gói dịch vụ.').max(120),
    category: z.enum(['baggage', 'meal', 'insurance_demo']).refine(value=>value==='baggage','Checkout currently supports checked baggage only.'),
    description: z
      .string()
      .trim()
      .max(400)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    weightKg: z.number().positive('Số kg hành lý phải lớn hơn 0.').max(100).nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.category === 'baggage' && (value.weightKg == null || value.weightKg <= 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['weightKg'],
        message: 'Gói hành lý bắt buộc phải có khối lượng (weight_kg > 0).',
      });
    }
  });

export type AddonProductInput = z.input<typeof addonProductInputSchema>;

export const flightAddonOfferInputSchema = z.object({
  id: databaseIdSchema('Mã gói bán trên chuyến không hợp lệ.').nullable().optional(),
  flightId: databaseIdSchema('Chọn chuyến bay hợp lệ.'),
  productId: databaseIdSchema('Chọn sản phẩm dịch vụ hợp lệ.'),
  unitAmount: z.coerce.number().int().min(0, 'Đơn giá không được âm.'),
  maxQuantityPerPassenger: z.coerce
    .number()
    .int()
    .min(1, 'Số lượng tối đa mỗi hành khách ít nhất là 1.')
    .max(1, 'Checkout supports one baggage choice per passenger per leg; max quantity must be 1')
    .default(1),
  isActive: z.boolean().default(true),
});

export type FlightAddonOfferInput = z.input<typeof flightAddonOfferInputSchema>;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function filterAndPaginate<T>(
  records: readonly T[],
  options: {
    query?: string;
    statusFilter?: StatusFilter;
    page?: number;
    pageSize?: number;
    getSearchText: (item: T) => string;
    getIsActive?: (item: T) => boolean;
  },
): PaginatedResult<T> {
  const normalizedQuery = (options.query ?? '').trim();
  const statusFilter = options.statusFilter ?? 'all';
  const pageSize = Math.max(1, Math.min(options.pageSize ?? 10, 100));

  const filtered = records.filter((item) => {
    if (statusFilter !== 'all' && options.getIsActive) {
      const active = options.getIsActive(item);
      if (statusFilter === 'active' && !active) return false;
      if (statusFilter === 'inactive' && active) return false;
    }
    if (!normalizedQuery) return true;
    return matchesAdminSearch(options.getSearchText(item), normalizedQuery);
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(1, Math.min(options.page ?? 1, totalPages));
  const start = (safePage - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export type StandardSeatLayoutConfig = {
  firstRows?: number;
  businessRows?: number;
  premiumEconomyRows?: number;
  economyRows: number;
  exitRowNumber?: number | null;
};

export function buildStandardSeatTemplate(config: StandardSeatLayoutConfig): SeatTemplateItemSchema[] {
  const firstRows = Math.max(0, Math.trunc(config.firstRows ?? 0));
  const businessRows = Math.max(0, Math.trunc(config.businessRows ?? 0));
  const premiumEconomyRows = Math.max(0, Math.trunc(config.premiumEconomyRows ?? 0));
  const economyRows = Math.max(1, Math.trunc(config.economyRows));
  const totalRows = firstRows + businessRows + premiumEconomyRows + economyRows;

  const fourSeatColumns: { col: number; letter: string; pos: 'window' | 'aisle' }[] = [
    { col: 1, letter: 'A', pos: 'window' },
    { col: 3, letter: 'C', pos: 'aisle' },
    { col: 4, letter: 'D', pos: 'aisle' },
    { col: 6, letter: 'F', pos: 'window' },
  ];
  const sixSeatColumns: { col: number; letter: string; pos: 'window' | 'middle' | 'aisle' }[] = [
    { col: 1, letter: 'A', pos: 'window' },
    { col: 2, letter: 'B', pos: 'middle' },
    { col: 3, letter: 'C', pos: 'aisle' },
    { col: 4, letter: 'D', pos: 'aisle' },
    { col: 5, letter: 'E', pos: 'middle' },
    { col: 6, letter: 'F', pos: 'window' },
  ];

  const seats: SeatTemplateItemSchema[] = [];

  for (let row = 1; row <= totalRows; row += 1) {
    let cabinClass: 'first' | 'business' | 'premium_economy' | 'economy';
    if (row <= firstRows) {
      cabinClass = 'first';
    } else if (row <= firstRows + businessRows) {
      cabinClass = 'business';
    } else if (row <= firstRows + businessRows + premiumEconomyRows) {
      cabinClass = 'premium_economy';
    } else {
      cabinClass = 'economy';
    }

    const columns =
      cabinClass === 'first' || cabinClass === 'business' ? fourSeatColumns : sixSeatColumns;

    for (const c of columns) {
      seats.push({
        seat_code: `${row}${c.letter}`,
        row_number: row,
        column_number: c.col,
        cabin_class: cabinClass,
        position: c.pos,
        is_exit_row: config.exitRowNumber === row,
        is_active: true,
      });
    }
  }

  return seats;
}

export function formatAdminError(error: unknown, language: 'vi' | 'en' = 'vi'): string {
  let issueMessage = '';
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues?: { message?: string }[] }).issues;
    if (Array.isArray(issues) && issues[0]?.message) {
      issueMessage = issues[0].message;
    }
  }
  const rawMessage = issueMessage || (error && typeof error === 'object' && 'message' in error
    ? String(error.message ?? '') : String(error ?? ''));
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code ?? '')
      : '';

  const catalogueMessages: [RegExp, string, string][] = [
    [/Cannot unpublish.*active bookings/i, 'Không thể ngừng mở bán chuyến đang có đơn đặt vé hoặc ghế đang giữ.', 'Cannot unpublish a flight with active bookings or seat holds.'],
    [/Cannot (unpublish|create an unpublished).*departed or arrived/i, 'Không thể ngừng mở bán chuyến đã khởi hành hoặc đã đến nơi.', 'Cannot unpublish a departed or arrived flight.'],
    [/last unblocked seat/i, 'Hãy ngừng bán các gói vé của khoang trước khi khóa ghế cuối cùng còn sử dụng được.', 'Deactivate cabin fares before blocking its last unblocked seat.'],
    [/unblocked seat inventory|no.*seat inventory.*cabin/i, 'Khoang của gói vé cần có ghế sử dụng được trên chuyến bay này.', 'The fare cabin must have unblocked seat inventory on this flight.'],
    [/supports (checked )?baggage only|Meals and insurance.*read.only/i, 'Hiện chỉ có hành lý ký gửi được bán trong luồng đặt vé. Suất ăn và bảo hiểm đang ở chế độ chỉ xem.', 'Checkout currently supports checked baggage only. Meals and insurance are read-only.'],
    [/max quantity must be 1|maximum: 1|Too big: expected number to be <=1/i, 'Mỗi hành khách chỉ chọn một gói hành lý cho từng chặng.', 'Each passenger can select one baggage package per leg.'],
    [/Use an HTTPS (image|logo) URL/i, 'Hãy dùng URL ảnh HTTPS hoặc ảnh điểm đến có sẵn được hỗ trợ. Logo hãng mới cần URL HTTPS.', 'Use an HTTPS image URL or a supported bundled destination image. New airline logos require HTTPS.'],
    [/duplicate seat codes/i, 'Mã ghế bị trùng trong sơ đồ. Hãy kiểm tra lại.', 'The seat template contains duplicate seat codes.'],
  ];
  const catalogueMessage = catalogueMessages.find(([pattern]) => pattern.test(rawMessage));
  if (catalogueMessage) return catalogueMessage[language === 'vi' ? 1 : 2];

  if (code === '23P01' || /Aircraft schedule conflict/i.test(rawMessage)) {
    return language === 'vi'
      ? 'Lịch bay bị trùng: Máy bay này đã được phân công cho một chuyến bay khác trong cùng khoảng thời gian.'
      : 'Schedule conflict: This aircraft is already assigned to another flight during that time window.';
  }
  if (code === '42501' || /Admin privileges required|permission denied/i.test(rawMessage)) {
    return language === 'vi'
      ? 'Từ chối truy cập: Tài khoản hiện tại không có quyền Quản trị viên.'
      : 'Access denied: Administrator privileges are required.';
  }
  if (code === '23505' || /duplicate key value/i.test(rawMessage)) {
    return language === 'vi'
      ? 'Mã định danh hoặc bản ghi đã tồn tại. Hãy kiểm tra lại mã IATA, slug, mã máy bay hoặc số hiệu chuyến bay.'
      : 'Duplicate identifier: Please check the IATA code, slug, registration code, or flight number.';
  }
  if (/Cannot modify seat template/i.test(rawMessage)) {
    return language === 'vi'
      ? 'Không thể thay đổi sơ đồ ghế mẫu vì máy bay đã có chuyến mở bán hoặc đã khởi tạo kho ghế.'
      : 'Cannot modify seat template for an aircraft that already has published flights or seat inventory.';
  }
  if (/active bookings or seat holds/i.test(rawMessage)) {
    return language === 'vi'
      ? 'Không thể đổi lịch, máy bay hoặc hủy chuyến khi đang có đơn đặt vé hoặc ghế đang giữ.'
      : 'Cannot reschedule, reassign aircraft, or cancel a flight while active bookings or seat holds exist.';
  }
  if (/currently held or booked/i.test(rawMessage)) {
    return language === 'vi'
      ? 'Không thể khóa ghế đang được hành khách giữ hoặc đã đặt.'
      : 'Cannot block a seat that is currently held or booked.';
  }
  if (/Invalid IANA timezone/i.test(rawMessage)) {
    return language === 'vi'
      ? 'Múi giờ IANA không hợp lệ (ví dụ: Asia/Ho_Chi_Minh).'
      : 'Invalid IANA timezone (e.g., Asia/Ho_Chi_Minh).';
  }
  if (rawMessage && rawMessage.length < 180) {
    return rawMessage;
  }
  return language === 'vi'
    ? 'Không thể thực hiện thao tác quản trị. Hãy kiểm tra dữ liệu và thử lại.'
    : 'Could not complete the administrative operation. Please check your input and try again.';
}

export async function saveAdminAirport(
  client: SupabaseClient<Database>,
  input: AirportInput,
): Promise<AirportRow> {
  const parsed = airportInputSchema.parse(input);
  const payload = {
    iata_code: parsed.iataCode,
    name: parsed.name,
    city: parsed.city,
    country_code: parsed.countryCode,
    timezone: parsed.timezone,
    is_active: parsed.isActive,
  };
  const query = parsed.id
    ? client.from('airports').update(payload).eq('id', parsed.id).select('*').single()
    : client.from('airports').insert(payload).select('*').single();

  const { data, error } = await query;
  if (error || !data) throw error ?? new Error('Không thể lưu sân bay.');
  return data;
}

export async function saveAdminAirline(
  client: SupabaseClient<Database>,
  input: AirlineInput,
): Promise<AirlineRow> {
  const parsed = airlineInputSchema.parse(input);
  const payload = {
    iata_code: parsed.iataCode,
    name: parsed.name,
    logo_path: parsed.logoPath ?? null,
    is_active: parsed.isActive,
  };
  const query = parsed.id
    ? client.from('airlines').update(payload).eq('id', parsed.id).select('*').single()
    : client.from('airlines').insert(payload).select('*').single();

  const { data, error } = await query;
  if (error || !data) throw error ?? new Error('Không thể lưu hãng hàng không.');
  return data;
}

export async function saveAdminDestination(
  client: SupabaseClient<Database>,
  input: DestinationInput,
): Promise<DestinationRow> {
  const parsed = destinationInputSchema.parse(input);
  const payload = {
    airport_id: parsed.airportId,
    slug: parsed.slug,
    title: parsed.title,
    description: parsed.description ?? null,
    image_path: parsed.imagePath ?? null,
    is_featured: parsed.isFeatured,
    sort_order: parsed.sortOrder,
    is_active: parsed.isActive,
  };
  const query = parsed.id
    ? client.from('destinations').update(payload).eq('id', parsed.id).select('*').single()
    : client.from('destinations').insert(payload).select('*').single();

  const { data, error } = await query;
  if (error || !data) throw error ?? new Error('Không thể lưu điểm đến.');
  return data;
}

export async function saveAdminAddonProduct(
  client: SupabaseClient<Database>,
  input: AddonProductInput,
): Promise<AddonProductRow> {
  const parsed = addonProductInputSchema.parse(input);
  const payload = {
    code: parsed.code,
    name: parsed.name,
    category: parsed.category,
    description: parsed.description ?? null,
    weight_kg: parsed.category === 'baggage' ? (parsed.weightKg ?? null) : null,
    is_active: parsed.isActive,
  };
  const query = parsed.id
    ? client.from('addon_products').update(payload).eq('id', parsed.id).select('*').single()
    : client.from('addon_products').insert(payload).select('*').single();

  const { data, error } = await query;
  if (error || !data) throw error ?? new Error('Không thể lưu danh mục dịch vụ.');
  return data;
}

export async function saveAdminFlightAddonOffer(
  client: SupabaseClient<Database>,
  input: FlightAddonOfferInput,
): Promise<FlightAddonOfferRow> {
  const parsed = flightAddonOfferInputSchema.parse(input);
  const payload = {
    flight_id: parsed.flightId,
    product_id: parsed.productId,
    unit_amount: parsed.unitAmount,
    currency: 'VND' as const,
    max_quantity_per_passenger: parsed.maxQuantityPerPassenger,
    is_active: parsed.isActive,
  };
  const query = parsed.id
    ? client.from('flight_addon_offers').update(payload).eq('id', parsed.id).select('*').single()
    : client.from('flight_addon_offers').insert(payload).select('*').single();

  const { data, error } = await query;
  if (error || !data) throw error ?? new Error('Không thể lưu gói bán dịch vụ trên chuyến.');
  return data;
}

export { summarizeAdminBookingsAndRevenue, type BookingMetricsSummary } from './financial-summary.ts';
