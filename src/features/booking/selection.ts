import { z } from 'zod';

export const passengerCountsSchema = z.object({
  adults: z.number().int().min(1).max(9), children: z.number().int().min(0).max(8),
  infants: z.number().int().min(0).max(9),
}).refine(p => p.adults + p.children <= 9 && p.infants <= p.adults,
  'Choose up to 9 seated passengers and at most one infant per adult.');

export const selectedItinerarySchema = z.object({
  tripType: z.enum(['one_way', 'round_trip', 'multi_city']),
  passengers: passengerCountsSchema,
  segments: z.array(z.object({
    flightId: z.uuid(), fareId: z.uuid(),
    journeyIndex: z.number().int().min(1).max(12), legIndex: z.number().int().min(1).max(12),
  })).min(1).max(12),
}).superRefine((value, ctx) => {
  let journey = 1; let leg = 0;
  for (const segment of value.segments) {
    if (segment.journeyIndex === journey + 1 && segment.legIndex === 1) { journey++; leg = 0; }
    if (segment.journeyIndex !== journey || segment.legIndex !== leg + 1) {
      ctx.addIssue({ code: 'custom', path: ['segments'], message: 'Segments must be in consecutive journey and leg order.' });
    }
    leg = segment.legIndex;
  }
  if ((value.tripType === 'one_way' && journey !== 1) || (value.tripType === 'round_trip' && journey !== 2)
    || (value.tripType === 'multi_city' && journey < 2)
    || new Set(value.segments.map(s => s.flightId)).size !== value.segments.length) {
    ctx.addIssue({ code: 'custom', path: ['segments'], message: 'Select distinct flights matching the trip type.' });
  }
});

export type SelectedItinerary = z.output<typeof selectedItinerarySchema>;
export function buildCheckoutHref(input: unknown) {
  return { pathname: '/checkout' as const, params: { selection: JSON.stringify(selectedItinerarySchema.parse(input)) } };
}
export function parseSelectionParameter(raw: unknown): SelectedItinerary {
  if (typeof raw !== 'string' || raw.length > 12000) throw new Error('Choose your flights before starting checkout.');
  return selectedItinerarySchema.parse(JSON.parse(raw));
}
/** Adapter for the current TV1 flight detail parameters. Never accepts a price. */
export function selectionFromDiscovery(input: Record<string, unknown>): SelectedItinerary {
  const count = (key: string) => typeof input[key] === 'string' && /^\d{1,2}$/.test(input[key]) ? Number(input[key]) : input[key];
  return selectedItinerarySchema.parse({ tripType: 'one_way', passengers: {
    adults: count('adults'), children: count('children'), infants: count('infants'),
  }, segments: [{ flightId: input.id, fareId: input.fareId, journeyIndex: 1, legIndex: 1 }] });
}
