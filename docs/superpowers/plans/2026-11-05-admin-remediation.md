# Admin Compatibility Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Resolve every actionable finding in ADMIN-FUNCTIONAL-REVIEW-2026-11-05.md with server-enforced behavior, complete data/search and truthful customer/admin presentation.
**Architecture:** Preserve the existing Expo58/Supabase contracts and add forward migrations. Server role/account directory and suspension state are authoritative. Admin query data is isolated by account. Catalogue writes validate inventory and publication; financial metrics use immutable payment/refund events. Existing money/order records are not rewritten.
**Tech Stack:** Expo58, React Native0.88, TypeScript6, Supabase Postgres/Edge Functions, Node24 tests.
**Spec:** docs/ADMIN-FUNCTIONAL-REVIEW-2026-11-05.md plus user's explicit request to fix all findings.

## Global Constraints

- Preserve current admin roles, real users, bookings, payments and unresolved refund jobs. Only temporary isolated/rollback fixtures may exercise mutations.
- No resubmitting refunds, pretending gateway success, new APK, push or merge in this request.
- New server code must be owner/admin authenticated, reject local metadata privileges and protect last-admin/self-lockout.
- Suspension must block server account actions even with an unexpired access token; Auth admin operations/secrets stay server-only.
- Use forward migrations created with Supabase CLI, do not edit old applied migration history or apply unrelated pending migrations.
- Mobile-first UI, existing teal palette, VI/EN labels, no new dependencies unless necessary.
- Read all list pages with stable ordering; surface errors rather than silently treating missing data as complete.
- Capability ruling: checkout currently sells one baggage choice per traveller/leg. Unsupported meal/insurance sales must be explicitly labelled/read-only and quantity editing constrained to one; do not invent an insurance/purchase feature.
- Media ruling: support HTTPS and known bundled destination paths; unknown relative media must produce actionable validation rather than silent success. Airline HTTPS logos must render with an initial fallback.

## Interfaces and ownership

- Access worker owns permissions/auth/admin layout, account directory service, new account migration and Edge Function. Produces `loadAdminAccounts(client)` -> `{id,email,fullName,phone,role:'admin'|'customer',suspended:boolean,createdAt}`[] plus mutation functions and `useAdminAccounts()` using account-scoped admin QueryClient.
- Catalogue worker owns catalogue/flight/addon screens and loaders, inventory/publication/fare migration, media resolver and customer discovery logo/image renderers. Does not edit admin/model.ts or admin/ui.tsx; requests shared schema changes from root.
- Transaction worker owns bookings/customers/payments/reports/dashboard, new financial-summary.ts, VNPAY review paging service/migration. Consumes account directory above and root search helpers; does not edit admin/model.ts or admin/ui.tsx.
- Root owns admin/model.ts shared schema/search wrappers, admin/ui.tsx global routing, migration deployment/order, generated DB types, integration, docs and verification. Workers do not commit or deploy; root commits scoped completed tasks.

## Review Focus

- Switching owners while a query/mutation is in flight cannot expose stale admin data.
- Revoked/suspended/last administrator cannot retain or accidentally destroy authority; ordinary account metadata cannot grant authority.
- Rows beyond API cap and 101+ reconciliation exceptions remain searchable; VN accent/case/spacing are normalized.
- Template shrink/cabin change preserves referenced inventory and publication=false is actually private; unsupported fare cabins rejected.
- Paid cancellation + refund leaves the retained fee in net receipts; cross-period payments/refunds and delayed completion use event dates.

## Tasks

### Task1: Authoritative account access and cache isolation
- [x] Add failing tests for directory email/roles, grant/revoke/suspend/last-admin, stale owner response/cache boundaries.
- [x] Implement admin-only paged directory and audited role changes; implement real suspension with server checks and Auth Admin integration as needed. Replace local overrides and fabricated emails.
- [x] Add account-scoped admin query provider and logout/revocation cleanup; migrate permissions screen to server data and real audit entries.
- [x] Verify SQL rollback/unauthorized and client tests, scoped review, commit.

### Task2: Complete catalogue loading and safe inventory writes
- [x] Reproduce API-cap, shrink template and publication cases in tests.
- [x] Page loaders and selectors; stable ordering and parameter synchronization. Add forward RPC fixes for omitted seats, cabin changes, explicit publication and fare/cabin validation without changing booked-flight safety guards.
- [x] Align unsupported services/quantities; resolve/validate media and render logos.
- [x] Verify rollback inventory/publication/fare tests and customer data compatibility, scoped review, commit.

### Task3: Shared search and navigation
- [x] Test diacritics (including đ), whitespace/multi-token queries and airline codes KE/TG/MH/CX/VU/F0.
- [x] Add reusable search normalization/token matching and generic IATA-flight routing in admin-search.ts. Wire filterAndPaginate and AdminShell.
- [x] Synchronize route q/ownerId filters in flights/bookings and all-owner booking history; verify >1000-row fixtures and commit.

### Task4: Transactions, finance and reconciliation
- [x] Test paid1553000/refund1203000 -> retained350000, cross-period completed_at/captured_at, pending/review exclusion and duplicate-payment handling.
- [x] Implement separate confirmed-booking value, successful receipts, completed refunds and net cash metrics; remove misleading mock labels.
- [x] Add real role/account search to customer list; complete booking flight/seat/addon details. Reconciliation supports paging/query, links exact booking/payment and exposes unknown/review/reference/completion time.
- [x] Remove local audit merging and fail visibly on audit errors; scoped review and commit.

### Task5: Integration/deployment and regression verification
- [x] Review all changed contracts, generate public DB types, run Node suite/typecheck/lint/web export.
- [x] Review and apply only the new forward migrations/functions to flight-dev; rollback fixtures prove fixes and server denial for ordinary/suspended users.
- [x] Compare protected real data fingerprints/counts and current roles before/after; no live account suspension or financial mutation used for tests.
- [x] Final independent review, fix important issues, update audit/handoff with verified/fixed/externally blocked items. Report physical UI/gateway acceptance honestly.

## Progress

See this plan's ignored SDD workspace ledger for rulings, completed tasks, commits and verification results. Continue until all five tasks are complete; do not stop after proposing the plan.
