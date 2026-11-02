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

Đã kiểm tra: 142 tests, typecheck và Expo lint. Màn chọn ghế mới có điểm vào;
RPC báo giá và sơ đồ ghế sẽ được bổ sung trong task 2/3.
