# Cập nhật tìm sân bay và phủ tuyến/khoang — 05/11/2026

SearchFlow dùng helper `airport-search.ts`: bỏ dấu, chuẩn hóa dấu câu/khoảng trắng, hỗ trợ alias SGN/HAN/CXR, tìm nhiều từ không phụ thuộc thứ tự và ưu tiên mã IATA/tên khớp trước khi giới hạn 12 kết quả. `TPHCM`, `HCM`, `Sài Gòn`, `Tan Son Nhat` đều ra SGN; không dùng fuzzy quá rộng để đoán sai mã sân bay.

Manifest catalogue mở rộng 71 cặp tuyến. Generator có `--all-cabins` tạo inventory C4 riêng của Flyora Airways F0, đủ 4 khoang với 5 gói giá, ID chuyến có hậu tố C4 và registration `-C4`; không ghi đè máy bay/chuyến đã có đơn. Phủ cả hai chiều từ SGN/HAN/DAD đến toàn bộ 22 sân bay, cùng các tuyến mẫu nhiều chặng; chưa phải mọi cặp thành phố đều có chuyến thẳng. Cửa sổ 06/11–05/12/2026. Xem [CATALOGUE-DATA.md](CATALOGUE-DATA.md) và [CHECKOUT-ITINERARY-TESTS.md](CHECKOUT-ITINERARY-TESTS.md). Không seed root, không sửa booking/payment/refund/RLS. Kiểm tra kết quả SQL và Git để biết trạng thái áp dụng/commit/push.

Đã áp dụng xong cả 6 batch vào flight-dev: thêm 4.260 chuyến, tổng 6.862 chuyến. Fingerprint dữ liệu ngoài catalogue giữ nguyên trong từng batch. SQL public search đủ 17.040 tổ hợp tuyến/ngày/khoang, không thiếu; kiểm tra ghế/khoang/hành lý/vòng quay đạt. 305 Node tests và typecheck đạt; lint có 1 cảnh báo AI cũ. Web đã xác nhận gõ TPHCM ra SGN và 3 chặng mẫu có kết quả ở Phổ thông. Chưa nghiệm thu Android, không build APK.

# Cập nhật email xác nhận — 05/11/2026

Email xác nhận mới dùng snapshot version 2: chia Chiều đi/Chiều về hoặc Chặng 1/2…, ghi tên và ghế từng người đúng theo passenger_segment_id; hành lý cũng nằm dưới đúng người/chặng. Giờ bay dùng timezone sân bay. Migration 20261105084143_vnpay_booking_email_segment_seats đã lên flight-dev, worker đã cập nhật. Renderer cũ giữ nguyên cho outbox cũ để không đổi payload retry Resend; không gửi lại email đã nhận. Kiểm thử SQL rollback khứ hồi/3 chặng + ghế/hành lý/em bé đạt, không còn dữ liệu test. Khi deploy worker phải giữ các file query/reconcile đang chạy từ nhánh điều tra hoàn tiền: lần này tải source worker hiện tại rồi chỉ thay booking-email.ts, không merge nhánh hoàn tiền vào main. Xem [VNPAY-SANDBOX.md](VNPAY-SANDBOX.md). Chưa nghiệm thu hình thức email trên Gmail/Android; browser chặn preview HTML cục bộ. Không build APK.

# Cập nhật khứ hồi/nhiều chặng — 05/11/2026

Đã nạp thêm 768 chuyến vào flight-dev bằng generator catalogue, gồm 12 cặp tuyến mới hai chiều và kéo dài lịch 24 cặp cũ đến 05/12/2026. Manifest hiện có 36 cặp/72 hướng; 12 cặp mới chạy hằng ngày 06/11–05/12/2026. Có 7 bộ test khứ hồi/nhiều chặng (23 chặng) trong [CHECKOUT-ITINERARY-TESTS.md](CHECKOUT-ITINERARY-TESTS.md). SQL discovery kiểm tra dưới role anon, khoang/ghế/hành lý kiểm tra riêng: tất cả đạt. Tổng mới: 2.602 chuyến, 8.891 gói giá, 300.204 ghế theo chuyến. Generator chỉ thêm offer hành lý để tương thích trigger capability hiện tại; không vô hiệu trigger hoặc cấp quyền đọc ghế cho anon. Fingerprint các bảng ngoài catalogue không đổi; không tạo/sửa booking, payment, refund, tài khoản. Chưa build APK hoặc nghiệm thu thao tác Android. Xem Git để biết trạng thái commit/push/merge.

# Cập nhật Admin — 05/11/2026

Đọc [ADMIN-REMEDIATION-2026-11-05.md](ADMIN-REMEDIATION-2026-11-05.md) trước khi sửa admin hoặc các phần giao nhau. Quyền/khóa là dữ liệu server, không dùng AsyncStorage làm nguồn quyền. Cache admin tách theo tài khoản; đọc đủ trang và báo lỗi tải thiếu. Template ghế thay thế toàn bộ với index vị trí ghế active; publish=false thực sự riêng tư, có bảo vệ chuyến đang có đơn. Checkout chỉ hỗ trợ một gói hành lý/người/chặng; meal/insurance chỉ xem. Báo cáo tiền dùng capture/refund completion theo ngày sự kiện, khác giá trị đơn confirmed. Ba migration 20261105022806/09/11 và hàm admin-account-suspension đã lên flight-dev; không chạy lại seed, không sửa history migration cũ hoặc các refund review đang chờ. Chưa nghiệm thu Android/build APK; kiểm tra Git để biết local/push/merge.

# Cập nhật danh mục — 04/11/2026

Đã nạp bộ mở rộng vào **flight-dev**: thêm 10 sân bay, 4 hãng, 14 điểm đến, 24 máy bay với 2.964 ghế mẫu; 1.440 chuyến bay (24 cặp đường bay hai chiều) từ 05/11 đến 04/12/2026, 4.620 gói giá, 177.840 ghế theo chuyến, 5 sản phẩm và 7.200 offer. Đọc [CATALOGUE-DATA.md](CATALOGUE-DATA.md) trước khi seed: chỉ dùng generator riêng, không chạy toàn bộ seed gốc vì có cấp admin. Không sửa booking/payment/refund/profile/role; bảo vệ bằng fingerprint trong giao dịch. Tên hiển thị Demo đã chuẩn hóa, giữ mã enum/code cũ để tương thích; có bản dịch Việt–Anh. VNPAY Sandbox giữ nguyên. Lịch, giá và sơ đồ ghế là dữ liệu học tập, không phải inventory thương mại. Chưa build APK mới.

Thanh toán VNPAY/email đã có: [VNPAY-SANDBOX.md](VNPAY-SANDBOX.md) thay thế các ghi chú “chưa kết nối cổng ngoài” ở snapshot cũ bên dưới. Phần UI hiện tự báo giá khi mở bước báo giá, nhãn vé/tổng tiền đã rút gọn, giờ bay hiển thị theo sân bay và nút payment status được thay bằng polling có giới hạn. Kiểm tra Git để biết thay đổi đang ở local hay đã push/merge.

# Cập nhật TV2 — 03/11/2026

**Mới nhất:** đọc `MOCK-PAYMENTS.md` và `ANDROID-CHECKOUT-ACCEPTANCE.md`. Đã có payment mock nội bộ, màn thành công/vé demo, cancel theo snapshot và refund giả. Không kết nối cổng ngoài, không thu tiền/nhập thẻ. Các RPC start_mock_payment, get_mock_payment_state, resolve_mock_payment, cancel_booking, refund_mock_booking đã chạy trên flight-dev cùng cron hết hạn mỗi phút. Năm migration 20261103143605/09/12/14/17 có history; hai migration admin/profile cũ vẫn chưa chạy. App code cần kiểm tra Git để biết local/push/merge. Android thật chưa nghiệm thu.

Đọc `BOOKING-CREATION.md`: đã có `create_booking(uuid,jsonb)`,
`get_pending_booking(uuid)`, `find_booking_request(uuid)`, giữ ghế tối đa 15 phút,
phân ghế miễn phí và `/pending/[id]`. Hai migration `20261103065922` và
`20261103065925` đã chạy trên flight-dev. Không cấp quyền ghi trực tiếp bảng
giao dịch. Snapshot chuyến theo contract của tickets/presentation.ts.
Đơn chờ có thể mở lại từ Vé của tôi; thanh toán/cancel/refund chưa triển khai.
Hai migration admin/profile cũ vẫn chưa chạy trên cloud, đợt này không chạy lẫn.
Kiểm tra Git để phân biệt code local, đã push và đã merge.

## Snapshot cũ — 02/11/2026

Đọc thêm `CHECKOUT-EXTRAS.md` và `CURRENCY.md` trước khi sửa phần giao nhau.
Checkout đã có hành lý theo người/chặng, sơ đồ ghế chọn trong RAM và báo giá
authenticated chỉ đọc `quote_checkout(p_request jsonb)`. Migration
`20261102090252_checkout_quote.sql` đã chạy trên flight-dev và có lịch sử khớp.
Giá DB/settlement vẫn VND; USD là hiển thị tham khảo. Không cấp quyền ghi trực
tiếp bảng giao dịch; chưa có hold/create booking/payment. Xem trạng thái Git
trước khi kết luận các thay đổi local này đã được push/merge.

# Bàn giao Flight cho Codex của nhóm 3 người

> **Đọc cập nhật này trước (02/11/2026):** phần bên dưới là snapshot tại mốc
> `3da5155`. Sau snapshot, TV3 đã thêm seed catalogue/lịch bay và sửa web hydration;
> TV2 đã hoàn tất tuổi theo từng chặng trong một đơn, nền tảng Việt–Anh, bản dịch
> checkout, màn Traveller information theo PDF và fixture dùng chung. DB flight-dev
> đã thêm `booking_passengers.gender` nullable và dữ liệu demo. Đọc
> [CHECKOUT-NEXT-WALKTHROUGH.md](CHECKOUT-NEXT-WALKTHROUGH.md),
> [LOCALIZATION.md](LOCALIZATION.md), [CHECKOUT-DEMO.md](CHECKOUT-DEMO.md),
> [CHECKOUT.md](CHECKOUT.md) trước khi tiếp tục; các mục snapshot nói ba phần trên
> “chưa làm” hoặc yêu cầu chọn lại/tách hành trình đã được thay thế.
> App chấp nhận UUID PostgreSQL từ seed TV3 và chuẩn hóa chữ thường; không đổi
> các khóa chính đã lưu. Baggage/seat/payment nghiệp vụ và nghiệm thu Android thật
> vẫn là các task sau. Gói ZIP kèm các tài liệu cập nhật và PDF tham chiếu.

**Ngày cập nhật:** 02/11/2026, múi giờ Asia/Bangkok.

**Repo:** https://github.com/duc150905/Flight.git

**Bản code đã đối chiếu:** local `main`, commit
`3da51555f2d7f0bc8aeddf21776e5e515bc20b98` (PR #10).
Đây là mốc tham chiếu, không phải yêu cầu quay code về commit này. Nếu repo đã
có commit mới hơn, kiểm tra thay đổi mới và cập nhật lại trạng thái bàn giao.

## 1. Mục đích và cách sử dụng

Tài liệu cung cấp ngữ cảnh cho Codex của TV1 và TV3 khi tiếp tục cùng repo với TV2.
Không cần đọc lịch sử chat của TV2 để hiểu các quyết định quan trọng dưới đây.

Đọc tài liệu này cùng code trong repo. Không xem danh sách việc còn lại là lệnh
tự thực hiện toàn bộ: chỉ triển khai task cụ thể mà thành viên đang giao.
Tài liệu không thay thế hướng dẫn hệ thống, yêu cầu mới của người dùng hoặc
`AGENTS.md` áp dụng cho thư mục đang làm việc.

Ba Codex không tự chia sẻ lịch sử chat giữa các tài khoản. Phần chia sẻ được là
code, tài liệu, migration và PR đã đưa lên GitHub rồi lấy về máy. Một thay đổi
chỉ ở máy cá nhân hoặc chat riêng chưa có nghĩa hai thành viên khác đã biết.

Khi bắt đầu:

1. Mở đúng repo Flight và đọc `AGENTS.md` đang có.
2. Kiểm tra nhánh, commit, thay đổi chưa commit; giữ nguyên công việc đang dở.
3. Fetch và đối chiếu `origin/main`. Cập nhật nhánh làm việc theo trạng thái Git
   thực tế, không ghi đè/reset cứng hoặc stash thay đổi của người khác tùy tiện.
4. Đọc phần phụ trách, yêu cầu mới và hợp đồng dữ liệu trong tài liệu này.
5. Đọc các file code liên quan trước khi đề xuất sửa. Nếu code/tài liệu khác nhau,
   nêu rõ khác biệt; không coi mọi ghi chú cũ là trạng thái hiện tại.

## 2. Mục tiêu project

- Ứng dụng đặt vé máy bay trên điện thoại, ưu tiên Android.
- Nhóm 3 người; mỗi người làm cả giao diện, dữ liệu, kiểm thử và tài liệu phần mình.
- Mục tiêu học và xây dựng một project hoàn chỉnh dần qua từng task.
- Dữ liệu chuyến bay mẫu; thanh toán và hoàn tiền mô phỏng.
- Chưa tích hợp xuất vé hãng thật hoặc thanh toán tiền thật.
- Người đang dùng chat tạo tài liệu này phụ trách **TV2**.

## 3. Ba yêu cầu mới cần đặc biệt lưu ý

### 3.1. Giao diện phải bám sát PDF gốc

Người dùng yêu cầu làm giống giao diện trong **flight.pdf**, không chỉ dùng màu
gần giống rồi tự đổi hẳn bố cục hoặc luồng sử dụng.

PDF có 17 trang: Home; tìm khứ hồi/một chiều/nhiều chặng; chọn sân bay đi/đến;
chọn ngày; chọn số người/hạng ghế; kết quả; lọc/sắp xếp; chi tiết chuyến;
Traveller information; Baggage; Seat information; Select seats; Payment;
Booking successful. Cần xem trang thực tế liên quan trước khi làm UI.

- Bám theo bố cục, màu, hình ảnh, icon, khoảng cách, ô nhập, thanh tiến trình,
  thanh điều hướng và vùng tổng tiền/nút tiếp tục.
- Thích ứng với kích thước màn hình, bàn phím, safe area và nội dung tiếng Việt.
- Giữ nghiệp vụ cần thiết như ngày sinh để tính tuổi và giấy tờ có điều kiện.
  Nếu trường trong PDF khác schema hiện tại, ghi rõ khác biệt và xử lý trong
  task tương ứng; không tự xóa trường nghiệp vụ hoặc tự sửa database chỉ vì ảnh.
- Số tiền, hãng, ngày và thông tin thẻ trong ảnh là dữ liệu minh họa. Không dùng
  chúng thay kết quả backend hoặc tạo thông báo thanh toán thành công giả.
- Mẫu giao diện không phải giấy phép thực hiện thao tác cloud hoặc thu tiền.

**Trạng thái:** đã xem đủ PDF, chưa sửa toàn bộ UI theo mẫu. Người dùng đã nói rõ
chỉ bổ sung thông tin, sẽ triển khai từng task; chưa giao làm cả 17 màn một lần.

Gói ZIP đi kèm chứa PDF ở `reference/flight.pdf`. Nếu chỉ nhận file Markdown,
cần lấy thêm PDF từ thành viên cung cấp. Đường dẫn trên máy TV2 không dùng được
trên máy thành viên khác. Trong mốc repo đã đối chiếu, PDF giao diện chưa nằm
trong Git; `output/pdf/Flight-Database-Ghi-Nho.pdf` là tài liệu DB, không phải UI.

SHA-256 PDF giao diện gốc:
`22701b74aa9faaeaa4993cc430af4e63e39b7a84548283fa27ad7527d45f8349`

### 3.2. Có hai ngôn ngữ: Tiếng Việt và English

Đây là yêu cầu mới đã được người dùng xác nhận. Giao diện hiện tại đang trộn:
Auth/tìm chuyến/vé của tôi chủ yếu tiếng Việt, checkout chủ yếu tiếng Anh.

**Trạng thái:** chưa có nền tảng i18n hoặc bộ chuyển ngôn ngữ dùng chung.

Định hướng kỹ thuật đã đề xuất, chưa coi là đã triển khai:

- Dùng một bộ dịch chung cho ba thành viên, tránh mỗi phần một cơ chế riêng.
- Dịch cả nhãn, nút, lỗi validation, trạng thái đơn, nội dung hướng dẫn và nhãn
  trợ năng; định dạng số/ngày theo ngôn ngữ hiển thị.
- Chuyển ngôn ngữ không làm mất phiên, hành trình hoặc dữ liệu đang nhập.
- Lưu lựa chọn ngôn ngữ cho lần mở sau; tự nhận ngôn ngữ thiết bị ở lần đầu là
  đề xuất, cần ghi rõ hành vi cụ thể khi triển khai task.
- Mã ngôn ngữ trong code là `vi` và `en`; `VN` là mã quốc gia.
- Đổi ngôn ngữ không tự đổi tiền VND sang USD hoặc đổi múi giờ chuyến bay.
- Nội dung từ DB như giới thiệu điểm đến/điều kiện vé cần chiến lược bản dịch
  riêng; dịch UI không tự dịch các bản ghi đó.

Một người nên phụ trách nền tảng chung trước, rồi TV1/TV2/TV3 áp dụng cho phần
mình để tránh tạo ba provider, ba bộ key hoặc ba chỗ lưu lựa chọn khác nhau.

### 3.3. Một đơn khứ hồi, tuổi và điều kiện riêng theo từng chặng

Người dùng không muốn buộc khách tách đơn khi sinh nhật làm đổi nhóm tuổi.

Ví dụ: sinh 15/11/2014, bay đi 10/11/2026 là Child, bay về 20/11/2026 là Adult.
Mục tiêu là **một hành khách nhập một lần, một đơn/mã đặt chỗ**, nhưng nhóm tuổi,
giá vé, yêu cầu ghế và điều kiện đi kèm được xác định theo từng chặng.

**Cảnh báo về code hiện tại:** `src/features/booking/passenger-policy.ts` vẫn
chặn nếu nhóm tuổi không khớp loại đã chọn trên mọi chặng, còn thông báo yêu cầu
chọn lại/tách hành trình. Đây là giới hạn cần sửa, không phải yêu cầu mới cần giữ.
Các test cũ về việc chặn đổi nhóm tuổi cũng sẽ phải thay đổi trong task đó.

- Quy tắc demo đã chốt: infant dưới 2 tuổi; child từ 2 đến dưới 12; adult từ 12.
- Infant không có ghế riêng và cần người đi kèm từ 18 tuổi theo quy tắc demo.
- Trường hợp infant đổi thành child trên chiều về cần được xử lý cả yêu cầu ghế,
  không chỉ thay nhãn tuổi. Quy tắc đi kèm cần kiểm tra trên chặng liên quan.
- `booking_passenger_segments` đã có trường để lưu nhóm tuổi, giá và ghế/người
  đi kèm của từng người trên từng chặng; chưa cần mặc định tạo một đơn mới.
- Cách tìm/đối chiếu số người và báo giá khi tuổi đổi giữa các chặng cần được
  thống nhất trong task liên quan giữa TV1 và TV2. Tài liệu này chưa chốt một API
  mới hoặc khẳng định server đã hỗ trợ đầy đủ.

## 4. Phân công ba thành viên

### TV1: tài khoản, tìm chuyến và vé của tôi

- F01: đăng ký, xác nhận email, đăng nhập/đăng xuất, khôi phục phiên, quên/đổi
  mật khẩu, hồ sơ người dùng.
- F02: trang chủ, sân bay, ngày, số người/hạng ghế; tìm một chiều rồi mở rộng
  khứ hồi/nhiều chặng khi làm task tương ứng.
- F03: kết quả, bộ lọc/sắp xếp, chi tiết chuyến và chuyển lựa chọn sang checkout.
- F08 phần UI: danh sách/chi tiết vé, UI yêu cầu hủy khi TV2 cung cấp thao tác server.
- Phụ trách `profiles`, truy vấn chuyến công khai và đơn thuộc người hiện tại.

### TV2: checkout và tính đúng đắn của đơn

- F04: hành khách, liên hệ, bản nháp, kiểm tra và xem lại/sửa.
- F05: hành lý và dịch vụ theo người/chặng; danh mục và giá do TV3 quản lý.
- F06: UI sơ đồ/chọn ghế, giữ/đổi/nhả ghế có thời hạn, chống trùng ghế.
- F07: báo giá server, tạo đơn nguyên tử, chống trùng yêu cầu, thanh toán mô phỏng.
- Cung cấp thao tác hủy/hoàn tiền mô phỏng nguyên tử để TV1 gọi.
- Phụ trách nhóm bookings và bảng con, payments/refunds cùng các RPC nghiệp vụ.

### TV3: dữ liệu chuyến bay, quản trị, nền tảng chung

- F09: danh mục sân bay/hãng/máy bay/ghế, chuyến theo ngày giờ, hạng vé, giá,
  hành lý/dịch vụ và ảnh/nội dung điểm đến.
- F10: quản trị đơn/thanh toán, thống kê mô phỏng và nhật ký quản trị.
- Chuẩn bị seed danh mục/chuyến/ghế/giá cho TV1 và TV2 thử.
- Điều phối schema, migrations, RLS, types DB; mỗi người vẫn chịu trách nhiệm
  viết/test SQL phần mình. Hỗ trợ kiểm tra transaction và cạnh tranh ghế.
- Phối hợp CI và build; cả nhóm cùng nghiệm thu trên thiết bị.

## 5. Tiến độ thật tại mốc đã đối chiếu

### Đã có code và đã tích hợp vào main

1. Nền Expo/TypeScript, môi trường npm, Supabase client, CI.
2. Auth email/password, mã số OTP cho xác nhận email và khôi phục mật khẩu,
   gửi lại mã, đổi mật khẩu, phiên đăng nhập và đăng xuất.
3. Hồ sơ đọc/sửa trong `public.profiles`, không còn chỉ lưu chỉnh sửa hồ sơ ở
   Auth user_metadata. Metadata không được dùng để quyết định admin.
4. Trang chủ/danh mục, tìm một chiều, danh sách/lọc hãng/sắp xếp và chi tiết chuyến.
5. Nút Tiếp tục đặt vé đã nối TV1 sang checkout TV2.
6. Sáu task checkout: bàn giao chuyến; bản nháp theo user/hành trình; form liên
   hệ; form hành khách; kiểm tra demo; review/edit thông tin.
7. Vé của tôi đọc danh sách/chi tiết đơn, lọc chủ sở hữu; chưa có thao tác hủy.
8. Hàm client/hook/guard admin và migration RPC `public.is_admin()`.
9. Schema nghiệp vụ 22 bảng, RLS, index, types và hàm đọc sơ đồ ghế.

### Chưa được coi là hoàn tất

- Chưa có tìm khứ hồi/nhiều chặng hoàn chỉnh trong UI. Model bàn giao checkout
  có hỗ trợ nhiều segment không chứng minh toàn bộ tìm kiếm nhiều chặng đã xong.
- Chưa có quote/create-booking/hold-seat/payment/refund/cancel RPC hoàn chỉnh.
- Chưa có các màn Baggage, Seat selection, Payment, Success hoàn chỉnh theo PDF.
- Confirm traveller details hiện chỉ là xác nhận đã xem thông tin trong RAM;
  không tạo đơn, không giữ ghế, không có tiền thực sự được xử lý.
- Chưa sửa hạn chế đổi nhóm tuổi giữa các chặng nêu ở mục 3.3.
- Chưa có i18n Việt–Anh, chưa đồng bộ toàn bộ giao diện với PDF.
- Có admin guard không có nghĩa đã có hệ thống màn quản trị danh mục/đơn.
- Lần đọc public catalogue trước đây không trả bản ghi khả dụng. Cần kiểm tra
  lại dữ liệu hiện tại; không suy ra mọi bảng cloud vẫn trống ở thời điểm khác.
- Chưa nghiệm thu toàn luồng trên Android, hai người tranh cùng ghế, email thật
  hoặc RLS bằng hai tài khoản thật trong lượt tích hợp cuối.

### Git và kiểm tra đã thực hiện

- PR #10: https://github.com/duc150905/Flight/pull/10 đã merge ngày 01/11/2026.
- Các nhánh đã merge được xóa sau khi kiểm tra ancestry. Tại lúc bàn giao đó,
  local và remote đều còn main; lịch sử sáu commit TV2 vẫn nằm trong main.
- Lần tích hợp đã chạy `npm ci`, 107 test pass, typecheck/lint, bundle Web và
  Android/Hermes pass; hai lượt CI của PR pass. Đây là kết quả ở mốc đó, không
  phải bảo đảm test vẫn pass sau mọi thay đổi mới.
- Export bundle không tạo APK, không phải bằng chứng chạy đúng trên điện thoại.

## 6. Công nghệ và cấu trúc cần giữ tương thích

Mốc hiện tại: Expo 58 (`~58.0.22`), React Native `0.88.1`, React `19.3.0`,
TypeScript, Expo Router; npm với `package-lock.json`, Node `>=24.13.0 <25`.
Đọc `package.json`/lockfile thật nếu phiên bản đã thay đổi.

- TanStack Query: dữ liệu server; provider chung ở root layout.
- Zustand: bản nháp checkout trong RAM.
- React Hook Form + Zod: form và validation.
- Supabase: Auth, PostgreSQL, Data API và các hàm DB; RLS là ranh giới quyền.
- Routes trong `src/app/`; component/hook/model/service ngoài thư mục routes.
- Không tự tạo/sửa `ios/`, `android/` nếu đang dùng CNG. Tuân theo AGENTS.md.
- Đọc docs Expo đúng major trước khi sửa API Expo/Router/React Native.
- Cài package dùng `npx expo install <package>` theo hướng dẫn repo.
- Máy có thể cần CA tin cậy riêng để tải package; không tắt kiểm tra TLS để vượt lỗi.

Các vị trí chính:

```text
src/app/_layout.tsx              Root AuthProvider + QueryClientProvider
src/app/index.tsx                Trang chủ công khai
src/app/account.tsx              Auth/hồ sơ
src/app/results.tsx              Kết quả tìm chuyến
src/app/flights/[id].tsx         Chi tiết chuyến
src/app/checkout/                Entry + contact + passengers + review
src/app/tickets.tsx              Vé của tôi
src/app/tickets/[id].tsx         Chi tiết đơn
src/features/auth/              Auth, session, admin helpers
src/features/profile/model.ts   Dịch vụ public.profiles
src/features/discovery/         Tìm chuyến và bàn giao checkout
src/features/booking/           Draft, form, policy, review
src/features/tickets/           Đọc/hiển thị đơn thuộc người dùng
src/lib/supabase.ts             Client dùng public config
src/types/database.generated.ts Types public schema
supabase/migrations/            Lịch sử schema
supabase/tests/                 Kiểm tra database
tests/                         Node tests
```

## 7. Hợp đồng dữ liệu đang có: TV1 sang TV2

Nguồn định nghĩa: `src/features/booking/selection.ts`. Không tạo một bản model
khác với tên trường gần giống nếu chưa cần thay đổi contract.

```ts
type SelectedItinerary = {
  tripType: 'one_way' | 'round_trip' | 'multi_city';
  passengers: { adults: number; children: number; infants: number };
  segments: {
    flightId: string;
    fareId: string;
    journeyIndex: number;
    legIndex: number;
  }[];
};
```

Quy tắc hiện tại: ID UUID; thứ tự journey/leg bắt đầu từ 1 và liên tục; không
lặp flight; tối đa 12 leg; ít nhất 1 adult; adult+child tối đa 9; infant không
quá adult. Những giới hạn này là code hiện tại, có thể cần điều chỉnh có chủ
đích trong task tuổi theo chặng, không tự thay ngầm ở một phía.

Với một chiều, TV1 đang dùng:

```ts
router.push(checkoutHrefForOffer(offer, criteria));
```

Hàm ở `src/features/discovery/model.ts`, kiểm tra fare thuộc đúng flight rồi
gọi helper từ module booking. Với nhiều chặng, dùng `buildCheckoutHref(selection)`
theo schema chung. Chỉ IDs và counts được đưa vào URL; không truyền dữ liệu
cá nhân hoặc coi giá client là giá chốt.

TV2 đọc lại flights/fares/airports, chặn chuyến/hạng vé không hợp lệ, lấy ngày
theo timezone sân bay; chấp nhận scheduled/delayed nếu còn mở bán và chưa bay.
Việc này không phải bảo đảm sức chứa, báo giá cuối hoặc thao tác giữ chỗ server.

## 8. Draft, validation và quyền sở hữu

- `draft.ts`: `createCheckoutDraftStore()`, `beginCheckout`, `updateContact`,
  `updatePassenger`, `removePassenger`, `reset`, `finish`.
- Một store cho user đang ở checkout. Đổi user/đăng xuất, đổi lựa chọn chuyến
  hoặc hủy phải bỏ dữ liệu cũ; cùng lựa chọn có thể giữ dữ liệu đang gõ.
- Form giữ chuỗi thô; validation trả bản sao chuẩn hóa, không tự sửa chuỗi đang gõ.
- RHF `onTouched`: lần đầu blur mới kiểm tra; sửa ô đã chạm thì cập nhật lỗi;
  Continue kiểm tra cả bước và hướng đến ô lỗi.
- Back/Edit dùng `dismissTo`; form đọc lại store lúc focus để tránh defaultValues
  cũ. Không đổi lại sang tạo nhiều màn trùng nhau mà bỏ bước đồng bộ.
- Điện thoại liên hệ của đơn chấp nhận cả số nội địa; `profiles.contact_phone`
  chỉ nhận E.164 hoặc null. Không dùng hai bộ kiểm tra thay thế nhau tùy tiện.
- Tài khoản đăng nhập, người liên hệ và hành khách là ba khái niệm khác nhau.

## 9. Database và hợp đồng với TV3

Project tham chiếu của nhóm: **flight-dev**, ref `qisvuxiuwsqtkcrfpiwu`,
URL công khai `https://qisvuxiuwsqtkcrfpiwu.supabase.co`. Đây không phải secret.
Mỗi máy tự cấu hình `.env.local` theo `.env.example`. Không cần tự tạo project
cloud khác chỉ vì mới clone repo; thống nhất với nhóm nếu dùng môi trường khác.

22 bảng gồm:

- Hồ sơ/quyền: `public.profiles`, `private.user_roles`.
- Danh mục/chuyến: `airports`, `airlines`, `destinations`, `aircraft`, `seats`,
  `flight_instances`, `flight_fares`, `flight_seats`.
- Dịch vụ: `addon_products`, `flight_addon_offers`.
- Đơn: `bookings`, `booking_segments`, `booking_passengers`,
  `booking_passenger_segments`, `seat_reservations`, `booking_addons`.
- Tiền/lịch sử: `payments`, `refunds`, `booking_events`, `private.admin_audit_logs`.

Không thiết kế lại các bảng này từ đầu chỉ vì chưa biết lịch sử project.
Đọc migrations và docs/DATABASE.md, kiểm tra cloud khi task có liên quan.

Các migration trong repo tại mốc này:

```text
20261029142657_database_foundation.sql
20261029143747_harden_database_access.sql
20261030100000_expose_is_admin_rpc.sql
```

Hai migration đầu đã được áp dụng/đối chiếu trong công việc nền DB trước đây.
Migration thứ ba đến từ nhánh admin. Lượt merge Git không chạy migration đó
lên cloud; phải kiểm tra lịch sử migration/trạng thái hàm hiện tại trước khi
kết luận đã hoặc chưa deploy. Không coi có file SQL là đã chạy thành công.

Types public hiện có `get_seat_map` và `is_admin`. `public.is_admin()` trả boolean
của caller, không có tham số user ID; không được lộ bảng private.user_roles.
`get_seat_map` trả dữ liệu sơ đồ/trạng thái an toàn, không phải API giữ ghế.

Quyền quan trọng:

- Khách đọc danh mục công khai được phép; một số inventory chỉ admin đọc bảng gốc.
- Customer đọc đơn của chính mình qua ownership và RLS; bảng con theo chủ đơn.
- Không cấp ghi trực tiếp tùy ý cho client lên đơn, thanh toán hoặc giữ ghế.
- Các RPC nghiệp vụ tương lai phải kiểm tra auth, ownership, trạng thái, số tiền,
  cạnh tranh và idempotency, có migration/test và grants phù hợp.
- Admin dashboard role của Supabase khác admin role của ứng dụng.
- Không dựa vào user_metadata để cấp quyền. Không đưa service_role/secret key,
  database password hoặc Resend API key vào app, URL, Git hay tài liệu bàn giao.
- Tất cả seed/test dùng thông tin cá nhân giả.

## 10. Hợp đồng TV2 sang Vé của tôi/TV3

Các trạng thái hiện có:

```text
bookings: pending_payment | confirmed | cancelled | expired
payments: pending | succeeded | failed | cancelled
trip_type: one_way | round_trip | multi_city
```

`src/features/tickets/model.ts` đã đọc bookings, booking_segments và
booking_passengers; luôn tìm đơn của user trước khi tải bảng con.
Không dùng UPDATE bookings trực tiếp từ UI để đổi trạng thái hoặc hủy.

`flightSnapshotSummary` trong `src/features/tickets/presentation.ts` hiện đọc:

```text
flight_number, airline_name,
departure_iata / origin_iata / departure_airport_iata,
arrival_iata / destination_iata / arrival_airport_iata,
departure_at, arrival_at,
departure_timezone / origin_timezone,
arrival_timezone / destination_timezone
```

Khi TV2 làm tạo đơn, cần chốt một bộ khóa canonical của flight_snapshot và giữ
UI đọc được. Các alias hiện tại là fallback, không phải lý do tùy ý đổi tên.
Giá, hành lý, điều kiện hủy phải được chốt/snapshot đúng nghiệp vụ; cập nhật
danh mục về sau không được làm thay đổi lịch sử đơn đã xác nhận.

Chưa có hợp đồng RPC create_booking/cancel_booking/quote/hold/payment hoàn chỉnh.
Không coi các tên minh họa đó là hàm đã tồn tại, và không để ba phía tự xây API
khác nhau rồi giả định có thể ghép mà không kiểm tra.

## 11. Phối hợp Git và cập nhật ngữ cảnh sau mỗi task

1. Chọn task, xác định người phụ trách và file/module chung có thể bị ảnh hưởng.
2. Tạo nhánh tính năng từ main đã cập nhật; dùng prefix `codex/` nếu không có
   quy ước cụ thể khác được nhóm chốt cho task.
3. Tránh ba người cùng sửa root provider, package/lockfile, generated types,
   migrations hoặc module i18n mà không biết thay đổi của nhau.
4. Giữ task nhỏ. Với TV2, người dùng yêu cầu mỗi task một commit và giải thích
   lại sau khi hoàn thành; các thành viên khác theo thỏa thuận task của mình.
5. Nếu thay contract: cập nhật type, nơi gọi, test và tài liệu trong cùng thay đổi;
   nêu rõ consumer nào phải cập nhật, dữ liệu cũ có cần migration không.
6. Cập nhật tiến độ/giới hạn và ghi nhánh/PR để người khác biết phần đang làm.
7. Chạy kiểm tra phù hợp, mở PR, xử lý xung đột giữ đủ tính năng hai phía và
   review theo thỏa thuận nhóm. Không tự merge nhánh của người khác chỉ vì
   tài liệu này có nhắc tới; lần merge tất cả trước là yêu cầu riêng của người dùng.
8. Người còn lại lấy code và tài liệu mới, rồi đối chiếu trước khi làm task phụ thuộc.

Không cần một file bộ nhớ khổng lồ chứa toàn bộ chat. Nên giữ:

- `AGENTS.md`: hướng dẫn ngắn và chỉ tới các tài liệu cần đọc.
- Tài liệu tính năng hiện có: mô tả đúng code và giới hạn.
- Một nơi ghi tiến độ hiện tại và một nơi mô tả các contract dùng chung.

`docs/STATUS.md`, `docs/CONTRACTS.md`, `docs/DECISIONS.md` là các tên đã đề xuất
trong chat, **chưa được tạo trong mốc code này**. Có thể triển khai cơ chế đó
trong một task riêng. Không giả định Codex tự đọc mọi file Markdown hoặc tự
đồng bộ tất cả nội dung chỉ vì cùng mở repo. Có thể yêu cầu nó đọc rõ các file
liên quan ở đầu task.

Mẫu ghi ngắn sau khi hoàn thành task:

```text
Task / người phụ trách:
Nhánh / commit / PR:
Hành vi đã thay đổi:
File/type/RPC dùng chung bị ảnh hưởng:
Thành viên khác cần cập nhật gì:
Migration: chỉ có file / đã chạy local / đã chạy cloud nào:
Kiểm tra đã chạy và kết quả:
Giới hạn, việc chưa làm, phụ thuộc còn chờ:
```

Tách rõ đang làm trên nhánh, đã merge, đã deploy DB và đã nghiệm thu thiết bị.
Chúng không phải cùng một trạng thái hoàn thành.

## 12. Chạy và kiểm tra

```bash
npm ci
npm start
npm test
npm run check
npm run build:web
npm run build:android
```

`npm run check` chạy typecheck và lint. Chạy test phù hợp phần thay đổi; khi
ghép nhiều phần chạy toàn bộ suite. Hai lệnh build trên chỉ export bundle.
Mỗi máy tự thiết lập public Supabase config theo README; không gửi bí mật cho
Codex qua tài liệu này.

Người dùng có điện thoại Android thật, chưa cài Android Studio. Expo Go và
scrcpy/ADB đã được đề xuất để kiểm tra trên thiết bị, nhưng chưa xác nhận đã
cài/kết nối hay điều khiển được. Computer Use trên browser trước đó dừng vì
không xác định được URL; không được báo UI đã nghiệm thu dựa trên lần đó.

## 13. Tài liệu cũ và thứ tự đọc

Một số file được viết ở các thời điểm khác nhau. Ví dụ:

- `docs/FEATURES-AND-TEAM.md` còn đoạn nói Auth/discovery chưa merge và chưa có DB;
  đó là thông tin lịch sử cũ, không đúng với mốc main đã đối chiếu ở đây.
- File đó còn để nhiều ngôn ngữ ở phạm vi để sau; yêu cầu mới là Việt–Anh và
  cần được đưa vào các task sắp tới.
- `docs/CHECKOUT.md`, walkthrough và spec/plan cũ còn mô tả chặn/tách hành trình
  khi đổi nhóm tuổi. Code hiện tại cũng đang làm vậy; mục 3.3 ghi rõ yêu cầu sửa.
- `supabase/README.md` còn đoạn schema sẽ thiết kế ở giai đoạn sau, trong khi
  repo đã có foundation/migrations/types. Không tạo thêm schema trùng lặp.

Thứ tự ưu tiên khi hiểu trạng thái: yêu cầu mới của thành viên trong task +
hướng dẫn áp dụng; code/migration/test và trạng thái môi trường thực tế; tài liệu
bàn giao cập nhật này; tài liệu cũ theo mốc thời gian của chúng. Nếu chúng xung
đột, nêu rõ và cập nhật tài liệu trong task liên quan, không âm thầm chọn một phía.

File nên mở theo công việc:

- Chung: `AGENTS.md`, `README.md`, `package.json`, tài liệu này.
- TV1: `docs/AUTH.md`, `docs/DISCOVERY.md`, `docs/TICKETS.md`, các module tương ứng.
- TV3: `docs/DATABASE.md`, `docs/DATABASE-PROPOSAL.md`,
  `docs/DATABASE-WALKTHROUGH.md`, `docs/PERMISSIONS.md`, migrations và generated types.
- Cần ghép checkout: `docs/CHECKOUT.md`, selection.ts, itinerary-data.ts,
  discovery/model.ts, draft.ts, passenger-policy.ts và tickets/presentation.ts.
- Cần làm UI: mở PDF gốc của đúng màn, đối chiếu các yêu cầu ở mục 3.

## 14. Prompt gửi Codex của TV1 hoặc TV3

Sao chép đoạn dưới, thay phần trong ngoặc vuông bằng vai trò/task thật:

```text
Đây là project Flight của nhóm 3 người. Tôi phụ trách [TV1 hoặc TV3].

Hãy đọc tài liệu TEAM-CODEX-HANDOFF.md tôi đính kèm, AGENTS.md và code thực tế
trong repo https://github.com/duc150905/Flight.git. Nếu làm UI, đọc thêm flight.pdf
đi kèm. Không giả định bạn có lịch sử chat hoặc cấu hình máy của TV2.

Đầu tiên hãy đối chiếu trạng thái repo hiện tại, tóm tắt phần tôi phụ trách,
phần đã có/chưa có và các hợp đồng với hai thành viên còn lại. Lưu ý ba yêu cầu:
giao diện bám sát PDF; Việt–Anh; một đơn khứ hồi với tuổi theo từng chặng
(code cũ đang chặn đổi nhóm tuổi, chưa sửa).

Tài liệu là ngữ cảnh bàn giao, không phải giao toàn bộ backlog để tự triển khai.
Task hiện tại của tôi: [chỉ đọc và tóm tắt / ghi rõ task được giao].

Khi làm task được giao, kiểm tra consumer của type/RPC chung, giữ phần của người
khác, cập nhật tài liệu và báo kết quả kiểm tra cùng các giới hạn còn lại.
```
# VNPAY sandbox addition (2026-11-04)

Feature branch codex/vnpay-sandbox adds provider-aware server settlement/refunds, worker reconciliation and confirmation-email outbox. See VNPAY-SANDBOX.md and ANDROID-VNPAY-ACCEPTANCE.md. Backend is deployed to flight-dev; full gateway/device acceptance is pending. Secret values stay outside Git and outside the app. Existing mock orders remain mock; new orders on this branch use VNPAY. Do not mark unknown payment/refund outcomes successful from the client.
