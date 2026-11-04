# VNPAY execution ledger

Plan: 2026-11-04-vnpay-sandbox.md. Baseline main 7c67814, 214 tests passed. In-place dedicated branch chosen to preserve existing local environment and user-visible checkout; no separate worktree.

- Task 1: provider isolation SQL RED (old CHECK constraint) -> GREEN (rollback on linked dev database). Migration not deployed yet. Includes owner state API, immutable provider routing, private metadata and mock-only expiry updates.
- Configuration: user supplied sandbox credentials; stored only in gitignored .env.vnpay.local. Never log or commit values.
- Task 2: signing tests RED missing module -> GREEN 4/4. Independent Node HMAC checks PAY and refund canonicalization, tamper/merchant/duplicate guards. Fixed sandbox endpoints and server-only config.
- User addition: confirmation email in task10, durable async outbox after confirmed booking (including mock), sent to saved contact email, uses verified flyora.site via Resend. Need RESEND_API_KEY configured locally before delivery test.
- Task 3: service-only checkout SQL RED missing RPC -> GREEN provider/checkout rollback suites. Attempt is persisted before returning signed checkout URL; owner validated by Auth API.
- Task 4: settlement SQL RED missing RPC -> GREEN duplicate/expiry/late-success and service permission suites. Ruling: a rare second paid attempt keeps its financial evidence in private.vnpay_attempts.gateway_paid and compensation state; existing one-success-per-booking index remains. Cost: reconciliation/UI must use the private ledger for compensation, not only payments.status.
- Task 5: return-ID/checkout-host RED missing module -> GREEN; APK uses owner-bound token and persisted request ID, signed return only redirects. Generic payment state selects legacy mock bookings; new bookings use VNPAY. Device acceptance pending.
