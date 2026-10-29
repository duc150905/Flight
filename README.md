# Flight

Ứng dụng đặt vé máy bay cho nhóm 3 thành viên, dùng Expo React Native và TypeScript.

## Bắt đầu

```powershell
npm.cmd ci
npm.cmd start
```

Xem [hướng dẫn môi trường](docs/SETUP.md) để chạy Android, web, cấu hình Supabase và build APK.

## Công nghệ

Expo Router · Supabase/PostgreSQL · TanStack Query · Zustand · React Hook Form · Zod.

## Trạng thái

Có giao diện tiếng Việt cho đăng ký, xác nhận mã email, đăng nhập, khôi phục phiên,
đặt lại/đổi mật khẩu, chỉnh sửa hồ sơ và đăng xuất qua Supabase Auth.
Xem [thiết lập Auth](docs/AUTH.md) để cấu hình mẫu
email và kiểm thử trên điện thoại. Database nghiệp vụ đã có 22 bảng với RLS,
index và RPC đọc sơ đồ ghế trên Supabase `flight-dev`; xem
[trạng thái database](docs/DATABASE.md) và [thiết kế đã duyệt](docs/DATABASE-PROPOSAL.md).
Trang chủ công khai tải sân bay và điểm đến gợi ý từ database. Tìm chuyến một chiều
theo ngày, hành khách và hạng ghế; xem kết quả, sắp xếp/lọc hãng và điều kiện vé.
Xem [phạm vi tìm chuyến](docs/DISCOVERY.md).
Chưa có luồng đặt vé, thanh toán mô phỏng hoặc quản trị trong app.
Chưa build APK hay liên kết EAS cloud.

## Kiểm tra

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build:web
npm.cmd run build:android
```

Dữ liệu chuyến bay mẫu, thanh toán mô phỏng, ưu tiên Android; giao diện tiếng Việt.
