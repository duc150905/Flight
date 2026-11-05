# Hướng dẫn chạy source Flyora

Tài liệu dành cho thành viên nhóm dùng **Windows PowerShell**. Source là ứng dụng Expo/React Native (Expo SDK 58), dùng npm và Supabase cloud. Để chạy app thông thường, bạn **không cần cài PostgreSQL hoặc chạy migration/seed** trên máy.

## 1. Chuẩn bị

- Cài Git và Node.js phiên bản **từ 24.13.0 đến trước 25**. Kiểm tra: `git --version` và `node --version`.
- Có tài khoản Supabase được nhóm cấp quyền vào project `flight-dev` để lấy **publishable key**.
- Muốn mở trên điện thoại: cài Expo Go tương thích SDK 58 và cho điện thoại, máy tính cùng mạng Wi-Fi.

## 2. Lấy source mới nhất và cài thư viện

Mở PowerShell trong thư mục muốn lưu dự án:

```powershell
git clone https://github.com/duc150905/Flight.git
cd Flight
git switch main
git pull --ff-only origin main
npm.cmd ci
```

Nếu đã clone, mở PowerShell ở thư mục `Flight`, chạy ba lệnh cuối. Trước khi `git switch main`, hãy commit hoặc cất các thay đổi cá nhân để tránh ghi đè.

## 3. Cấu hình Supabase

Tại thư mục gốc của repo, tạo file cấu hình riêng từ mẫu:

```powershell
Copy-Item .env.example .env.local
```

Mở `.env.local` và điền:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://qisvuxiuwsqtkcrfpiwu.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_GEMINI_API_KEY=
```

Lấy publishable key trong Supabase Dashboard của project `flight-dev` → **Project Settings → API Keys** (hoặc nút **Connect → Publishable key**). `EXPO_PUBLIC_GEMINI_API_KEY` chỉ cần khi thử tính năng AI. **Không đặt service role/secret key vào biến `EXPO_PUBLIC_`**. `.env.local` là cấu hình riêng từng máy, không commit lên Git. Sau khi sửa file này, dừng và chạy lại Expo để nạp giá trị mới.

## 4. Chạy ứng dụng

```powershell
npm.cmd start -- --port 8081 --host lan
```

Giữ cửa sổ PowerShell đang chạy. Khi Metro hiện mã QR:

| Nơi chạy | Cách mở |
| --- | --- |
| Trình duyệt trên máy tính | Nhấn `w` trong terminal hoặc vào `http://localhost:8081/`. |
| Điện thoại Android | Mở Expo Go, quét QR hoặc chọn server Flyora trong Expo Go. Điện thoại phải cùng Wi-Fi với máy tính. |
| Android Emulator | Mở máy ảo rồi nhấn `a` trong terminal. |

Nhấn `r` để tải lại app, `Ctrl+C` để dừng server. Địa chỉ `exp://...:8081` in trong terminal là địa chỉ LAN của **máy bạn**, không cố định cho cả nhóm.

## 5. Đăng nhập và kiểm thử trên điện thoại

- Đăng nhập bằng email, tìm chuyến và các màn thông thường có thể thử trong Expo Go.
- **Đăng nhập Google trên Android** cần bản APK Flyora hoặc development build để app nhận được deep link `flight://account`. Expo Go không thay thế APK cho luồng này.
- Nếu cần tạo APK mới, người có quyền với Expo project của nhóm chạy:

  ```powershell
  npx.cmd eas-cli@latest login
  npx.cmd eas-cli@latest build --platform android --profile preview
  ```

  Profile `preview` trong `eas.json` tạo APK cài trực tiếp. Hãy cấu hình các biến môi trường `EXPO_PUBLIC_` cho môi trường build trên Expo trước khi build. Sau khi build xong, mở **trang build trên Expo Dashboard** để lấy liên kết tải mới; không dùng lại URL tải APK tạm thời đã hết hạn. APK đã cài chạy độc lập với Metro.

## 6. Kiểm tra source

```powershell
npm.cmd run check
npm.cmd test
```

Khi cần kiểm tra đóng gói thêm:

```powershell
npm.cmd run build:web
npm.cmd run build:android
```

Hai lệnh `build:*` xuất bundle, **không tạo APK**. Sau khi thay đổi code, làm trên feature branch và mở Pull Request vào `main` theo quy trình nhóm.

## 7. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| “Chưa cấu hình Supabase” | Kiểm tra tên file `.env.local`, hai biến URL/publishable key và chạy lại Expo. |
| Điện thoại không mở được QR/server | Kiểm tra cùng Wi-Fi, tắt VPN nếu làm lệch mạng LAN, cho phép Node/Expo qua Windows Firewall; có thể chạy `npx.cmd expo start --tunnel`. |
| Cổng 8081 đang được dùng | Dừng Metro cũ bằng `Ctrl+C`, rồi chạy lại lệnh ở mục 4. |
| App vẫn hiện code/cấu hình cũ | Dừng server; chạy `npx.cmd expo start --clear --port 8081 --host lan`; tải lại app. |
| Google login không quay lại app trong Expo Go | Thử trên APK `preview` Flyora; kiểm tra Supabase cho phép redirect `flight://account`. |
| Không thấy email xác nhận | Kiểm tra Inbox/Spam và trạng thái gửi trong Resend; email đã đăng nhập Google trước đó có thể đã có tài khoản, hãy dùng luồng đăng nhập phù hợp. |

Tài liệu liên quan: [thiết lập Auth](AUTH.md), [database](DATABASE.md), [cache](CACHE.md), [hướng dẫn môi trường chi tiết](SETUP.md).
