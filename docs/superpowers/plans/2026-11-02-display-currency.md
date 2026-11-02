# VND/USD display currency

Approved intent: language and display currency are independent; persist VND/USD,
convert real prices, preserve checkout, and retain VND as DB/settlement currency.
No schema migration or USD payment support in this task.

Builder decisions: use ExchangeRate-API's public USD endpoint with attribution,
provider update timestamp and daily cache. Refuse rates older than 36 hours or
invalid/future timestamps; show clearly labelled VND fallback while unavailable.
USD amounts are indicative, rounded to cents after summing base VND amounts.
Never change stored fares, itinerary IDs, sorting by base prices or form values.

1. RED tests for independent persisted preference (including restoration race),
   provider validation/direction/rounding, stale/missing-rate fallback, cache reuse,
   request deduplication and HTTP failure. Implement pure preferences/rates/money
   presentation modules under `src/features/currency/`.
2. Add root CurrencyProvider, shared selector, rate attribution and MoneyText.
   Integrate discovery home/results/detail and checkout footer/review. Keep
   recorded transaction/ticket history in its original settlement currency.
   Handle request timeout, selection persistence errors, app resume, rate expiry
   and a retry action without resetting any other provider.
3. Verify all tests, lint/typecheck, Web/Android bundles, live public endpoint and
   browser language/currency/data retention; independent review, fix important
   findings, document provider/cache/DB boundaries and commit.

Review focus: USD division direction; cent rounding/unsafe amounts; cached-rate
freshness after failed refresh/resume; slow preferences vs manual choice; no USD
label on unconverted VND; no form resets, repeated-network storm or leaked PII.

## Completed verification

All three implementation steps are complete. RED/GREEN tests observed; final
suite: 139/139. `npm run check` passed (typecheck + Expo lint); Web and Android
exports exited 0. Live endpoint and 390 × 844 browser QA passed, including
currency/language persistence, input/error retention and original-tab retention
on attribution-link click. Removed the temporary preview route before exports.

Independent review completed. Fixed its important source-link navigation issue
and minor original-VND fee display / rate-expiry timing findings. Physical Android
lifecycle/keyboard QA remains pending; no DB migration was needed or performed.
