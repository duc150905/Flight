# Hướng dẫn Khởi chạy & Thiết lập Môi trường Phát triển (Flight)

Tài liệu hướng dẫn thiết lập môi trường, khởi chạy và quy chuẩn làm việc nhóm cho dự án đặt vé máy bay **Flight** (Expo React Native SDK 58, TypeScript, Supabase).

---

## 1. Yêu cầu môi trường

- **Node.js**: Phiên bản **`>=24.13.0 <25`** (khuyến nghị chuẩn `24.13.0` theo `.nvmrc`). Kiểm tra bằng `node -v`.
- **Package Manager**: `npm` phiên bản 11 (đi kèm Node 24).
- **Git**: Đã cài đặt và cấu hình SSH hoặc Personal Access Token.
- **Thiết bị chạy thử nghiệm**:
  - **Điện thoại Android / iOS**: Cài ứng dụng **Expo Go** tương thích SDK 58, kết nối **cùng mạng Wi-Fi** với máy tính phát triển.
  - **Giả lập (Emulator)**: Đã cài Android Studio cùng Android SDK, ADB và Virtual Device (AVD).

---

## 2. Cài đặt và Khởi chạy

### Bước 1: Cài đặt thư viện dependencies

Mở PowerShell tại thư mục gốc của dự án:

```powershell
npm.cmd ci
```

> [!WARNING]
> **Xử lý lỗi chứng chỉ mạng SSL trên Windows**:
> Nếu `npm ci` báo lỗi `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, hãy sử dụng kho chứng chỉ của hệ thống Windows:
> ```powershell
> $env:NODE_OPTIONS='--use-system-ca'
> npm.cmd ci
> ```
> *Lưu ý: Không tắt kiểm tra SSL (`strict-ssl=false`). Biến môi trường trên chỉ áp dụng trong phiên terminal hiện tại.*

---

### Bước 2: Cấu hình biến môi trường Supabase

1. Tạo file `.env.local` tại thư mục gốc của dự án (copy từ `.env.example`).
2. Điền thông tin kết nối Supabase Cloud:

```env
# URL và Publishable Key của dự án Supabase (project: flight-dev)
EXPO_PUBLIC_SUPABASE_URL=https://qisvuxiuwsqtkcrfpiwu.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here
```

> [!CAUTION]
> File `.env.local` đã nằm trong `.gitignore`. **Tuyệt đối không commit file này lên Git** để bảo vệ khóa truy cập.

---

### Bước 3: Khởi chạy Metro Bundler

```powershell
npm.cmd start
```

Sau khi server Metro khởi động:
- **Quét mã QR**: Mở ứng dụng **Expo Go** trên điện thoại và quét mã QR trên terminal.
- **Chạy trên Android Emulator**: Nhấn phím **`a`** trên terminal.
- **Chạy trên Trình duyệt Web**: Nhấn phím **`w`** (hoặc chạy `npm.cmd run web`).
- **Tải lại ứng dụng (Reload)**: Nhấn phím **`r`**.

---

## 3. Các lệnh kiểm tra & kiểm thử (BẮT BUỘC)

Trước khi mở Pull Request hoặc tích hợp mã nguồn, bạn cần chạy bộ lệnh kiểm tra:

```powershell
# 1. Kiểm tra kiểu dữ liệu TypeScript và định dạng mã nguồn ESLint
npm.cmd run check

# 2. Chạy toàn bộ các unit test tự động (xác thực Auth, logic...)
npm.cmd test

# 3. Kiểm tra khả năng đóng gói bundle (Web & Android)
npm.cmd run build:web
npm.cmd run build:android
```

*(Hai lệnh `build:web` và `build:android` chỉ kiểm tra xuất bundle, không tạo file APK).*

---

## 4. Quy chế Làm việc nhóm 3 người & Quy trình Git

Để đảm bảo nhánh `main` luôn ổn định và không xảy ra xung đột mã nguồn:

### 1. Phân nhánh tính năng (Feature Branching)
- Không commit hay đẩy code trực tiếp lên `main`.
- Mỗi tính năng phải tạo một nhánh riêng từ `main`:
  ```powershell
  git checkout main
  git pull origin main
  git checkout -b feat/<ten-tinh-nang>
  ```
  *(Ví dụ: `feat/search-flights`, `feat/seat-map`, `feat/admin-categories`)*.

### 2. Cài đặt thư viện mới (Native Modules)
- **Không tùy tiện dùng** `npm install <package>`.
- **Bắt buộc** dùng `npx expo install <package>` để Expo tự động giải quyết phiên bản tương thích chính xác với SDK 58.
- Không tự ý nâng/hạ phiên bản React Native tách rời với Expo SDK.

### 3. Tiêu chuẩn mở Pull Request (Pre-PR Checklist)
- [ ] Đã chạy `npm.cmd run check` và không còn lỗi đỏ nào.
- [ ] Đã chạy `npm.cmd test` và toàn bộ bài test đều PASS.
- [ ] File commit không chứa thông tin nhạy cảm, mật khẩu hoặc `.env.local`.
- [ ] Có ít nhất **1 thành viên khác trong nhóm review và approve** PR trước khi merge.
- [ ] Sau khi kéo code mới về máy, luôn chạy `npm.cmd ci` nếu có thay đổi trong `package-lock.json`.

---

## 5. Đóng gói file cài đặt Android (Build APK bằng EAS)

Dự án sử dụng dịch vụ Expo Application Services (EAS Build) để tạo file APK mà không cần build native phức tạp trên máy local:

1. Đăng nhập tài khoản Expo:
   ```powershell
   npx.cmd eas-cli@latest login
   ```
2. Khởi tạo cấu hình EAS cho project (chỉ chạy 1 lần đầu):
   ```powershell
   npx.cmd eas-cli@latest build:configure
   ```
3. Cấu hình biến môi trường bí mật trên trang Expo Dashboard hoặc CLI cho bản build.
4. Kích hoạt build file APK:
   ```powershell
   npx.cmd eas-cli@latest build --platform android --profile preview
   ```
   *(Profile `preview` trong file `eas.json` đã được cấu hình tạo file APK `android.buildType: "apk"` để cài trực tiếp lên điện thoại).*

---

## 6. Theo dõi phụ thuộc (Dependency Notes)

- Ngày 2026-10-28, `npm audit --omit=dev` ghi nhận một số cảnh báo lồng trong Expo CLI và Zod.
- Bản Zod trực tiếp của dự án sử dụng `^4.6.7`. Không chạy lệnh `npm audit fix --force` vì có thể gây hạ phiên bản Expo SDK. Chờ các bản vá upstream tương thích từ Expo.
