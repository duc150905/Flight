# Mock payment lifecycle

User approved all eight follow-up tasks using internal simulation, not a gateway. Keep Expo 58, existing Supabase schema, VND settlement and VI/EN display. No new package, card input, real charge or external callback.

1. A private cron job runs every minute, expires due pending orders/holds and cancels pending mock attempts. Lock flights in UUID order before bookings, matching create_booking.
2. Authenticated owner RPC starts an idempotent mock payment using saved total/version. Return existing pending/success attempt rather than duplicate. State RPC supplies saved attempts/refunds and cancellation preview.
3. Owner intentionally chooses demo outcome pending/succeeded/failed/cancelled. A private action ledger makes repeated resolution/cancellation/refund actions idempotent. Only a valid, unexpired booking with all required active holds and available scheduled flights can confirm. Confirmation and seats update atomically. Late success is rejected as cancelled, never charged. Failed/cancelled attempts can start another attempt within the original hold; pending attempts resume, never extend expiry.
4. PDF Payment layout: mock card method, explicit simulation label, outcome choices, traveller/contact and bottom total/action. Existing pending screen is reused, no real card/CVV storage.
5. PDF Payment Success layout and an authenticated demo ticket receipt show snapshot flights, passenger/seat/baggage and total. Explicitly not an airline-issued boarding pass.
6. Cancel whole pending order without fee. Confirmed order requires every passenger-leg snapshot to permit cancellation and be before its cutoff. Demo fee is sum of min(snapshot fee, that passenger-leg fare including tax/fee); other extras refunded. Server preview then expected-fee comparison before cancellation; release seats and snapshot refund due. No partial cancellation.
7. Cancelled paid orders can simulate pending/failed/succeeded refund of server-calculated due. One refund per successful payment, retries only failed/pending, succeeded terminal, idempotent actions. No refund if due zero or no successful payment.
8. SQL rollback tests and concurrency/expiry/access tests, client tests, exports, browser QA, Android acceptance checklist. Physical Android acceptance requires user's device; do not mark as completed locally.

All private definers have empty search_path and restricted grants. No direct transactional write grants. No PII in action ledger/local journal/URL. Preserve old two unexecuted admin/profile migrations; deploy only new migrations. Each task is a commit; user did not request push in this turn.
