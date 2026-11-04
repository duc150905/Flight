# VNPAY Sandbox

Sandbox only. No real card/CVV entry in Flyora. Pay in hosted VNPAY checkout with merchant-provided test credentials. All saved amounts are integer VND; display USD remains indicative.

Server secrets: VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_RETURN_URL. Fill gitignored `.env.vnpay.local`, then set project secrets with the Supabase CLI; never commit the file. The gateway secret is never an EXPO_PUBLIC variable.

PAY: https://sandbox.vnpayment.vn/paymentv2/vpcpay.html . Query/refund: https://sandbox.vnpayment.vn/merchant_webapi/api/transaction . Both are fixed sandbox URLs in code. PAY canonicalization uses sorted form-encoded fields; QueryDR and refund use their own documented pipe-separated signing order.

References: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html and https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html . IPN controls settlement, return only navigation. Unknown gateway outcomes stay pending/review instead of being simulated.

## Deployed development endpoints

- IPN: `https://qisvuxiuwsqtkcrfpiwu.supabase.co/functions/v1/vnpay-ipn`
- Return: `https://qisvuxiuwsqtkcrfpiwu.supabase.co/functions/v1/vnpay-return`
- Authenticated POST: vnpay-create, vnpay-sync, vnpay-refund. Handler validates JWT through the Auth API, then owner-bound service RPC.
- Scheduled POST: vnpay-worker. Requires PAYMENT_WORKER_SECRET; Vault holds the matching value and functions base URL. pg_cron dispatches through pg_net every minute. No secret in cron job text.

Provider is frozen on first attempt. Old mock orders retain mock actions; new orders default to VNPAY in this branch. The signed return bridge redirects to `flight://payment-return?bookingId=...`, then the app reloads owner state. Return never confirms a booking. A late/duplicate paid attempt retains financial evidence for compensation without reassigning seats.

Cancellation is whole-order only. Preview uses saved fare rules/cutoff and captured expected fee. One refund per paid attempt: full compensation for unusable late/duplicate payments, or net refund after cancellation fee for a valid paid booking. Refund intent is persisted and claimed before HTTP; an unknown/submitted refund is never resubmitted blindly. QueryDR may not unambiguously identify a refund; after bounded reads it requires merchant review. Failed refunds require operator investigation, not a client outcome selector.

Owner state returns each refund job plus an aggregate state prioritizing review/unknown over completed. Admin reconciliation shows references/statuses for traceability and cannot manually mark financial success. Internal admin state strings still need VI/EN presentation polish.

## Confirmation email

After a booking first becomes confirmed, a private outbox captures the saved contact email, code, flights, travellers, seats, add-ons and VND total. Both mock and VNPAY confirmations enqueue mail; late-paid expired orders do not. Worker sends a bilingual, HTML-escaped sandbox confirmation using Resend and the verified flyora.site sender. It is not an airline ticket/boarding pass. No attachment in this version.

RESEND_API_KEY and BOOKING_EMAIL_FROM are server-only. Retry reuses a frozen sender/payload and `booking-confirmed/{bookingId}` idempotency key, has a two-minute lease, five-minute backoff, six-attempt cap and stops before Resend's 24-hour idempotency retention. An unresolvable mail outcome goes to review. Mail errors never roll back confirmed bookings. `sent` means accepted by Resend; actual inbox delivery is a separate acceptance check.

## Verification, 2026-11-04

- 227 Node unit tests; TypeScript and Expo lint passed. Node WebCrypto tests replace a separate Deno runner; Edge Functions bundled/deployed successfully using the Supabase API.
- Eight VNPAY SQL rollback suites passed on the deployed schema; six existing mock suites passed after adapting the wrong-amount fixture to the new immutable-payment guard. No fixture remains after verification.
- Ten VNPAY/email/hardening migrations and six functions deployed. Two unrelated pending admin/profile migrations were deliberately excluded and their histories were not repaired.
- Live unauthorized user/worker calls return 401; forged IPN returns RspCode97. Advisors have no ERROR; existing leaked-password-protection WARN remains unchanged.
- Resend reports flyora.site verified. Confirmed synthetic order -> outbox -> scheduled worker -> Resend test address produced state sent and a provider ID. No mail was sent to a real person's address for this test; fixture was cleaned.
- Web and Android/Hermes exports passed. Initial Android export had a sandbox temp-file write denial; export succeeded with a workspace temp directory under normal host execution.
- Hosted PAY readiness passed: valid signed sandbox checkout reaches the test payment-method selection page. Initial HTTP readiness incorrectly dropped the session cookie on redirect; retaining cookies fixed that test harness. A separate real code defect (Postgres inet::text appending /32) was reproduced RED and fixed through a forward migration normalizing host IPs. Config values match the user's email. QueryDR with a nonexistent transaction still returns unsigned99 and is not trusted as a result. User is configuring merchant IPN; actual card/QR payment and refund acceptance remain pending.
- Physical Android, bank/QR channel availability, actual sandbox refund completion and inbox delivery to a real booking contact remain unchecked. A fresh APK should be built from the final feature commit; do not use old APK8404da7 to test this integration.

## Refund UI and gateway check, 04 November 2026

Cancelling while `/receipt/[id]` is open now displays readable booking details instead of the stale e-ticket state error. Terminal bookings have no checkout total/payment footer or payment-method card. The refund section shows one card per refund job, a short status, amount, captured cancellation fee, and a completion timestamp when supplied by the server. Verified success is green; unknown/review is amber. Aggregate refund status is not rendered as a duplicate job. Both Vietnamese and English copy are included. Active-screen polling remains bounded to two minutes; after that a read-only status update action is offered. Reopening also reads the current result.

The actual recent sandbox refunds remain unresolved (`unknown`, with the existing `transport_or_validation` code after roughly 15 seconds). A separate read-only QueryDR probe for a real pending refund received HTTP 200 with code 99, without a signature; it could not verify a refund outcome. No refund was resubmitted and no booking/payment/refund rows were manually changed during diagnosis. Full gateway refund completion is still an acceptance item; do not mark these refunds succeeded without verified provider evidence. Computer Use could not verify the current Windows browser URL, so visual browser/Android acceptance remains pending. No new APK was built.

### Reproduce checks

`npm test`, `npm run check`, `npm run build:web`, `npm run build:android`.

`node scripts/prepare-vnpay-sql.mjs --deployed=10 worker email refunds provider checkout settlement sync cancellation` then Supabase `db query --linked --file supabase/.temp/checkout-options/vnpay-candidate.sql`. This script encloses tests in BEGIN/ROLLBACK; do not add internal COMMIT to fixture suites.

`node scripts/check-vnpay-sandbox.mjs` performs a read-only query with an unknown reference. `check-vnpay-checkout.mjs` requires a dedicated synthetic attempt JSON under the ignored temp directory and only reads hosted checkout; it never enters card/OTP. Credentials are read from the gitignored local secret file, never printed.
