# Checkout UI cleanup implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make airport times unambiguous, display the full seat map, and remove duplicate payment controls.

**Architecture:** Keep Expo/React Native components and the existing server cancellation policy. Show each flight endpoint by city/IATA while formatting its own local time. Render all cabin rows and disable seats outside the purchased cabin.

**Tech Stack:** Expo 58, React Native, Expo Router, existing VI/EN dictionaries and Node tests.

**Spec:** User's seven screenshots and four requested fixes in this chat; scope is presentation, not a change to fare, cancellation, refund or settlement rules.

## Global constraints
- Preserve the PDF/Flyora teal style, VI/EN and mobile touch targets.
- No database changes or fabricated seats; preserve actual row numbers and cabin eligibility.
- Keep the sandbox disclosure accurate and every cancellation behind confirmation.
- Work in the existing checkout on codex/checkout-ui-cleanup, preserving local environment and output/imagegen.

## Review focus
- Domestic endpoints share Asia/Ho_Chi_Minh; labels must identify the actual airports.
- International endpoints can have different timezones and local calendar dates.
- Leading or missing seat rows must not create large phantom gaps; other cabins remain visible but unselectable.
- Expired holds, cancelled bookings and policies that disallow cancellation must not show a cancellation action.
- Payment status refresh appears once, calls gateway reconciliation, and remains distinct from whole-booking cancellation.

## Task 1: Flight wording
- [x] In review-screen.tsx replace raw timezone suffixes with the appropriate city/IATA and a local-airport-time note; remove the obsolete development sentence and its translation.
- [x] Verify domestic and international endpoint labels in the browser. Copy-only changes need no text snapshot tests.

## Task 2: Seat map
- [x] Add failing cases to tests/checkout-seats.test.mjs: actual rows 6/8 stay 6/8 without invented rows; full rows 1/6 stay present and seats outside economy remain ineligible.
- [x] In seats.ts build sorted rows from actual map data; in seat-map-screen.tsx pass the full map. In seat-grid.tsx label cabin sections and visually disable other-cabin seats without losing their codes.
- [x] Run node --test tests/checkout-seats.test.mjs and verify rows 1–5 plus row 6 on mobile and desktop.

## Task 3: Payment actions
- [x] Add tests for cancellationStage(state, holdActive): unpaid hold, confirmed allowed, expired hold, denied policy and terminal states.
- [x] Add payment-presentation.ts, use it in both management panels, and capture cancellation stage/fee/refund when opening confirmation.
- [x] User steering: remove normal-flow status refresh buttons entirely. Reconcile once on VNPAY browser return and poll saved server status every 10 seconds for up to 2 minutes while focused; resume the window on app foreground. Show waiting/busy feedback and a single Retry only on error or unresolved outcome after that window. Keep cancellation separate, and show fee/refund figures only for paid cancellation.
- [x] Replace the gateway's mock hold sentence with neutral hold guidance. Reuse existing server actions and gate payment/cancellation by latest status and countdown.
- [x] Run npm test, npm run check and web export. Verify VI/EN pending, cancelled/refund, paid cancellation and mobile layout with synthetic fixtures; do not execute a real payment or cancellation during visual QA.


## Execution record
- Seat-row regressions were reproduced against the old implementation, then passed after using actual row numbers and displaying every cabin. No database changes were needed.
- Ruling: replace normal status buttons with a ten-second server-state poll for two minutes after focus/foreground/action; keep Retry on error or delayed result. This avoids indefinite background polling; results taking longer require reopening the order or Retry.
- Final review: fixed independent deadline expiry, detailed-seat reload after receipt transitions, read-only Retry for failed provider lookup, and active per-refund-job detection. Each was covered RED to GREEN; the mixed-refund finding was treated as Important because an unresolved financial result must continue updating.
- Browser QA used disposable synthetic data only. Verified VI/EN, 375px portrait and 812px landscape, disabled other-cabin seats, selecting economy 6A, unpaid cancellation confirmation, paid fee/refund display, no cancellation for expired/cancelled orders, no ordinary payment-status buttons, and one Retry on error. No gateway payment or database cancellation was executed.
- Temporary QA route removed. Physical Android and the full bank-return sequence were not re-run; the existing APK does not contain this new UI until rebuilt.
