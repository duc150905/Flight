# TV2 — saved pending booking and temporary seats

`create_booking(p_request_id uuid,p_request jsonb)` is authenticated. Request contains `checkout` (same IDs/DOB/companions used for quote), `expectedQuote`, normalized `contact`, and `travellers` (`{id,values}` from checkoutReview). Names/documents are sent only here, never to quote or URL. VND amounts are recomputed; the expected quote is a consent comparison, not a trusted price source.

Private definer authenticates, takes account/request advisory lock, returns same booking for same SHA-256 request hash, and rejects hash mismatch. All flight rows are locked in UUID order before catalogue share locks and another server quote. It inserts bookings, segments, passengers, passenger-segments, baggage snapshots, seat reservations and a safe created event in one transaction. Any exception rolls back all inserts. No client write grants/RLS relaxation.

Holds last 15 minutes, capped at earliest sales close. Explicit seats are allocated first, then travellers ineligible for exit rows, then other adults. Auto seats match cabin, are available/unblocked, and cost zero even if the seat normally has a selection fee. No separate seat for infant legs. Exit rows require age 18+ and no infant companion responsibility on that leg. Adjacent seating is not guaranteed. Live holds and confirmed reservations plus existing unique indexes prevent duplicates. Due holds are expired under inventory locks before reuse.

`get_pending_booking(p_booking_id uuid)` checks owner and returns saved receipt, contact, names, snapshots, per-leg passenger types/allowances, seats and baggage. It expires a due pending booking/holds and writes the event once. `find_booking_request(p_request_id uuid)` waits on the same advisory lock and returns only the caller's receipt, or null. It resolves an uncertain create outcome without resubmitting PII or making another order.

Availability is correct without a background scheduler: seat-map/quote ignore due holds, creation expires conflicting due rows before reuse, pending detail reconciles owner status. Untouched due booking rows may still say pending in the existing ticket list until opened. Global cleanup, cancellation and payment/late callbacks are subsequent tasks.

No money is charged, no payment row inserted, no confirmed booking created here. This change must not be presented as payment integration. SQL regression files use only synthetic auth/booking data inside BEGIN/ROLLBACK.

Recovery of a missing request writes a UUID tombstone in `private.closed_booking_requests` under the same advisory lock. A before-insert trigger rejects that closed UUID. Thus even an HTTP request delayed until after recovery cannot create an unnoticed duplicate. The private table has RLS and no client table grants; only the owner-aware RPC accesses it. No PII payload is stored there.
