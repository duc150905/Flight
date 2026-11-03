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
- Nhãn/trạng thái và định dạng ngày/tiền dùng lựa chọn Việt–Anh chung của ứng dụng;
  dữ liệu lịch sử từ database như tên hành khách, hãng bay, mã vé được giữ nguyên.
- Thông tin chuyến được đọc từ `flight_snapshot` của đơn, không phụ thuộc tên
  hãng/sân bay có thể bị sửa sau khi đặt. Nếu RPC tạo đơn chưa ghi một trường
  snapshot tùy chọn, UI hiện nhãn dự phòng thay vì lỗi.

## Phụ thuộc TV2/TV3

Từ 03/11/2026 có RPC `create_booking`; chi tiết đơn pending có nút tiếp tục tới
`/pending/[id]`. Màn này tải dữ liệu đã lưu, đồng bộ đồng hồ server và cập nhật
trạng thái hết hạn khi mở lại. Danh sách cũ có thể còn ghi pending đến khi mở
đơn để đồng bộ; ghế quá hạn không còn chặn người khác. Snapshot dùng đúng các
khóa trong `flightSnapshotSummary`. Đọc `BOOKING-CREATION.md` trước khi đổi contract.
Chưa có `cancel_booking` hoặc thanh toán. Không dùng `UPDATE bookings` trực tiếp
từ client để hủy/đổi trạng thái. TV1 vẫn cần nghiệm thu toàn luồng trên Android.

## Kiểm thử

`tests/tickets.test.mjs` kiểm tra lọc theo chủ đơn, phân trang ổn định, chỉ tải
bảng con sau khi xác thực đơn, ID sai/không tồn tại, lỗi API và snapshot thiếu
trường. Cần kiểm thử thêm với hai tài khoản thật và đơn do TV2 tạo để xác nhận
RLS và dữ liệu lịch sử đầu cuối trên Android.
