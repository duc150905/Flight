# Hành lý, báo giá và ghế — TV2

Thiết kế đã duyệt: `superpowers/specs/2026-11-02-baggage-quote-seats-design.md`.

## Task 1: hành lý

Màn `/checkout/baggage` đọc hành lý bao gồm trong hạng vé và gói ký gửi đang bán.
Mỗi người/chặng chọn không mua thêm hoặc một gói; chọn gói khác sẽ thay gói cũ.
Tổng tạm tính gồm giá vé và lựa chọn thêm. Next tải lại danh mục; gói/giá đã đổi
phải được chọn lại hoặc bỏ chọn. Không có ghi booking/giữ ghế ở bước này.

Lựa chọn nằm trong bản nháp RAM, xóa khi hủy/đổi tài khoản/đổi hành trình/hoàn tất.
Sửa tên giữ hành lý/ghế; sửa ngày sinh hoặc người đi kèm làm mất lựa chọn ghế để
kiểm tra điều kiện mới. `revision` giúp không chuyển bước bằng kết quả mạng cũ.
Hỗ trợ Việt–Anh và VND/USD qua các thành phần chung.

## Task 2: báo giá

`public.quote_checkout(p_request jsonb)` đã được triển khai lên flight-dev qua
migration `20261102090252_checkout_quote.sql`; lịch sử local/cloud khớp nhau.
Chỉ authenticated được gọi; wrapper public invoker gọi private definer có kiểm
tra auth.uid(), search_path rỗng và quyền EXECUTE giới hạn. Không đổi bảng/RLS.

Request chỉ có tripType, counts, segments, passengers (ID/ngày sinh/người đi kèm),
baggage (ID người/chuyến/offer), seats (ID người/chuyến/ghế). Không gửi tên, liên
hệ, hộ chiếu hoặc giá trong draft. Server tự tính tuổi từng chặng, giá và sức chứa
khoang, loại ghế bị chặn/đã đặt/đang giữ còn hạn. Trả các thành phần tổng tiền,
dòng từng người/chặng và thời hạn 5 phút bằng VND; không ghi đơn hoặc giữ ghế.

Màn `/checkout/quote` kiểm tra tổng, số an toàn, đủ dòng, thời hạn; ẩn báo giá lỗi/
hết hạn, hỗ trợ làm mới và xác nhận đã xem giá khác tạm tính. Các request khác
nhau có query key riêng, không nhận nhầm kết quả cũ. Đây chưa phải thanh toán.

Kiểm tra: 144 tests, typecheck/lint, SQL rollback (giá giả, dịch vụ ngừng bán,
sinh nhật giữa chặng, sức chứa, exit row, held/booked/expired, anonymous và role
authenticated), API public smoke. Advisors không có ERROR; WARN bảo vệ mật khẩu
rò rỉ là cấu hình Auth có sẵn từ trước, không phát sinh từ thay đổi này.
## Task 3: chọn ghế

`/checkout/seats` liệt kê các chặng và ghế của từng người. `/checkout/seat-map`
nhận duy nhất flightId trên URL, đọc RPC `get_seat_map` theo trang 500 hàng và
lọc theo khoang của hạng vé. Hỗ trợ sơ đồ ABC–DEF, giữ hàng/cột thật; dữ liệu sai,
trùng hoặc bố trí khác được báo rõ là chưa hỗ trợ. Người dùng vẫn có thể bỏ qua
chọn ghế trả phí để lấy báo giá; chỉ tải lại sơ đồ cho chặng có ghế đã chọn.

Giao diện Flyora có mũi máy bay, lối đi, ghế bo góc, thẻ hành khách và thanh xác
nhận dưới cùng. Dấu ✓ là ghế đang chọn của người hiện tại; số trên ghế là thứ tự
người khác trong đơn đang chọn. Ghế giữ có đồng hồ, đã đặt là ô đặc, bị chặn là ×.
Có nhãn cho trình đọc màn hình; ghế không khả dụng không bấm được.

Infant không chọn ghế trên chặng chưa đủ hai tuổi; sau sinh nhật được chọn như
child. Exit row yêu cầu từ 18 tuổi và không đi kèm infant trên chặng đó. Không
cho hai người trong draft chọn trùng. DOB/người đi kèm thay đổi sẽ xóa lựa chọn
ghế; server vẫn kiểm tra độc lập khi báo giá. Không có thao tác giữ ghế thật.

Review độc lập đã hoàn tất. Test hồi quy kiểm tra bỏ qua sơ đồ không hỗ trợ,
kết quả mạng cũ không chuyển màn sau khi blur/unmount, và tải lại cùng ID nhưng
giá mới làm mất hiệu lực báo giá/xác nhận giá cũ. Query key gồm revision của draft.

Browser QA dùng tên/liên hệ giả và danh mục/sơ đồ public thật ở 375×844, kiểm tra
hai người chọn ghế riêng, ghế bị chặn, VN/EN, VND/USD, giữ lựa chọn khi mở lại màn,
radio/ghế có trạng thái accessibility và không còn lỗi render mới. Có kiểm tra
khung 844×390; vùng nội dung cuộn hẹp hơn khi xoay ngang. Route QA đã được xóa.
Ảnh local nằm trong output/checkout-qa, không đưa vào Git.

Giới hạn nghiệm thu: chưa thử trên Android thật hoặc toàn luồng bằng phiên đăng
nhập thật trên UI; RPC authenticated đã được kiểm tra qua role SQL, API public
được kiểm tra riêng. Chưa kiểm tra Dynamic Type/TalkBack trên thiết bị. Màn báo
giá kết thúc phạm vi này; giữ ghế/tạo đơn/thanh toán là các task tiếp theo.

Kết quả cuối: **151/151 tests**, typecheck/lint và export Web/Android đều qua.
Để thử luồng thật: chọn chuyến demo F0103 SGN → HAN, đăng nhập, nhập thông tin giả,
xem lại/xác nhận thông tin, chọn hành lý, chọn hoặc bỏ qua ghế rồi xem báo giá.
Chuyến/ngày và các fixture khác được mô tả trong CHECKOUT-DEMO.md.
