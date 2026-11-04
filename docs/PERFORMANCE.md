# Performance: tìm chuyến bay

Màn kết quả một chiều từng dùng `ScrollView` và tạo mọi thẻ chuyến bay ngay khi có dữ liệu. Nó cũng tạo lại `SearchCriteria` mỗi lần đổi bộ lọc, khiến hiệu ứng lưu tìm kiếm chạy lại. Mỗi thẻ tạo hai `Intl.DateTimeFormat` mới. Sau khi tải danh sách chuyến, các lô giá vé và truy vấn hãng bay được gọi tuần tự.

Thay đổi hiện tại:

| Hạng mục | Trước | Sau |
| --- | --- | --- |
| Danh sách | Dựng toàn bộ `N` thẻ | `FlatList` dựng 6 thẻ ban đầu, các thẻ tiếp theo theo lô 8 trong cửa sổ 5 màn hình |
| Đổi bộ lọc | Tạo lại tiêu chí và ghi AsyncStorage | Giữ tiêu chí ổn định nếu tham số tìm kiếm không đổi |
| Định dạng giờ | Tạo formatter cho từng giờ bay | Dùng lại formatter theo múi giờ và ngôn ngữ, tối đa 16 formatter |
| Tải giá vé/hãng bay | Gọi lần lượt | Tải tối đa 4 lô giá song song và hãng bay cùng lúc |

## Đo lặp lại được

1. Chạy `node scripts/benchmark-flight-time.mjs` để so thời gian định dạng 1.000 giờ bay bằng mã cũ và mới trên cùng một máy. Script in trung vị của 7 lần đo sau một lượt làm nóng và kiểm tra kết quả giống nhau. Đây là **microbenchmark Node**, không phải FPS trên điện thoại.
2. Trên cùng điện thoại và cùng tập dữ liệu, so bản `main` trước PR với nhánh này bằng bản build tương đương. Trong React Native Performance Monitor, ghi JS FPS và mức dùng bộ nhớ khi mở kết quả, đổi bộ lọc 5 lần, rồi cuộn từ đầu đến cuối 3 lần. Dùng ít nhất 30 chuyến/giá vé để nhìn rõ tác dụng của danh sách ảo hóa.
3. Trong Network của React Native DevTools, đo thời gian từ lúc bắt đầu tìm đến lúc danh sách hiện ra và số request đến Supabase. Lặp 5 lần ở mỗi bản, ghi trung vị. Dùng cùng tuyến bay/ngày/hạng ghế, mạng và trạng thái cache. Tách kết quả cache nóng và cache lạnh.

Chưa có số liệu FPS hoặc độ trễ thực tế trên thiết bị trong PR này. Không đưa kết quả microbenchmark Node thành số liệu hiệu năng Android/iOS.

Lần đo trên máy phát triển (Node 24.22.1): mã cũ 97,62 ms, mã mới 5,02 ms cho 1.000 lượt, nhanh hơn 19,4 lần ở riêng thao tác định dạng giờ. Cần chạy lại trên máy của nhóm để ghi số liệu vào báo cáo.
