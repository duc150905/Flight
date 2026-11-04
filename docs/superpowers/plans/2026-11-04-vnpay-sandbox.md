# VNPAY Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Each numbered task is one reviewed commit. No implementation or deployment has started.

**Goal:** Complete gateway-backed sandbox payment, whole-booking cancellation, refund and recovery in Flyora.

**Architecture:** Reuse existing bookings/holds and owner-bound UI; introduce isolated VNPAY attempt metadata and server-only settlement. Edge Functions own signing, callbacks, refunds and reconciliation. Provider results, not client-selected outcomes, control financial status.

**Tech Stack:** Existing Expo 58/React Native 0.88.1/Expo Router, TypeScript, Supabase Postgres/Edge Functions, VNPAY PAY 2.1.0.

**Spec:** ../specs/2026-11-04-vnpay-sandbox-design.md

## Global constraints

- Branch at execution time: codex/vnpay-sandbox, based on freshly fetched main; preserve output/imagegen and unrelated work.
- Sandbox only, VND settlement, VI/EN UI; no card/CVV entry/storage in Flyora and no production endpoint fallback.
- Whole-order cancellation; one server-calculated full/net refund per successful payment. No split booking or arbitrary multi-refund feature.
- Credentials are server secrets. No email credentials or VNPAY_HASH_SECRET in chat/Git/EXPO_PUBLIC variables or logs.
- Keep flight-before-booking lock order, existing RLS/owner checks and independent mock support. A client's mock RPC cannot settle VNPAY orders.
- Create new migration filenames through Supabase CLI; use skill/current docs and advisors. Do not alter old migrations or unrelated remote migration history.
- Per task: meaningful failing test, minimal implementation, passing checks, review and commit. Full local lint/typecheck before completion; integration checks when behavior crosses layers.

## Review focus

- Late signed success after seats expired/reallocated must be recorded without reviving the booking, with compensating refund/review.
- Timeout after refund submission must not cause a second financial operation.
- Correct PAY encoding differs from QueryDR/refund signing; verify official fixtures, Unicode, spaces, amount bounds and duplicate query parameters.
- Return/deep link is untrusted navigation input, not authority to confirm payment; no sensitive details in deep links.
- Provider switching and old mock endpoints must not bypass gateway verification, including cancellation/refund races.

## Task 1 — Provider-aware database and access boundary

Files: new CLI-generated migration; src/types/database.generated.ts; supabase/tests/vnpay-provider.sql.

Interfaces: private booking payment-route record locks `mock` or `vnpay_sandbox` at first attempt; private VNPAY attempt/event metadata references public payments/refunds. Add owner-readable `get_payment_state(p_booking_id uuid)` with safe provider/payment/refund/review data. No client settlement grants.

- [ ] RED: SQL tests prove current provider CHECK rejects VNPAY and prevent cross-provider/cross-owner operations.
- [ ] Add provider support, route enforcement for both start paths, unique gateway identities, RLS/restricted grants, and provider-aware expiry behavior. Preserve historical mock data and one-pending/one-success/one-refund constraints.
- [ ] GREEN: rollback suites, advisors and refreshed types; confirm anon/authenticated cannot write settlement data; commit `feat: isolate VNPAY payment records and permissions`.

## Task 2 — Signing and sandbox configuration

Files: supabase/functions/_shared/vnpay/{config,signing,contracts}.ts; corresponding *.test.ts; docs/VNPAY-SANDBOX.md.

Interfaces: `createPayUrl(input, config): string`, `verifyPayCallback(params, config): VerifiedPayment`, `signGatewayRequest(command, fields, secret): string`, `verifyGatewayResponse(command, response, config)`. Config is server-only; callbacks reject repeated/malformed fields.

- [ ] RED: official signing fixtures plus Unicode/space encoding, tampering, wrong merchant, unsafe integers and sandbox-only URL checks.
- [ ] Implement separate PAY versus QueryDR/refund canonicalization and strict response schemas; document secret names without values.
- [ ] GREEN: focused Deno tests; commit `feat: sign and validate VNPAY sandbox messages`.

## Task 3 — Start a sandbox checkout

Files: supabase/functions/vnpay-create/index.ts; new migration/service RPC `begin_vnpay_payment`; tests/vnpay-create.test.*; shared gateway types.

Interfaces: authenticated POST `{bookingId,requestId}` -> `{paymentId,paymentUrl,expiresAt}`. Edge validates user; service RPC loads saved total, provider route, version and hold. Client cannot supply payable amount or return host.

- [ ] RED: duplicate presses, wrong owner, expired/departed booking, mixed provider, version/amount mismatch.
- [ ] Persist unique attempt/reference/expiry before returning signed URL; recover same intent after lost response, do not extend holds.
- [ ] GREEN: endpoint/SQL tests; commit `feat: create idempotent VNPAY checkout sessions`.

## Task 4 — Verified IPN and atomic settlement

Files: supabase/functions/vnpay-ipn/index.ts; service-only `apply_vnpay_result` migration; supabase/tests/vnpay-settlement.sql; IPN tests.

Interfaces: public GET callback with VNPAY signature -> documented `{RspCode,Message}`. Service settlement accepts verified gateway identity/outcome, never a user-chosen success.

- [ ] RED: invalid hash/merchant/amount/reference; duplicate and reordered callbacks; payment versus expiry/cancel race.
- [ ] Validate before mutation; durable financial result and deduplicated event. Eligible success confirms seats/order atomically. Late success is paid but not ticketed, recorded for compensation/review. Return exact gateway acknowledgments without leaking internals.
- [ ] GREEN: role/rollback/concurrency tests; commit `feat: settle verified VNPAY payment notifications`.

## Task 5 — APK checkout and return bridge

Files: supabase/functions/vnpay-return/index.ts; src/app/payment-return.tsx; src/features/booking/{vnpay-payment.ts,use-vnpay-checkout.ts,vnpay-payment-panel.tsx,pending-screen.tsx,payment-success.tsx}; i18n/payment messages; client tests.

Interfaces: return bridge opens only configured Flyora route with opaque IDs; app reloads `get_payment_state`, including processing and review state. Use existing owner journal/guards; do not persist signed URLs with PII or secrets.

- [ ] RED: forged/foreign deep link, return before IPN, browser close, blur/account switch, reopen after lost response.
- [ ] Hosted checkout via SDK-58 documented WebBrowser/Linking APIs; show sandbox label, provider-specific actions, VI/EN and existing USD-display/VND-settlement behavior. Replace mock-only wording for VNPAY success/receipt.
- [ ] GREEN: focused client tests, lint/typecheck and web/Android export; commit `feat: add VNPAY checkout and return to Flyora`.

## Task 6 — Payment QueryDR reconciliation

Files: supabase/functions/vnpay-sync/index.ts; _shared/vnpay/query.ts; private sync queue/scheduler migration; gateway/SQL tests.

Interfaces: user-triggered owner refresh and restricted worker enqueue QueryDR; verified results reuse `apply_vnpay_result` from task 4. Persist unique gateway request IDs and rate-limited backoff.

- [ ] RED: missing IPN, API response code success but transaction pending, invalid signature, concurrent sync/IPN, rate limit/network timeout.
- [ ] Bounded reconciliation for active/unknown/late outcomes; do not hold DB locks across HTTP. Do not turn an unknown payment into terminal failure merely on local expiry.
- [ ] GREEN: endpoint and rollback tests; commit `feat: reconcile VNPAY payments after lost callbacks`.

## Task 7 — Whole-order cancellation and refund intent

Files: new provider-aware cancellation/intent migration; src/features/booking/booking-management-panel.tsx; shared payment client/messages; cancellation SQL/client tests.

Interfaces: safe cancellation preview `{allowed,fee,refundAmount}`; owner cancellation with request ID/expected fee. Successful paid cancellation creates one durable refund intent; unsettled payment outcomes are reconciled before final refund eligibility.

- [ ] RED: fare/cutoff denial, fee changed after preview, duplicate cancel, cancel versus success, net refund cap.
- [ ] Reuse saved policies; atomically cancel/release seats/save fee+due and create intent. Pending unpaid cancellation has no refund; later success must route to compensation, not be discarded. One net refund, no passenger/leg cancellation.
- [ ] GREEN: regress old mock and new VNPAY cancellation tests; commit `feat: cancel VNPAY bookings and prepare refund intents`.

## Task 8 — Gateway-backed full and net refund

Files: supabase/functions/vnpay-refund/index.ts; _shared/vnpay/refund.ts; service-only prepare/apply refund RPCs; private refund-outbox metadata; refund tests.

Interfaces: authenticated `{bookingId,requestId}` requests the saved refund amount, never accepts an arbitrary client amount/outcome. Durable outbox carries stable local refund identity, unique VNPAY request identity and original transaction/date.

- [ ] RED: wrong owner, nonrefundable/unpaid booking, wrong provider, over-refund, double click, transport failure after submission.
- [ ] Claim/persist before HTTP; choose documented full/net refund transaction type. Verify response signature and bindings; map API acceptance separately from final refund status. Never use refund_mock_booking for gateway money state.
- [ ] GREEN: gateway fixtures + SQL bounds/concurrency tests; commit `feat: submit full and net refunds to VNPAY sandbox`.

## Task 9 — Refund recovery, compensation and status UI

Files: vnpay-sync and shared reconciliation modules; restricted queue migration; booking-management-panel and admin payment/refund status; i18n/tests.

Interfaces: bounded worker resolves known refund intent; owner/admin sees pending/submitted/unknown/succeeded/failed/review states. Public API offers no manual success selector. Reuse same intent across restarts.

- [ ] RED: response lost, duplicate/in-progress gateway code, delayed success, refund denied, late paid expired booking and worker retry collision.
- [ ] Confirm actual merchant-supported refund reconciliation semantics. If cannot prove an outcome, retain review state and merchant trace rather than retry blindly. Compensate late successful payments with full sandbox refund; eligible cancellations refund net amount. Gate retry on safe known state.
- [ ] GREEN: status/worker/idempotency tests; commit `feat: recover VNPAY refunds and late payment compensation`.

## Task 10 — Configure, deploy and accept on Android

Files: supabase/config.toml; docs/VNPAY-SANDBOX.md; Android acceptance checklist; targeted regression fixtures only.

- [ ] Configure merchant secrets securely; deploy functions/migrations to intended dev project; provide exact HTTPS IPN/return URLs for user's merchant configuration. Verify gateway callback access and JWT/signature boundaries.
- [ ] Verify merchant test card/QR and refund capability from actual sandbox responses; document any provider restriction rather than replacing missing functionality with mock success.
- [ ] Full tests + lint/typecheck + exports/advisors; real sandbox success/failure/cancel, unknown/duplicate/late results, full/net refund and both languages. Build APK matching final commit, then physical Android acceptance. Never mark physical checks passed from an export alone.
- [ ] Final review, document evidence and limitations, commit `test: verify VNPAY payment and refund lifecycle`. Push/merge according to the user's integration instruction at execution time.
- [ ] User addition: send confirmation email to saved booking contact email only after booking confirmed. Add durable outbox unique per booking/event, provider email idempotency key, bounded retries, HTML escaping, server-only Resend API key, verified flyora.site sender, and no mail failure rollback of booking/payment. Apply to mock confirmations too. Never email a late-paid expired/unconfirmed booking as confirmed. Include booking code, itinerary, travellers, seat/baggage and saved total; no real airline ticket claim. If retry exceeds provider idempotency retention, leave unknown result for review instead of risking duplicates. Verify actual delivery separately from unit tests.

## Current handoff

Plan/spec only. No branch, implementation, DB mutation, deployed endpoint, merchant setting, secret storage or APK build has been changed by this planning turn. Existing untracked output/imagegen preserved. Needed before live tests: sandbox TmnCode/HashSecret configured server-side, merchant callback settings, confirmed refund-channel capability and access to the linked Supabase/EAS projects.
