import { z } from 'zod';
import type { CheckoutDraft, CheckoutDraftState } from './draft.ts';
import type { ItineraryLeg } from './itinerary-data.ts';
import { ageOnDate, classifyPassenger } from './passenger-policy.ts';
import { calendarDateSchema } from './passenger.ts';
import { databaseIdSchema } from '../../lib/database-id.ts';
const seatSchema = z.object({ flight_seat_id: databaseIdSchema(), seat_code: z.string().min(1).max(12),
  row_number: z.number().int().min(1).max(200), column_number: z.number().int().min(1).max(6),
  cabin_class: z.enum(['economy', 'premium_economy', 'business', 'first']), position: z.enum(['window', 'middle', 'aisle']),
  is_exit_row: z.boolean(), selection_fee_amount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), currency: z.literal('VND'),
  availability: z.enum(['available', 'blocked', 'held', 'booked']) });
export type MapSeat = z.output<typeof seatSchema>;
export function parseSeatMap(input: unknown): MapSeat[] {
  const seats = z.array(seatSchema).max(1200).parse(input);
  if (new Set(seats.map(s => s.flight_seat_id)).size !== seats.length
    || new Set(seats.map(s => `${s.row_number}:${s.column_number}`)).size !== seats.length) throw new Error('seats.unsupported');
  return seats;
}
export function seatRows(seats: MapSeat[]) {
  const numbers = [...new Set(seats.map(seat => seat.row_number))].sort((a, b) => a - b);
  return numbers.map(row => ({ row,
    seats: Array.from({ length: 6 }, (_, col) => seats.find(seat => seat.row_number === row && seat.column_number === col + 1) ?? null) }));
}
export function seatEligibility(seat: MapSeat, passenger: CheckoutDraft['passengers'][number], leg: ItineraryLeg,
  passengers: CheckoutDraft['passengers'], choices: CheckoutDraftState['seats']): string | null {
  const birth = passenger.values.dateOfBirth.trim();
  if (!calendarDateSchema.safeParse(birth).success || birth > leg.departureDate) return 'extras.checkDetails';
  if (classifyPassenger(birth, leg.departureDate) === 'infant') return 'seats.infant';
  if (seat.availability !== 'available' || seat.cabin_class !== leg.cabinClass) return 'seats.unavailable';
  if (choices.some(c => c.flightId === leg.flightId && c.seatId === seat.flight_seat_id && c.passengerId !== passenger.id)) return 'seats.duplicate';
  if (seat.is_exit_row && (ageOnDate(birth, leg.departureDate) < 18 || passengers.some(p => p.values.accompanyingAdultId === passenger.id
    && calendarDateSchema.safeParse(p.values.dateOfBirth.trim()).success && p.values.dateOfBirth.trim() <= leg.departureDate
    && classifyPassenger(p.values.dateOfBirth.trim(), leg.departureDate) === 'infant'))) return 'seats.exit';
  return null;
}
export function seatChoiceCurrent(choice: CheckoutDraftState['seats'][number], map: MapSeat[], draft: CheckoutDraftState) {
  const seat = map.find(s => s.flight_seat_id === choice.seatId); const p = draft.passengers.find(p => p.id === choice.passengerId);
  const leg = draft.itinerary?.legs.find(l => l.flightId === choice.flightId);
  return !!seat && !!p && !!leg && seat.selection_fee_amount === choice.amount && seat.currency === choice.currency
    && !seatEligibility(seat, p, leg, draft.passengers, draft.seats);
}
export async function validateSelectedSeats(draft: CheckoutDraftState, load: (flightId: string) => Promise<MapSeat[]>) {
  const maps = await Promise.all([...new Set(draft.seats.map(s => s.flightId))].map(async flightId => ({ flightId, map: await load(flightId) })));
  if (draft.seats.some(choice => !seatChoiceCurrent(choice, maps.find(m => m.flightId === choice.flightId)!.map, draft))) throw new Error('seats.changed');
}
