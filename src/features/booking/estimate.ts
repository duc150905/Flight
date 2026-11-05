import type { CheckoutDraftState } from './draft.ts';
import { calendarDateSchema } from './passenger.ts';
import { classifyPassenger } from './passenger-policy.ts';

/** Display estimate only. A booking RPC must independently price every leg. */
export function checkoutEstimate(draft: Pick<CheckoutDraftState, 'itinerary' | 'passengers'> & Partial<Pick<CheckoutDraftState, 'baggage' | 'seats' | 'meals'>>) {
  if (!draft.itinerary?.legs.length || !draft.passengers.length) return null;
  let amount = 0; let currency: string | undefined;
  for (const leg of draft.itinerary.legs) {
    if (!leg.prices || (currency && currency !== leg.prices.currency)) return null;
    currency = leg.prices.currency;
    for (const passenger of draft.passengers) {
      const birth = passenger.values.dateOfBirth.trim();
      const type = calendarDateSchema.safeParse(birth).success && birth <= leg.departureDate
        ? classifyPassenger(birth, leg.departureDate) : passenger.id.split('-')[0];
      if (type !== 'adult' && type !== 'child' && type !== 'infant') return null;
      const value = leg.prices[type];
      if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(amount + value)) return null;
      amount += value;
    }
  }
  for (const extra of [...(draft.baggage ?? []), ...(draft.seats ?? []), ...(draft.meals ?? [])]) {
    if (extra.currency !== currency || !Number.isSafeInteger(extra.amount) || extra.amount < 0 || !Number.isSafeInteger(amount + extra.amount)) return null;
    amount += extra.amount;
  }
  return { amount, currency: currency! };
}
