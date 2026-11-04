# Flyora Android — VNPAY sandbox acceptance

Status: real device and full gateway payment/refund acceptance pending. Backend deployment, unit/SQL checks and Resend test-address acceptance do not replace these checks.

Use a new preview APK built from codex/vnpay-sandbox, not the earlier APK8404da7. No Metro server/Android Studio is needed for a standalone preview APK. Log in, choose a future available demo itinerary, enter disposable traveller details and a contact email you control. Use only test card/OTP/QR channels provided for this merchant sandbox.

- [ ] Merchant IPN URL is saved; return endpoint is configured in server secrets. User can open the merchant configuration portal.
- [ ] Hosted VNPAY page loads with correct VND total; merchant-enabled card/QR channel is available. No real bank transfer.
- [ ] Success returns to Flyora; server confirms order/seats, shows receipt and sends one confirmation to the saved contact email. Check spam folder; receipt is explicitly sandbox-only.
- [ ] Failure/cancelled browser leaves the order recoverable inside its original hold. Pending outcome does not enable a second unresolved charge.
- [ ] Lose network/kill/reopen app; refresh reconciles through server. Repeated callback/button presses do not create duplicate confirmation/email.
- [ ] Paid Flex cancellation shows the saved fee/net refund before consent; Standard or cutoff denial is explained. Cancel affects the whole booking.
- [ ] Net refund/full compensating refund uses actual gateway API, not mock outcome selection. Record merchant transaction/refund references and terminal gateway status; check that unknown status is not shown as refunded.
- [ ] Payment after expiry never steals/revives seats; it records compensation/review. Multiple paid attempts show individual refund states without crashing.
- [ ] VI/EN, large font, keyboard and Android Back/browser return remain usable. USD is display only; settlement remains VND.
- [ ] Other-account access is denied; no keys/card details appear in logs/screenshots.

Record device/build commit, booking code, steps and masked screenshots. Do not include password, JWT, gateway HashSecret or API key. Hosted checkout readiness now passes; nonexistent-transaction QueryDR returns unsigned99, which must not update financial status. Full bank/OTP/refund acceptance still requires user testing.
