# Checkout details design

Approved scope: the user's six F04 tasks in chat, one commit per task. Existing
contact/passenger validators and draft store remain the foundation. No order,
seat hold, price quote or payment is created by this change.

## Interaction

English mobile-first checkout based on the handoff's white/turquoise traveller
screen, with Contact, Passengers, Review steps. First
validation happens on blur, then revalidates while fixing; Continue validates
the entire step and focuses the first invalid field. Raw text remains in memory
between steps. Review links back to either form. Cancel requires a concrete
discard confirmation and clears the draft. Reloading/process death loses it.

## Handoff and data

`SelectedItinerary`: tripType (one_way, round_trip, multi_city), ordered segments
with flightId, fareId, journeyIndex and legIndex (one-based), passenger counts.
Only IDs/counts are serialized in the checkout entry URL, never personal data.
TV1's existing detail/search fields have a one-way adapter. TV1's unmerged PR is
not merged or copied. `/checkout?selection=...` is the integration boundary.
Fetch selected flights/fares/airports from Supabase using the public client,
validate fare ownership, publication, availability and chronological continuity.
Derive departure calendar days in the origin airport timezone, not phone timezone.
This is a read-time check; future server booking operations must revalidate.

## Lifecycle

One store per authenticated user's mounted checkout layout. Initialize from a
validated hydrated itinerary and exact stable passenger slots. Same selection
retains input; changed selection resets it. Changing auth user/signing out destroys
the previous store immediately. Cancel/finish actions clear it; finish is reserved
for the future successful booking operation, not review. Stale entry loads cannot
replace a newer itinerary. No disk persistence, secret key or schema change.

## Demo passenger policy (age/companion/passport requirements approved in chat)

Age is computed for each departure local calendar day. Infant <2 without separate
seat; child >=2 and <12; adult >=12. Each infant needs a distinct companion >=18
on every leg. At least one adult, <=9 seated passengers, <=1 infant per selected
adult (matching TV1); selected type must remain correct on every leg, otherwise
return a clear request to split/reselect the trip. No minimum flying age is
claimed. Feb 29 birthdays advance on March 1 in non-leap years for this demo.
International means any segment crosses country codes; all travelers then need
ISO two-letter nationality/issuer codes, passport number and expiry no earlier
than any departure or arrival local calendar day. This is demo validation, not
country entry/visa advice or actual airline policy. Domestic documents optional.

## Verification

Node behavior tests for handoff, loader boundaries, lifecycle, form validation
timing, counts, age boundaries, timezone, companions, documents and review gate.
Run project tests, typecheck/lint for every task and web/Android bundle at end.
Review the complete branch with a fresh reviewer; preserve six task commits.
