# Checkout Localized UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Six approved tasks, six commits, compatible shared data and PDF-aligned UI.
**Architecture:** Pure per-leg derivation; global persistent language store and
typed dictionaries; domain error keys translated at render; shared RN reference
components; combined RHF traveller/contact form; insert-only SQL demo fixtures.
**Tech Stack:** Expo 58, RN 0.88, Zod, RHF, Zustand, AsyncStorage, Supabase.
**Spec:** docs/superpowers/specs/2026-11-02-checkout-localized-ui-design.md

## Global Constraints
- No booking/payment/seat-hold APIs or public personal-data storage.
- First-departure counts; per-leg age/seat/companion; one itinerary/order.
- vi/en toggling cannot reset auth, raw form text or draft.
- PDF page12 is visual reference, with required business fields retained.
- Keep six commits; preserve existing untracked handoff artefacts.

## Review Focus
- Birthday changes child/adult or infant/child: Task1 regression tests.
- Companion eligibility and uniqueness on only relevant legs: Task1 tests.
- Slow storage restoration and rapid language toggles: Task2 tests.
- Errors already visible when language changes: Task3 render-time translation tests.
- Revisited combined form and privacy after auth change: Task5 form/store tests.
- Seed rerun and pre-existing shared catalogue ownership: Task6 SQL checks.

## Task 1: Per-leg passenger rules
- [x] RED tests: cross-birthday trips succeed, first-leg counts still checked,
  per-leg seats and eligible unique companions are derived without splitting.
- [x] Implement passenger-policy helpers and expose per-leg review data; adapt UI
  eligibility to infant legs. Update obsolete documentation.
- [x] Full tests + check; commit `fix(tv2): derive traveller rules per flight leg`.

## Task 2: Shared language foundation
- [x] RED tests for device fallback, persisted vi/en, races, storage failure.
- [x] Install compatible expo-localization, implement pure locale store,
  typed translator/formatters, provider and reusable vi/en picker at root.
- [x] Tests + check; commit `feat(i18n): add persistent Vietnamese English foundation`.

## Task 3: Localize checkout
- [x] RED tests for bilingual error messages, dictionary parity, unchanged data.
- [x] Translate domain issues and all checkout surfaces/formatting, preserving
  existing active errors and raw input. Document integration for TV1/TV3.
- [x] Tests + check; commit `feat(tv2): localize checkout content and validation`.

## Task 4: Reference components
- [x] Verify footer estimate and progress semantics with behavior tests.
- [x] Build PDF-aligned header, four icon steps, fields/sections/footer/safe area
  and responsive keyboard behavior. No fake totals or clickable future steps.
- [x] Tests + check; commit `style(tv2): align checkout components with reference PDF`.

## Task 5: Combined traveller screen
- [x] RED combined-form tests: independent IDs, contact/traveller errors, revisit,
  conditional documents/gender and unchanged data during locale switch.
- [x] Combine passenger/contact form in PDF order; preserve legacy entry routes;
  review per-leg classifications. Add nullable DB gender only if needed via CLI.
- [x] Tests + check; commit `feat(tv2): match traveller information reference screen`.

## Task 6: Safe demo fixtures and final review
- [x] Prepare insert-only deterministic seed and rollback verification SQL.
- [x] Verify fixture constraints/repeatability, data reads through public access
  and handoff. Record applied environment and generated future dates/IDs.
- [x] All tests/check, web/Android bundles, independent code review; fix important
  findings, update current team-facing status and task walkthrough.
- [x] Commit `test(tv2): prepare safe checkout demo data`.

## Completion evidence (2026-11-02)

124 Node tests; typecheck/lint; Web/Android exports; live read-only integration smoke; SQL gender constraint/RLS checks and seed rerun catalogue hashes passed. Browser QA at 390x844 verified language/error/data preservation and visible footer. Physical Android acceptance remains pending. Independent review: customer-text translation crash and phone input-order issue fixed with RED→GREEN regressions. Source English validation messages are stable translation identifiers. Dark button/icon text is used on reference turquoise for contrast.
