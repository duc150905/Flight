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

Đã scaffold môi trường. App hiện hiển thị template Expo. Chưa triển khai màn hình đặt vé,
đăng nhập, database, thanh toán mô phỏng hoặc quản trị. Chưa liên kết Supabase/EAS cloud.

## Kiểm tra

```powershell
npm.cmd run check
npm.cmd run build:web
npm.cmd run build:android
```

Dữ liệu chuyến bay mẫu, thanh toán mô phỏng, ưu tiên Android; giao diện sản phẩm sẽ dùng tiếng Việt.
