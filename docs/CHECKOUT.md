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

## Draft lifetime

The checkout layout creates one store per authenticated user. Navigating between
its child screens keeps the same store; logging out/changing user replaces it.
`beginCheckout` initializes stable `adult-1`, `child-1`, `infant-1` slots. Loading
the same selection refreshes flight data without losing text; changed IDs/counts
clear all previous personal data. Cancel asks before discarding. `finish()` is
provided for a future successful booking operation, not invoked by review.
Leaving/unmounting checkout or reloading loses the in-memory draft by design.
Async entry loading ignores responses after a new selection or route unmount.

Contact uses React Hook Form `onTouched`: untouched typing stays quiet, first
blur validates, editing a touched field updates errors immediately. Continue
checks all fields and focuses the first invalid input. Each edit is immediately
copied as raw text to the shared draft. Validation produces a normalized copy
without changing what is displayed. Forms are keyed by selection to avoid stale
local form state after a new itinerary.

Traveller forms use fixed stable slots from the selected counts, separate names
and birth dates, the same blur/change/submit feedback as contact, and individual
draft updates by ID. Names can be identical without sharing data. Opening the
traveller route without valid contact redirects to the contact step.

Only contact/passenger information and review. Booking, seat, add-on and payment
RPCs remain separate work. No database migration or shared schema change.
