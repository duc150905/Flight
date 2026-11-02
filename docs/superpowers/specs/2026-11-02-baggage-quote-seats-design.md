# Thiết kế checkout: hành lý, báo giá từ server và chọn ghế

## Yêu cầu đã thống nhất và các giới hạn hiện tại

Thực hiện ba task TV2 được yêu cầu ngày 02/11/2026:

1. Chọn hành lý riêng cho từng hành khách và từng chặng.
2. Server tính lại giá và kiểm tra khả năng còn chỗ.
3. Chọn ghế trên sơ đồ máy bay.

Phát triển tiếp checkout hiện có trên Expo 58. Luồng và bố cục chính bám theo
trang 13–15 của flight.pdf; riêng màn chọn ghế được làm đẹp hơn theo yêu cầu mới.
Giữ hỗ trợ Việt–Anh, lựa chọn VND/USD độc lập với ngôn ngữ và một đơn đặt vé
ngay cả khi hành khách đổi nhóm tuổi giữa các chặng.

**Trạng thái:** đã được bạn duyệt và triển khai ngày 02/11/2026; xem kết quả và giới hạn nghiệm thu trong CHECKOUT-EXTRAS.md.

## Luồng sử dụng

Thông tin hành khách → xem lại/sửa → Hành lý → Ghế → Tổng hợp báo giá từ server.

- Quay lại bước trước vẫn giữ dữ liệu.
- Đổi tài khoản, đổi hành trình, hủy hoặc hoàn tất sẽ xóa bản nháp.
- Thay đổi thông tin ảnh hưởng đến giá sẽ làm báo giá cũ không còn hiệu lực.
- Sửa tên vẫn giữ lựa chọn hành lý và ghế. Sửa ngày sinh hoặc người lớn đi kèm
  sẽ kiểm tra lại hành khách có đủ điều kiện ngồi ghế đã chọn hay không.
- Khi tải lại cùng các ID chuyến bay, vẫn giữ thông tin đang nhập; nếu dữ liệu
  giá/dịch vụ đã thay đổi thì báo giá cũ phải được kiểm tra lại.
- Không đưa thông tin liên hệ hoặc hộ chiếu vào URL.

## 1. Chọn hành lý

Giữ các phần **hành lý xách tay**, **hành lý ký gửi**, nút chọn một phương án
và thanh tổng tiền/nút tiếp tục phía dưới như PDF. Bổ sung bộ chọn chặng và hành
khách để hỗ trợ đơn có nhiều người hoặc nhiều chặng.

Hiển thị hành lý được bao gồm trong hạng vé và các gói mua thêm đang được bán
cho chuyến đó. Mỗi hành khách trên mỗi chặng có thể chọn **không mua thêm** hoặc
**một gói hành lý mua thêm**.

Đề xuất triển khai: mỗi lựa chọn có số lượng một gói, phù hợp với hai gói demo
hiện tại. Đây là lựa chọn thiết kế của người triển khai, đã được bạn duyệt.

Cần có trạng thái đang tải, không có gói bán thêm, lỗi/thử lại và gói đã thay đổi.
Áp dụng quy tắc trong danh mục cho các hành khách hợp lệ; không tự đặt quy định
miễn hoặc cấm mua hành lý cho em bé khi dữ liệu hiện tại chưa quy định.

## 2. Báo giá từ server

### Server làm gì?

Thêm hàm chỉ đọc, yêu cầu đăng nhập: `public.quote_checkout(p_request jsonb)`.
App gọi hàm này để nhận báo giá; hàm không tạo đơn, giữ ghế hoặc thanh toán.

Dữ liệu gửi lên gồm ID chuyến/hạng vé, thứ tự các chặng, số hành khách đã chọn
ban đầu, ID ổn định của từng người, ngày sinh, ID người đi kèm em bé, cùng ID
gói hành lý và ghế đã chọn.

**Server tự lấy giá trong DB và tự xác định nhóm tuổi.** Không tin tổng tiền,
nhóm tuổi hoặc trạng thái ghế do app gửi lên.

Server kiểm tra:

- Giới hạn số phần tử và dữ liệu trùng.
- Thứ tự chặng, thời gian nối chuyến và sự khớp nhau giữa chuyến/hạng vé/khoang.
- Chuyến còn mở bán, gói hành lý còn hiệu lực.
- Tuổi và người lớn đi kèm em bé trên từng chặng.
- Ghế không trùng, còn khả dụng và phù hợp với quy tắc hàng thoát hiểm.
- Khoang còn đủ ghế sau khi trừ ghế bị chặn, đã đặt hoặc đang được giữ còn hạn.

Sức chứa được tính theo ghế của khoang; schema hiện không có hạn mức bán riêng
cho từng gói giá vé. Phải thử trường hợp em bé thành trẻ em ở chiều về và bắt đầu
cần ghế riêng trên chặng đó.

Khi từ chối, chỉ trả mã lỗi an toàn, ổn định; không trả lại dữ liệu cá nhân trong lỗi.

### App hiển thị gì?

Báo giá trả về bằng VND, có tổng và các phần: giá vé cơ bản, thuế, phí vé,
hành lý, phí chọn ghế; kèm chi tiết từng người/chặng, giờ server và thời hạn báo giá.

Đề xuất thời hạn: **5 phút**. Đây là lựa chọn của người triển khai, đã được duyệt.

App hiển thị bảng phân tích tiền. Nếu giá khác với tổng tạm tính/báo giá trước,
app làm rõ phần thay đổi và yêu cầu người dùng xác nhận đã xem giá mới.
Báo giá hết hạn hoặc làm mới thất bại không được hiển thị như giá còn hiệu lực.

**Báo giá không giữ chỗ và không bảo đảm giá cho đến khi đặt đơn.** Task tạo đơn/
giữ ghế sau này phải kiểm tra lại trong giao dịch của chính nó.

### Cách bảo vệ dữ liệu

Hàm public dùng `security invoker`, gọi phần xử lý trong schema private.
Phần private kiểm tra đăng nhập rõ ràng, đặt `search_path` rỗng và chỉ cấp quyền
`EXECUTE` cần thiết. Quyền đọc nội bộ dùng để đếm ghế bị chiếm mà không lộ
thông tin khách khác.

Giữ nguyên RLS và việc cấm app ghi trực tiếp vào các bảng giao dịch.
Không cần thêm bảng tỷ giá hoặc sửa cột tiền. Bổ sung kiểu dữ liệu RPC và tạo
migration mới cho SQL; không viết lại các migration cũ.

## 3. Chọn ghế — làm đẹp hơn theo yêu cầu mới

Giữ luồng chọn chặng rồi mở sơ đồ ghế riêng như PDF, nhưng nâng giao diện theo
phong cách Flyora:

- Khung khoang/mũi máy bay có đường viền nhẹ.
- Ghế bo góc; lối đi và số hàng tách rõ.
- Ghế đang chọn dùng màu xanh ngọc và ký hiệu chọn.
- Thẻ hành khách hiển thị tên và ghế hiện tại.
- Thanh xác nhận ghế/giá cố định phía dưới.
- Vùng bấm đủ rộng, chú giải ngắn có chữ; không chỉ dựa vào màu để phân biệt.
- Hạn chế trang trí làm sơ đồ chật hoặc khó thao tác trên điện thoại.

### Dữ liệu và trạng thái ghế

Đọc trạng thái an toàn qua RPC hiện có `get_seat_map`; chỉ hiện khoang tương ứng
hạng vé, giữ đúng vị trí hàng/cột.

Dữ liệu hiện chưa mô tả vị trí lối đi riêng. Đề xuất hỗ trợ sơ đồ sáu cột
**ABC–DEF** đang dùng trong demo/PDF, giữ khoảng trống giữa các hàng nếu có.
Sơ đồ không được hỗ trợ hoặc dữ liệu sai sẽ hiện thông báo không khả dụng,
không tự đoán bố trí.

Phân trang khi đọc RPC để tránh giới hạn 1.000 hàng của Data API làm thiếu ghế.

Phân biệt bằng chữ/ký hiệu và màu:

- Ghế trống.
- Ghế bị chặn.
- Ghế đang được giữ.
- Ghế đã đặt.
- Ghế đang chọn trong bản nháp.

### Quy tắc chọn

Chọn ghế trả phí là **không bắt buộc**. Có thể bỏ qua để được xếp ghế tự động ở
bước nghiệp vụ sau; đợt này chưa triển khai việc xếp ghế tự động.

Em bé không có ghế riêng không được chọn ghế trên chặng đó. Nếu sang chặng sau
đã đủ hai tuổi thì được chọn ghế riêng. Không cho hai người chọn trùng một ghế.
Không cho người dưới 18 tuổi hoặc người lớn đang đi kèm em bé chọn hàng thoát hiểm.

Tải lại trạng thái khi quay lại app và trước khi lấy báo giá. Nếu ghế đã bị người
khác giữ/đặt, yêu cầu chọn lại rõ ràng; không âm thầm đổi ghế của khách.

**Luôn ghi rõ: ghế mới được chọn, chưa được giữ.**

## Phạm vi dừng của đợt này

Đợt này kết thúc tại màn tổng hợp báo giá. Chưa làm giữ ghế có thời hạn, tạo đơn,
thanh toán, bảo hiểm hoặc thay đổi lịch sử giao dịch. Không hiển thị như thể các
nghiệp vụ đó đã có.

## Kiểm thử và bàn giao

Kiểm thử logic bản nháp: dữ liệu giữa các người/chặng độc lập, xóa đúng lúc,
báo giá mất hiệu lực đúng lúc, lựa chọn gói, điều kiện ghế, ghế trùng và tổng tiền.

Kiểm thử SQL trong giao dịch được hoàn tác sau khi chạy: tính giá thực, app gửi
giá giả, sinh nhật đổi nhóm tuổi giữa các chặng, gói ngừng bán, chuyến đóng bán/
hết chỗ, ghế bị chặn/đã đặt/đang giữ, từ chối khách chưa đăng nhập và xác nhận
không ghi vào bảng giao dịch. Chỉ dùng thông tin cá nhân giả.

Kiểm tra RPC trên flight-dev bằng giao dịch hoàn tác; chạy bộ kiểm tra bảo mật/
hiệu năng của Supabase. Sau đó triển khai migration qua CLI có quản lý lịch sử
và xác minh lịch sử đã khớp. Không chạy SQL thay đổi cấu trúc riêng rồi chỉ đánh
dấu migration là đã chạy.

Chạy test, lint, typecheck và xuất bundle Web/Android. Kiểm tra trình duyệt ở
kích thước điện thoại: bố cục, quay lại/sửa, Việt–Anh, VND/USD và trạng thái tải/lỗi.
Kết quả thử trên Android thật được báo riêng.

**Mỗi task là một commit riêng. Chưa push/merge trong yêu cầu này.**
