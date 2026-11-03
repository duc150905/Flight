# TV2 — saved pending booking and temporary seats

`create_booking(p_request_id uuid,p_request jsonb)` is authenticated. Request contains `checkout` (same IDs/DOB/companions used for quote), `expectedQuote`, normalized `contact`, and `travellers` (`{id,values}` from checkoutReview). Names/documents are sent only here, never to quote or URL. VND amounts are recomputed; the expected quote is a consent comparison, not a trusted price source.

Private definer authenticates, takes account/request advisory lock, returns same booking for same SHA-256 request hash, and rejects hash mismatch. All flight rows are locked in UUID order before catalogue share locks and another server quote. It inserts bookings, segments, passengers, passenger-segments, baggage snapshots, seat reservations and a safe created event in one transaction. Any exception rolls back all inserts. No client write grants/RLS relaxation.

Holds last 15 minutes, capped at earliest sales close. Explicit seats are allocated first, then travellers ineligible for exit rows, then other adults. Auto seats match cabin, are available/unblocked, and cost zero even if the seat normally has a selection fee. No separate seat for infant legs. Exit rows require age 18+ and no infant companion responsibility on that leg. Adjacent seating is not guaranteed. Live holds and confirmed reservations plus existing unique indexes prevent duplicates. Due holds are expired under inventory locks before reuse.

`get_pending_booking(p_booking_id uuid)` checks owner and returns saved receipt, contact, names, snapshots, per-leg passenger types/allowances, seats and baggage. It expires a due pending booking/holds and writes the event once. `find_booking_request(p_request_id uuid)` waits on the same advisory lock and returns only the caller's receipt, or null. It resolves an uncertain create outcome without resubmitting PII or making another order.

Availability is correct without a background scheduler: seat-map/quote ignore due holds, creation expires conflicting due rows before reuse, pending detail reconciles owner status. Untouched due booking rows may still say pending in the existing ticket list until opened. Global cleanup, cancellation and payment/late callbacks are subsequent tasks.

No money is charged, no payment row inserted, no confirmed booking created here. This change must not be presented as payment integration. SQL regression files use only synthetic auth/booking data inside BEGIN/ROLLBACK.

Recovery of a missing request writes a UUID tombstone in `private.closed_booking_requests` under the same advisory lock. A before-insert trigger rejects that closed UUID. Thus even an HTTP request delayed until after recovery cannot create an unnoticed duplicate. The private table has RLS and no client table grants; only the owner-aware RPC accesses it. No PII payload is stored there.

Client uses a fixed-token Supabase RPC client per submit/recovery operation. A later sign-in/account change cannot send a previous traveller payload as the new account. Network callbacks are gated by screen focus and uncertain results remain resolvable in the journal.

## Pending UI and device recovery

`/checkout/quote` now has Create booking and hold seats. A changed quote still requires acknowledgement. On success the RAM draft is cleared and `/pending/[id]` loads saved DB details. Return via Tickets → detail → Resume pending booking after app restart. Pending screen rechecks on focus/app resume, derives countdown from server time plus monotonic elapsed time, and refreshes when countdown reaches zero. No device-clock extension of holds.

AsyncStorage journal contains only UUID, payload SHA-256 and phase, scoped by user UUID. It is persisted before any mutation. Unknown outcomes are resolved before another create; recover button also works when the old quote has expired. Server tombstones close requests not found by recovery. Failed resolution blocks a replacement create. New `expo-crypto` uses Expo SDK-compatible installation and is included in Expo Go.

UI uses Checkout - Payment.png: turquoise progress/header, method card, traveller/contact sections, sticky total and action. Since payment is not implemented the payment method section says so and the payment action is disabled; no card form or fake success is shown. VI/EN and VND/USD follow existing shared providers; attribution is below USD total.

## Verification and deployment — 03/11/2026

- The two booking migrations are deployed to flight-dev, with normal migration history. A temporary deployment workspace excluded two older pending admin/profile migrations; those remain unexecuted and were not silently marked applied.
- SQL rollback suites: booking creation, baggage/price snapshots, actual price changes, invalid contacts/documents/countries, request conflicts, missing quote expiry, expiry, automatic/selected/infant/exit rules, closed delayed requests and access control.
- Role suite actually uses SET LOCAL ROLE authenticated/anon, verifies owner-only reads and denied direct writes.
- Two concurrent Management API transactions on a dedicated synthetic 2050 flight: one created, one rejected; database had exactly one order and one held seat. Synthetic flight/users/booking removed afterward.
- Browser QA with synthetic saved-booking data: 375×844 and 844×390, VI/EN, VND/USD, sticky total, scroll, disabled payment, expired state and no console errors. QA route removed. Screenshots ignored under output/checkout-qa.
- Independent review: account-switch race fixed with token-bound RPC client and regression test. No remaining Critical/Important finding. Minor: direct malformed JSON non-string names may be coerced by PostgreSQL ->>; UI/client validator always sends strings. Further strict JSON typing can be hardened separately.
- Final checks: 201/201 client tests, typecheck/lint, Web export and Android/Hermes export passed. Lockfile dry-run accepted; only expo-crypto was added, existing platform-specific lock entries retained. Generated remote RPC signatures match the three client declarations.
- Not yet accepted on physical Android or full authenticated create UI. Payment/cancellation/refunds and a global expiry scheduler remain later work. Security advisors: no ERROR; pre-existing leaked-password-protection WARN unchanged.

Concurrent SQL fixture files are manual integration tests, not automatic migrations. Run setup only on flight-dev, substitute ACTOR_UID and LOCK_FIRST in two temporary worker copies, execute both concurrently, check exactly one order/hold, then always run booking-race-cleanup.sql. Cleanup targets only the named synthetic IDs.
