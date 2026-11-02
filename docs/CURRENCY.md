# VND/USD display currency — Flyora

Language (`vi`/`en`) and display currency (`VND`/`USD`) are independent. Default
currency is VND. The selected currency is saved in AsyncStorage under
`flyora.displayCurrency`; changing language, account or checkout route does not
reset it or remount the checkout form.

## Meaning of the displayed amounts

All database fares and transaction amounts remain in their original VND units.
This feature converts search-result/detail prices and checkout estimates for
display. USD is indicative, prefixed with `≈`, with the original VND shown below.
Recorded ticket/payment history keeps its settlement amounts. USD payment is
not implemented and no DB schema or RLS policy is changed by this feature.

The existing foundation migration enforces `currency = 'VND'` on fares, services,
bookings and payment amounts. Keep these constraints for this display feature.
Supporting real USD settlement later requires a separate reviewed design for
transaction currency, currency-specific amount units, payment-provider support,
locked conversion rates/timestamps and refund reconciliation.

For a rate where 1 USD = R VND, USD = VND / R. Checkout sums the underlying VND
leg/passenger amounts first, then rounds the display total to cents. Sorting,
selection IDs, form values and server-bound data are unaffected by the display
choice. Invalid/unsafe amounts show unavailable rather than a fabricated price.

## Public rate source and cache

Source: [ExchangeRate-API Open Access](https://www.exchangerate-api.com/docs/free),
endpoint `https://open.er-api.com/v6/latest/USD`. No API key is needed. Its public
data updates daily and allows caching; each screen using USD displays the
required provider attribution link and rate timestamp. Only a public USD-rate
request is sent; no booking, contact, auth token or passenger data is transmitted.
On web, the attribution opens separately so it does not leave the checkout form.

The app accepts a successful USD-base payload with a positive finite VND rate,
valid update timestamps and a maximum age of 36 hours. An update more than five
minutes in the future or an implausible next-update interval is rejected.
The normalized rate is stored as `flyora.fx.usd-vnd` on the device and reused
until the provider's next-update time. Concurrent requests are deduplicated.

A root query runs only when USD is selected. It checks hourly and on app resume;
the cache avoids an HTTP request while current. Fetch has an eight-second abort
timeout. A still-valid cached rate can be used if refreshing fails. An expired
rate is never used for USD: amounts fall back to clearly labelled VND with a
loading/unavailable message and retry action. There is no hardcoded rate.
An expiry timer invalidates the displayed rate at its age limit; app resume also
checks the clock in case the operating system suspended timers.

## Files and reuse

- `src/features/currency/preferences.ts`: independent preference store and ordered writes.
- `rates.ts`: provider validation, timeout and persistent rate cache.
- `presentation.ts`: conversion, rounding, original amount and fallback.
- `provider.tsx`: one app-level query/lifecycle bridge; `useCurrency` and `useDisplayMoney`.
- `ui.tsx`: `CurrencyControls` and `MoneyText`; labels reuse the existing vi/en dictionary.

Use `<MoneyText amount={vndAmount} currency="VND" />` for display and put
`<CurrencyControls />` on the same screen for rate explanation/attribution.
Keep API requests and business calculations in VND. Do not save a displayed USD
estimate to VND DB columns or relabel an unconverted amount as USD.

## Verification (2026-11-02)

- 139 automated tests pass, including cache failures, preference races, conversion
  direction, rounding, unsafe amounts and keeping original VND in inline fees.
- Live public endpoint returned a valid USD/VND rate; browser displayed the same
  conversion with provider timestamp and source.
- Browser QA at 390 × 844: switching English/Vietnamese and VND/USD preserves
  entered traveller data and validation errors. Currency/language survive reload.
  Source link retains the original checkout tab and entered data.
- Temporary isolated preview route used for QA was removed before final bundles.
- Typecheck and Expo lint pass; production Web and Android exports succeed.
- Physical Android lifecycle/keyboard testing remains to be done on a device.
