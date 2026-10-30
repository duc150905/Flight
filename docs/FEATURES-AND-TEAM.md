# Flight — nghiệp vụ, tính năng và phân công nhóm 3 người

Ngày lập: 29/10/2026. Đây là đề xuất phân công; chưa biết tên, thế mạnh hoặc
deadline của từng thành viên nên dùng TV1, TV2, TV3. Không phải tính năng nào
trong checklist cũng đã được triển khai.

## 1. Phạm vi và trạng thái hiện tại

- Ứng dụng Expo React Native + TypeScript, ưu tiên Android, giao diện tiếng Anh.
- Backend Supabase/PostgreSQL; chuyến bay mẫu và thanh toán mô phỏng.
- Nhóm 3 người cùng làm giao diện, dữ liệu, kiểm thử và tài liệu phần mình.
- `main` có nền tảng môi trường (032feb2).
- `feat/email-auth` có đăng ký, xác nhận mã email, đăng nhập, khôi phục phiên,
  đăng xuất (e6971b6). Chưa merge vào main tại thời điểm lập kế hoạch.
- Auth mới qua kiểm thử tự động và xuất bundle; chưa nghiệm thu gửi email thật
  và phiên trên điện thoại. SMTP/domain chưa chốt. Với project Free mới, muốn sửa
  email template phải thiết lập custom SMTP; không coi email OTP đã hoàn tất.
- Chưa có schema nghiệp vụ đặt vé, dữ liệu chuyến bay hoặc màn hình quản trị.

## 2. Vai trò người dùng

- Khách chưa đăng nhập: xem điểm đến, tìm/lọc/xem chi tiết chuyến bay.
- Khách hàng: đăng nhập để tạo đơn, lưu hồ sơ, xem và hủy đơn của mình theo điều kiện.
- Quản trị viên: quản lý danh mục, lịch bay, giá/dịch vụ và theo dõi đơn/thanh toán.
- Quyền admin được kiểm soát phía server; không dựa vào user_metadata tự sửa được.

## 3. Danh sách nghiệp vụ và tính năng

### F01 — Tài khoản và hồ sơ | TV1

- [ ] Nghiệm thu đăng ký với full name, email, password, confirm password.
- [ ] Hoàn tất xác nhận email, gửi lại mã và lỗi mã sai/hết hạn.
- [ ] Nghiệm thu đăng nhập, đăng xuất, khôi phục và làm mới phiên.
- [ ] Quên mật khẩu: gửi yêu cầu và đặt mật khẩu mới qua luồng xác thực phù hợp.
- [ ] Xem/sửa hồ sơ: tên và số điện thoại liên hệ; không coi số nhập tay là đã xác minh.
- [ ] Đổi mật khẩu bằng luồng xác thực phù hợp, không cho thay đổi tùy ý qua client.
- [ ] Tạo bảng profiles, giới hạn người dùng đọc/sửa hồ sơ của mình.

Đạt khi: đăng nhập lại không mất hồ sơ; người A không đọc/sửa hồ sơ người B;
không lưu mật khẩu trong bảng profiles hoặc log. Luồng email cần test trên thiết bị.

### F02 — Trang chủ và tìm kiếm | TV1

- [ ] Trang chủ gợi ý điểm đến và điểm bắt đầu tìm chuyến.
- [ ] Chọn sân bay đi/đến, tìm theo thành phố hoặc mã IATA, hoán đổi hai sân bay.
- [ ] Chọn ngày khởi hành; chặn ngày không hợp lệ và hai sân bay giống nhau.
- [ ] Số hành khách người lớn/trẻ em/em bé, hạng ghế; kiểm tra tổ hợp hợp lệ.
- [ ] Tìm vé một chiều trước, tích hợp theo hợp đồng dữ liệu chung.
- [ ] Mở rộng khứ hồi: chọn cả chiều đi và chiều về, ngày về không trước ngày đi.
- [ ] Mở rộng nhiều chặng: thêm/xóa/sắp thứ tự chặng và kiểm tra ngày từng chặng.
- [ ] Hiển thị loading, không có kết quả, lỗi và thử lại.

Đạt khi: cùng bộ dữ liệu mẫu, điều kiện tìm kiếm trả đúng chuyến và giá/hạng vé;
chọn chiều đi không làm mất lựa chọn chiều về hoặc các chặng khác.

### F03 — Kết quả và chi tiết chuyến | TV1

- [ ] Thẻ chuyến: hãng, mã chuyến, giờ, sân bay, thời lượng, giá và tiền tệ.
- [ ] Lọc hãng, khoảng giá, giờ bay, số điểm dừng khi dữ liệu có hỗ trợ.
- [ ] Sắp xếp giá, giờ khởi hành, thời lượng; xóa các bộ lọc.
- [ ] Chi tiết từng chuyến/chặng, điều kiện vé, hành lý đi kèm và phí bổ sung.
- [ ] Chọn hạng vé, chuyển lựa chọn có kiểu dữ liệu rõ ràng sang checkout của TV2.

Đạt khi: giá trên kết quả khớp hạng vé và số hành khách; server vẫn kiểm tra
lại giá ở bước tạo đơn, không tin số tiền do giao diện gửi lên.

### F04 — Hành khách và liên hệ đặt vé | TV2

Tiến độ 30/10/2026: đã có module kiểm tra/chuẩn hóa dữ liệu liên hệ và 10 test;
xem [BOOKING-CONTACT.md](BOOKING-CONTACT.md). Chưa có form hoặc lưu bản nháp.

- [ ] Bản nháp checkout lưu lựa chọn giữa các bước bằng Zustand.
- [ ] Nhập thông tin từng hành khách: tên, ngày sinh, loại hành khách và các trường
  giấy tờ/quốc tịch chỉ khi hành trình yêu cầu; xác định nội địa/quốc tế từ dữ liệu.
- [ ] Thông tin liên hệ của đơn: tên, email, số điện thoại; phân biệt với hành khách.
- [ ] Kiểm tra đủ hành khách, trường bắt buộc và ngày sinh phù hợp chính sách.
- [ ] Cho xem lại/sửa dữ liệu trước khi xác nhận; tránh mất bản nháp khi quay lại.

Đạt khi: người đặt có thể mua cho người khác; nhiều hành khách không dùng nhầm
thông tin nhau. Chỉ dùng dữ liệu cá nhân giả trong seed và kiểm thử.

### F05 — Hành lý và dịch vụ bổ sung | TV2; danh mục/giá do TV3 quản lý

- [ ] Hiển thị hành lý có sẵn trong hạng vé và các gói mua thêm.
- [ ] Chọn dịch vụ theo đúng hành khách và từng chặng.
- [ ] Tính lại báo giá phía server khi thêm/bớt dịch vụ.
- [ ] Bảo hiểm ở ảnh tham khảo: chỉ là lựa chọn mô phỏng có ghi rõ trong demo,
  triển khai sau khi hành lý chạy ổn; không phát hành hợp đồng bảo hiểm thật.

Đạt khi: thay đổi dịch vụ trên một chặng không tác động sai đến chặng còn lại;
giá cũ trong đơn đã xác nhận không đổi khi quản trị viên cập nhật bảng giá.

### F06 — Sơ đồ và giữ ghế | TV2; máy bay/sơ đồ gốc do TV3 quản lý

- [ ] Hiển thị ghế trống, đang giữ, đã đặt và ghế đang chọn.
- [ ] Chọn ghế riêng cho từng hành khách trên từng chuyến.
- [ ] Giữ ghế có hạn dùng do server quyết định; hiển thị thời gian còn lại.
- [ ] Transaction và ràng buộc bảo đảm không giữ/đặt trùng ghế trên cùng chuyến.
- [ ] Xử lý hết hạn, đổi lựa chọn, hủy đơn và xác nhận đơn; ghế hết hạn không
  tiếp tục chặn người khác, có cơ chế dọn dữ liệu hết hạn.

Đạt khi: hai thiết bị chọn cùng ghế thì chỉ một bên giữ được; hết hạn phải chọn
lại hoặc lấy báo giá mới. Quy tắc ghế/em bé thống nhất cùng F02 trước khi làm UI.

### F07 — Báo giá, tạo đơn và thanh toán mô phỏng | TV2

- [ ] Server tính vé, hành lý, ghế và phí; lưu tiền dạng số nguyên kèm mã tiền tệ.
- [ ] Lưu giá chốt trong đơn; hiển thị bảng phân tích tổng tiền.
- [ ] Tạo mã đặt chỗ và các chặng/hành khách liên quan trong một thao tác nguyên tử.
- [ ] Mô phỏng thành công, thất bại, hủy và chờ xử lý; cho thử lại đúng chính sách.
- [ ] Yêu cầu lặp sau timeout/mất mạng không tạo đơn hoặc ghi nhận thanh toán hai lần.
- [ ] Xác nhận đơn và ghế nhất quán; không thu tiền thật hoặc lưu số thẻ/CVV.
- [ ] Màn hình thành công dẫn tới chi tiết đơn do TV1 phụ trách.

Đạt khi: tổng tiền client bị sửa không ảnh hưởng giá server; tiền thanh toán
khớp đơn; chỉ confirmed sau kết quả hợp lệ. Thử thanh toán thành công trễ sau
thời hạn giữ ghế phải có quy tắc từ chối/đối soát mô phỏng rõ ràng.

### F08 — Vé của tôi và hủy đơn | TV1; thao tác hủy nguyên tử do TV2 cung cấp

- [ ] Danh sách đơn của người dùng, lọc theo trạng thái.
- [ ] Chi tiết mã đặt chỗ, hành khách, từng chặng, ghế, dịch vụ và tổng tiền.
- [ ] Tóm tắt vé điện tử dùng cho demo, ghi rõ không phải vé do hãng xuất.
- [ ] Xác nhận hủy đơn, kiểm tra điều kiện vé và thời điểm bay ở phía server.
- [ ] Hủy hợp lệ cập nhật đơn/ghế/thanh toán nhất quán; hoàn tiền chỉ mô phỏng.

Đạt khi: chỉ xem/hủy được đơn của mình, không hủy confirmed/đã bay trái chính sách;
gửi lại yêu cầu hủy không giải phóng ghế của một đơn khác.

### F09 — Quản trị danh mục, lịch bay và giá | TV3

- [ ] Giao diện quản trị riêng; đề xuất web để nhập liệu thuận tiện, chốt với nhóm
  trước khi tạo project riêng. API/phân quyền phải được bảo vệ dù dùng giao diện nào.
- [ ] Quản lý sân bay, thành phố, mã IATA, quốc gia, múi giờ IANA; hãng bay.
- [ ] Quản lý máy bay, hạng ghế và sơ đồ ghế.
- [ ] Tạo chuyến theo ngày giờ, chặng bay và máy bay; tránh lịch máy bay xung đột.
- [ ] Quản lý hạng vé, số chỗ bán, giá, tiền tệ và điều kiện vé.
- [ ] Quản lý gói hành lý/dịch vụ có hiệu lực và ảnh điểm đến.
- [ ] Tìm/lọc/phân trang và validation trên các danh sách quản trị.
- [ ] Ngừng bán chuyến thay vì xóa cứng dữ liệu đã được đơn hàng tham chiếu.

Đạt khi: người dùng thường không gọi được thao tác admin; dữ liệu lịch sử đơn
không hỏng sau cập nhật danh mục; ngày bay hiển thị đúng múi giờ của sân bay.

### F10 — Quản trị đơn và báo cáo | TV3

- [ ] Danh sách/chi tiết đơn, lọc mã đơn, khách hàng, ngày và trạng thái.
- [ ] Xem các lần thanh toán mô phỏng và lỗi xử lý để hỗ trợ kiểm thử.
- [ ] Không cho sửa trạng thái đơn tùy ý để bỏ qua quy tắc giữ ghế/thanh toán.
- [ ] Dashboard số đơn và tổng tiền mô phỏng theo kỳ; thống nhất cách loại đơn
  hủy/hoàn tiền và múi giờ báo cáo; không gọi đây là doanh thu kinh doanh thật.
- [ ] Ghi nhận người và thời gian của thao tác quản trị quan trọng.

Đạt khi: thống kê khớp dữ liệu đơn đã xác nhận theo định nghĩa của nhóm;
thông tin cá nhân được giới hạn theo quyền quản trị cần thiết.

## 4. Phân chia trách nhiệm tổng thể

### TV1 — Tài khoản, tìm kiếm và trải nghiệm khách hàng

- Chính: F01, F02, F03, F08.
- Dữ liệu: profiles và truy vấn tìm chuyến/đơn của người dùng.
- Đầu ra đầu tiên: Auth nghiệm thu + tìm một chiều tới bước chọn chuyến.
- Tiếp nhận phần Auth đã có; không viết lại từ đầu. Phụ trách cấu hình/nghiệm thu
  email cùng người đang giữ tài khoản Supabase/Resend.
- Viết kiểm thử form, tìm kiếm/lọc/ngày và quyền xem đơn.

### TV2 — Checkout và tính đúng đắn của đơn

- Chính: F04, F05, F06, F07.
- Dữ liệu: bookings, booking_segments, booking_passengers, seat_reservations,
  booking_addons, payments; transaction/RPC và idempotency của tạo/hủy/thanh toán.
- Đầu ra đầu tiên: một hành khách đặt một chuyến và thanh toán mô phỏng thành công.
- Cung cấp thao tác hủy đơn cho TV1 và thông tin trạng thái cho TV3.
- Viết kiểm thử cạnh tranh ghế, hết hạn, thay đổi giá, retry và quyền sở hữu.
- Đây là phần có rủi ro nghiệp vụ cao nhất: giữ giao diện đơn giản lúc đầu,
  TV3 hỗ trợ review transaction/RLS và TV1 hỗ trợ thử trên thiết bị thứ hai.

### TV3 — Dữ liệu chuyến bay, quản trị và nền tảng dùng chung

- Chính: F09, F10; seed danh mục và chuyến bay phục vụ F02–F07.
- Dữ liệu: airports, airlines, aircraft, seats, flight_instances, flight_fares,
  danh mục dịch vụ và phân quyền quản trị.
- Đầu ra đầu tiên: schema/seed danh mục nhất quán và quản trị tạo được chuyến có giá.
- Điều phối migration/seed và kiểm tra RLS; mỗi người vẫn viết SQL/test phần mình.
- Điều phối CI, EAS/APK, cấu hình môi trường và hướng dẫn cài; cả nhóm cùng xử lý lỗi.

Không chia cố định thành một người chỉ frontend, một người chỉ backend, một người
chỉ kiểm thử. Khối lượng chưa thể cân chính xác khi chưa biết năng lực/deadline;
đánh giá lại sau luồng một chiều chạy xuyên suốt, chuyển việc nếu có người bị nghẽn.

## 5. Các thỏa thuận phải chốt trước khi code song song

- ID và model chuẩn: Airport, FlightInstance, Fare, SearchCriteria,
  SelectedItinerary, PassengerDraft, Quote, BookingSummary.
- Phân biệt một hành trình có nhiều chặng với một chuyến bay cụ thể; round trip
  và multi-city dùng chung cấu trúc booking_segments có thứ tự.
- Một CheckoutDraft được bàn giao từ TV1 sang TV2 bằng ID chuyến/hạng vé và số
  hành khách, không coi giá trong draft là nguồn xác nhận cuối cùng.
- TV2 chốt hợp đồng báo giá/giữ ghế/tạo đơn/thanh toán/hủy, TV1 và TV3 review.
- Trạng thái đơn cơ bản: pending_payment, confirmed, cancelled, expired.
  Trạng thái thanh toán tách riêng và chỉ chuyển qua thao tác server hợp lệ.
- Xác định chính sách trẻ em/em bé, tuổi tại ngày bay, số lượng tối đa,
  ghế em bé, chuyến nối chuyến và điều kiện hủy; không tự suy đoán khác nhau.
- Thời điểm bay lưu dạng thời điểm tuyệt đối và múi giờ sân bay để hiển thị.
- Chọn một người điều phối schema (TV3); migration có lịch sử, không chỉnh
  database bằng tay mà không ghi lại thay đổi để các máy tái tạo được.

## 6. Thứ tự triển khai (không gán tuần khi chưa có deadline)

### Mốc A — Nền tảng chung

- Nghiệm thu Auth, chốt ERD, hợp đồng dữ liệu, chính sách và dữ liệu seed.
- Thống nhất component, màu, định dạng tiền/ngày/giờ và trạng thái loading/error.
- Chốt nhánh/PR, biến môi trường và cách chạy cho cả 3 người.

### Mốc B — Một luồng đặt vé chạy xuyên suốt

- TV1: tìm một chiều, chi tiết và chọn vé.
- TV2: một hành khách, ghế, giá server và thanh toán mô phỏng.
- TV3: tạo chuyến/giá/ghế bằng quản trị và theo dõi đơn sau khi đặt.
- Cùng ghép demo: đăng nhập → tìm → đặt → xem đơn → quản trị thấy đơn.

### Mốc C — Mở rộng để hoàn thiện phạm vi

- Khứ hồi, nhiều hành khách, nhiều chặng; dịch vụ theo hành khách/chặng.
- Hồ sơ, khôi phục mật khẩu, bộ lọc, lịch sử và hủy đơn.
- Hoàn thiện danh mục, báo cáo, trạng thái rỗng/lỗi và trải nghiệm trên điện thoại.

### Mốc D — Nghiệm thu và bàn giao

- Kiểm thử 2 người chọn cùng ghế, hết hạn, retry sau mất mạng, giá đổi,
  múi giờ/chuyến qua đêm, thanh toán thất bại và truy cập đơn người khác.
- Tạo APK chạy trên Android thật, kiểm tra môi trường sạch từ README.
- Chuẩn bị ERD, tài liệu nghiệp vụ/API, kết quả test và kịch bản demo.

## 7. Tiêu chuẩn hoàn tất một tính năng

- Có giao diện và dữ liệu thật từ backend phù hợp phạm vi mô phỏng.
- Có loading, lỗi, thử lại, dữ liệu rỗng và validation cần thiết.
- Có phân quyền phía server và kiểm thử các quy tắc nghiệp vụ quan trọng.
- Có migration/seed nếu thay đổi dữ liệu; không commit khóa bí mật/dữ liệu cá nhân thật.
- Có PR được một thành viên khác review; CI/typecheck/lint/test qua.
- Chạy thử trên Android; mô tả rõ điều gì chưa kiểm tra được.

## 8. Để sau khi phạm vi chính chạy ổn

Tích hợp vé hãng thật, thu tiền/hoàn tiền thật, đổi vé, mã giảm giá, tích điểm,
push notification, đăng nhập mạng xã hội, nhiều ngôn ngữ và tự động hóa n8n.
Không thêm đồng thời các phần này vào mốc một chiều đầu tiên.
