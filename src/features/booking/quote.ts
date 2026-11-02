import { z } from 'zod';
import type { CheckoutDraftState } from './draft.ts';
import { selectedItinerarySchema } from './selection.ts';
import { databaseIdSchema } from '../../lib/database-id.ts';
export function quoteRequest(draft: Pick<CheckoutDraftState, 'itinerary' | 'passengers' | 'baggage' | 'seats'>) {
  if (!draft.itinerary) throw new Error('quote.invalid');
  const selection = selectedItinerarySchema.parse(draft.itinerary.selection);
  return { tripType: selection.tripType, counts: selection.passengers, segments: selection.segments,
    passengers: draft.passengers.map(p => ({ id: p.id, dateOfBirth: p.values.dateOfBirth.trim(),
      ...(p.values.accompanyingAdultId ? { accompanyingPassengerId: p.values.accompanyingAdultId } : {}) })),
    baggage: draft.baggage.map(b => ({ passengerId: b.passengerId, flightId: b.flightId, offerId: b.offerId })),
    seats: draft.seats.map(s => ({ passengerId: s.passengerId, flightId: s.flightId, seatId: s.seatId })) };
}
export function requestKey(request: ReturnType<typeof quoteRequest>) { return JSON.stringify(request); }
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const amounts = { base: money, tax: money, fee: money, baggage: money, seat: money };
const lineSchema = z.object({ passengerId: z.string().min(1).max(30), flightId: databaseIdSchema(),
  passengerType: z.enum(['adult', 'child', 'infant']), requiresSeat: z.boolean(), ...amounts,
  baggageName: z.string().nullable(), seatCode: z.string().nullable() });
const quoteSchema = z.object({ currency: z.literal('VND'), ...amounts, total: money.positive(),
  quotedAt: z.string().datetime({ offset: true }), expiresAt: z.string().datetime({ offset: true }), lines: z.array(lineSchema).min(1).max(216) });
export type CheckoutQuote = z.output<typeof quoteSchema>;
const fields = ['base', 'tax', 'fee', 'baggage', 'seat'] as const;
export function parseQuote(raw: unknown, now = Date.now()): CheckoutQuote {
  const value = quoteSchema.parse(raw); const start = Date.parse(value.quotedAt); const end = Date.parse(value.expiresAt);
  if (start > now + 60_000 || end <= now || end <= start || end - start > 300_000
    || new Set(value.lines.map(l => `${l.passengerId}:${l.flightId}`)).size !== value.lines.length
    || value.lines.some(l => l.requiresSeat !== (l.passengerType !== 'infant'))
    || fields.some(key => value.lines.reduce((sum, l) => sum + l[key], 0) !== value[key])
    || fields.reduce((sum, key) => sum + value[key], 0) !== value.total) throw new Error('quote.invalid');
  return value;
}
export function quoteMatchesRequest(quote: CheckoutQuote, request: ReturnType<typeof quoteRequest>) {
  return quote.lines.length === request.segments.length * request.passengers.length
    && request.segments.every(s => request.passengers.every(p => quote.lines.some(l => l.flightId === s.flightId && l.passengerId === p.id)));
}
