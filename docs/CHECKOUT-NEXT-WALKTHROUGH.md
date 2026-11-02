# Review 6 task checkout tiếp theo — 02/11/2026

Nhánh `codex/tv2-checkout-localized-ui`. Mỗi task một commit; chưa push/merge.
Mẫu giao diện: `flight.pdf`, trang 12. Đây là đợt tiếp theo của bản walkthrough
ngày 01/11; các quy tắc cũ yêu cầu chọn lại khi đổi nhóm tuổi đã được thay thế.

## 1. Tuổi, ghế và người đi kèm theo từng chặng

`passenger-policy.ts` tính tuổi tròn vào ngày khởi hành tại sân bay từng chặng.
Số adult/child/infant được chọn lúc tìm vé mô tả chặng đầu. ID `child-1` hay
`infant-1` giữ ổn định để không mất dữ liệu; đây không phải nhóm tuổi cố định
cho cả hành trình.

`derivePassengerSegments` tạo kết quả riêng theo người và chuyến: loại hành
khách, có cần ghế hay không, người đi kèm nếu là infant. Child → Adult và
Infant → Child vẫn hợp lệ trong cùng một đơn. Người đi kèm phải từ 18 tuổi
trên các chặng thực sự có infant; hai infant trên cùng chặng không được dùng
chung một người đi kèm. `review.ts` kiểm tra lại trước khi hiển thị kết quả.

## 2. Nền tảng Việt–Anh

`i18n/language.ts`: store độc lập, đọc ngôn ngữ thiết bị, khôi phục lựa chọn,
lưu lựa chọn mới. Có xử lý đọc chậm, bấm chuyển liên tục và lỗi bộ nhớ.
`provider.tsx`: bọc app một lần, có `useLanguage` và `LanguagePicker` dùng chung.
Đổi tiếng không tạo lại AuthProvider hay CheckoutProvider nên không xóa form.
Chỉ lựa chọn ngôn ngữ được lưu lâu dài; thông tin hành khách vẫn chỉ trong RAM.

## 3. Dịch checkout

`checkout-messages.ts` chứa nhãn, hướng dẫn và lỗi song ngữ; `translate.ts`
dịch tại lúc hiển thị và định dạng ngày/giờ/tiền theo vi-VN hoặc en-GB.
Lỗi đang hiện đổi tiếng ngay, không cần submit lại và không mất dữ liệu.
`CheckoutText` chỉ dịch khi có prop `message`; dữ liệu khách hàng là raw text,
không dịch tên của khách hay dữ liệu catalogue. Có kiểm thử tên trùng key như
`Review`, `constructor`, `toString` để tránh thay tên hoặc crash màn xem lại.
TV1/TV3 có hướng dẫn tái sử dụng trong `LOCALIZATION.md`.

## 4. Bộ giao diện theo PDF

`ui.tsx`: nền trắng, màu turquoise, tiêu đề giữa, nút quay lại, bốn biểu tượng
Traveller/Baggage/Seat/Payment và thanh tổng tiền/Next cố định phía dưới.
Các bước tương lai chưa bấm được. `form-field.tsx` dùng cùng kiểu nhãn và ô nhập.
Dùng biểu tượng native qua Expo Symbols có tên cho Android/Web/iOS.

`itinerary-data.ts` đọc thêm giá base/tax/fee từ DB. `estimate.ts` tính tạm
theo loại từng hành khách trên từng chặng. Chưa nhập ngày sinh hợp lệ thì dùng
loại đã chọn ban đầu; thiếu giá không bịa số. Đây chưa phải báo giá hay giữ vé
phía server. Chữ/icon trên nền turquoise được làm đậm tối hơn PDF để dễ đọc.

## 5. Màn Traveller information

`passenger-screen.tsx` chứa lần lượt từng hành khách rồi liên hệ, theo bố cục
PDF. First name, Last name, Gender tùy chọn, DOB và các trường hộ chiếu khi cần.
Giữ Full name của người liên hệ vì họ có thể không phải người bay.
`choice-field.tsx` là lựa chọn giới tính; `phone-field.tsx` là ô mã quốc gia và
số điện thoại. Mã +84 xử lý số 0 đầu giống nhau dù chọn mã trước hay nhập trước;
chế độ số đầy đủ dùng được cho các mã khác.

`travellerFormOptions` trong `form-state.ts` kiểm tra cả người bay lẫn liên hệ
trong một lần Next. Vẫn áp dụng rời ô lần đầu mới báo lỗi, sau đó sửa thì cập
nhật lỗi, Next kiểm tra toàn bộ. Khi quay lại, form khôi phục bản nháp mới nhất.
Route `/checkout/contact` cũ chuyển sang màn chung; TV1 không phải đổi contract.

DB thêm `booking_passengers.gender` nullable với CHECK cho male/female/unspecified;
bỏ trống tương ứng NULL khi sau này tạo booking. Migration
`20261102033140_add_optional_passenger_gender.sql` đã áp dụng vào flight-dev,
đồng bộ types và qua test SQL rollback về constraint/RLS/quyền ghi. Không thêm
index cho giới tính vì không có truy vấn cần lọc cột này.

## 6. Dữ liệu giả để nhóm kiểm thử

`supabase/seeds/checkout-demo.sql`: ba chuyến tương lai, hai fare mỗi chuyến,
hai sản phẩm hành lý, offer và sơ đồ ghế. Chỉ insert, có kiểm tra xung đột,
không reset hay sửa dữ liệu của nhóm. `supabase/tests/checkout-demo.sql` kiểm
tra quyền đọc công khai và seat-map RPC. Script `checkout-demo-check.mjs`
kiểm tra chạy lại không đổi dữ liệu; `checkout-demo-smoke.mjs` kiểm tra tích
hợp thật bằng publishable key, không ghi thông tin khách hàng.

Ngày bay, ID cụ thể và cách thử: `CHECKOUT-DEMO.md`.

## Kiểm chứng và giới hạn

- Suite Node: **124/124** qua sau khi sửa lỗi review; TypeScript và lint không lỗi.
- Web và Android Hermes export thành công sau các sửa cuối.
- Trình duyệt đã thử ở 390×844: báo lỗi Next, chuyển VN/EN khi đang có lỗi,
  giữ chữ đã gõ, nhớ ngôn ngữ sau reload và thanh tổng tiền nằm trong viewport.
- Dùng màn fixture tạm cho kiểm tra hình thức; đã xóa trước commit. Không
  thêm đường đi vòng đăng nhập vào app bàn giao.
- Chưa nghiệm thu trên Android thật: bàn phím, screen reader, thao tác quay
  lại native và luồng đăng nhập → tìm chuyến → checkout toàn bộ trên thiết bị.
- Chưa triển khai chọn hành lý/ghế, giữ chỗ, tạo đơn, thanh toán. Các task này
  có dữ liệu demo nhưng cần nghiệp vụ server ở các đợt tiếp theo.
- DB advisor không có ERROR; còn ba WARN sẵn có: hai cảnh báo execute của
  `public.is_admin()` và tùy chọn bảo vệ mật khẩu rò rỉ của Auth chưa bật.
  Đợt này không đổi quyền RPC hoặc cấu hình Auth. Các INFO chủ yếu là index
  chưa được dùng và hai bảng private cố ý không có policy truy cập từ client.
