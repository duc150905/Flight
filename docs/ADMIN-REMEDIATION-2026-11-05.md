# Bản sửa Admin — 05/11/2026

Đã xử lý các phát hiện trong [bản rà soát](ADMIN-FUNCTIONAL-REVIEW-2026-11-05.md). Code ở nhánh `codex/admin-remediation`; kiểm tra Git để biết trạng thái push/merge. Server `flight-dev` đã nhận ba migration mới và hàm `admin-account-suspension`.

## 1. Tài khoản, quyền và cache

- Danh sách tài khoản lấy email thật từ `auth.users`, tên/điện thoại từ hồ sơ, vai trò từ `private.user_roles`; không ghép email hoặc suy vai trò từ lịch sử thao tác.
- `admin_set_account_role` cấp/thu hồi quyền thật và ghi audit trên server. Thao tác lặp cùng trạng thái không tạo audit giả. Không tự thu hồi quyền hoặc tự khóa tài khoản; có khóa giao dịch và bảo vệ admin hoạt động cuối cùng.
- Khóa/mở tài khoản đi qua Edge Function, kiểm tra JWT và quyền hiện tại, gọi Supabase Auth Admin bằng khóa chỉ tồn tại trên server.
- `private.account_access` chặn hành động DB ngay từ lúc yêu cầu khóa. Khi Auth lỗi/mất phản hồi, tài khoản vẫn bị chặn và có thể thử lại cùng thao tác để đối chiếu; không báo thành công giả. Mở lại chỉ hoàn tất sau khi Auth xác nhận.
- RLS và các RPC chủ đơn kiểm tra tài khoản hoạt động, kể cả với JWT chưa hết hạn. Các luồng server xử lý tiền đã thu vẫn được phép đối soát; khóa người dùng không được làm thất lạc khoản thanh toán.
- Cache admin có QueryClient riêng theo người đăng nhập; đăng xuất/đổi tài khoản xóa cache. Phản hồi cũ không vào cache của chủ tài khoản mới. Client kiểm tra lại quyền định kỳ; server kiểm tra mỗi thao tác.

## 2. Danh mục, ghế và chuyến bay

- Danh mục, chuyến, giá, offer và kho ghế được đọc nhiều trang, sắp xếp ổn định; lỗi trang sau được báo thay vì coi dữ liệu thiếu là đầy đủ. Ô chọn dữ liệu có tìm kiếm/phân trang, không cắt ở 24/1.000 dòng.
- Payload lưu sơ đồ là cấu hình đầy đủ: ghế bị loại chuyển inactive; ghế còn lại giữ ID. Chuyển 6→4→6 ghế mỗi hàng không xung đột vị trí cũ. Index vị trí chỉ áp dụng ghế active.
- Máy bay đã có kho ghế/chuyến xuất bản vẫn không được sửa template; không ghi đè snapshot của các chuyến hiện có.
- `publish=false` thực sự đặt `published_at=null`; scheduled không tự xuất bản. Chặn ngừng xuất bản khi có đơn/ghế đang giữ hoặc chuyến đã khởi hành/đến nơi.
- Giá active phải có khoang ghế sử dụng được. Đổi máy bay không được làm giá trỏ vào khoang bị thiếu; muốn khóa ghế cuối cùng của khoang phải tắt gói vé trước.
- Checkout hiện bán một gói hành lý/người/chặng. Admin chỉ cấu hình loại này và quantity=1. Suất ăn/bảo hiểm cũ được ghi rõ chỉ xem; chưa mở bán những dịch vụ checkout chưa hỗ trợ. Seed mới khớp giới hạn này, không chạy lại seed lên dữ liệu đang dùng.
- Ảnh điểm đến hỗ trợ HTTPS và các đường dẫn bundle được nhận diện. Đường dẫn tương đối không hỗ trợ bị từ chối. Logo HTTPS được dùng ở kết quả/chi tiết chuyến, có chữ cái đầu dự phòng. Logo tương đối cũ được giữ để tương thích, chỉ hiển thị chữ dự phòng.

## 3. Tìm kiếm và liên kết

- Bỏ dấu tiếng Việt (kể cả đ), không phân biệt hoa/thường, gộp khoảng trắng; mọi từ khóa có thể khớp các trường khác nhau.
- Tìm nhanh nhận mã hãng IATA hai ký tự, gồm KE/TG/MH/CX/VU/F0; không giới hạn các hãng ban đầu.
- Khách hàng tìm được theo email tài khoản thật, điện thoại liên hệ và PNR. Hành khách tìm được theo giấy tờ và liên hệ của đơn.
- Xem lịch sử khách truyền `ownerId`, hiển thị mọi đơn của người đó. Liên kết chính xác đơn/giao dịch dùng ID, không chọn PNR đầu tiên.

## 4. Tiền và đối soát

- Tách giá trị đơn đang confirmed khỏi tiền thực nhận, tiền hoàn đã hoàn tất và thu ròng trong kỳ.
- Thu ròng = các khoản đã thu trong kỳ − các khoản hoàn hoàn tất trong kỳ. Ví dụ thu 1.553.000đ rồi hoàn 1.203.000đ còn 350.000đ. Kỳ chỉ có tiền hoàn có thể âm.
- VNPAY dùng bằng chứng `gateway_paid` và ngày thu của cổng theo giờ Việt Nam; gồm cả khoản thu trùng/chậm cần bồi hoàn dù payment public chưa succeeded. Mock dùng `paid_at`. Không dùng ngày tạo yêu cầu thay ngày tiền thực nhận.
- Hoàn tiền tính theo `completed_at`; pending/unknown/review không được cộng thành đã hoàn. Không sửa trạng thái giao dịch để làm báo cáo đẹp hơn.
- `admin_payment_ledger_page` và `admin_vnpay_review_page` là RPC chỉ đọc có kiểm tra admin. Đối soát có count, phân trang và tìm theo PNR/ID/mã cổng; bỏ giới hạn cứng 100 của màn cũ.
- Bộ lọc chi tiết ghi rõ trạng thái xử lý hoàn tiền; “thành công” không bị hiểu là mọi thanh toán thành công. Hiển thị mã hoàn/thời điểm hoàn khi có, liên kết đúng đơn và payment.
- Chi tiết đơn hiển thị snapshot tuyến/chuyến/giờ theo múi giờ sân bay, ghế và dịch vụ đã mua. Nhật ký chỉ lấy server; lỗi tải audit được báo rõ.

## 5. Triển khai và bằng chứng

Ba migration đã áp dụng, có lịch sử trên `flight-dev`:

- `20261105022806_admin_account_authority.sql`
- `20261105022809_admin_catalogue_integrity.sql`
- `20261105022811_admin_reconciliation_read_model.sql`

Không chạy lẫn hai migration admin/profile cũ đang thiếu lịch sử. Generated public types đã cập nhật từ server; wrapper bỏ tham số optional để dùng đúng default SQL.

Kiểm chứng:

- 283 Node tests đạt sau khi cập nhật generated types và wrapper RPC.
- Typecheck, lint và export web được chạy; lint còn ba cảnh báo có sẵn ở AI greeting, auth View và dependency effect của kết quả tìm chuyến.
- Fixture SQL cũ tái hiện lỗi thu nhỏ template còn hai ghế active. Ba bộ SQL rollback đạt với candidate và sau triển khai: quyền/khóa tài khoản; 25 kiểm tra danh mục gồm 6→4→6; 121 giao dịch đối soát, tìm mã trang sau, ngày capture và từ chối người thường/tài khoản khóa. Cách ly cache và phản hồi cũ được kiểm tra bằng Node tests.
- Endpoint đã triển khai từ chối gọi không đăng nhập: suspension và ba RPC đọc admin đều trả HTTP401.
- Fingerprint trước/sau không đổi: bookings19, segments20, passengers19, addons9, seat reservations20, payments25, refunds3, profiles11, admin roles3. Các fixture đã rollback.
- Security advisor trước/sau chỉ có cùng cảnh báo Auth leaked-password protection chưa bật; không thêm cảnh báo schema/function mới.

Giới hạn: chưa nghiệm thu nhìn/thao tác trên Android hoặc trình duyệt Windows; chưa thử khóa/mở một tài khoản thật qua Auth. Không gửi lại refund, không xác nhận gateway đã hoàn tiền, không build APK trong lượt này. Các bản ghi hoàn tiền đang chờ đối soát vẫn giữ nguyên; cần kiểm thử gateway riêng khi người dùng tiếp tục.

## Cách thử nhanh giao diện

1. Đăng nhập admin, mở danh mục/chuyến/offer và tìm bản ghi thuộc cuối danh sách; thử từ khóa không dấu và khoảng trắng thừa.
2. Mở khách có nhiều đơn → lịch sử: mọi đơn của đúng người đó phải có mặt. Mở chi tiết đơn để xem tuyến, giờ, ghế và hành lý.
3. Trong Thanh toán → Đối soát cổng, tìm PNR/reference và đổi bộ lọc hoàn tiền. Review/unknown phải được giữ rõ, không hiện hoàn thành.
4. Tạo máy bay thử chưa sử dụng, đổi cấu hình hàng ghế 6→4→6; chỉ ghế active trong cấu hình mới được tính. Chuyến đã có kho ghế phải bị chặn sửa template.
5. Đăng xuất/đổi sang khách thường: dữ liệu và màn admin của người trước không được hiện lại. Chỉ thử cấp/thu hồi/khóa bằng tài khoản thử riêng.

**Bổ sung từ kiểm thử của người dùng:** hàng khách hàng trước đó chỉ hiện “Cấp quyền Admin”, không mở được hộp quản lý trạng thái. Đã thêm nút “Quản lý” cho mọi tài khoản khác người đang đăng nhập; trong hộp có “Tạm dừng tài khoản này” hoặc “Kích hoạt lại tài khoản này”. Hai nút trên hàng có khoảng cách và tự xuống dòng khi thiếu chỗ.

## Hợp nhất main trong ngày05/11

Đã đối chiếu thêm các PR36/37/38 trên main: giữ cache công khai có whitelist, tối ưu tìm chuyến và giao diện danh mục/lịch bay/kho ghế/thanh toán mới. Khi đổi chủ tài khoản, hủy và xóa query riêng tư, đồng thời giữ cache công khai; cache admin riêng theo người dùng tiếp tục được giữ nguyên ranh giới.

Phần suất ăn mới trên main chưa có trong payload báo giá/tạo đơn trên server. Vì vậy giữ thực đơn ở chế độ tham khảo có nhãn rõ, bỏ lựa chọn không được lưu và bỏ fallback tự dựng suất ăn miễn phí. Giá/hành lý/ghế tiếp tục theo báo giá server; không triển khai nghiệp vụ bán suất ăn trong lần merge này. Có regression test bảo đảm danh mục suất ăn chung không tự trở thành offer của mọi chuyến.

Theo yêu cầu người dùng, công việc điều tra hoàn tiền mới được giữ ở nhánh `codex/vnpay-refund-investigation`, không gộp vào lần tích hợp admin/main này.
