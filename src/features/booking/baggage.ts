import { z } from 'zod';
export type BaggageOffer = { id: string; flightId: string; name: string; weightKg: number; amount: number; currency: 'VND' };
export type BaggageChoice = { passengerId: string; flightId: string; offerId: string; name: string; weightKg: number; amount: number; currency: 'VND' };
export type MealOffer = { id: string; flightId: string; productId: string; name: string; description?: string | null; amount: number; currency: 'VND' };
export type MealChoice = { passengerId: string; flightId: string; offerId: string; name: string; description?: string | null };
export type SeatChoice = { passengerId: string; flightId: string; seatId: string; seatCode: string; amount: number; currency: 'VND' };
const allowanceSchema = z.object({ cabin_pieces: z.number().int().nonnegative(), cabin_kg: z.number().nonnegative(),
  checked_pieces: z.number().int().nonnegative(), checked_kg: z.number().nonnegative() });
export function parseAllowance(value: unknown) {
  const parsed = allowanceSchema.safeParse(value);
  return parsed.success ? { cabinPieces: parsed.data.cabin_pieces, cabinKg: parsed.data.cabin_kg,
    checkedPieces: parsed.data.checked_pieces, checkedKg: parsed.data.checked_kg } : null;
}
export function isBaggageCurrent(choice: BaggageChoice, offers: BaggageOffer[]) {
  return offers.some(o => o.id === choice.offerId && o.flightId === choice.flightId && o.amount === choice.amount && o.currency === choice.currency);
}
