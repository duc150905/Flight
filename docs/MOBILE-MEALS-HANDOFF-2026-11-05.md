# Android layout and meal checkout handoff

Stopped at the user's request to save quota. Work is on `codex/mobile-meals-and-keyboard`; do not merge or delete `codex/vnpay-refund-investigation`.

## Implemented locally

- Android AI chat explicitly avoids the keyboard inside the full-screen modal and scrolls messages after layout changes. Actual Android keyboard acceptance is still pending; no APK was built.
- Admin headings/actions stack on narrow screens; permissions controls and account grant layout adapt to phone widths.
- Checkout service tabs use native icons and short labels. Meals can be selected independently per traveller and flight, replaced or removed, with prices included in estimate/quote/detail screens. Ingredient/product substitutions require reselection.
- Trusted server meal pricing and atomic booking snapshots are in `20261105124259_checkout_meals.sql`. Existing account guards, request recovery and idempotency remain. Legacy quotes omit meal fields; pending responses retain aggregate `baggage` for older APKs and expose `baggageOnly`/`meal` for new clients.
- Admin supports baggage and meal authoring; insurance stays read-only and existing categories cannot change.
- Six bilingual meal products and a repeatable insert-only seed are ready. See `MEAL-CHECKOUT.md` for exact menu and commands.

## Verified

- 313 Node tests passed; typecheck and lint passed during implementation.
- Candidate migration plus meal checkout and admin catalogue SQL tests passed in one linked database transaction ending in ROLLBACK, including round-trip and three-journey passenger/meal mapping. A later additional forged meal price assertion was not rerun.
- Candidate migration plus meal seed executed twice and rolled back: 6 products and 40,110 offers for 6,685 eligible flights on the first run; zero new rows on the second. Existing catalogue and all protected application/inventory fingerprints were unchanged.

## Still pending — not deployed

- The migration and seed have NOT been applied persistently to Supabase. Phone users will not see the new meals until deployment and a new app build.
- Re-run the final SQL suite before deployment, then deploy only the new migration. Remote migration history has two older local-only entries (`20261102123000`, `20261103013000`); do not blindly push or repair those.
- Apply the meal seed, run its read-only coverage verification, and run security advisors.
- Visually verify phone layouts and native keyboard behavior. Local web server on port 8081 was not running during the attempted preview. No emulator/device session was available.
- Build a new preview APK only when requested. Preserve the current valid Gemini preview environment and the separate deployed refund investigation.
