# Checkout information (TV2)

The six F04 tasks use the original `Flight_Booking_Handoff.zip` screens as visual
reference: white surfaces, turquoise accent, progress indicator, traveller cards
and clear bottom actions. Personal data stays in RAM, never URL/storage/logs.

## TV1 handoff

Import `buildCheckoutHref` and `selectionFromDiscovery` from
`@/features/booking/selection`, then use Expo Router:

```ts
router.push(buildCheckoutHref(selectionFromDiscovery({
  id: offer.flight.id, fareId: offer.fare.id,
  adults: criteria.adults, children: criteria.children, infants: criteria.infants,
})));
```

For round trip/multi-city pass `{tripType, passengers, segments}` to
`buildCheckoutHref`. Each segment has `flightId`, `fareId`, `journeyIndex`,
`legIndex` (one-based, contiguous, chronological). One journey can have connecting
legs. At most 12 legs, 9 seated passengers, one infant per selected adult. No
prices/names/PII are accepted in the handoff. The URL only transports IDs/counts.

Flight data is read again from Supabase, not trusted from route parameters.
`loadCheckoutItinerary` rejects missing/inactive/mismatched fares, closed or
unpublished/non-scheduled flights, invalid connections and reversed times.
Dates use airport timezones. This is not a price quote or seat guarantee.

TV1 discovery remains in its separate open PR; this branch does not merge it.
Its detail-screen Continue button must call the helper above when integrating.

## Scope

Only contact/passenger information and review. Booking, seat, add-on and payment
RPCs remain separate work. No database migration or shared schema change.
