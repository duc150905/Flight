# Review 6 task checkout của TV2

> Bản này ghi nhận đợt 01/11/2026. Đợt 02/11 đã thay quy tắc sinh nhật, thêm
> Việt–Anh và gộp màn theo PDF: xem [CHECKOUT-NEXT-WALKTHROUGH.md](CHECKOUT-NEXT-WALKTHROUGH.md).

Ngày: 01/11/2026. Nhánh: `codex/tv2-checkout-flow`.

Giao diện checkout dùng tiếng Anh, dựa trên ảnh Traveller information trong
Flight_Booking_Handoff.zip: nền sáng, xanh ngọc, tiến trình, ô nhập và thẻ hành
khách. Có màu tối theo thiết bị. Không thêm package mới hoặc thay đổi database.

## 1. Nhận chuyến khách đã chọn từ phần TV1

Commit: `a32e7c6` — `feat(tv2): accept selected itineraries`.

- `src/features/booking/selection.ts`: định nghĩa lựa chọn gồm loại hành trình,
  các ID chuyến/hạng vé theo thứ tự chặng, số người lớn/trẻ em/em bé.
- `buildCheckoutHref()` tạo đường dẫn `/checkout?selection=...` chỉ chứa ID và
  số lượng. Không đưa tên, điện thoại, hộ chiếu, giá tiền lên URL.
- `selectionFromDiscovery()` chuyển dữ liệu chi tiết một chiều hiện có của TV1
  sang định dạng chung. Với khứ hồi/nhiều chặng, truyền trực tiếp các segments.
- `src/features/booking/itinerary-data.ts`: đọc lại chuyến, hạng vé và sân bay từ
  Supabase; chặn hạng vé sai chuyến, ngừng bán, chưa công bố, chuyến không hợp lệ.
- Kiểm tra thứ tự ngày giờ, nối chuyến đúng sân bay và khứ hồi đúng chiều.
- Ngày bay được lấy theo múi giờ sân bay đi. Ngày đến theo múi giờ sân bay đến.

Sau bước tích hợp các nhánh, nút Tiếp tục đặt vé trên chi tiết chuyến của TV1 đã
gọi helper chung. Khách chọn chuyến có thể đi sang checkout; nếu chưa đăng nhập
thì đăng nhập trước rồi tiếp tục với lựa chọn đó.

## 2. Hoàn thiện bản nháp và nối màn hình

Commit: `2e5836c` — `feat(tv2): connect checkout draft lifecycle`.

- `src/features/booking/draft.ts`: thêm hành trình đã đọc lại và tạo đúng số ô
  hành khách theo số người đã chọn. ID ổn định như adult-1, child-1, infant-1.
- Cùng lựa chọn thì giữ dữ liệu đang nhập; đổi chuyến/hạng vé/số người thì xóa
  dữ liệu cũ và tạo bản nháp mới. Các thao tác cập nhật chỉ nhận trường được phép.
- `checkout-provider.tsx`: một store trong bộ nhớ cho tài khoản đang checkout.
- `src/app/checkout/_layout.tsx`: yêu cầu đăng nhập; đổi tài khoản/đăng xuất thì
  store cũ bị bỏ, dữ liệu người trước không xuất hiện cho người sau.
- `src/app/checkout/index.tsx`: đọc lựa chọn, tải dữ liệu, trạng thái chờ/lỗi/thử
  lại; bỏ phản hồi cũ nếu người dùng đổi lựa chọn hoặc rời màn hình.
- `ui.tsx`: giao diện dùng chung, tiến trình Contact → Travellers → Review,
  nút Cancel hỏi trước khi xóa, hỗ trợ cuộn/bàn phím/safe area.
- `reset()` và `finish()` xóa cả hành trình và thông tin cá nhân. finish dành cho
  lần tạo đơn thành công sau này; không gọi khi mới xem lại thông tin.

Bản nháp chỉ ở RAM. Quay lại giữa các bước vẫn còn; rời luồng làm layout bị gỡ,
tải lại hoặc đóng tiến trình app sẽ mất. Chưa lưu bản nháp xuống thiết bị.

## 3. Form thông tin liên hệ

Commit: `0b4e8de` — `feat(tv2): add checkout contact form`.

- `contact-screen.tsx`: Full name, Email address, Phone number. Liên hệ có thể
  khác người bay và khác chủ tài khoản. Không tự lấy hành khách đầu làm liên hệ.
- `form-field.tsx`: nhãn rõ ràng, bàn phím phù hợp, thông báo lỗi dưới từng ô,
  tham chiếu ô nhập để tập trung vào ô lỗi khi Continue.
- `form-state.ts`: dùng React Hook Form và resolver của Zod.
- Lúc mới gõ chưa báo lỗi; rời ô lần đầu thì kiểm tra; sửa ô đã chạm thì lỗi cập
  nhật ngay; Continue kiểm tra toàn bộ bước, gồm ô chưa chạm.
- Mỗi lần gõ cập nhật ngay chuỗi gốc vào store. Dữ liệu chuẩn hóa là bản sao,
  không tự sửa chữ đang gõ trong form.
- Quy tắc liên hệ cũ được giữ; đổi thông báo lỗi sang tiếng Anh cho checkout.

Đọc thêm contact.ts để xem quy tắc tên 2–100 ký tự, email và số 7–15 chữ số.

## 4. Form từng hành khách

Commit: `cb0540d` — `feat(tv2): add passenger details form`.

- `passenger-screen.tsx`: mỗi hành khách một thẻ, có Given names, Family name,
  Date of birth. Given names là tên đệm và tên; Family name là họ.
- Cập nhật bằng ID, không dùng họ tên hoặc vị trí mảng làm danh tính. Hai người
  trùng tên vẫn sửa độc lập. Không tự sao chép thông tin người thứ nhất.
- Ngày sinh dùng YYYY-MM-DD, ngày có thật và không sau ngày đặt vé. Hai phần
  tên bắt buộc, tối đa 100 ký tự mỗi phần; giữ dấu và dấu nháy/gạch nối.
- Dùng cùng cách báo lỗi với form liên hệ. Thiếu thông tin thì chưa sang review.
- Mở trực tiếp bước hành khách khi liên hệ chưa hợp lệ sẽ quay lại bước liên hệ.

Phần mở rộng giấy tờ/người đi kèm của màn này nằm ở task 5.

## 5. Quy tắc hành khách đã được chốt cho demo

Commit: `8281cbd` — `feat(tv2): enforce demo passenger rules`.

`passenger-policy.ts` tập trung các quy tắc, không rải rác trong giao diện:

- Dưới 2 tuổi: infant, không có ghế riêng. Từ 2 đến dưới 12: child. Từ 12: adult.
- Tính tuổi hoàn thành tại ngày bay của từng chặng. Một người có sinh nhật đổi
  nhóm tuổi giữa chiều đi/về sẽ nhận lỗi yêu cầu chọn lại hoặc tách hành trình.
- Mỗi infant phải chọn một người >=18 tuổi trên mọi chặng. Một người lớn không
  được làm người đi kèm cho hai infant. Người 12–17 tuổi không làm người đi kèm.
- Danh sách phải khớp đúng số người và các ID của lựa chọn ban đầu.
- Nếu có chặng qua hai quốc gia khác nhau, mọi hành khách cần quốc tịch, số hộ
  chiếu, quốc gia cấp và ngày hết hạn; các trường này hiện có điều kiện.
- Quốc gia dùng mã ISO hai chữ như VN. Hộ chiếu phải còn hạn qua ngày đến cuối
  cùng. Nội địa không bắt buộc giấy tờ ở phạm vi hiện tại.
- Đây là quy tắc demo, chưa đại diện chính sách thật của hãng/quốc gia. Không
  khẳng định tuổi tối thiểu được bay, yêu cầu visa hoặc hạn hộ chiếu thêm 6 tháng.

Ngày sinh 29/2 được tính qua sinh nhật vào 1/3 trong năm không nhuận theo quy ước
demo. Lựa chọn hiện có ít nhất 1 adult, tối đa 9 người cần ghế và không quá 1
infant trên mỗi adult đã chọn. Bản nháp tiếp tục giữ giấy tờ khi sửa tên.

## 6. Xem lại và sửa thông tin

Commit thứ sáu: `feat(tv2): add checkout review and editing`.

- `review.ts`: kiểm tra lại dữ liệu hiện tại mỗi lần xem, thay vì tin rằng lần
  Continue trước đã hợp lệ. Kiểm tra cả giờ đóng bán/khởi hành.
- `review-screen.tsx`: hiển thị từng chặng, ngày giờ/múi giờ, hạng vé, liên hệ,
  mọi hành khách và giấy tờ/người đi kèm nếu có.
- Edit contact details và Edit travellers đưa về đúng bước, giữ dữ liệu gốc.
- Confirm traveller details chỉ đánh dấu người dùng đã xem lại trong bộ nhớ.
  Chưa tạo đơn, giữ ghế, báo giá hoặc thanh toán. Dữ liệu không bị xóa ở bước này.

Lượt review độc lập tìm thấy lỗi ở những trường hợp ít gặp và đã bổ sung sửa
trong task cuối: hành trình bắt đầu từ journey 2, form giữ defaultValues cũ khi
quay lại, khoảng trắng trong ngày sinh làm khóa người đi kèm và lỗi người đi kèm
chưa cập nhật sau khi sửa tuổi. Back/Edit dùng dismissTo và form đọc lại store
khi được focus; có test hồi quy cho các trường hợp này.

## Luồng dữ liệu để nhớ

TV1 chọn chuyến → selection.ts kiểm tra ID/số người → itinerary-data.ts đọc lại
dữ liệu → draft.ts tạo bản nháp → contact-screen → passenger-screen + policy →
review.ts kiểm tra lại → review-screen cho xem/sửa. Tạo đơn là phần tiếp theo.

## Kiểm tra và giới hạn nghiệm thu

- 84 test tự động của toàn project đã pass, gồm các module cũ và 27 test mới.
- TypeScript, lint, xuất bundle Web và Android/Hermes đều đã pass. Đây là kiểm tra
  đóng gói mã, chưa phải tạo APK hoặc chạy trên điện thoại.
- Các truy vấn public đọc flight_instances, flight_fares, airports chạy được trên
  Supabase nhưng hiện không trả bản ghi, nên chưa có chuyến thật để thử toàn luồng.
- Chưa nghiệm thu trực tiếp trên điện thoại/đủ kích thước, screen reader và chế độ
  chữ lớn. Công cụ xem trình duyệt bị chặn do không xác định được URL Windows;
  không coi bundle thành công là bằng chứng đã kiểm thử giao diện trên thiết bị.
- Validation phía client giúp nhập liệu. Server tạo đơn sau này vẫn phải kiểm
  tra lại giá, chuyến, tuổi, giấy tờ, quyền sở hữu và tình trạng ghế.
