import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTicketService, TicketNotFoundError, ticketErrorMessage, TICKET_PAGE_SIZE } from '../src/features/tickets/model.ts';
import { bookingStatusLabel, cabinClassLabel, flightSnapshotSummary, formatDateTime, formatMoney, tripTypeLabel } from '../src/features/tickets/presentation.ts';
import { translate } from '../src/features/i18n/translate.ts';

const bookingId = '11111111-1111-4111-8111-111111111111';
const booking = { id: bookingId, user_id: 'user-1', booking_code: 'FLIGHT42' };

function mockClient(results = {}) {
  const calls = [];
  return {
    calls,
    client: {
      from(table) {
        calls.push([table, 'from']);
        const query = {
          select(columns) { calls.push([table, 'select', columns]); return this; },
          eq(column, value) { calls.push([table, 'eq', column, value]); return this; },
          order(column, options) { calls.push([table, 'order', column, options]); return this; },
          range(start, end) { calls.push([table, 'range', start, end]); return this; },
          async maybeSingle() { calls.push([table, 'maybeSingle']); return results[table] ?? { data: null, error: null }; },
          then(resolve, reject) { return Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve, reject); },
        };
        return query;
      },
    },
  };
}

test('ticket list filters by owner and paginates in stable newest-first order', async () => {
  const { client, calls } = mockClient({ bookings: { data: [booking], error: null } });
  assert.deepEqual(await createTicketService(client).list('user-1', 2), [booking]);
  assert.deepEqual(calls.filter(call => call[1] === 'eq'), [['bookings', 'eq', 'user_id', 'user-1']]);
  assert.deepEqual(calls.filter(call => call[1] === 'order'), [
    ['bookings', 'order', 'created_at', { ascending: false }],
    ['bookings', 'order', 'id', { ascending: false }],
  ]);
  assert.deepEqual(calls.at(-1), ['bookings', 'range', 2 * TICKET_PAGE_SIZE, 3 * TICKET_PAGE_SIZE - 1]);
});

test('invalid list requests never query the database', async () => {
  const { client, calls } = mockClient();
  const service = createTicketService(client);
  await assert.rejects(() => service.list('', 0), RangeError);
  await assert.rejects(() => service.list('user-1', -1), RangeError);
  assert.deepEqual(calls, []);
});

test('ticket details require an owned booking before loading children', async () => {
  const { client, calls } = mockClient({
    bookings: { data: booking, error: null },
    booking_segments: { data: [{ id: 'segment-1' }], error: null },
    booking_passengers: { data: [{ id: 'passenger-1' }], error: null },
  });
  const result = await createTicketService(client).details('user-1', bookingId);
  assert.deepEqual(result, { booking, segments: [{ id: 'segment-1' }], passengers: [{ id: 'passenger-1' }] });
  assert.deepEqual(calls.filter(call => call[1] === 'eq'), [
    ['bookings', 'eq', 'id', bookingId], ['bookings', 'eq', 'user_id', 'user-1'],
    ['booking_segments', 'eq', 'booking_id', bookingId], ['booking_passengers', 'eq', 'booking_id', bookingId],
  ]);
});

test('missing, inaccessible, and invalid booking IDs do not fetch child data', async () => {
  const { client, calls } = mockClient();
  const service = createTicketService(client);
  await assert.rejects(() => service.details('user-1', 'bad-id'), TicketNotFoundError);
  assert.deepEqual(calls, []);
  await assert.rejects(() => service.details('user-1', bookingId), TicketNotFoundError);
  assert.equal(calls.some(call => call[0] === 'booking_segments'), false);
  assert.match(ticketErrorMessage(new TicketNotFoundError()), /Không tìm thấy/);
});

test('database errors are shown without leaking server text', async () => {
  const error = { message: 'private policy details' };
  const { client } = mockClient({ bookings: { data: null, error } });
  await assert.rejects(() => createTicketService(client).details('user-1', bookingId), e => e === error);
  assert.equal(ticketErrorMessage(error).includes(error.message), false);
});

test('booking labels and snapshots remain safe when optional snapshot fields are absent', () => {
  assert.equal(bookingStatusLabel('pending_payment'), 'Chờ thanh toán');
  assert.equal(tripTypeLabel('round_trip'), 'Khứ hồi');
  assert.equal(cabinClassLabel('premium_economy'), 'Phổ thông đặc biệt');
  assert.match(formatMoney(1200000, 'VND'), /1[.,]200[.,]000/);
  assert.deepEqual(flightSnapshotSummary({ departure_iata: 'HAN', arrival_iata: 'SGN', flight_number: 'VN123' }), {
    flightNumber: 'VN123', airlineName: null, departureCode: 'HAN', arrivalCode: 'SGN', departureAt: null, arrivalAt: null,
    departureTimezone: null, arrivalTimezone: null,
  });
  assert.equal(flightSnapshotSummary(null).departureCode, null);
});

test('ticket status, dates and amounts follow the shared language choice', () => {
  assert.equal(translate('en', bookingStatusLabel('confirmed')), 'Confirmed');
  assert.equal(translate('en', tripTypeLabel('round_trip')), 'Round trip');
  assert.notEqual(formatDateTime('2030-03-08T02:00:00Z', 'Asia/Ho_Chi_Minh', 'vi'),
    formatDateTime('2030-03-08T02:00:00Z', 'Asia/Ho_Chi_Minh', 'en'));
  assert.notEqual(formatMoney(1200000, 'VND', 'vi'), formatMoney(1200000, 'VND', 'en'));
});
