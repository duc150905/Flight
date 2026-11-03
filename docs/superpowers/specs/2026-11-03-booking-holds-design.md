# Create booking, hold seats and resume pending payment

Scope authorized in chat: create an atomic server booking, hold/automatically allocate seats, and a PDF-based pending-payment screen. Three task commits; no payment processing in this change.

Use the existing Expo 58/React Native, Supabase, React Query and VI/EN system. Keep VND as the settlement currency, USD indicative only. Reuse Checkout - Payment.png: four-step header, payment-method section, traveller/contact sections, fixed total/action footer. Payment method is explicitly unavailable until the later payment integration; do not collect card data.

Builder decisions: holds last 15 minutes, capped by the earliest sales close. Never charge an automatic seat assignment. Allocate selected seats first, then restricted passengers before unrestricted adults; automatic assignment avoids exit rows for children/infant companions. Adjacency is best effort, not guaranteed. Infant has no separate seat on legs where under 2. Allocation and insert happen in the same transaction.

create_booking(request_id, request) authenticates, serializes retries by user/request UUID, hashes the full payload, and returns the existing booking for an identical retry, even if its quote has expired. A different payload with the same UUID is rejected. It locks all flight inventory in UUID order, locks catalogue rows, re-quotes against current prices and verifies the displayed quote, validates names/contact/documents independently, stores immutable snapshots, allocates/holds seats, and records a safe event. Any exception rolls back everything.

Only authenticated can call the public invoker wrappers. Definer implementations live in private with empty search_path; ownership checked explicitly. Direct transactional-table writes stay denied. No PII in logs, URLs, local retry metadata or event metadata.

Pending screen accepts a booking UUID, reads only the authenticated user's saved booking and children, uses server time for countdown and refreshes on focus/resume. A server-owned expiry RPC expires only the caller's due pending bookings; seat-map/quote already disregard due holds. Creation clears due reservations under inventory locks before reusing them. No scheduler required for availability correctness; global background housekeeping and payment/late success are later tasks.

Persist only pending request UUID + SHA-256 payload digest per account before sending. Reuse after timeout and reload; unknown outcome must be resolved by request UUID before another booking attempt. Saved pending orders are accessible from Tickets after restart; checkout personal draft remains RAM only.

Validate SQL on flight-dev in rollback transactions first, including roles, rollback, price changes, idempotency, infant/cabin/exit restrictions and reservation collisions. Run client tests, lint/typecheck, exports and browser QA. Do not claim physical Android acceptance.
