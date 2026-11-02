# Tích hợp Admin Console — 02/11/2026

PR #16 được ghép với main chứa Flyora/TV2. Các điểm đã chỉnh để tích hợp:

- Các bundle booking, hành khách, chặng, lịch sử, thanh toán, hồ sơ và danh mục
  đọc theo trang 500 hàng với thứ tự ổn định. Nhật ký RPC đọc theo trang 200 hàng,
  không dừng ở 100/200 bản ghi đầu. Lỗi giữa các trang làm cả lần tải thất bại,
  không trình bày dữ liệu thiếu như báo cáo đầy đủ. Giới hạn 200 trang để chặn
  tải không kiểm soát; vượt ngưỡng sẽ báo lỗi thay vì âm thầm cắt dữ liệu.
- Biểu đồ dùng booking thực, ngày báo cáo Việt Nam và doanh thu gộp của vé
  confirmed. Mỗi chuỗi chuẩn hóa theo giá trị cao nhất của kỳ; không có dữ liệu
  thì các cột bằng 0. KPI doanh thu ròng vẫn trừ khoản hoàn theo quy tắc hiện có.
- Đăng xuất điều hướng về `/account`, nơi có màn đăng nhập.
- Bộ lọc thanh toán dùng `pending`, với kiểu lấy từ enum DB, thay cho `initiated`.
- Tên trên thanh điều hướng quản trị là Flyora.

Kiểm thử hồi quy gồm dữ liệu trên 1.000 hàng, lỗi trang sau, biểu đồ không dữ liệu,
ngày theo múi giờ Việt Nam, loại booking ngoài kỳ/tương lai và chỉ tính doanh thu
vé confirmed. Bộ đầy đủ có 182 tests; typecheck và lint đã qua.

Trạng thái DB: migration `20261102123000_admin_management_rpcs.sql` chưa được áp
dụng lên flight-dev tại lúc đối chiếu. Việc merge code không tự triển khai SQL.
Các cập nhật migration của TV3 được giữ nguyên; không reset DB hoặc tự deploy
migration admin trong task chỉ yêu cầu push/merge này.
