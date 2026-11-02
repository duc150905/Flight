# TV1 — Trang chủ và tìm chuyến bay

Trang chủ đọc `airports` đang hoạt động và tối đa 8 `destinations` nổi bật.
Người dùng tìm sân bay theo thành phố, tên hoặc mã IATA; chọn ngày `YYYY-MM-DD`,
số người lớn/trẻ em/em bé và hạng ghế. Form chặn hai sân bay giống nhau, ngày sai
hoặc đã qua tại múi giờ sân bay đi, em bé nhiều hơn người lớn và quá 9 khách cần ghế.
Form hỗ trợ một chiều, khứ hồi và nhiều chặng (2–12 chặng). Chiều về
đảo tuyến chiều đi; chặng nhiều thành phố gợi ý bắt đầu tại sân bay đến của
chặng trước nhưng có thể sửa sân bay đi.
Ngày chặng sau không được trước chặng trước.

Kết quả đọc các chuyến đã công bố, còn mở bán, trạng thái `scheduled`/`delayed`
và fare đang hoạt động trong cabin đã chọn. Cửa sổ UTC rộng 3 ngày được lọc lại
theo múi giờ IANA sân bay đi để ngày địa phương đúng cả khi qua ngày UTC. Query
phân trang 200 chuyến/lần. Màn hình cho sắp xếp giá/giờ/thời lượng, lọc hãng,
xem chi tiết giờ địa phương, hành lý và điều kiện hủy. Giá trên client chỉ là
ước tính theo các cột base/tax/fee của fare; TV2 phải báo giá lại trên server.
Chuyến đã cất cánh không xuất hiện trong kết quả. Với khứ hồi/nhiều chặng,
khách chọn từng chuyến theo thứ tự; chuyến tiếp phải cất cánh sau giờ đến của
chuyến trước. Màn chọn chặng có lọc hãng, sắp xếp, hành lý và điều kiện hủy.
Luồng cuối chuyển `tripType`, số hành khách và các cặp `flightId`/`fareId`
theo `SelectedItinerary` chung sang checkout. Checkout đọc lại và kiểm tra
trạng thái, thời gian, tuyến bay; URL không chứa giá hoặc thông tin cá nhân.

Dữ liệu mẫu cho danh mục và chuyến bay đã được định nghĩa trong `supabase/seed.sql`
(bật trong `supabase/config.toml`). Trang kết quả đọc trực tiếp dữ liệu đó mà không cần
sửa giao diện. Hiện chưa có RPC `search_flights`;
truy vấn client phân trang là giải pháp cho giai đoạn đầu. Khi dữ liệu lớn, nên
chuyển lọc ngày/múi giờ và fare sang RPC để tránh tải rộng 3 ngày về thiết bị.

Nút Tiếp tục đặt vé trên chi tiết chuyến đã nối sang checkout qua helper kiểm tra
ID chuyến/hạng vé và số hành khách. Hồ sơ đã đọc/sửa trong `public.profiles`.
Chưa có lọc khoảng giá/giờ, kiểm tra sức chứa hoặc báo giá chốt ở server.
Số người lớn/trẻ em/em bé hiện áp dụng chung cả hành trình; yêu cầu đổi nhóm
tuổi theo ngày bay ở từng chặng cần TV1/TV2 thống nhất contract và sửa policy
checkout trước khi nghiệm thu trường hợp sinh nhật giữa hai chiều. Chưa có
giao diện song ngữ và chưa đối chiếu đủ từng màn với `flight.pdf`.

## Kiểm thử

`npm test` kiểm tra validation, ngày theo múi giờ, phép tính giá, tuyến khứ hồi/
nhiều chặng và hợp đồng ID checkout. `npm run check` kiểm tra TypeScript/Expo
lint; `npm run build:android` kiểm tra bundle. Có seed trong repo nhưng cần xác
nhận đã áp dụng vào Supabase và nghiệm thu trên thiết bị thật.
