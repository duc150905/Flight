# Điều tra hoàn tiền VNPAY Sandbox — 05/11/2026

## Kết quả hiện tại

Ba yêu cầu hoàn đã đi qua bước gửi của Flyora, gặp lỗi chưa phân loại sau khoảng 15 giây, rồi hết giới hạn 20 lần đối soát và chuyển sang `review`. Worker vẫn được cron gọi mỗi phút và trả HTTP200. Trong trạng thái `review`, worker ngừng tự đối soát khoản đó; đợi thêm hoặc tải lại app không tự gửi lại refund.

Truy vấn **chỉ đọc** giao dịch có thật từ Node và Postman cùng nhận HTTP200 với JSON:

```json
{"vnp_ResponseCode":"99","vnp_Message":"Unexpected error"}
```

Phản hồi không có `vnp_SecureHash`. Nó không xác nhận kết quả thanh toán/hoàn tiền và không được dùng để đổi trạng thái tài chính. Node mất khoảng 234–289ms, Postman 483ms; đây là lỗi ở trao đổi API đang quan sát được, không phải chỉ do app trên điện thoại tải chậm. Chưa xác định được nguyên nhân sâu hơn của mã99: cần VNPAY xác minh kết nối merchant/API và giao dịch gốc.

Kiểm tra tiếp từ database Supabase qua `pg_net` có sẵn, không tạo endpoint mới: một QueryDR chỉ đọc timeout45.007ms, trong đó DNS404ms, TCP/SSL handshake44.604ms, HTTP request/response0ms, không có HTTP status/body. Đây là bằng chứng riêng về đường kết nối cloud→sandbox bị kẹt trước HTTP, chưa chứng minh nguyên nhân là whitelist, firewall, vùng chạy hay sự cố nhà cung cấp. Không thể suy ra chữ ký/payload sai từ lần timeout này vì chưa tới lớp HTTP; cũng chưa xác nhận vùng/đường đi của Edge có hoàn toàn giống database hay không.

## Dữ liệu đọc từ flight-dev

- Ba refund public vẫn `pending`, job `review`, `sync_count=20`, `completed_at=null`, `last_code=transport_or_validation`.
- Đơn `FY66DBE65DEB0247FF843A9083D65D82`: payment1.700.000đ, refund1.500.000đ, giao dịch gốc `15725819`.
- Đơn `FYDCC9EA908EDE48AA90FB210CFAE2FE`: payment1.603.000đ, refund1.253.000đ, giao dịch gốc `15725847`.
- Đơn `FYD9C03480D97C45E6BDCFFB090AED2F`: payment1.603.000đ, refund1.253.000đ, giao dịch gốc `15725860`.
- Mã merchant-ref của giao dịch cuối: `1c7a138e13ea4f9c9f16aec6272ec7a3`; payment create date `20261104215347`, pay date `20261104215419`; refund gửi lúc21:56:01 ngày04/11/2026 giờ Việt Nam.

Các số trên là bằng chứng trong DB của Flyora, chưa phải xác nhận VNPAY đã nhận hoặc xử lý thành công refund.

## Đã đối chiếu

- URL API QueryDR/refund đúng tài liệu: `https://sandbox.vnpayment.vn/merchant_webapi/api/transaction`, POST JSON, version2.1.0.
- Thứ tự HMAC-SHA512, tiền nhân100, loại hoàn03 cho khoản hoàn một phần và ngày giao dịch lấy từ CreateDate gốc phù hợp đặc tả.
- Mỗi lần đối soát tạo request ID và ngày truy vấn mới; không tái dùng ID refund làm ID QueryDR.
- Bổ sung TransactionNo gốc vào một truy vấn chỉ đọc vẫn nhận unsigned99.
- Postman chạy raw JSON, tắt report-events; exit0 chỉ cho biết HTTP200, không có assertion nào chứng minh giao dịch thành công. Lần thử Postman ban đầu dùng `@file` bị CLI diễn giải thành file upload và trả500; lần đó bị loại khỏi bằng chứng vì payload không đúng định dạng.
- Có chênh lệch cần VNPAY xác minh: code hiện dùng IP đã lưu từ người thanh toán cho QueryDR/refund; tài liệu mô tả trường này là IP máy chủ gọi API. Chưa chứng minh chênh lệch này gây mã99/timeout; chưa tự thay bằng IP đoán hoặc IP giả.
- Không gửi lại bất cứ refund nào, không reset review/đếm thử lại, không ép succeeded hoặc thay số tiền.

Tài liệu gốc: [QueryDR và Refund](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html), [bảng mã lỗi](https://sandbox.vnpayment.vn/apis/docs/bang-ma-loi/). Mã99 là lỗi chung, không tự xác định một nguyên nhân cụ thể.

## Thay đổi chẩn đoán trong code

`gatewayCall` phân biệt timeout, lỗi mạng/đọc stream, HTTP lỗi, JSON không hợp lệ và phản hồi không xác thực. Log chỉ chứa command, loại lỗi, thời gian, HTTP status và response code hai chữ số; không ghi secret, chữ ký, request body hoặc thông điệp tùy ý từ cổng.

Lỗi gửi refund mới ghi mã chẩn đoán cụ thể vào `last_code`, ví dụ `gateway_timeout` hoặc `gateway_unverified_99`. Trạng thái tài chính vẫn `unknown` khi kết quả không xác thực. Các job cũ giữ nguyên bằng chứng cũ; không thể truy ngược nguyên nhân chi tiết từ mã tổng hợp đã lưu hôm trước.

Có kiểm thử RED→GREEN cho unsigned99 không được tin cậy, không lộ dữ liệu vào log, phân biệt HTTP/timeout/network/JSON và timeout sau khi đã nhận HTTP headers. Đây là cải thiện khả năng tìm lỗi; chưa chứng minh cổng đã hoàn tiền thành công.

Đã triển khai phần chẩn đoán vào ba function hiện có `vnpay-refund`, `vnpay-sync`, `vnpay-worker`, giữ nguyên ranh giới xác thực. 286 Node tests đạt, typecheck app và riêng module gateway đạt; lint0 lỗi, ba cảnh báo cũ. Fingerprint trước/sau của refunds3, payments25 và bookings19 không đổi. Code điều tra được giữ riêng trên nhánh `codex/vnpay-refund-investigation` theo yêu cầu người dùng.

Sau khi main nhận PR40 và PR39, nhánh điều tra đã đồng bộ từ main `fc2e9b2` và được push riêng. Tổng293 Node tests đạt, typecheck đạt; lint còn một cảnh báo có sẵn của AI greeting. GitHub được dọn còn main và nhánh điều tra; các file điều tra không nằm trong hai PR đã merge.

## Đối chiếu trên portal

Vào Merchant Admin → Giao dịch hoàn trả, nhập mã giao dịch gốc15725860. Có thể thử số hóa đơn bằng merchant-ref `1c7a138e13ea4f9c9f16aec6272ec7a3`; phải đối chiếu với chi tiết giao dịch thanh toán để xác nhận tên trường của portal.

Đặt ngày từ04/11/2026 đến05/11/2026, mọi trạng thái/kiểu hoàn. Ưu tiên bỏ hai ô ngày xử lý nếu portal cho phép: bản ghi chưa xử lý có thể không có ngày để khớp bộ lọc. Ảnh người dùng ban đầu có lọc ngày xử lý, nên kết quả0 dòng chưa đủ chứng minh VNPAY chưa nhận refund.

Nếu vẫn trống, mở GD Thanh toán để xác nhận giao dịch gốc15725860, số tiền1.603.000đ, ngày04/11 và merchant-ref. Sau đó chuyển thông tin tra soát bên dưới cho VNPAY; không gửi lại refund để thử trước khi biết kết quả lần gửi cũ.

## Nội dung tra soát để người dùng gửi VNPAY

Merchant của Flyora đang thanh toán PAY thành công nhưng chưa xác minh được QueryDR/refund. Giao dịch gốc15725860, merchant-ref1c7a138e13ea4f9c9f16aec6272ec7a3, tạo lúc20261104215347 (GMT+7), thanh toán1.603.000VND. Yêu cầu hoàn một phần1.253.000VND gửi lúc20261104215601, RequestId3600fa19131646c29e1594cca2d02967. QueryDR đúng endpoint nhận HTTP200, code99 Unexpected error, không có chữ ký, cả khi bổ sung TransactionNo. Nhờ xác nhận yêu cầu refund cũ đã được nhận chưa, merchant đã được bật QueryDR/refund chưa, yêu cầu IP/whitelist và nguyên nhân mã99.

Thêm bằng chứng kết nối: cùng endpoint QueryDR từ Supabase Postgres/pg_net không hoàn tất TCP/TLS sau45giây, HTTP time0ms, trong khi máy người phát triển nhận JSON99 dưới một giây. Nhờ kiểm tra hạn chế kết nối từ hạ tầng cloud và hướng dẫn IP máy chủ/API caller đúng cho môi trường sandbox. Không khẳng định đây là cùng nguyên nhân với code99 trước khi nhà cung cấp đối chiếu.

Không gửi HashSecret, API key, mật khẩu hoặc toàn bộ file env cho hỗ trợ. Chưa gửi nội dung tra soát này ra bên ngoài.

## Giới hạn chẩn đoán

Đầu probe tạm mới trên Edge bị automatic approval review từ chối do mở thêm endpoint với JWT verification tắt; không triển khai, không thay đổi ranh giới bảo mật bằng cách khác. Chẩn đoán tiếp tục qua DB/cron hiện có, API chỉ đọc và ảnh portal của người dùng. Tab in-app của agent chưa đăng nhập Merchant Admin nên không đọc được bản ghi trong phiên Chrome của người dùng.

Trạng thái VNPAY thực tế và nguyên nhân nội bộ của unsigned99 còn chờ bằng chứng portal/nhà cung cấp. Không có bằng chứng để báo “đã sửa xong hoàn tiền”.
