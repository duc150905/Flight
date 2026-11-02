# Hành lý, báo giá và ghế — TV2

Thiết kế đã duyệt: `superpowers/specs/2026-11-02-baggage-quote-seats-design.md`.

## Task 1: hành lý

Màn `/checkout/baggage` đọc hành lý bao gồm trong hạng vé và gói ký gửi đang bán.
Mỗi người/chặng chọn không mua thêm hoặc một gói; chọn gói khác sẽ thay gói cũ.
Tổng tạm tính gồm giá vé và lựa chọn thêm. Next tải lại danh mục; gói/giá đã đổi
phải được chọn lại hoặc bỏ chọn. Không có ghi booking/giữ ghế ở bước này.

Lựa chọn nằm trong bản nháp RAM, xóa khi hủy/đổi tài khoản/đổi hành trình/hoàn tất.
Sửa tên giữ hành lý/ghế; sửa ngày sinh hoặc người đi kèm làm mất lựa chọn ghế để
kiểm tra điều kiện mới. `revision` giúp không chuyển bước bằng kết quả mạng cũ.
Hỗ trợ Việt–Anh và VND/USD qua các thành phần chung.

## Task 2: báo giá

`public.quote_checkout(p_request jsonb)` đã được triển khai lên flight-dev qua
migration `20261102090252_checkout_quote.sql`; lịch sử local/cloud khớp nhau.
Chỉ authenticated được gọi; wrapper public invoker gọi private definer có kiểm
tra auth.uid(), search_path rỗng và quyền EXECUTE giới hạn. Không đổi bảng/RLS.

Request chỉ có tripType, counts, segments, passengers (ID/ngày sinh/người đi kèm),
baggage (ID người/chuyến/offer), seats (ID người/chuyến/ghế). Không gửi tên, liên
hệ, hộ chiếu hoặc giá trong draft. Server tự tính tuổi từng chặng, giá và sức chứa
khoang, loại ghế bị chặn/đã đặt/đang giữ còn hạn. Trả các thành phần tổng tiền,
dòng từng người/chặng và thời hạn 5 phút bằng VND; không ghi đơn hoặc giữ ghế.

Màn `/checkout/quote` kiểm tra tổng, số an toàn, đủ dòng, thời hạn; ẩn báo giá lỗi/
hết hạn, hỗ trợ làm mới và xác nhận đã xem giá khác tạm tính. Các request khác
nhau có query key riêng, không nhận nhầm kết quả cũ. Đây chưa phải thanh toán.

Kiểm tra: 144 tests, typecheck/lint, SQL rollback (giá giả, dịch vụ ngừng bán,
sinh nhật giữa chặng, sức chứa, exit row, held/booked/expired, anonymous và role
authenticated), API public smoke. Advisors không có ERROR; WARN bảo vệ mật khẩu
rò rỉ là cấu hình Auth có sẵn từ trước, không phát sinh từ thay đổi này.
Sơ đồ ghế được bổ sung trong task 3.
