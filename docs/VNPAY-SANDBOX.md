# VNPAY Sandbox

Sandbox only. No real card/CVV entry in Flyora. Pay in hosted VNPAY checkout with merchant-provided test credentials. All saved amounts are integer VND; display USD remains indicative.

Server secrets: VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_RETURN_URL. Fill gitignored `.env.vnpay.local`, then set project secrets with the Supabase CLI; never commit the file. The gateway secret is never an EXPO_PUBLIC variable.

PAY: https://sandbox.vnpayment.vn/paymentv2/vpcpay.html . Query/refund: https://sandbox.vnpayment.vn/merchant_webapi/api/transaction . Both are fixed sandbox URLs in code. PAY canonicalization uses sorted form-encoded fields; QueryDR and refund use their own documented pipe-separated signing order.

References: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html and https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html . IPN controls settlement, return only navigation. Unknown gateway outcomes stay pending/review instead of being simulated.
