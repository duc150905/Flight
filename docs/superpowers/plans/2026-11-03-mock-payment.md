# Mock payment implementation plan

> Execute inline with superpowers:executing-plans; one final fresh review.

Goal: finish demo checkout/payment/cancel/refund using existing transactions and snapshots.
Spec: ../specs/2026-11-03-mock-payment-design.md

Constraints: eight task commits, PDF styling, VI/EN, VND amounts, no real card data/new package, private definer + invoker wrappers, preserve untracked imagegen.

Review focus: duplicate/late callbacks; payment versus expiry/cancel races; wrong-owner requests; persisted retry ID after lost response; whole-order cancellation policy and refund bounds.

- [x] 1. Cron expiry migration and rollback tests; verify and commit (3b30a48).
- [x] 2. Mock start/state RPC and typed client adapter; RED→GREEN tests; commit (7cd1d45).
- [x] 3. Atomic outcome resolution and idempotency ledger; SQL tests; commit (fc71c72).
- [x] 4. PDF mock-payment UI and safe owner-bound retries; client checks; commit (073c190).
- [x] 5. Success screen and demo e-ticket receipt; commit (69e0c76).
- [x] 6. Server cancellation policy/preview/action and confirmation UI; SQL tests; commit (7dcb4fa).
- [x] 7. Server mock refund/action and status/retry UI; SQL tests; commit (5069424).
- [x] 8. Combined regression/roles/races, browser QA, builds and Android checklist; final review completed. Physical Android acceptance is pending, not included in this completion mark.

Ledger: baseline main 61057d1, user approved internal mock implementation. Physical device acceptance remains pending. Builder decisions are listed in spec.

Final evidence, 2026-11-03:
- 211/211 unit tests; npm run check (TypeScript + Expo lint); git diff --check passed.
- Expo web export and Android/Hermes export passed. No physical Android session or APK acceptance is claimed.
- Six rollback SQL suites passed on flight-dev: expiry, attempts, resolution, cancellation, refunds, roles. Actual authenticated/anon role checks and cross-owner/direct-write denials included.
- Concurrent payment/cancel requests on a dedicated synthetic 2050 flight returned cancelled booking/payment, zero confirmed seats/events. Both requests completed successfully; fixture cleanup followed. This observed interleaving complements transactional SQL tests; it does not exhaust all scheduler interleavings.
- Five new migrations deployed; cron has a succeeded run. First four were applied early by a test-builder transaction-boundary bug. Compared 15/15 deployed function bodies to source, verified rollback tests, then repaired only the four histories after the user's explicit approval. Fifth deployed normally. The builder now has a regression test rejecting internal transaction boundaries. Older admin/profile migrations remain untouched.
- Browser fixture QA at 375x844 and 844x390: VI/EN, VND/USD, payment scenarios, cancellation modal, refund retries/terminal state; no console errors after fixing empty-string RN children. Temporary QA route/tab/server removed.
- Final code review found no Critical/Important issues. Minor stale pending-cache risk fixed with timestamp selection and refreshing both state sources on expiry; reviewer rechecked.
- Handoff: docs/MOCK-PAYMENTS.md and docs/ANDROID-CHECKOUT-ACCEPTANCE.md. Eight local commits; no push/merge requested for this batch.
