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
unpublished flights outside scheduled/delayed status, invalid connections and reversed times.
Dates use airport timezones. This is not a price quote or seat guarantee.

TV1 discovery is integrated. Its detail screen uses `checkoutHrefForOffer()` to
check the fare/flight relationship and open checkout with the selected passenger
counts. Public search is available without signing in; checkout requires
authentication and retains the IDs-only entry URL during sign-in.

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

## Approved demo passenger policy

- Infant: age <2, no separate seat; child: 2–11; adult: >=12.
- Compute completed years on every departure's local date. A Feb 29 birthday
  advances on March 1 in non-leap years in this demo. Search counts describe the
  first departure. Later birthdays change the per-leg type/seat requirement,
  keeping one itinerary and stable passenger IDs; never request a split booking.
- Exact stable slots must match selected counts, with no duplicate/missing IDs.
- Each infant selects a distinct accompanying traveller aged >=18 on infant legs.
  A 12–17-year-old can be an adult fare traveller, but cannot accompany an infant.
- Any international segment requires nationality, passport number, issuing
  country and expiry for all travellers. Codes are ISO alpha-2; issuing country
  is an additional builder choice to keep passport data unambiguous.
- Passport must be valid through every departure and arrival local calendar day;
  same-day expiry passes the demo rule. Domestic documents are optional, but if
  supplied their format and expiry are checked. No minimum flying age, visa or
  country-specific passport validity period is claimed by this demo.
- All of these are client feedback. Future server booking RPCs must enforce
  the same rules using trusted flight data and booking time.

## Review and editing

`checkoutReview` always validates the current raw draft again, including exact
traveller slots and policies. Invalid contact/travellers point to the correct edit
step; sales-closed/departed flights require a new selection. Review displays the
hydrated itinerary, normalized contact and every traveller/document/companion.
Returning to edit retains raw values. Confirm traveller details is an in-memory
acknowledgment only, invalidated by edits; it does not clear the draft, create an
order, hold a seat or charge money. Those operations belong to later TV2 work.

Back/Edit uses Router `dismissTo` to return to the existing step instead of
creating duplicate step screens. On focus both forms restore the latest shared
draft, so native Back cannot expose stale cached default values. Companion
eligibility trims DOB exactly like the validator; corrections revalidate already
touched/invalid companion fields without showing untouched errors early.

## Six tasks and commits

1. Selected itinerary schema, TV1 adapter and read-only hydration.
2. Authenticated checkout routes, draft ownership/lifetime and cancel handling.
3. Contact form with blur-first/change/submit validation.
4. Stable per-traveller forms and draft synchronization.
5. Approved age/count/companion/document demo policy.
6. Validated review, editing and informational details acknowledgment.

Run `npm test`, `npm run check`, `npm run build:web`, `npm run build:android`.

## Verification on 2026-11-01

- `npm test`: 84 passed, 0 failed.
- `npm run check`: TypeScript and lint passed.
- Web export and Android Hermes export passed (custom ignored output directories
  under `supabase/.temp/checkout-work/`; Windows sandbox output restrictions
  required running the final exports outside the sandbox).
- Independent review's four findings fixed and targeted regressions passed.
- Read-only public Supabase catalogue queries succeeded, returning no available
  rows. No real-flight end-to-end test or Android device acceptance yet.
- Browser visual inspection could not be completed: embedded webview did not
  attach and Windows Computer Use stopped because it could not establish the URL.
  Temporary fixture route was removed and is not part of the deliverable.
- Vietnamese task/file walkthrough: [CHECKOUT-WALKTHROUGH.md](CHECKOUT-WALKTHROUGH.md).

Only contact/passenger information and review. Booking, seat, add-on and payment
RPCs remain separate work. No database migration or shared schema change.
