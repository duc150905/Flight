# Nội dung nhờ VNPAY kiểm tra kết nối sandbox

Soạn thư mới gửi **kythuatctt@vnpay.vn**, địa chỉ hỗ trợ kỹ thuật được công bố tại https://sandbox.vnpayment.vn/apis/contact/. Nếu cần chuyển tuyến, liên hệ **hotrovnpay@vnpay.vn** hoặc **1900 55 55 77** theo https://vnpay.vn/lien-he. Đây là thông tin được công bố chính thức; chưa kiểm chứng việc hộp thư nhận thư thực tế.

Đã kiểm tra file thư cấp merchant: From là no-reply@noreply.vnpay.vn, Reply-To là no-reply@vnpay.vn; chữ ký có support.vnpayment@vnpay.vn. Địa chỉ trong chữ ký đã bị Gmail trả về lỗi 550 5.1.1 khi người dùng gửi, nên không tiếp tục dùng địa chỉ này.

Chỉ sao chép phần từ “Chào bộ phận kỹ thuật VNPAY” đến lời cảm ơn, hoặc dùng file VNPAY-SUPPORT-EMAIL-BODY-2026-11-05.txt cùng thư mục. Không sao chép phần hướng dẫn này vào nội dung email. Không chuyển tiếp toàn bộ email cấp merchant vì có chứa HashSecret.

**Tiêu đề:** Sandbox merchant AMYSDLKQ — refund timeout, QueryDR unsigned99, cần kiểm tra kết nối cloud

Chào bộ phận kỹ thuật VNPAY,

Merchant Flyora, TmnCode **AMYSDLKQ**, thanh toán PAY sandbox thành công nhưng chưa xác minh được hoàn tiền. Nhờ anh/chị kiểm tra:

- Giao dịch gốc: **15726344**.
- Merchant reference/TxnRef: **2b69c7ed3b2f49daa98941ba6d4816a9**.
- CreateDate giao dịch gốc: **20261105110728**, PayDate: **20261105110802**, GMT+7.
- Thanh toán: **1.468.000 VND**.
- Hoàn một phần (`vnp_TransactionType=03`): **1.118.000 VND**.
- Refund RequestId: **fbc476d95d1c4fd69e578e115aa0112d**.
- Thời điểm gửi yêu cầu hoàn: **05/11/2026 lúc 11:09:00 GMT+7**; ứng dụng hết hạn chờ sau 15 giây.

Endpoint sử dụng theo tài liệu:
`https://sandbox.vnpayment.vn/merchant_webapi/api/transaction` — POST JSON, version 2.1.0.

Các phép kiểm tra chỉ đọc:

1. Từ máy phát triển, QueryDR cho giao dịch có thật nhận HTTP 200 với `{"vnp_ResponseCode":"99","vnp_Message":"Unexpected error"}`, không có vnp_SecureHash.
2. Từ Supabase Postgres/pg_net, QueryDR timeout 45 giây trong pha TCP/SSL, HTTP request/response time 0 ms.
3. GET trang công khai của sandbox từ cùng database cũng timeout 20 giây trước HTTP; một HTTPS đối chứng đến supabase.com trả 200.

Nhờ anh/chị xác nhận:

- Yêu cầu refund mang RequestId trên đã tới VNPAY và có kết quả gì chưa?
- Merchant đã có quyền QueryDR/refund đầy đủ trên sandbox chưa?
- Sandbox có giới hạn IP/vùng cloud hoặc yêu cầu whitelist máy chủ gọi API không? Cần cấu hình IP như thế nào cho Supabase Edge Functions?
- Nguyên nhân code 99 ở QueryDR và hướng xử lý kết nối nêu trên.

Chúng tôi chưa gửi lại refund và chưa tự đánh dấu hoàn thành để tránh hoàn trùng. Cảm ơn anh/chị.

---

Không đính kèm HashSecret, API key, mật khẩu hoặc file env. Nếu VNPAY cần request chi tiết, chỉ cung cấp qua kênh hỗ trợ chính thức sau khi kiểm tra dữ liệu được yêu cầu.
