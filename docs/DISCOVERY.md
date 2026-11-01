# TV1 — Trang chủ và tìm chuyến một chiều

Trang chủ đọc `airports` đang hoạt động và tối đa 8 `destinations` nổi bật.
Người dùng tìm sân bay theo thành phố, tên hoặc mã IATA; chọn ngày `YYYY-MM-DD`,
số người lớn/trẻ em/em bé và hạng ghế. Form chặn hai sân bay giống nhau, ngày sai
hoặc đã qua tại múi giờ sân bay đi, em bé nhiều hơn người lớn và quá 9 khách cần ghế.

Kết quả đọc các chuyến đã công bố, còn mở bán, trạng thái `scheduled`/`delayed`
và fare đang hoạt động trong cabin đã chọn. Cửa sổ UTC rộng 3 ngày được lọc lại
theo múi giờ IANA sân bay đi để ngày địa phương đúng cả khi qua ngày UTC. Query
phân trang 200 chuyến/lần. Màn hình cho sắp xếp giá/giờ/thời lượng, lọc hãng,
xem chi tiết giờ địa phương, hành lý và điều kiện hủy. Giá trên client chỉ là
ước tính theo các cột base/tax/fee của fare; TV2 phải báo giá lại trên server.

Dữ liệu mẫu cho danh mục và chuyến bay đã được định nghĩa trong `supabase/seed.sql`
(bật trong `supabase/config.toml`). Trang kết quả đọc trực tiếp dữ liệu đó mà không cần
sửa giao diện. Hiện chưa có RPC `search_flights`;
truy vấn client phân trang là giải pháp cho giai đoạn đầu. Khi dữ liệu lớn, nên
chuyển lọc ngày/múi giờ và fare sang RPC để tránh tải rộng 3 ngày về thiết bị.

Nút Tiếp tục đặt vé trên chi tiết chuyến đã nối sang checkout qua helper kiểm tra
ID chuyến/hạng vé và số hành khách. Hồ sơ đã đọc/sửa trong `public.profiles`.
Chưa có tìm khứ hồi/nhiều chặng, lọc khoảng giá/giờ, kiểm tra sức chứa, tạo/hủy
đơn. Các phần này phụ thuộc seed và API/RPC tiếp theo của TV2/TV3.

## Kiểm thử

`npm test` kiểm tra validation, ngày theo múi giờ và phép tính giá. `npm run check`
kiểm tra TypeScript/Expo lint; `npm run build:android` kiểm tra bundle. Chưa thể
thử tìm chuyến thực tế khi chưa có seed và `.env.local` trong worktree này.
