# Booking, holds and pending payment implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline, with one fresh branch review at the end.

**Goal:** turn a reviewed quote into a resumable, saved pending booking with real temporary seat reservations.
**Architecture:** authenticated invoker RPCs delegate to private transaction implementations; existing schema and read RLS retained. Client persists only retry identifiers, then loads saved details by owner.
**Tech Stack:** Expo 58, React Native, Supabase PostgreSQL, TypeScript, React Query.
**Spec:** docs/superpowers/specs/2026-11-03-booking-holds-design.md

## Global constraints
- Three task commits; preserve existing infant guidance edits and untracked logo output.
- Hold 15 minutes capped at sales close, VND settlement, VI/EN display.
- No card collection/payment processing; no PII persistence in client storage.

## Review focus
- Lost create response followed by app restart must not create a second order.
- Mixed child/adult and paid/automatic seats cannot steal a selected or required eligible seat.
- Multi-flight lock order and active-seat unique index must protect concurrent requests.
- Changed price, malformed docs or invalid passenger must leave no partial booking/hold.
- Wrong account, app resume and device-clock skew must never expose data or extend hold.

### Task 1 — atomic creation
- [x] Write SQL rollback tests for auth, complete snapshot insert, rollback, changed quote, retry hash and same request ID.
- [x] Observe RED, implement migration and typed create payload/response adapter.
- [x] Verify SQL, client tests, lint/typecheck; commit.

### Task 2 — automatic allocation and expiry
- [x] Add failing tests for automatic/free assignment, selected-seat priority, infant companions, expired holds and collision constraints.
- [x] Implement allocator replacement and owner-scoped expiry/read RPC.
- [x] Verify SQL and permission advisors, add typed RPC signatures; commit.

### Task 3 — pending screen and safe retry
- [x] Add failing tests for retry persistence, changed input, uncertain outcomes, owner changes and countdown.
- [x] Add request journal, quote create action, pending route, Tickets resume and localized PDF screen.
- [x] Verify all tests, lint/typecheck, exports and browser portrait/landscape; review complete branch; commit.

## Execution ledger
- Baseline: 187 tests passed. Existing five copy-only edits retained. Working in current checkout on a new feature branch to preserve those edits.
- Task 1: observed SQL RED (create_booking absent), then rollback tests GREEN. Client adapter RED (module absent), then 3 tests GREEN. First allocator requires explicit seats; task 2 replaces it before cloud deployment/UI exposure. Fixed booking-code length against existing 32-character constraint during rollback verification.
- Task 2: observed RED booking.seatRequired for automatic seats; replacement allocator and owner read/recovery RPCs then passed rollback tests. Explicit seats allocated first; restricted travellers next. Due holds reused safely; owner detail expires status once. Global scheduler remains outside scope.
- Task 3: journal/pending tests RED absent modules then GREEN; owner race review fixed with token-bound client and RED→GREEN test. SQL role suites and real two-transaction race passed; exactly one order/hold. Test fixtures cleaned. Two booking migrations deployed alone; older admin/profile pending migrations preserved unexecuted. Browser fixture QA done VI/EN, portrait/landscape, expired state; QA route removed. Physical Android/full signed-in UI remains unaccepted.
- Review minor deferred: strict JSON string typing for raw RPC names; server currently validates their extracted text. No financial/ownership impact identified. Request UI sends validated strings.
- Final: 201/201 tests, typecheck/lint, both platform exports passed. Fractional baggage allowance regression RED→GREEN. Fresh reviewer reconfirmed no Critical/Important. Lockfile retains prior platform entries. Browser/Metro QA cleaned up, imagegen output preserved. No push/merge requested for this delivery.
