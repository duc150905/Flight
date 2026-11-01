# TV1 — Vé của tôi (đọc dữ liệu)

## Đã triển khai

- Tài khoản đã đăng nhập mở `/tickets` để xem đơn mới nhất trước, 20 đơn mỗi lần.
- `/tickets/[id]` đọc chi tiết đơn, các chặng, hành khách, liên hệ và tổng tiền
  mô phỏng. Trạng thái chờ thanh toán, xác nhận, hủy và hết hạn được phân biệt.
- Mọi truy vấn danh sách lọc `bookings.user_id` theo phiên hiện tại. Chi tiết chỉ
  tải chặng và hành khách sau khi tìm thấy đơn có cùng `user_id`. RLS trên
  `bookings` và các bảng con vẫn là ranh giới phân quyền thực sự.
- Có trạng thái chờ, lỗi, thử lại, danh sách rỗng, làm mới và nút xem thêm.
  Khách chưa đăng nhập không truy vấn dữ liệu đơn.
- Thông tin chuyến được đọc từ `flight_snapshot` của đơn, không phụ thuộc tên
  hãng/sân bay có thể bị sửa sau khi đặt. Nếu RPC tạo đơn chưa ghi một trường
  snapshot tùy chọn, UI hiện nhãn dự phòng thay vì lỗi.

## Phụ thuộc TV2/TV3

Database hiện chỉ có bảng và quyền đọc; chưa có RPC `create_booking` hoặc
`cancel_booking`, nên chưa thể tạo đơn mẫu từ app và chưa có nút yêu cầu hủy.
Không dùng `UPDATE bookings` trực tiếp từ client để hủy hoặc đổi trạng thái.
TV2 cần chốt khóa của `flight_snapshot` khi triển khai RPC tạo đơn, và TV1 cần
nghiệm thu lại thời gian/sân bay theo snapshot thực tế. Khi có `cancel_booking`,
thêm UI kiểm tra điều kiện phía server và retry an toàn theo `request_id`.

## Kiểm thử

`tests/tickets.test.mjs` kiểm tra lọc theo chủ đơn, phân trang ổn định, chỉ tải
bảng con sau khi xác thực đơn, ID sai/không tồn tại, lỗi API và snapshot thiếu
trường. Cần kiểm thử thêm với hai tài khoản thật và đơn do TV2 tạo để xác nhận
RLS và dữ liệu lịch sử đầu cuối trên Android.
