import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { databaseIdSchema } from '../../lib/database-id.ts';
import type { Database } from '../../types/database.generated.ts';

type AdminRpcClient = Pick<SupabaseClient<Database>, 'rpc'>;
type PublicTables = Database['public']['Tables'];
type PublicFunctions = Database['public']['Functions'];

export type AircraftRow = PublicTables['aircraft']['Row'];
export type FlightInstanceRow = PublicTables['flight_instances']['Row'];
export type FlightFareRow = PublicTables['flight_fares']['Row'];
export type FlightSeatRow = PublicTables['flight_seats']['Row'];
export type AdminAuditLogRow = PublicFunctions['admin_list_audit_logs']['Returns'][number];

const cabinClassSchema = z.enum(['economy', 'premium_economy', 'business', 'first']);
const seatPositionSchema = z.enum(['window', 'middle', 'aisle']);
const flightStatusSchema = z.enum([
  'draft',
  'scheduled',
  'delayed',
  'departed',
  'arrived',
  'cancelled',
]);

export const upsertAircraftSchema = z.object({
  aircraftId: databaseIdSchema('Mã máy bay không hợp lệ.').nullable().optional(),
  airlineId: databaseIdSchema('Chọn hãng hàng không hợp lệ.'),
  registrationCode: z
    .string()
    .trim()
    .min(2, 'Nhập mã đăng ký máy bay.')
    .max(20, 'Mã đăng ký tối đa 20 ký tự.')
    .transform((val) => val.toUpperCase()),
  modelName: z
    .string()
    .trim()
    .min(2, 'Nhập tên dòng máy bay.')
    .max(80, 'Tên dòng máy bay tối đa 80 ký tự.'),
  isActive: z.boolean().default(true),
});

export type UpsertAircraftInput = z.input<typeof upsertAircraftSchema>;

export const seatTemplateItemSchema = z.object({
  seat_code: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{0,2}[A-Z]$/i, 'Mã ghế không hợp lệ (ví dụ: 1A, 12F).')
    .transform((val) => val.toUpperCase()),
  row_number: z.number().int().min(1, 'Số hàng phải lớn hơn 0.').max(200),
  column_number: z.number().int().min(1, 'Số cột phải lớn hơn 0.').max(12),
  cabin_class: cabinClassSchema,
  position: seatPositionSchema,
  is_exit_row: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export type SeatTemplateItemSchema = z.output<typeof seatTemplateItemSchema>;

export const upsertAircraftSeatsSchema = z.object({
  aircraftId: databaseIdSchema('Mã máy bay không hợp lệ.'),
  seats: z.array(seatTemplateItemSchema).min(1, 'Sơ đồ ghế phải có ít nhất 1 ghế.'),
});

export type UpsertAircraftSeatsInput = z.input<typeof upsertAircraftSeatsSchema>;

const isoTimestampSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Thời điểm không hợp lệ.');

export const saveFlightInstanceSchema = z
  .object({
    flightId: databaseIdSchema('Mã chuyến bay không hợp lệ.').nullable().optional(),
    airlineId: databaseIdSchema('Chọn hãng hàng không hợp lệ.'),
    aircraftId: databaseIdSchema('Chọn máy bay hợp lệ.'),
    flightNumber: z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{2,10}$/i, 'Số hiệu chuyến bay không hợp lệ (ví dụ: VN210).')
      .transform((val) => val.toUpperCase()),
    departureAirportId: databaseIdSchema('Chọn sân bay đi hợp lệ.'),
    arrivalAirportId: databaseIdSchema('Chọn sân bay đến hợp lệ.'),
    departureAt: isoTimestampSchema,
    arrivalAt: isoTimestampSchema,
    salesCloseAt: isoTimestampSchema.nullable().optional(),
    status: flightStatusSchema.default('draft'),
    publish: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.departureAirportId === value.arrivalAirportId) {
      ctx.addIssue({
        code: 'custom',
        path: ['arrivalAirportId'],
        message: 'Sân bay đến phải khác sân bay đi.',
      });
    }
    const depMs = Date.parse(value.departureAt);
    const arrMs = Date.parse(value.arrivalAt);
    if (!Number.isNaN(depMs) && !Number.isNaN(arrMs) && arrMs <= depMs) {
      ctx.addIssue({
        code: 'custom',
        path: ['arrivalAt'],
        message: 'Giờ đến phải sau giờ khởi hành.',
      });
    }
    if (value.salesCloseAt) {
      const closeMs = Date.parse(value.salesCloseAt);
      if (!Number.isNaN(closeMs) && !Number.isNaN(depMs) && closeMs > depMs) {
        ctx.addIssue({
          code: 'custom',
          path: ['salesCloseAt'],
          message: 'Thời điểm đóng bán không được sau giờ khởi hành.',
        });
      }
    }
  });

export type SaveFlightInstanceInput = z.input<typeof saveFlightInstanceSchema>;

export const setFlightSalesSchema = z.object({
  flightId: databaseIdSchema('Mã chuyến bay không hợp lệ.'),
  openSales: z.boolean(),
  salesCloseAt: isoTimestampSchema.nullable().optional(),
});

export type SetFlightSalesInput = z.input<typeof setFlightSalesSchema>;

export const updateFlightSeatSchema = z.object({
  flightSeatId: databaseIdSchema('Mã ghế chuyến bay không hợp lệ.'),
  isBlocked: z.boolean().nullable().optional(),
  selectionFeeAmount: z
    .number()
    .int()
    .min(0, 'Phí chọn ghế không được âm.')
    .nullable()
    .optional(),
});

export type UpdateFlightSeatInput = z.input<typeof updateFlightSeatSchema>;

export const baggageAllowanceSchema = z.object({
  cabin_pieces: z.number().int().min(0),
  cabin_kg: z.number().min(0),
  checked_pieces: z.number().int().min(0),
  checked_kg: z.number().min(0),
});

export const saveFlightFareSchema = z.object({
  fareId: databaseIdSchema('Mã hạng vé không hợp lệ.').nullable().optional(),
  flightId: databaseIdSchema('Mã chuyến bay không hợp lệ.'),
  fareCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{2,32}$/i, 'Mã hạng vé không hợp lệ (ví dụ: ECO_SAVER).')
    .transform((val) => val.toUpperCase()),
  cabinClass: cabinClassSchema,
  name: z.string().trim().min(2, 'Nhập tên hạng vé.').max(80),
  adultBaseAmount: z.number().int().min(0, 'Giá vé không được âm.'),
  childBaseAmount: z.number().int().min(0, 'Giá vé không được âm.'),
  infantBaseAmount: z.number().int().min(0, 'Giá vé không được âm.'),
  adultTaxAmount: z.number().int().min(0).default(0),
  childTaxAmount: z.number().int().min(0).default(0),
  infantTaxAmount: z.number().int().min(0).default(0),
  adultFeeAmount: z.number().int().min(0).default(0),
  childFeeAmount: z.number().int().min(0).default(0),
  infantFeeAmount: z.number().int().min(0).default(0),
  baggageAllowance: baggageAllowanceSchema.default({
    cabin_pieces: 1,
    cabin_kg: 7,
    checked_pieces: 0,
    checked_kg: 0,
  }),
  cancellationAllowed: z.boolean().default(false),
  cancellationCutoffMinutes: z.number().int().min(0).default(60),
  cancellationFeeAmount: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type SaveFlightFareInput = z.input<typeof saveFlightFareSchema>;

export const listAuditLogsSchema = z.object({
  entityType: z.string().trim().min(1).nullable().optional(),
  entityId: databaseIdSchema('Mã đối tượng không hợp lệ.').nullable().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export type ListAuditLogsInput = z.input<typeof listAuditLogsSchema>;

function requireClient(client: AdminRpcClient | null | undefined): AdminRpcClient {
  if (!client) {
    throw new Error('Chưa cấu hình kết nối Supabase.');
  }
  return client;
}

export async function adminUpsertAircraft(
  client: AdminRpcClient | null | undefined,
  input: UpsertAircraftInput,
): Promise<AircraftRow> {
  const db = requireClient(client);
  const parsed = upsertAircraftSchema.parse(input);
  const { data, error } = await db.rpc('admin_upsert_aircraft', {
    p_aircraft_id: parsed.aircraftId ?? undefined,
    p_airline_id: parsed.airlineId,
    p_registration_code: parsed.registrationCode,
    p_model_name: parsed.modelName,
    p_is_active: parsed.isActive,
  });
  if (error || !data) {
    throw new Error(error?.message ?? 'Không thể lưu thông tin máy bay.');
  }
  return data;
}

export async function adminUpsertAircraftSeats(
  client: AdminRpcClient | null | undefined,
  input: UpsertAircraftSeatsInput,
): Promise<number> {
  const db = requireClient(client);
  const parsed = upsertAircraftSeatsSchema.parse(input);
  const { data, error } = await db.rpc('admin_upsert_aircraft_seats', {
    p_aircraft_id: parsed.aircraftId,
    p_seats: parsed.seats,
  });
  if (error || typeof data !== 'number') {
    throw new Error(error?.message ?? 'Không thể cập nhật sơ đồ ghế mẫu.');
  }
  return data;
}

export async function adminSaveFlightInstance(
  client: AdminRpcClient | null | undefined,
  input: SaveFlightInstanceInput,
): Promise<FlightInstanceRow> {
  const db = requireClient(client);
  const parsed = saveFlightInstanceSchema.parse(input);
  const { data, error } = await db.rpc('admin_save_flight_instance', {
    p_flight_id: parsed.flightId ?? undefined,
    p_airline_id: parsed.airlineId,
    p_aircraft_id: parsed.aircraftId,
    p_flight_number: parsed.flightNumber,
    p_departure_airport_id: parsed.departureAirportId,
    p_arrival_airport_id: parsed.arrivalAirportId,
    p_departure_at: parsed.departureAt,
    p_arrival_at: parsed.arrivalAt,
    p_sales_close_at: parsed.salesCloseAt ?? undefined,
    p_status: parsed.status,
    p_publish: parsed.publish,
  });
  if (error || !data) {
    throw new Error(error?.message ?? 'Không thể lưu lịch bay.');
  }
  return data;
}

export async function adminSetFlightSales(
  client: AdminRpcClient | null | undefined,
  input: SetFlightSalesInput,
): Promise<FlightInstanceRow> {
  const db = requireClient(client);
  const parsed = setFlightSalesSchema.parse(input);
  const { data, error } = await db.rpc('admin_set_flight_sales', {
    p_flight_id: parsed.flightId,
    p_open_sales: parsed.openSales,
    p_sales_close_at: parsed.salesCloseAt ?? undefined,
  });
  if (error || !data) {
    throw new Error(error?.message ?? 'Không thể cập nhật trạng thái mở bán chuyến bay.');
  }
  return data;
}

export async function adminUpdateFlightSeat(
  client: AdminRpcClient | null | undefined,
  input: UpdateFlightSeatInput,
): Promise<FlightSeatRow> {
  const db = requireClient(client);
  const parsed = updateFlightSeatSchema.parse(input);
  const { data, error } = await db.rpc('admin_update_flight_seat', {
    p_flight_seat_id: parsed.flightSeatId,
    p_is_blocked: parsed.isBlocked ?? undefined,
    p_selection_fee_amount: parsed.selectionFeeAmount ?? undefined,
  });
  if (error || !data) {
    throw new Error(error?.message ?? 'Không thể cập nhật kho ghế chuyến bay.');
  }
  return data;
}

export async function adminSaveFlightFare(
  client: AdminRpcClient | null | undefined,
  input: SaveFlightFareInput,
): Promise<FlightFareRow> {
  const db = requireClient(client);
  const parsed = saveFlightFareSchema.parse(input);
  const { data, error } = await db.rpc('admin_save_flight_fare', {
    p_fare_id: parsed.fareId ?? undefined,
    p_flight_id: parsed.flightId,
    p_fare_code: parsed.fareCode,
    p_cabin_class: parsed.cabinClass,
    p_name: parsed.name,
    p_adult_base_amount: parsed.adultBaseAmount,
    p_child_base_amount: parsed.childBaseAmount,
    p_infant_base_amount: parsed.infantBaseAmount,
    p_adult_tax_amount: parsed.adultTaxAmount,
    p_child_tax_amount: parsed.childTaxAmount,
    p_infant_tax_amount: parsed.infantTaxAmount,
    p_adult_fee_amount: parsed.adultFeeAmount,
    p_child_fee_amount: parsed.childFeeAmount,
    p_infant_fee_amount: parsed.infantFeeAmount,
    p_baggage_allowance: parsed.baggageAllowance,
    p_cancellation_allowed: parsed.cancellationAllowed,
    p_cancellation_cutoff_minutes: parsed.cancellationCutoffMinutes,
    p_cancellation_fee_amount: parsed.cancellationFeeAmount,
    p_is_active: parsed.isActive,
  });
  if (error || !data) {
    throw new Error(error?.message ?? 'Không thể lưu bảng giá vé.');
  }
  return data;
}

export async function adminListAuditLogs(
  client: AdminRpcClient | null | undefined,
  input: ListAuditLogsInput = {},
): Promise<AdminAuditLogRow[]> {
  const db = requireClient(client);
  const parsed = listAuditLogsSchema.parse(input);
  const { data, error } = await db.rpc('admin_list_audit_logs', {
    p_entity_type: parsed.entityType ?? undefined,
    p_entity_id: parsed.entityId ?? undefined,
    p_limit: parsed.limit,
    p_offset: parsed.offset,
  });
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

