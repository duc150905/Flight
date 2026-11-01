# Checkout Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement the six approved checkout information tasks as six commits.
**Architecture:** Pure validated handoff/policy modules, vanilla Zustand lifecycle,
authenticated Expo Router checkout layout, React Hook Form screens, read-only
Supabase hydration. Preserve existing validators and raw draft text.
**Tech Stack:** Expo 58, React Native 0.88, Zod 4, Zustand 5, React Hook Form 7.
**Spec:** docs/superpowers/specs/2026-11-01-checkout-details-design.md

## Global Constraints

- English checkout, existing dependencies only; no database or order writes.
- Six commits, one per requested task; documentation/setup belong to that task.
- Keep unrelated database walkthrough/PDF files untracked and untouched.
- Do not merge TV1's open PRs; provide a documented handoff adapter instead.

## Review Focus

- Malformed/duplicated/reordered selection and mismatched fare IDs: Task 1 tests.
- Auth changes, same selection retention, changed selection reset: Task 2 tests.
- Blur-first then change revalidation without input loss: Task 3 tests.
- Identical names and edits to different passenger IDs: Task 4 tests.
- Birthday during return, infant companion and passport expiry: Task 5 tests.
- Back/edit and stale review validity: Task 6 tests.

## Task 1: Selection handoff

Files: selection.ts, itinerary-data.ts, tests/checkout-selection.test.mjs,
tests/checkout-itinerary.test.mjs, docs/CHECKOUT.md and this spec/plan.
Produces SelectedItinerary, buildCheckoutHref, selectionFromDiscovery,
parseSelectionParameter, hydrateItinerary, localCalendarDay.
- [ ] Write failing tests for counts, multi-leg continuity, untrusted extra fields,
  malformed URLs, fare mismatch, unavailable flights, timezones and ordering.
- [ ] Implement pure validation and read-only Supabase loader; no price trust.
- [ ] Run tests and npm run check; commit `feat(tv2): accept selected itineraries`.

## Task 2: Draft lifecycle and routing

Files: draft.ts, checkout-provider.tsx, ui.tsx, app/checkout routes,
tests/checkout-lifecycle.test.mjs.
Consumes SelectedItinerary; produces beginCheckout/setStep/finish and reset behavior.
- [ ] Write failing tests for initialize/retain/reset, stable passenger slots,
  navigation guards, cancel/complete and owner isolation.
- [ ] Implement session-keyed provider, safe entry loading/retry, step shell.
- [ ] Run tests and npm run check; commit `feat(tv2): connect checkout draft lifecycle`.

## Task 3: Contact form

Files: contact.ts English messages, form-state.ts, contact-screen.tsx,
tests/checkout-form.test.mjs, app/checkout/contact.tsx.
Consumes store contact, produces validated contact and passenger navigation.
- [ ] Write failing tests for blur/change/submit feedback and field-level errors.
- [ ] Implement labelled keyboard-friendly form with raw draft synchronization.
- [ ] Run tests and npm run check; commit `feat(tv2): add checkout contact form`.

## Task 4: Passenger form

Files: passenger.ts English messages, passenger-screen.tsx,
tests/checkout-passenger-form.test.mjs, app/checkout/passengers.tsx.
Consumes stable slots, produces basic per-person data with no overwrites.
- [ ] Write failing tests for independent updates and missing passenger data.
- [ ] Implement all required passenger cards and consistent inline validation.
- [ ] Run tests and npm run check; commit `feat(tv2): add passenger details form`.

## Task 5: Passenger policies

Files: passenger-policy.ts, draft.ts, passenger-screen.tsx,
tests/checkout-passenger-policy.test.mjs, docs/CHECKOUT.md.
Consumes hydrated departure/arrival dates and slots; produces policy issues.
- [ ] Write failing tests for exact ages on every leg, counts, companion uniqueness,
  invalid countries, required passport and expiry across itinerary.
- [ ] Implement documented demo policy and conditional document/companion fields.
- [ ] Run tests and npm run check; commit `feat(tv2): enforce demo passenger rules`.

## Task 6: Review and edit

Files: review.ts, review-screen.tsx, app/checkout/review.tsx,
tests/checkout-review.test.mjs, docs/FEATURES-AND-TEAM.md, docs/CHECKOUT.md.
Consumes current store and full policy validation; produces review summary only.
- [ ] Write failing tests for normalized summaries, invalid/missing/stale data
  rejection and raw input preservation when returning to edit.
- [ ] Implement itinerary/contact/passenger review and edit links; no fake booking.
- [ ] Run all tests, npm run check, web/Android bundles; whole-branch code review.
- [ ] Commit `feat(tv2): add checkout review and editing`.
