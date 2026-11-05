# Rà soát chức năng Admin Flyora — 05/11/2026

> Bản rà bên dưới giữ lại hiện trạng trước sửa. Các phát hiện đã được xử lý trong [bản sửa Admin 05/11/2026](ADMIN-REMEDIATION-2026-11-05.md), kèm phạm vi triển khai, kiểm thử và giới hạn nghiệm thu.

## Kết luận và phạm vi

Admin chưa khớp hoàn toàn với luồng khách hàng. Kiểm tra code của toàn bộ 10 màn quản trị, tìm kiếm/lọc/phân trang, RPC triển khai trên flight-dev, dữ liệu tổng hợp và kiểm thử hiện có. Nhánh được rà: `codex/fix-admin-seat-pagination`, commit `13d98bd` (đã gồm bản sửa admin tải đủ ghế `050db6b`).

Đây là kết quả kiểm tra code, truy vấn trực tiếp và thử RPC trong transaction rollback; không phải nghiệm thu thao tác trực quan trên Android/trình duyệt. Computer Use trước đó không xác định được URL trình duyệt Windows đủ tin cậy. Không gửi thanh toán, yêu cầu hoàn tiền, đổi quyền hay khóa tài khoản trong lượt rà này. Không tự sửa các lỗi mới bên dưới.

## Các lỗi cần ưu tiên

### P1 — Phân quyền và tạm khóa chỉ lưu trên thiết bị

- `src/features/admin/screens/permissions-screen.tsx:424`: cấp quyền gọi local store, không ghi `private.user_roles`.
- `permissions-screen.tsx:454`: thu hồi cũng chỉ lưu local; admin thật vẫn có quyền DB.
- `permissions-screen.tsx:488`: tạm khóa không gọi Supabase Auth/server. `suspendedIds` không được kiểm tra ở luồng đăng nhập hay RLS.
- `src/features/admin/permissions-store.ts:38`: lưu các thay đổi vào AsyncStorage. Các sự kiện được chuyển thành nhật ký nhìn giống log server rồi trộn vào báo cáo (`permissions-store.ts:277`, `reports-screen.tsx:700`). Chúng không phải log bất biến và không đồng bộ sang máy khác.
- `src/features/auth/use-admin.ts:43` và `:70`: local promoted/revoked có thể ghi đè kết quả `is_admin` thật.

Quyền admin vừa cấp trực tiếp trong DB cho tài khoản người dùng là quyền thật; lỗi này nằm ở các nút phân quyền trong giao diện. Các RPC admin đang triển khai vẫn kiểm tra `private.user_roles` thông qua `private.require_admin()`; local store không tự nâng quyền DB.

### P1 — Cache admin chưa được tách theo người đăng nhập

Các query key như `['admin-reports-audit-bundle']` không chứa user ID. Đăng xuất không xóa QueryClient. Kết hợp với local role override, việc đổi sang tài khoản được local-promote trong cùng app có thể hiển thị dữ liệu admin còn trong cache trước khi server kiểm tra lại. Root QueryClient mặc định giữ dữ liệu fresh 30 giây. Đây là nguy cơ lộ dữ liệu trên thiết bị dùng chung, không phải vượt RLS; suy luận từ code, chưa tái hiện qua trình duyệt.

Tham chiếu: `src/app/_layout.tsx:26`, `src/features/admin/screens/reports-screen.tsx:710`, `src/features/admin/ui.tsx:241`, `src/features/auth/account-screen.tsx:54`.

### P1 — Lưu sơ đồ mới không bỏ ghế cũ bị loại khỏi cấu hình

`supabase/migrations/20261102123000_admin_management_rpcs.sql:397` chỉ upsert các ghế được gửi lên. Ghế cũ không còn trong cấu hình mới vẫn active. Khi chuyển hàng 6 ghế sang 4 ghế, B/E có thể còn tồn tại; khi giảm số hàng, hàng cũ vẫn còn. Chuyến tạo sau đó sao chép cả những ghế thừa này.

Đã tái hiện trên RPC thực, trong BEGIN/ROLLBACK:

1. Tạo máy bay thử chưa có chuyến; lưu ghế 1A và 2A.
2. Gửi cấu hình mới chỉ còn 1A. RPC báo cập nhật 1 ghế.
3. DB vẫn có 2 ghế active; kho ghế của chuyến tạo sau đó cũng có 2 ghế.

Máy bay đã có chuyến xuất bản/kho ghế được RPC bảo vệ khỏi sửa template. Các sơ đồ hiện có đã kiểm tra trước đó vẫn khớp giữa `seats` và `flight_seats`; phát hiện này là lỗi thao tác thay đổi cấu hình máy bay chưa sử dụng.

### P1 — Tùy chọn chưa xuất bản không khớp trạng thái lưu trên server

`flights-screen.tsx:689` cho phép bỏ chọn publish độc lập với status. `admin_save_flight_instance` tại SQL `:627` vẫn gán `published_at` nếu status là scheduled, dù `p_publish=false`. Khi sửa chuyến đã xuất bản, SQL `:588` giữ nguyên publication ngay cả khi bỏ chọn.

Đã tái hiện RPC thực: tạo chuyến scheduled với publish=false trên máy bay thử -> `actual_published=true`. Một chuyến có giá active và còn mở bán có thể xuất hiện ở tìm kiếm khách hàng dù admin tưởng đang để nháp. Phép thử đã rollback.

### P1 — Một số danh sách chưa tải hết dữ liệu để tìm kiếm

`flights-screen.tsx:63`, `addons-screen.tsx:32`, `catalogues-screen.tsx:35` vẫn dùng select một lần; tìm kiếm/lọc chỉ chạy trên mảng đã tải. Flight-dev hiện có 1.834 chuyến, 6.577 giá vé và 10.326 offer. Với giới hạn API mặc định 1.000 dòng, không thể bảo đảm tìm thấy các bản ghi phía sau. Chưa đọc được cấu hình giới hạn cloud tùy chỉnh từ pg role settings; lỗi thiếu ghế admin trước đó đã được xác nhận qua ảnh và sửa riêng.

Danh sách đơn, thanh toán, khách hàng, báo cáo và máy bay/ghế đã dùng loader phân trang. Cần áp dụng cách tải đầy đủ cho phần lịch bay, giá, kho ghế và danh sách chọn chuyến/offer còn lại.

## Tìm kiếm và liên kết nghiệp vụ

### P2 — Xem đơn của khách hàng chỉ mở một đơn

`customers-screen.tsx:249` chuyển sang `/admin/bookings?q=<mã đơn đầu tiên>` thay vì lọc theo user ID. Người có nhiều đơn chỉ thấy một đơn, cũng không chắc là đơn mới nhất vì bundle đang sắp theo ID.

### P2 — Tìm khách hàng và email tài khoản chưa đáng tin cậy

- Tìm hồ sơ khách hàng không gồm PNR và số điện thoại liên hệ trong booking; tìm hành khách không gồm điện thoại, dù placeholder có hứa các trường đó (`customers-screen.tsx:122`, `:132`, `:186`).
- Màn quyền lấy email người khác từ contact booking hoặc tự ghép địa chỉ từ điện thoại/UUID (`permissions-screen.tsx:330`), không phải email đăng nhập đã xác minh. Vì vậy tìm email tài khoản hoặc mời/cấp quyền theo email có thể không tìm đúng người.
- Vai trò đang được suy ra từ người từng ghi audit log, không phải danh sách role hiện tại (`permissions-screen.tsx:199`, `customers-screen.tsx:44`). Admin chưa thao tác có thể bị gọi là khách hàng; admin cũ bị thu hồi trên server có thể vẫn được hiển thị là admin.

### P2 — Tìm nhanh toàn cục thiếu hãng bay

`src/features/admin/ui.tsx:263` chỉ nhận mẫu chuyến VN/VJ/QH/BL/SQ. Nhập KE7030, TG, MH, CX, VU hoặc F0 ở tìm kiếm tổng quan có thể bị đưa sang tìm đơn thay vì tìm chuyến, dù các hãng này có trong DB.

Các màn tìm kiếm dùng `filterAndPaginate` chỉ trim và so chuỗi liên tiếp không phân biệt hoa thường. Không bỏ dấu tiếng Việt, không tách nhiều từ khóa và không gộp khoảng trắng. Probe: “Nguyễn Đăng An” và chữ hoa khớp; “nguyen dang an” hoặc hai dấu cách không khớp. Đây là giới hạn tính năng tìm kiếm cần thống nhất, không tự coi là sai dữ liệu.

## Thanh toán, báo cáo và dịch vụ

### P2 — Báo cáo chưa đối soát được đầy đủ tiền thu và hoàn

`src/features/admin/model.ts:473` cộng doanh thu của đơn hiện còn confirmed, bỏ toàn bộ đơn cancelled rồi tiếp tục trừ tiền hoàn thành công. Cách này phù hợp một phần với định nghĩa cũ “giá trị đơn còn xác nhận”, nhưng không phù hợp nhãn tổng thu ròng/đối soát tiền.

Probe thu 1.553.000đ, hủy, hoàn 1.203.000đ: còn giữ phí hủy 350.000đ, nhưng hàm báo net=0. Khi còn những đơn confirmed khác, tiền hoàn của đơn đã bị loại khỏi gross còn bị trừ vào chúng. Cần tách rõ giá trị đơn, tiền thanh toán thành công, tiền hoàn hoàn tất và phí hủy giữ lại.

Số liệu cloud lúc kiểm tra: confirmed booking gross=13.893.000đ; successful payments=18.799.000đ; phần tiền của các đơn đã hủy=4.906.000đ; completed refunds=0. Các số này không cùng định nghĩa, không nên trình bày như một số dư đối soát.

### P2 — Đối soát VNPAY thiếu phân trang/tìm kiếm và trạng thái chưa đồng nhất

`private.admin_vnpay_review()` hard-limit 100, không offset/count (`20261104093316_vnpay_worker.sql:26`). `vnpay-review.tsx` render trực tiếp, không nhận query/filter từ màn thanh toán. Bản ghi thứ 101 có thể không tìm lại được.

Màn hoàn tiền chính dùng trạng thái public pending/succeeded/failed; trạng thái chi tiết unknown/review nằm trong khối đối soát riêng. Cần kết nối hai phần theo cùng đơn/giao dịch và hiển thị thời điểm hoàn/reference khi có. Chi tiết đơn admin hiện chưa hiển thị đủ tuyến/giờ/chuyến/ghế/addon, mới có cabin/fare và UUID chuyến rút gọn (`bookings-screen.tsx:440`).

Cloud hiện có 3 yêu cầu hoàn đều ở `review`, không có khoản hoàn succeeded. Đây là tình trạng gateway còn chưa xác minh; lượt rà không gửi lại refund hoặc ép trạng thái thành công.

### P2 — Dịch vụ admin cấu hình được nhưng khách chưa mua được

Admin có meal và insurance_demo, nhưng checkout và quote hiện chỉ bán baggage. Max quantity chỉnh được 1–10 nhưng checkout chỉ lưu một gói/người/chặng và server tạo quantity=1. Giá và bật/tắt offer hành lý hiện đi đúng vào luồng khách hàng; các dịch vụ/số lượng còn lại là khoảng trống tính năng.

### P2 — Ảnh/logo và hạng vé chưa có ràng buộc đầy đủ

- Admin chấp nhận đường dẫn ảnh `destinations/da-nang.jpg`; home chỉ nhận URL HTTPS hoặc dùng ảnh bundle theo IATA, nên đường dẫn tương đối không được hiển thị như người quản trị kỳ vọng (`catalogues-screen.tsx:589`, `home-screen.tsx:218`). `logo_path` của hãng được lưu nhưng danh sách kết quả khách hàng vẫn dùng chữ cái đầu.
- Admin có thể lưu giá active cho khoang không tồn tại trên chuyến. RPC lưu giá chưa kiểm tra kho ghế; tìm kiếm khách có thể hiển thị trước khi quote từ chối. Cloud hiện có **0 giá active thiếu khoang ghế**, nên chưa thấy dữ liệu đang sai ở tình huống này.

## Phần đã kiểm chứng và giới hạn nghiệm thu

- 8 RPC admin public đang tồn tại trên cloud; anon không được execute; authenticated vẫn phải qua require_admin kiểm tra role server.
- 250 Node tests đạt; typecheck đạt; lint 0 lỗi, còn 3 cảnh báo có sẵn từ AI/auth/results.
- Đơn/thanhtoán/khách hàng/báo cáo/máy bay đọc nhiều trang với thứ tự ổn định; lỗi trang sau không được coi là dữ liệu hoàn chỉnh. Riêng audit loader đang nuốt lỗi thành danh sách rỗng, cần làm rõ trạng thái lỗi.
- Các enum booking/payment và lọc trạng thái chính khớp với DB. Nhà cung cấp VNPAY được hiển thị trong danh sách payment chính.
- Giá tiền, allowance JSON, chính sách hủy, seat geometry của dữ liệu hiện tại khớp checkout. Ghế mẫu và kho ghế của 1.834 chuyến đã được đối chiếu trước đó, không thấy lệch.
- RPC có bảo vệ chống đổi template của máy bay đã có inventory, lịch máy bay chồng, sửa tuyến/giờ khi có đơn đang hoạt động, block ghế đang giữ/đã đặt và thay identity của giá đã có tham chiếu.
- Bộ test hiện có còn thiên về schema, mapping và mẫu thành công; việc xanh không chứng minh các nút CRUD/role đều hoạt động đúng end-to-end.
- Phép thử cloud chỉ dùng máy bay/chuyến tạm trong BEGIN/ROLLBACK. Đọc lại: aircraft=34, seats=3.744, flights=1.834, fares=6.577, bookings=17, payments=23, refunds=3, roles=3; máy bay thử còn lại=0. Không thay đổi dữ liệu nghiệp vụ thật.

## Thứ tự sửa đề nghị

1. Role/suspend thật trên server, bỏ local override và tách/xóa cache theo tài khoản; đồng bộ audit thật.
2. Phân trang toàn bộ danh sách admin; sửa tìm nhanh theo hãng và liên kết mọi đơn của khách.
3. Sửa thay thế template ghế và hành vi nháp/xuất bản; thêm rollback regression cho hai tình huống đã tái hiện.
4. Thống nhất metric tiền và màn đối soát/refund; bổ sung chi tiết đơn/ghế/dịch vụ.
5. Khớp giới hạn dịch vụ, ảnh/logo, kiểm tra khoang khi tạo giá; hoàn thiện VN/EN và chuẩn hóa tìm kiếm.

Mỗi nhóm nên là task/commit riêng. Sau khi sửa cần nghiệm thu giao diện Android và web, gồm đổi tài khoản, dữ liệu vượt 1.000 dòng, nhiều đơn cùng khách, sửa cấu hình trước/sau xuất bản và trạng thái refund từ server.
