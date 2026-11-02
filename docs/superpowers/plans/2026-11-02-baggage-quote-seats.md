# Kế hoạch triển khai: hành lý, báo giá từ server và chọn ghế

> **Dành cho tác nhân thực hiện:** sử dụng skill `superpowers:executing-plans` để làm lần lượt từng task. Đánh dấu các ô bên dưới để theo dõi.

**Mục tiêu:** mở rộng checkout TV2 đến bước chọn hành lý, chọn ghế và nhận báo giá
đã được server kiểm tra.

**Cách tổ chức:** lưu lựa chọn trong bản nháp Zustand ở bộ nhớ, tách theo tài khoản.
Đọc danh mục và sơ đồ ghế an toàn qua Supabase. RPC Postgres yêu cầu đăng nhập,
giới hạn dữ liệu đầu vào và tự tính giá/kiểm tra chỗ, không dựa vào tổng tiền từ app.
Tái sử dụng khung checkout, bản dịch và phần hiển thị tiền tệ hiện có.

**Công nghệ:** Expo 58, React Native 0.88, Expo Router, Zustand, TanStack Query,
Zod, Supabase/Postgres 17; dự kiến không thêm thư viện.

**Bản thiết kế:** `docs/superpowers/specs/2026-11-02-baggage-quote-seats-design.md`.

## Giới hạn và trạng thái chuẩn bị

- Bạn đã duyệt thiết kế và yêu cầu triển khai trực tiếp ngày 02/11/2026.
- Bộ test nền đã qua 139/139. Nhánh `codex/tv2-baggage-quote-seats` bắt đầu từ
  `8dfd7b0`, giữ các commit logo/tên app/tiền tệ chưa push. Thư mục chưa theo dõi
  `output/imagegen/` là dữ liệu khác, phải giữ nguyên.
- Đã xem trang 13–15 của PDF. Kết nối được flight-dev; RPC báo giá chưa có.
  Docker chưa chạy, nên có thể kiểm thử SQL trong giao dịch hoàn tác trên
  flight-dev mà không reset DB hay sửa dữ liệu khách hiện có.
- Tạo migration mới theo quy trình hiện tại, dùng CLI sinh tên file.
- Giữ VND là tiền tệ thanh toán; báo giá chỉ đọc và luôn ghi rõ ghế chưa được giữ.
- Riêng giao diện ghế được làm đẹp hơn PDF theo phong cách Flyora, như thiết kế mới.

## Task 1 — Lựa chọn hành lý và màn hình hành lý

**File dự kiến:** thêm `baggage.ts`, `baggage-screen.tsx`, phần tải danh mục và
giao diện lựa chọn trong `src/features/booking/`; thêm
`src/app/checkout/baggage.tsx`. Cập nhật bản nháp, tải dữ liệu hành trình,
điều hướng từ màn xem lại, tổng tạm tính, bước đang chọn và bản dịch.

- [x] Viết test trước cho một gói trên mỗi người/chặng, lựa chọn độc lập, xóa khi
  đổi tài khoản/hành trình, gói không còn hợp lệ và báo giá mất hiệu lực.
  Chạy để thấy test thất bại trước khi triển khai.
- [x] Bổ sung dữ liệu hành lý/ghế có kiểu rõ ràng và theo dõi phiên bản bản nháp;
  giữ dữ liệu khi quay lại, đổi ngôn ngữ hoặc tiền tệ.
- [x] Tải hành lý bao gồm trong vé và gói mua thêm còn hiệu lực. Làm các phần theo
  PDF, bộ chọn người/chặng, trạng thái rỗng/tải/lỗi/thử lại và tổng tiền dưới cùng.
- [x] Nối từ màn xem lại sang hành lý và điểm vào bước ghế; không báo đã tạo đơn.
- [x] Chạy test liên quan, lint/typecheck; cập nhật tài liệu và commit task 1.

## Task 2 — Báo giá từ server và phân tích tổng tiền

**File dự kiến:** migration mới do CLI tạo và `supabase/tests/checkout-quote.sql`;
`quote.ts`, phần gọi/tải báo giá, màn/route tổng hợp; kiểu RPC, bản dịch, tài liệu
và script kiểm tra tích hợp.

- [x] Viết test SQL về tính giá/phân quyền và test logic kiểm tra dữ liệu gửi/nhận
  ở app. Chạy để thấy lỗi trước khi viết RPC.
- [x] Làm hàm báo giá chỉ đọc trong private và hàm public có quyền hạn giới hạn;
  tự xác định tuổi, lấy giá và đếm sức chứa phía server; trả mã lỗi an toàn.
- [x] Thử SQL trong giao dịch hoàn tác; xem quyền hàm và chạy bộ kiểm tra Supabase.
  Sau khi rà soát, triển khai migration bổ sung vào flight-dev và xác minh lịch sử.
- [x] Làm client RPC có kiểu dữ liệu, dấu nhận diện dữ liệu yêu cầu, bảng phân tích
  tiền, hết hạn, thử lại và xác nhận đã xem giá đổi. Bỏ kết quả trả về muộn nếu
  lựa chọn đã đổi; báo giá lỗi/hết hạn phải hiển thị rõ là không còn hiệu lực.
- [x] Chạy SQL cho các ca bị từ chối, kiểm tra tích hợp bằng client dùng khóa public,
  test liên quan và lệnh check; cập nhật tài liệu DB/checkout và commit task 2.

## Task 3 — Sơ đồ ghế và ghép luồng hoàn chỉnh

**File dự kiến:** `seats.ts`, `seats-screen.tsx`, màn/giao diện sơ đồ và các route
checkout; cập nhật bản dịch, bản nháp, tổng tạm tính, yêu cầu báo giá và test.

- [x] Viết test trước cho điều kiện em bé/trẻ em từng chặng, lọc khoang, hàng thoát
  hiểm, ghế trùng và lựa chọn ghế đã thay đổi/không còn khả dụng.
- [x] Đọc trạng thái qua RPC an toàn; làm thẻ chặng, khung máy bay, hàng/lối đi,
  thẻ hành khách, chọn ghế tùy chọn, bỏ chọn và chú giải trạng thái.
- [x] Tải lại sơ đồ khi quay lại app và trước báo giá; chuyển sang tổng hợp sau
  khi kiểm tra. Quay lại vẫn giữ lựa chọn; luôn ghi rõ chưa giữ ghế.
- [x] Thử trình duyệt ở kích thước điện thoại với dữ liệu giả: hành lý theo người/
  chặng, ghế đang chọn/bị chặn, quay lại/sửa, Việt–Anh và VND/USD.
  Xóa route chỉ phục vụ kiểm thử nếu có.
- [x] Chạy toàn bộ test, check, xuất bundle Web/Android và review độc lập cuối.
  Sửa các lỗi quan trọng, ghi rõ giới hạn và commit task 3. Chưa push/merge.

## Các phần phụ thuộc nhau và điểm cần review kỹ

- Task 1 tạo dữ liệu lựa chọn cho task 2 tính giá và task 3 chọn ghế.
  Luôn dùng `passengerId`/`flightId` ổn định, không dùng vị trí trong mảng làm ID.
- Task 2 đã tính phí ghế dù task 3 mới làm giao diện chọn. Test SQL gửi ID ghế
  trực tiếp để kiểm chứng server độc lập với giao diện.
- Kiểm thử ghế đổi trạng thái trong lúc thao tác, tuổi đổi theo chặng, app sửa giá
  gửi lên, truy cập chưa đăng nhập, kết quả mạng trả về muộn và tràn số tiền.
- Giữ tương thích với auth, tìm chuyến, vé và danh mục/quản trị hiện có.
  Không lộ dữ liệu khách hoặc danh tính người đang giữ ghế.

## Kết quả cuối — 02/11/2026

Đã hoàn tất ba task và một lượt review độc lập. Sửa cả ba phát hiện quan trọng bằng test hồi quy: bỏ qua ghế không phụ thuộc sơ đồ hỗ trợ, hủy chuyển màn từ request cũ khi blur/unmount và làm mới quote theo revision khi cùng ID nhưng snapshot giá đổi. Bộ cuối: 151/151 tests, typecheck/lint và export Web/Android đều qua. SQL rollback trên RPC đã deploy và public API smoke đều qua. Giới hạn nghiệm thu UI/Android thật được ghi trong CHECKOUT-EXTRAS.md. Giữ nhánh local, không push/merge.
