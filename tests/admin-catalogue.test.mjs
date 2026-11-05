import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addonProductInputSchema,
  airlineInputSchema,
  airportInputSchema,
  buildStandardSeatTemplate,
  destinationInputSchema,
  filterAndPaginate,
  flightAddonOfferInputSchema,
  formatAdminError,
  isValidIanaTimezone,
  saveAdminAddonProduct,
  saveAdminAirline,
  saveAdminAirport,
  saveAdminDestination,
  saveAdminFlightAddonOffer,
  summarizeAdminBookingsAndRevenue,
} from '../src/features/admin/model.ts';

const SAMPLE_UUID = '00000000-0000-4000-8000-000000000001';
const SAMPLE_UUID_2 = '00000000-0000-4000-8000-000000000002';

test('admin errors explain server catalogue constraints in the selected language', () => {
  const cases = [
    ['Cannot unpublish a flight with active bookings or seat holds', /ngừng mở bán/, /unpublish/],
    ['Active fares require unblocked seat inventory in their cabin', /khoang/i, /cabin/],
    ['Deactivate fares before blocking the last unblocked seat in this cabin', /ghế cuối cùng/, /last/],
    ['Meals and insurance are read-only: checkout currently supports baggage only', /hành lý/, /baggage/],
    ['Insurance is read-only: checkout supports baggage and meals only', /bảo hiểm/i, /insurance/i],
    ['Cannot change an existing add-on product category', /phân loại/, /category/],
    ['Cannot change an existing add-on offer category', /phân loại/, /category/],
    ['Use an HTTPS image URL or a known bundled destination path such as destinations/da-nang.jpg', /HTTPS/, /HTTPS/],
  ];
  for (const [message, vi, en] of cases) {
    assert.match(formatAdminError({message, code: '23514'}, 'vi'), vi);
    assert.match(formatAdminError({message, code: '23514'}, 'en'), en);
  }
  assert.equal(formatAdminError({message: 'A specific server failure'}), 'A specific server failure');
});

test('isValidIanaTimezone validates real IANA timezones and rejects invalid strings', () => {
  assert.equal(isValidIanaTimezone('Asia/Ho_Chi_Minh'), true);
  assert.equal(isValidIanaTimezone('Asia/Tokyo'), true);
  assert.equal(isValidIanaTimezone('UTC'), false); // Must include region/city slash per project rules
  assert.equal(isValidIanaTimezone('Invalid/Timezone_Name'), false);
  assert.equal(isValidIanaTimezone(''), false);
});

test('airportInputSchema normalizes IATA & country codes and validates IANA timezone', () => {
  const parsed = airportInputSchema.parse({
    iataCode: 'sgn',
    name: 'Tân Sơn Nhất',
    city: 'TP. Hồ Chí Minh',
    countryCode: 'vn',
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: true,
  });

  assert.equal(parsed.iataCode, 'SGN');
  assert.equal(parsed.countryCode, 'VN');
  assert.equal(parsed.timezone, 'Asia/Ho_Chi_Minh');

  assert.throws(() =>
    airportInputSchema.parse({
      iataCode: 'SG',
      name: 'Invalid IATA',
      city: 'HCM',
      countryCode: 'VN',
      timezone: 'Asia/Ho_Chi_Minh',
    }),
  );

  assert.throws(() =>
    airportInputSchema.parse({
      iataCode: 'SGN',
      name: 'Invalid Timezone',
      city: 'HCM',
      countryCode: 'VN',
      timezone: 'GMT+7',
    }),
  );
});

test('airlineInputSchema normalizes 2-character IATA code and optional logoPath', () => {
  const parsed = airlineInputSchema.parse({
    iataCode: 'vn',
    name: 'Vietnam Airlines',
    logoPath: '   ',
    isActive: true,
  });

  assert.equal(parsed.iataCode, 'VN');
  assert.equal(parsed.logoPath, null);

  assert.throws(() =>
    airlineInputSchema.parse({
      iataCode: 'VNA',
      name: 'Too Long Code',
    }),
  );
});

test('destinationInputSchema validates slug format and airportId', () => {
  const parsed = destinationInputSchema.parse({
    airportId: SAMPLE_UUID,
    slug: 'Da-Nang',
    title: 'Đà Nẵng',
    description: 'Thành phố biển miền Trung',
    isFeatured: true,
    sortOrder: '2',
    isActive: true,
  });

  assert.equal(parsed.slug, 'da-nang');
  assert.equal(parsed.sortOrder, 2);

  assert.throws(() =>
    destinationInputSchema.parse({
      airportId: SAMPLE_UUID,
      slug: 'da nang invalid',
      title: 'Đà Nẵng',
    }),
  );
});

test('addonProductInputSchema supports meals without baggage weight and keeps insurance read-only', () => {
  const baggage = addonProductInputSchema.parse({
    code: 'bag_20kg',
    name: 'Hành lý 20kg',
    category: 'baggage',
    weightKg: 20,
    isActive: true,
  });
  assert.equal(baggage.code, 'BAG_20KG');
  assert.equal(baggage.weightKg, 20);

  assert.throws(
    () =>
      addonProductInputSchema.parse({
        code: 'BAG_INVALID',
        name: 'Hành lý thiếu kg',
        category: 'baggage',
        weightKg: null,
      }),
    /weight_kg > 0/,
  );

  const meal = addonProductInputSchema.parse({
    code: 'meal_hot',
    name: 'Suất ăn nóng',
    category: 'meal',
    weightKg: null,
  });
  assert.equal(meal.category, 'meal');
  assert.equal(meal.code, 'MEAL_HOT');
  assert.equal(meal.weightKg, null);
  assert.throws(()=>addonProductInputSchema.parse({code:'INS_TEST',name:'Protection',category:'insurance_demo'}),/baggage and meals only/);
});

test('flightAddonOfferInputSchema validates flightId, productId, unitAmount, and maxQuantityPerPassenger', () => {
  const offer = flightAddonOfferInputSchema.parse({
    flightId: SAMPLE_UUID,
    productId: SAMPLE_UUID_2,
    unitAmount: '250000',
    maxQuantityPerPassenger: '1',
    isActive: true,
  });

  assert.equal(offer.unitAmount, 250000);
  assert.equal(offer.maxQuantityPerPassenger, 1);
  assert.throws(()=>flightAddonOfferInputSchema.parse({flightId:SAMPLE_UUID,productId:SAMPLE_UUID_2,unitAmount:250000,maxQuantityPerPassenger:2}));

  assert.throws(() =>
    flightAddonOfferInputSchema.parse({
      flightId: SAMPLE_UUID,
      productId: SAMPLE_UUID_2,
      unitAmount: -1000,
      maxQuantityPerPassenger: 2,
    }),
  );
});

test('filterAndPaginate filters by query and statusFilter and slices pages accurately', () => {
  const items = [
    { code: 'SGN', city: 'Hồ Chí Minh', active: true },
    { code: 'HAN', city: 'Hà Nội', active: true },
    { code: 'DAD', city: 'Đà Nẵng', active: true },
    { code: 'CXR', city: 'Nha Trang', active: false },
    { code: 'PQC', city: 'Phú Quốc', active: true },
  ];

  const activeOnly = filterAndPaginate(items, {
    statusFilter: 'active',
    page: 1,
    pageSize: 2,
    getSearchText: (i) => `${i.code} ${i.city}`,
    getIsActive: (i) => i.active,
  });

  assert.equal(activeOnly.total, 4);
  assert.equal(activeOnly.totalPages, 2);
  assert.equal(activeOnly.items.length, 2);
  assert.equal(activeOnly.items[0].code, 'SGN');

  const searchResult = filterAndPaginate(items, {
    query: 'đà nẵng',
    statusFilter: 'all',
    page: 1,
    pageSize: 10,
    getSearchText: (i) => `${i.code} ${i.city}`,
    getIsActive: (i) => i.active,
  });

  assert.equal(searchResult.total, 1);
  assert.equal(searchResult.items[0].code, 'DAD');
});

test('buildStandardSeatTemplate generates 4-cabin seats with 4-abreast First/Business and 6-abreast Economy', () => {
  const seats = buildStandardSeatTemplate({
    firstRows: 1,
    businessRows: 2,
    premiumEconomyRows: 1,
    economyRows: 4,
    exitRowNumber: 5,
  });

  // 1*4 + 2*4 + 1*6 + 4*6 = 4 + 8 + 6 + 24 = 42 seats
  assert.equal(seats.length, 42);
  assert.equal(seats[0].seat_code, '1A');
  assert.equal(seats[0].cabin_class, 'first');

  const row2Seats = seats.filter((s) => s.row_number === 2);
  assert.equal(row2Seats.length, 4);
  assert.equal(row2Seats[0].cabin_class, 'business');

  const row4Seats = seats.filter((s) => s.row_number === 4);
  assert.equal(row4Seats.length, 6);
  assert.equal(row4Seats[0].cabin_class, 'premium_economy');

  const exitSeats = seats.filter((s) => s.is_exit_row);
  assert.equal(exitSeats.length, 6);
  assert.equal(exitSeats[0].row_number, 5);
});

test('formatAdminError maps PostgreSQL codes and constraint messages to friendly Vietnamese/English messages', () => {
  assert.match(
    formatAdminError({ code: '23P01', message: 'Aircraft schedule conflict' }, 'vi'),
    /Lịch bay bị trùng/,
  );
  assert.match(
    formatAdminError({ code: '23P01', message: 'Aircraft schedule conflict' }, 'en'),
    /Schedule conflict/,
  );
  assert.match(
    formatAdminError({ code: '42501', message: 'Admin privileges required' }, 'vi'),
    /Từ chối truy cập/,
  );
  assert.match(
    formatAdminError(new Error('Cannot modify seat template for published flights'), 'vi'),
    /Không thể thay đổi sơ đồ ghế mẫu/,
  );
});

test('saveAdminAirport, saveAdminAirline, saveAdminDestination, saveAdminAddonProduct, and saveAdminFlightAddonOffer call Supabase table operations with normalized payloads', async () => {
  const calls = [];
  const mockClient = {
    from(table) {
      return {
        insert(payload) {
          calls.push({ table, op: 'insert', payload });
          return {
            select() {
              return {
                async single() {
                  return { data: { id: SAMPLE_UUID, ...payload }, error: null };
                },
              };
            },
          };
        },
        update(payload) {
          return {
            eq(col, val) {
              calls.push({ table, op: 'update', col, val, payload });
              return {
                select() {
                  return {
                    async single() {
                      return { data: { id: val, ...payload }, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  await saveAdminAirport(mockClient, {
    iataCode: 'dad',
    name: 'Đà Nẵng',
    city: 'Đà Nẵng',
    countryCode: 'vn',
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: true,
  });

  await saveAdminAirline(mockClient, {
    id: SAMPLE_UUID,
    iataCode: 'vj',
    name: 'VietJet Air',
    isActive: true,
  });

  await saveAdminDestination(mockClient, {
    airportId: SAMPLE_UUID,
    slug: 'Da-Nang',
    title: 'Đà Nẵng',
    isFeatured: true,
    sortOrder: 1,
    isActive: true,
  });

  await saveAdminAddonProduct(mockClient, {
    code: 'bag_20kg',
    name: 'Gói 20kg',
    category: 'baggage',
    weightKg: 20,
    isActive: true,
  });

  await saveAdminFlightAddonOffer(mockClient, {
    flightId: SAMPLE_UUID,
    productId: SAMPLE_UUID_2,
    unitAmount: 280000,
    maxQuantityPerPassenger: 1,
    isActive: true,
  });

  await saveAdminAddonProduct(mockClient, {
    id: SAMPLE_UUID_2,
    code: 'meal_hot',
    name: 'Suất ăn nóng',
    category: 'meal',
    weightKg: 20,
    isActive: false,
  });

  assert.equal(calls.length, 6);
  assert.equal(calls[0].table, 'airports');
  assert.equal(calls[0].payload.iata_code, 'DAD');
  assert.equal(calls[1].table, 'airlines');
  assert.equal(calls[1].op, 'update');
  assert.equal(calls[2].table, 'destinations');
  assert.equal(calls[2].payload.slug, 'da-nang');
  assert.equal(calls[3].table, 'addon_products');
  assert.equal(calls[3].payload.weight_kg, 20);
  assert.equal(calls[4].table, 'flight_addon_offers');
  assert.equal(calls[4].payload.unit_amount, 280000);
  assert.equal(calls[5].table, 'addon_products');
  assert.equal(calls[5].op, 'update');
  assert.equal(calls[5].payload.category, 'meal');
  assert.equal(calls[5].payload.code, 'MEAL_HOT');
  assert.equal(calls[5].payload.weight_kg, null);
  assert.equal(calls[5].payload.is_active, false);
});

test('booking value remains separate while cash uses actual receipt/refund completion events', () => {
  const nowMs = Date.parse('2026-11-02T12:00:00Z');
  const summary = summarizeAdminBookingsAndRevenue({
    nowMs,
    daysWindow: 30,
    bookings: [
      {
        id: '1',
        status: 'confirmed',
        total_amount: 3_000_000,
        created_at: '2026-10-25T10:00:00Z',
        confirmed_at: '2026-10-25T10:05:00Z',
      },
      {
        id: '2',
        status: 'pending_payment',
        total_amount: 2_000_000,
        created_at: '2026-10-28T10:00:00Z',
        confirmed_at: null,
      },
      {
        id: '3',
        status: 'cancelled',
        total_amount: 1_500_000,
        created_at: '2026-10-29T10:00:00Z',
        confirmed_at: null,
      },
      {
        id: '4',
        status: 'expired',
        total_amount: 1_800_000,
        created_at: '2026-10-30T10:00:00Z',
        confirmed_at: null,
      },
    ],
    payments: [
      { id: 'p1', status: 'succeeded', amount: 3_000_000, created_at: '2026-10-25T10:05:00Z',paid_at:'2026-10-25T10:05:00Z' },
      { id: 'p2', status: 'failed', amount: 2_000_000, created_at: '2026-10-28T10:05:00Z' },
    ],
    refunds: [
      { id: 'r1', status: 'completed', amount: 400_000, created_at: '2026-10-31T10:00:00Z',completed_at:'2026-10-31T10:01:00Z' },
      { id: 'r2', status: 'initiated', amount: 500_000, created_at: '2026-10-31T11:00:00Z' },
    ],
    profiles: [
      { id: 'u1', created_at: '2026-10-20T00:00:00Z' },
      { id: 'u2', created_at: '2026-01-01T00:00:00Z' },
    ],
  });

  assert.equal(summary.totalBookings, 4);
  assert.equal(summary.confirmedCount, 1);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.cancelledCount, 1);
  assert.equal(summary.expiredCount, 1);
  assert.equal(summary.confirmedGrossAmount, 3_000_000);
  assert.equal(summary.completedRefundAmount, 400_000);
  assert.equal(summary.simulatedNetAmount, 2_600_000);
  assert.equal(summary.succeededPaymentsCount, 1);
  assert.equal(summary.failedPaymentsCount, 1);
  assert.equal(summary.totalCustomers, 2);
  assert.equal(summary.newCustomersInWindow, 1);
});

