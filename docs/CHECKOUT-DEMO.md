# Dữ liệu demo checkout dùng chung TV1–TV2–TV3

**Cập nhật 04/11/2026:** tên hiển thị đã chuẩn hóa thành Flyora Airways, Flyora Regional 24, Phổ thông Tiết kiệm/Linh hoạt. ID và giá cũ giữ nguyên. Đã có bộ danh mục mở rộng 1.440 chuyến mới; xem [CATALOGUE-DATA.md](CATALOGUE-DATA.md). Các ghi chú bên dưới về màn hình/chức năng chưa làm là snapshot cũ; trạng thái hiện tại đọc CHECKOUT.md và VNPAY-SANDBOX.md.

Đã nạp vào **flight-dev** (`qisvuxiuwsqtkcrfpiwu`) ngày 02/11/2026.
Đây là dữ liệu giả, không phải chuyến bay/hãng/giá thương mại.

## Có gì để thử?

- Hãng `F0 — Flyora Airways`; máy bay `FLY-TV2-24`, 24 ghế Economy.
- `F0101`: SGN → SIN, **16/11/2026 09:00**, giờ Việt Nam.
- `F0102`: SIN → SGN, **20/11/2026 09:00**, giờ Singapore.
- `F0103`: SGN → HAN, **23/11/2026 09:00**, giờ Việt Nam.
- Mỗi chuyến có Standard/Flex, giá riêng adult/child/infant, thuế/phí và hành lý
  có sẵn. Standard một người lớn: **1.250.000 VND/chặng**.
- Hai offer hành lý mua thêm: 15 kg / 250.000 VND và 25 kg / 400.000 VND.
- Sơ đồ A–F, bốn hàng. Ghế 4F bị chặn; các ghế còn lại sẵn sàng nếu chưa có
  nghiệp vụ khác giữ ghế. Hàng 1 phí chọn ghế 100.000 VND, còn lại 50.000 VND.

Tìm SGN → HAN ngày 23/11/2026 để thử màn trong nước trước. Chọn vé từ màn chi
tiết của TV1 rồi đăng nhập để vào checkout thật. Hành lý/ghế đã có **dữ liệu**;
màn chọn, giữ chỗ và đặt đơn vẫn là các task sau.

## ID để TV1/TV3 tích hợp

- F0101 flight: `610992a6-7098-487b-899b-435a4b1a06ba`.
  Standard fare: `0cae0745-146d-4950-80bd-fbb9e7d4744f`.
  Flex fare: `78f894a7-2729-42d1-8c35-983bd7933d5f`.
- F0102 flight: `5dddaa20-12fe-45d3-86ec-affd5294ac6c`.
  Standard fare: `cb3dd5d8-7b39-4ca7-8768-90c9ff928801`.
  Flex fare: `b92b46e2-75c2-4fcb-878c-093ec0b8faf6`.
- F0103 flight: `ed50239e-85f7-4928-877c-984445b096e8`.
  Standard fare: `1d653662-38ce-4d2f-8600-8ddd2beae8a7`.
  Flex fare: `e311e20d-4e10-4035-885d-69d0a14c1413`.

Round trip dùng F0101 journeyIndex=1 và F0102 journeyIndex=2, legIndex=1 cho
cả hai. Dùng `buildCheckoutHref` như `CHECKOUT.md`; không gửi thông tin cá nhân
hay giá trên URL. Đọc sơ đồ bằng `get_seat_map(flightId)`, không đọc trực tiếp
`flight_seats`. RPC chỉ trả trạng thái an toàn, không có người đang giữ ghế.

## Ca kiểm thử bằng thông tin giả

1. Một adult, chuyến F0103: tên/ngày sinh, liên hệ; không bắt nhập hộ chiếu.
2. Một adult + một child, F0101/F0102; child sinh **18/11/2014**:
   chiều đi Child, chiều về Adult, cả hai có ghế, vẫn cùng một hành trình.
3. Một adult + một infant, cùng hai chuyến; infant sinh **18/11/2024**:
   chiều đi Infant, đi cùng adult từ 18 tuổi, không ghế riêng; chiều về Child,
   có ghế riêng. Nhóm đếm lúc tìm vé luôn theo ngày khởi hành đầu tiên.
4. Quốc tế: dùng số hộ chiếu giả như `DEMO-ONLY-1`, quốc tịch/nơi cấp VN,
   hết hạn 2036-12-31. Thử thiếu/hết hạn để thấy lỗi.
5. Gõ email sai rồi rời ô; đổi VN/EN khi lỗi đang hiện; dữ liệu và lỗi phải
   giữ đúng ô, còn câu thông báo và định dạng tiền đổi theo ngôn ngữ.
6. Next khi trống: báo lỗi các ô cần nhập. Xem lại → sửa: không mất dữ liệu.
7. Hủy/đổi tài khoản/đổi hành trình: thông tin cá nhân cũ không còn.

Không dùng thông tin giấy tờ thật khi thử. Các script smoke chỉ dùng tên/số
hộ chiếu giả trong RAM, không tạo đơn hay ghi hồ sơ cá nhân vào DB.

## Nạp và kiểm tra lại

Chạy CLI đã đăng nhập và chỉ định đúng project, không dùng reset:

```powershell
npx --yes supabase@2.122.0 db query --linked --project-ref qisvuxiuwsqtkcrfpiwu --file supabase/seeds/checkout-demo.sql
npx --yes supabase@2.122.0 db query --linked --project-ref qisvuxiuwsqtkcrfpiwu --file supabase/tests/checkout-demo.sql
node scripts/checkout-demo-check.mjs
npx --yes supabase@2.122.0 db query --linked --project-ref qisvuxiuwsqtkcrfpiwu --file supabase/.temp/checkout-next/demo-rerun.sql
node --env-file=.env.local scripts/checkout-demo-smoke.mjs
```

Seed chỉ INSERT trong một transaction. Các sân bay đã có được tái sử dụng khi
mã quốc gia/timezone khớp; hãng/máy bay/sản phẩm demo có namespace riêng và
xung đột sẽ dừng, không ghi đè. UUID ổn định theo ngày chạy ở Việt Nam; cùng
ngày không thêm trùng, ngày khác tạo batch tương lai mới và giữ batch cũ.
Không xóa lịch sử hay tạo auth user/admin/booking/payment. Không tự nối seed
này vào reset hoặc pipeline môi trường thật.

Kiểm tra rerun so sánh hash **toàn bộ hàng của chín bảng catalogue** trước/sau,
thử nạp lại và rollback; đã xác nhận không thay đổi. SQL cũng đã kiểm tra đọc
vé/offer/sơ đồ qua role `anon`. Smoke dùng publishable key của app, tải hành
trình thật và xác nhận tuổi/ghế từng chặng, hộ chiếu, tổng tạm tính.

TV3 có thể dùng fixture này để xây UI; **chưa có RPC ghi booking/hold/payment**,
nên không tự cấp quyền INSERT các bảng giao dịch để làm UI chạy được.
