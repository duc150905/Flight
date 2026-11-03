# Thanh toán, hủy và hoàn tiền mô phỏng — TV2

Cập nhật 03/11/2026. Phạm vi người dùng đã chọn: mô phỏng nội bộ, không kết nối cổng thanh toán/sandbox bên ngoài. Không thu tiền, không nhập/lưu số thẻ hoặc CVV. `payments.provider` vẫn là `mock`.

## Luồng sử dụng

Tìm chuyến → hành khách/liên hệ → hành lý → ghế → báo giá → tạo đơn/giữ ghế → chọn kết quả mô phỏng → Thanh toán thử.

- Thành công: server xác nhận đơn và ghế trong một transaction; màn thành công theo PDF dẫn tới `/receipt/[id]`.
- Thất bại/hủy lần thanh toán: đơn vẫn chờ, chỗ giữ theo hạn cũ; có thể thử một lần mới.
- Đang xử lý: giữ nguyên attempt pending. Mở lại từ Vé của tôi để chọn kết quả và hoàn tất cùng attempt.
- Hết hạn: không được thanh toán; kết quả thành công đến trễ bị từ chối, không có tiền thật để thu/hoàn.
- Vé mô phỏng chỉ hiển thị khi đơn confirmed và mọi ghế cần thiết đã confirmed. Không phải vé hãng/thẻ lên máy bay.

## RPC và giao dịch

Tất cả public RPC chỉ cho authenticated. Wrapper invoker gọi phần triển khai private, search_path rỗng. Chủ đơn được xác minh bằng auth.uid(); không cấp quyền ghi trực tiếp bảng giao dịch.

- `get_mock_payment_state(p_booking_id uuid)`: trả `{booking,payments,refunds,cancellation}`. Kiểm tra hết hạn trước khi trả; tiền VND từ đơn đã lưu.
- `start_mock_payment(p_booking_id uuid,p_request_id uuid)`: lấy total/version từ server, không nhận amount ở client. Cùng request trả attempt cũ; có attempt pending thì trả nó thay vì tạo thêm. Mỗi đơn có tối đa một pending và một successful payment theo index đã có.
- `resolve_mock_payment(p_payment_id uuid,p_request_id uuid,p_outcome text)`: outcome là pending/succeeded/failed/cancelled, cố ý do chủ đơn chọn trong bản demo. Không phải callback cổng thanh toán. Attempt terminal không đổi kết quả. Thành công chỉ khi amount/currency/version khớp đơn, chưa hết hạn, đủ ghế held còn hạn/không bị chặn/đúng khoang và các chuyến chưa khởi hành/còn scheduled hoặc delayed.
- `cancel_booking(p_booking_id uuid,p_request_id uuid,p_expected_fee bigint)`: hủy toàn đơn theo policy preview phía server. Số expected_fee chỉ dùng đối chiếu đồng ý; server tự tính. Hủy giải phóng held/confirmed seats và dừng attempt pending.
- `refund_mock_booking(p_booking_id uuid,p_request_id uuid,p_outcome text)`: pending/succeeded/failed. Chỉ đơn cancelled có mock payment succeeded và refund_due > 0. Amount lấy từ snapshot server, không nhận amount của client. Một refund cho mỗi successful payment; failed/pending thử lại trên cùng refund; succeeded không bị đảo hoặc hoàn thêm.

`private.lock_mock_booking` khóa flight UUID theo thứ tự rồi khóa booking, cùng thứ tự với create_booking. Cron/payment/cancel sử dụng thứ tự này. `private.claim_mock_action` ghi fingerprint vào private.mock_action_requests, PK(user_id,request_id), RLS và không có quyền client. Gửi lại cùng action trả trạng thái hiện tại, không ghi thêm sự kiện/tiền; đổi nội dung trên UUID cũ báo conflict.

Không tính lại giá vé hiện hành lúc thanh toán: đơn đã chốt giá. Chỉ tạo đơn mới mới re-quote. USD chỉ tham khảo; DB/settlement luôn VND.

## Chính sách hủy/hoàn demo

- Pending còn hạn: hủy miễn phí, không hoàn vì chưa trả.
- Confirmed: mọi người/chặng phải có snapshot cho phép hủy và chưa qua cutoff. Thời gian so với mốc sớm hơn giữa lịch đã lưu và lịch hiện tại, tránh vượt hạn khi lịch đổi.
- Phí = tổng `min(phí hủy snapshot, base+tax+fee của người đó trên chặng đó)`.
- Tiền hoàn = tổng đơn − phí; dịch vụ thêm được hoàn trong mô phỏng. Không hủy một phần. Không thu thêm phí riêng.
- Standard không cho hủy sau thanh toán; Flex fixture hiện có phí 200.000 VND/người/chặng, có giới hạn không vượt giá vé người đó. Không suy ra chính sách này là quy tắc của hãng thật.
- UI hiển thị phí/tiền hoàn rồi yêu cầu xác nhận. Phí đổi hoặc vừa thanh toán trong khi mở hộp thoại phải được server kiểm tra lại.

## Hết hạn tự động

Cron `flyora-expire-pending-bookings`, mỗi phút, tối đa 100 đơn/lượt. `private.expire_pending_bookings` không cho anon/authenticated execute. Worker cập nhật booking/holds/event; trigger dừng pending mock payments khi booking expired/cancelled. Các kiểm tra thời hạn vẫn dựa vào clock server, nên không đợi cron mới chặn thanh toán hoặc tái sử dụng ghế quá hạn.

Cron đã có lần chạy status succeeded trên flight-dev. Nhật ký nằm ở cron.job_run_details, không ghi thông tin hành khách.

## Mất mạng, đổi tài khoản và dữ liệu cache

mock-action-journal lưu UUID thao tác, loại start/resolve/cancel/refund, ID liên quan, kết quả mô phỏng/expected fee và phase; không lưu hành khách/thẻ. Lưu trước khi gửi. Kết quả chưa rõ phải replay đúng UUID/args cũ trước khi chấp nhận thao tác khác. Recovery không có journal chỉ đọc trạng thái, không tạo payment mới.

Lỗi nghiệp vụ chắc chắn được ghi complete để người dùng xem lại phí rồi gửi action mới; lỗi mạng giữ sent để retry an toàn. Client RPC gắn token của tài khoản bắt đầu thao tác; generation guard ngăn gửi/ghi UI tiếp sau blur/đổi tài khoản. Đọc trạng thái dùng query key theo owner và booking.

Screen có hai nguồn chi tiết/trạng thái mock: `withLatestReceipt` chọn receipt có serverNow mới hơn. Khi đếm ngược về 0 tải lại cả hai, tránh cache pending che trạng thái expired mới. Cả token lẫn thông tin thẻ đều không nằm trong journal.

## Migration và nghiệm thu

Năm migration 20261103143605/09/12/14/17 đã triển khai trên flight-dev. Bốn migration đầu được áp dụng sớm do lỗi ghép transaction của công cụ kiểm thử; sau đó đối chiếu 15/15 function bodies khớp source, test rollback qua, người dùng cho phép cụ thể repair history của đúng bốn version. Repair đã thành công. Công cụ prepare-mock-sql nay chặn COMMIT/ROLLBACK bên trong phần DDL. Không còn fixture user 81/82. Hai migration admin/profile cũ vẫn chưa chạy, không được đánh dấu áp dụng lẫn.

`node scripts/prepare-mock-sql.mjs --deployed=5 expiry attempts resolution cancellation refunds roles` tạo SQL BEGIN/ROLLBACK để kiểm tra DB đã triển khai. Bỏ --deployed khi chạy với DB chưa có năm migration mới. SQL test bao gồm money/version/late result, retry, policy/cutoff/fee cap, refund bounds, role authenticated/anon, cross-owner read/resolve/cancel/refund và denied direct writes.

Browser QA dùng fixture riêng, không gọi payment thật/DB: lựa chọn thất bại/pending/thành công, xác nhận hủy, hoàn failed/pending/succeeded và ẩn retry sau thành công, VI/EN, VND/USD, portrait/landscape. Lỗi empty-string child trong RN View đã được phát hiện và sửa qua QA. Route QA được xóa trước commit.

Đã qua 211/211 unit tests, TypeScript, Expo lint, web export và Android/Hermes export. Review cuối không còn lỗi Critical/Important. Gửi đồng thời payment/cancel trên fixture chuyến bay riêng năm 2050 quan sát được booking/payment cancelled, không có confirmed seat/event; fixture đã được dọn. Phép thử này kiểm tra một lần thực thi đồng thời, không thay thế nghiệm thu trên hai thiết bị.

Để chạy lại phép thử đồng thời trên DB phát triển: `booking-race-setup.sql` → `mock-race-setup.sql` → chạy `mock-race-pay.sql` và `mock-race-cancel.sql` từ hai kết nối → kiểm tra booking/payment/seat/event → luôn chạy `mock-race-cleanup.sql` rồi `booking-race-cleanup.sql`, kể cả nếu phép thử lỗi. Chỉ dùng fixture UUID trong các file; không chạy trên đơn thật. Kết quả hợp lệ: cancelled/cancelled với 0 confirmed seat/event; hoặc confirmed/succeeded với 1 confirmed seat/event và thao tác hủy chưa được chấp nhận vì phí đã đổi.

Chưa nghiệm thu toàn luồng đăng nhập thật trên UI Android. Máy hiện không có ADB. Đọc `ANDROID-CHECKOUT-ACCEPTANCE.md` để thử trên Expo Go bằng email/password. Google OAuth/development build là việc riêng chưa sửa ở đây.
