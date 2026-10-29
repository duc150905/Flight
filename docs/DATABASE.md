# Database đã triển khai

Ngày triển khai: 29/10/2026. Project: **flight-dev** (`qisvuxiuwsqtkcrfpiwu`).
Thiết kế đã được duyệt nằm trong [DATABASE-PROPOSAL.md](DATABASE-PROPOSAL.md).

## Có gì trên cloud

Đã tạo 22 bảng, bật RLS toàn bộ và cấp quyền rõ ràng:

- Hồ sơ: `public.profiles`; quyền quản trị: `private.user_roles`.
- Danh mục: `airports`, `airlines`, `destinations`, `aircraft`, `seats`.
- Chuyến bay: `flight_instances`, `flight_fares`, `flight_seats`.
- Dịch vụ: `addon_products`, `flight_addon_offers`.
- Đơn: `bookings`, `booking_segments`, `booking_passengers`,
  `booking_passenger_segments`, `seat_reservations`, `booking_addons`.
- Thanh toán: `payments`, `refunds`; lịch sử: `booking_events`,
  `private.admin_audit_logs`.

Các bảng không ghi tiền tố ở trên đều thuộc `public`. `auth.users` do Supabase
quản lý, không nằm trong 22 bảng nghiệp vụ. Không lưu mật khẩu trong `profiles`.
Kiểm đếm sau triển khai: 20 bảng public + 2 bảng private, 22/22 bật RLS,
77 index tổng cộng (bao gồm index tự tạo bởi PK/UQ), không thiếu profile cho
tài khoản có sẵn và không còn tài khoản test.

Trigger tạo profile khi tài khoản được đăng ký; tài khoản có sẵn được bổ sung
profile nếu còn thiếu. Tên thiếu hoặc không hợp lệ dùng `Traveler`; không lấy
metadata do người dùng sửa để quyết định quyền admin. Chưa cấp admin cho tài khoản
thật nào. Hai bảng `private` không cấp quyền đọc/ghi trực tiếp cho app.

Người dùng đọc đơn và dữ liệu con của chính mình; admin đọc được dữ liệu nghiệp vụ.
Khách chỉ đọc danh mục đang hoạt động và chuyến đã công bố. Profile chỉ được sửa
các cột tên, điện thoại, avatar của chính chủ. Một số danh mục nhỏ cho admin
INSERT/UPDATE; các thao tác ghi vào đơn, ghế, thanh toán và hoàn tiền đều bị chặn
trực tiếp, kể cả khi tài khoản có vai trò admin.

RPC `public.get_seat_map(p_flight_id uuid)` đã có: trả mã ghế, vị trí, cabin,
phí chọn ghế và trạng thái `available`, `held`, `booked`, `blocked`; không trả
ID người giữ hoặc ID đơn. Wrapper public chạy bằng quyền người gọi, phần đọc
inventory có quyền đặc biệt được đặt trong schema `private` và tự kiểm tra
chuyến đã công bố/quyền admin. RLS bật trên bảng inventory gốc.

## Migration và kiểu TypeScript

- `supabase/migrations/20261029142657_database_foundation.sql`: bảng, enum,
  CHECK/FK/UQ, index, trigger, grants/RLS và seat map.
- `supabase/migrations/20261029143747_harden_database_access.sql`: gộp các
  SELECT policy theo cùng quyền truy cập và thu hồi quyền gọi event-trigger
  helper `public.rls_auto_enable()` có sẵn trên cloud.
- `src/types/database.generated.ts`: sinh từ schema public thật trên cloud.
  `src/lib/supabase.ts` đã dùng `createClient<Database>` để kiểm tra kiểu truy vấn.
- `supabase/config.toml`: cấu hình môi trường Supabase local, PostgreSQL 17,
  chỉ expose `public`/`graphql_public`; chưa bật seed vì chưa có bộ dữ liệu mẫu.

Hai migration đã được áp dụng theo thứ tự bằng `db query`. Vì đường này không tự
ghi lịch sử migration, đã dùng `migration repair --status applied` cho đúng hai
phiên bản đã chạy thành công. `migration list` xác nhận local và remote trùng nhau.
Không chạy lại các file CREATE TABLE lên cloud hiện tại.

Đã thử `db pull` để kiểm tra drift, nhưng bước tạo shadow database cần Docker.
Docker daemon trên máy chưa chạy nên chưa hoàn tất diff hoặc kiểm chứng dựng lại
toàn bộ DB local. Các file migration đã được kiểm thử trực tiếp trên cloud.

## Kiểm thử

```powershell
npx.cmd --yes supabase@2.122.0 db query --linked --project-ref qisvuxiuwsqtkcrfpiwu --file supabase/tests/database_foundation.sql
npx.cmd --yes supabase@2.122.0 db advisors --linked --project-ref qisvuxiuwsqtkcrfpiwu --type all
npx.cmd --yes supabase@2.122.0 migration list --linked --project-ref qisvuxiuwsqtkcrfpiwu
npm.cmd run check
npm.cmd test
```

SQL test tạo dữ liệu giả bên trong một transaction và luôn rollback khi kết thúc.
Không gửi email, không để lại tài khoản thử. Kiểm tra số bảng/RLS, trigger profile
(gồm metadata lỗi), timezone, tiền âm, tổng tiền, hành lý, FK khác đơn/chuyến,
ghế bị giữ trùng, thanh toán pending/succeeded trùng và refund sai booking.
Phần RLS chuyển `SET LOCAL ROLE` thực sự sang `anon` và `authenticated`, gắn
`auth.uid()` tương ứng để kiểm tra khách, hai khách hàng riêng và admin.
`npm run check` (typecheck/lint) pass; 17 bài test Auth hiện có cũng pass.

Advisor không còn cảnh báo mức WARN/ERROR sau migration thứ hai. Các INFO được
giữ có chủ đích:

- Hai bảng private bật RLS nhưng không có policy: app không có quyền truy cập;
  helper/worker có kiểm tra quyền mới được dùng chúng.
- 11 FK không có index phủ đầy đủ mọi cột: nhiều FK đã có index/UQ theo cột ID
  đầu tiên đủ chọn lọc; một số liên quan lịch sử bất biến hoặc actor tùy chọn.
  Chưa thêm các index gần trùng chỉ để xóa INFO. Đo EXPLAIN và tải thật khi thêm
  luồng quản trị/xóa dữ liệu trước khi bổ sung.
- Các index chưa được sử dụng: DB mới chưa có dữ liệu và traffic nghiệp vụ.

Chưa có benchmark tải lớn hoặc kiểm thử cạnh tranh qua RPC checkout.

## Phần tiếp theo

Đây là nền database; chưa có dữ liệu chuyến bay mẫu và chưa nối giao diện đặt vé.
Các RPC ghi trong mục E của bản duyệt còn cần triển khai: `create_booking`,
`update_checkout`, `start_mock_payment`, `cancel_booking`, worker hết hạn và
`admin_*`; thêm `search_flights` để xử lý tìm ngày theo múi giờ sân bay.

Các quy tắc cần transaction như tự cấp ghế, giữ 10 phút theo đồng hồ server,
chống lịch máy bay giao nhau, cabin/ghế đúng máy bay, tính tổng từ dòng con,
phân loại tuổi và người lớn đi kèm, idempotency, hủy/hoàn tiền cần nằm trong
các RPC đó. CHECK/FK và unique index hiện tại chỉ bảo đảm phần cấu trúc đã nêu,
chưa thay thế các quy tắc nghiệp vụ này. Hold hết thời gian vẫn cần worker/RPC
chuyển trạng thái để giải phóng unique index; seat map chỉ hiển thị thời gian thực.

Với phần TV2, thứ tự hợp lý là dữ liệu mẫu chung → tạo đơn và giữ ghế → cập nhật
checkout → thanh toán mô phỏng → hết hạn/hủy/hoàn tiền. Dùng cùng hợp đồng dữ liệu
với TV1/TV3 trước khi nối màn hình.
