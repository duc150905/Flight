# Mock payment implementation plan

> Execute inline with superpowers:executing-plans; one final fresh review.

Goal: finish demo checkout/payment/cancel/refund using existing transactions and snapshots.
Spec: ../specs/2026-11-03-mock-payment-design.md

Constraints: eight task commits, PDF styling, VI/EN, VND amounts, no real card data/new package, private definer + invoker wrappers, preserve untracked imagegen.

Review focus: duplicate/late callbacks; payment versus expiry/cancel races; wrong-owner requests; persisted retry ID after lost response; whole-order cancellation policy and refund bounds.

- [ ] 1. Cron expiry migration and rollback tests; verify and commit.
- [ ] 2. Mock start/state RPC and typed client adapter; RED→GREEN tests; commit.
- [ ] 3. Atomic outcome resolution and idempotency ledger; SQL tests; commit.
- [ ] 4. PDF mock-payment UI and safe owner-bound retries; client checks; commit.
- [ ] 5. Success screen and demo e-ticket receipt; commit.
- [ ] 6. Server cancellation policy/preview/action and confirmation UI; SQL tests; commit.
- [ ] 7. Server mock refund/action and status/retry UI; SQL tests; commit.
- [ ] 8. Combined regression/roles/races, browser QA, builds and Android checklist; review, commit.

Ledger: baseline main 61057d1, user approved internal mock implementation. Physical device acceptance remains pending. Builder decisions are listed in spec.
