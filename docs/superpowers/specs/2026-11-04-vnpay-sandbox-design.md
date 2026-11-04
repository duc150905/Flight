# VNPAY Sandbox: payment, cancellation and refund

User requested a separate sandbox branch, then explicitly included cancellation/refunds. This document records the proposed scope; implementation has not started. User reports receiving merchant configuration by email. No credential values have been collected.

## Outcome

An Android Flyora user pays through VNPAY's hosted sandbox checkout, resumes a saved order, cancels an eligible whole booking, and receives a gateway-backed sandbox refund. VI/EN and VND settlement remain. Full refund means the paid amount; partial refund means the paid amount minus the saved cancellation fee. No separate passenger/leg cancellation, split booking, arbitrary repeated partial refunds, or production charging.

## Existing foundations and required corrections

- Reuse booking snapshots, seat holds, fare cancellation rules, transaction locks and owner-bound client request guards.
- payments.provider currently has CHECK(provider='mock'). There is one pending and one succeeded payment per booking; refunds.payment_id is unique. Preserve those invariants, allowing one net refund per successful payment.
- Add provider `vnpay_sandbox`; freeze each booking's provider at its first payment attempt in a private route record. Both mock and VNPAY entry points enforce it. Old mock bookings remain usable; a mock success/refund RPC must never settle a VNPAY booking.
- The booking-end trigger currently cancels every pending payment and writes a mock message. Restrict mock cancellation to mock payments. For a submitted gateway attempt, track local booking expiry separately from the gateway's financial outcome.
- Reuse cancellation fee calculations, but produce provider-neutral receipts/messages. A paid VNPAY cancellation must not call refund_mock_booking.

## Backend design

Supabase Edge Functions create and validate payment links, receive IPN, render a return bridge, request refunds and perform bounded reconciliation. Merchant secret and service credentials stay on the server. Each user endpoint validates the JWT and owner; callback endpoints cannot require a user JWT and instead validate the VNPAY signature and merchant identity. Settlement RPCs are service-only, with private implementation, empty search_path and no direct client financial writes.

Server loads the saved amount in integer VND; VNPAY wire amount is VND multiplied by 100 with safe range validation. Hosted checkout selects merchant-enabled payment channels; do not promise every card/QR test channel before testing this merchant account. Use the official PAY 2.1.0 encoding/HMAC-SHA512 rules and separate pipe-delimited signing rules for QueryDR/refund.

Return URL only returns the user to Flyora and triggers a state reload. Verified IPN, or verified QueryDR reconciliation, authorizes settlement. Save all successful gateway outcomes durably, including results arriving after expiry/cancellation. Confirm seats and booking atomically only when still eligible; otherwise do not revive/reassign seats, mark the transaction for full compensating sandbox refund/review.

Persist refund intent and request identity before the network call. Timeout/duplicate/in-progress is an unknown or processing state, not permission to send another refund. Verify response signature, reference, amount, transaction type and gateway status; distinguish API request acceptance from final transaction completion. Where QueryDR cannot identify the refund unambiguously, leave review pending and use merchant reconciliation; never invent a successful refund or retry blindly. Confirm merchant sandbox refund capability before reporting end-to-end success.

## Configuration and acceptance

User has flyora.site, but deployed callback hosting/DNS is unverified. Supabase HTTPS function endpoints can be used for IPN/return; a custom domain is optional. No website/DNS changes are included automatically.

Names: VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_RETURN_URL; sandbox PAY and transaction endpoints are allowlisted constants, not arbitrary client URLs. Never EXPO_PUBLIC_HASH_SECRET. Prefer a gitignored local server secret file or project secret settings; do not paste the email/password/secret into chat. Produce exact callback URLs after deployment so user can configure the merchant dashboard.

Required acceptance: payment success/failure/cancel/timeout; duplicate/out-of-order callback; wrong owner/merchant/signature/amount; late successful payment; no double confirmation/refund; unknown refund response; full/net refund; denied cancellation; Android return/reopen/lost network; UI VI/EN with clear sandbox label. APK must match final tested commit. Real Android acceptance and real VNPAY sandbox responses must be reported separately from mocks/unit/export checks.

References: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html and https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html . Recheck current Supabase/Expo docs before implementation.
