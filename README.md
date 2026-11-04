# Flyora

Ứng dụng đặt vé máy bay cho nhóm 3 thành viên, dùng Expo React Native và TypeScript.

## Bắt đầu

```powershell
npm.cmd ci
npm.cmd start
```

Xem [hướng dẫn môi trường](docs/SETUP.md) để chạy Android, web, cấu hình Supabase và build APK.
Xem [chính sách cache](docs/CACHE.md) để biết dữ liệu nào được lưu trên thiết bị, cách làm mới và cách kiểm thử.

## Công nghệ

Expo Router · Supabase/PostgreSQL · TanStack Query · Zustand · React Hook Form · Zod.

## Trạng thái

Có giao diện tiếng Việt cho đăng ký, xác nhận mã email, đăng nhập, khôi phục phiên,
đặt lại/đổi mật khẩu và đăng xuất qua Supabase Auth; hồ sơ đọc/sửa trong
`public.profiles` với RLS.
Xem [thiết lập Auth](docs/AUTH.md) để cấu hình mẫu
email và kiểm thử trên điện thoại. Database nghiệp vụ đã có 22 bảng với RLS,
index, dữ liệu mẫu (`supabase/seed.sql`) và RPC đọc sơ đồ ghế trên Supabase `flight-dev`; xem
[trạng thái database](docs/DATABASE.md) và [thiết kế đã duyệt](docs/DATABASE-PROPOSAL.md).
Trang chủ công khai tải sân bay và điểm đến gợi ý từ database. Tìm chuyến một chiều,
khứ hồi và nhiều chặng theo ngày, hành khách và hạng ghế; xem kết quả,
sắp xếp/lọc hãng và điều kiện vé.
Xem [phạm vi tìm chuyến](docs/DISCOVERY.md).
Màn hình Vé của tôi đọc đơn và chi tiết qua Supabase; xem [phạm vi hiện tại](docs/TICKETS.md).
Checkout đã có liên hệ, hành khách, chính sách demo và xem lại/sửa thông tin;
xem [hướng dẫn checkout](docs/CHECKOUT.md). Chưa có tạo đơn, hủy vé, giữ ghế,
thanh toán mô phỏng hoặc quản trị nghiệp vụ trong app.
Chưa build APK hay liên kết EAS cloud.

## Kiểm tra

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build:web
npm.cmd run build:android
```

Dữ liệu chuyến bay mẫu, thanh toán mô phỏng, ưu tiên Android. Nền tảng chuyển
Việt–Anh đã dùng ở Auth, tìm chuyến, Vé của tôi và checkout.
