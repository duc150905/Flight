import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  adminListAuditLogs,
  adminSaveFlightFare,
  adminSaveFlightInstance,
  adminSetFlightSales,
  adminUpdateFlightSeat,
  adminUpsertAircraft,
  adminUpsertAircraftSeats,
  saveFlightFareSchema,
  saveFlightInstanceSchema,
  upsertAircraftSchema,
  upsertAircraftSeatsSchema,
} from '../src/features/admin/rpc.ts';

const id1 = '11111111-1111-4111-8111-111111111111';
const id2 = '22222222-2222-4222-8222-222222222222';
const id3 = '33333333-3333-4333-8333-333333333333';
const id4 = '44444444-4444-4444-8444-444444444444';

test('admin RPC migration file defines all required SECURITY INVOKER public wrappers and SECURITY DEFINER private handlers', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261102123000_admin_management_rpcs.sql',
  );
  assert.equal(fs.existsSync(migrationPath), true, 'Admin RPC migration file must exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const expectedRpcs = [
    'admin_list_audit_logs',
    'admin_upsert_aircraft',
    'admin_upsert_aircraft_seats',
    'admin_save_flight_instance',
    'admin_set_flight_sales',
    'admin_update_flight_seat',
    'admin_save_flight_fare',
  ];

  for (const fn of expectedRpcs) {
    assert.match(sql, new RegExp(`create or replace function private\\.${fn}\\b`, 'i'));
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\b`, 'i'));
  }

  assert.match(sql, /private\.write_admin_audit_log/i);
  assert.match(sql, /23P01/);
});

test('upsertAircraftSchema normalizes registration code to uppercase and validates UUIDs', () => {
  const parsed = upsertAircraftSchema.parse({
    airlineId: id1.toUpperCase(),
    registrationCode: ' vn-a861 ',
    modelName: ' Airbus A350-900 ',
  });
  assert.equal(parsed.airlineId, id1);
  assert.equal(parsed.registrationCode, 'VN-A861');
  assert.equal(parsed.modelName, 'Airbus A350-900');
  assert.equal(parsed.isActive, true);

  assert.equal(
    upsertAircraftSchema.safeParse({
      airlineId: 'not-a-uuid',
      registrationCode: 'VN-A861',
      modelName: 'A350',
    }).success,
    false,
  );
});

test('upsertAircraftSeatsSchema requires at least one valid seat and uppercases seat_code', () => {
  const parsed = upsertAircraftSeatsSchema.parse({
    aircraftId: id1,
    seats: [
      {
        seat_code: '12a',
        row_number: 12,
        column_number: 1,
        cabin_class: 'economy',
        position: 'window',
      },
    ],
  });
  assert.equal(parsed.seats[0].seat_code, '12A');
  assert.equal(parsed.seats[0].is_exit_row, false);
  assert.equal(parsed.seats[0].is_active, true);

  assert.equal(
    upsertAircraftSeatsSchema.safeParse({ aircraftId: id1, seats: [] }).success,
    false,
  );
});

test('saveFlightInstanceSchema rejects identical airports, reversed times, and invalid salesCloseAt', () => {
  const valid = {
    airlineId: id1,
    aircraftId: id2,
    flightNumber: ' vn210 ',
    departureAirportId: id3,
    arrivalAirportId: id4,
    departureAt: '2026-11-10T08:00:00Z',
    arrivalAt: '2026-11-10T10:10:00Z',
    salesCloseAt: '2026-11-10T07:00:00Z',
    status: 'scheduled',
    publish: true,
  };
  const parsed = saveFlightInstanceSchema.parse(valid);
  assert.equal(parsed.flightNumber, 'VN210');

  assert.equal(
    saveFlightInstanceSchema.safeParse({
      ...valid,
      arrivalAirportId: valid.departureAirportId,
    }).success,
    false,
  );

  assert.equal(
    saveFlightInstanceSchema.safeParse({
      ...valid,
      arrivalAt: '2026-11-10T07:30:00Z',
    }).success,
    false,
  );

  assert.equal(
    saveFlightInstanceSchema.safeParse({
      ...valid,
      salesCloseAt: '2026-11-10T08:30:00Z',
    }).success,
    false,
  );
});

test('saveFlightFareSchema validates non-negative amounts and normalizes fareCode', () => {
  const parsed = saveFlightFareSchema.parse({
    flightId: id1,
    fareCode: ' eco_flex ',
    cabinClass: 'economy',
    name: 'Phổ thông Linh hoạt',
    adultBaseAmount: 1200000,
    childBaseAmount: 900000,
    infantBaseAmount: 120000,
  });
  assert.equal(parsed.fareCode, 'ECO_FLEX');
  assert.deepEqual(parsed.baggageAllowance, {
    cabin_pieces: 1,
    cabin_kg: 7,
    checked_pieces: 0,
    checked_kg: 0,
  });

  assert.equal(
    saveFlightFareSchema.safeParse({
      flightId: id1,
      fareCode: 'ECO',
      cabinClass: 'economy',
      name: 'Eco',
      adultBaseAmount: -1,
      childBaseAmount: 0,
      infantBaseAmount: 0,
    }).success,
    false,
  );
});

test('admin RPC wrappers invoke matching Supabase RPC names and parameters', async () => {
  const calls = [];
  const mockClient = {
    rpc: async (fn, args) => {
      calls.push({ fn, args });
      if (fn === 'admin_upsert_aircraft_seats') {
        return { data: 1, error: null };
      }
      if (fn === 'admin_list_audit_logs') {
        return {
          data: [
            {
              id: id1,
              actor_user_id: id2,
              action: 'flight.create',
              entity_type: 'flight_instances',
              entity_id: id3,
              safe_changes: {},
              created_at: '2026-11-02T00:00:00Z',
            },
          ],
          error: null,
        };
      }
      return { data: { id: id1 }, error: null };
    },
  };

  await adminUpsertAircraft(mockClient, {
    airlineId: id1,
    registrationCode: 'vn-a321',
    modelName: 'Airbus A321',
  });
  await adminUpsertAircraftSeats(mockClient, {
    aircraftId: id1,
    seats: [
      {
        seat_code: '1a',
        row_number: 1,
        column_number: 1,
        cabin_class: 'business',
        position: 'window',
      },
    ],
  });
  await adminSaveFlightInstance(mockClient, {
    airlineId: id1,
    aircraftId: id2,
    flightNumber: 'vn210',
    departureAirportId: id3,
    arrivalAirportId: id4,
    departureAt: '2026-11-10T08:00:00Z',
    arrivalAt: '2026-11-10T10:10:00Z',
  });
  await adminSetFlightSales(mockClient, {
    flightId: id1,
    openSales: false,
  });
  await adminUpdateFlightSeat(mockClient, {
    flightSeatId: id1,
    isBlocked: true,
    selectionFeeAmount: 50000,
  });
  await adminSaveFlightFare(mockClient, {
    flightId: id1,
    fareCode: 'eco_saver',
    cabinClass: 'economy',
    name: 'Economy Saver',
    adultBaseAmount: 1000000,
    childBaseAmount: 750000,
    infantBaseAmount: 100000,
  });
  const logs = await adminListAuditLogs(mockClient, { entityType: 'flight_instances', limit: 20 });

  assert.equal(logs.length, 1);
  assert.equal('p_aircraft_id' in JSON.parse(JSON.stringify(calls[0].args)), false);
  assert.equal('p_flight_id' in JSON.parse(JSON.stringify(calls[2].args)), false);
  assert.equal('p_sales_close_at' in JSON.parse(JSON.stringify(calls[2].args)), false);
  assert.equal('p_fare_id' in JSON.parse(JSON.stringify(calls[5].args)), false);
  assert.deepEqual(
    calls.map((c) => c.fn),
    [
      'admin_upsert_aircraft',
      'admin_upsert_aircraft_seats',
      'admin_save_flight_instance',
      'admin_set_flight_sales',
      'admin_update_flight_seat',
      'admin_save_flight_fare',
      'admin_list_audit_logs',
    ],
  );
});

