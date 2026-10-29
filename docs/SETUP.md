# Chạy Flight trên máy phát triển

## Yêu cầu

- Node.js 24.13 trở lên trong nhánh 24, npm 11 và Git.
- Điện thoại Android có Expo Go tương thích SDK của project, cùng Wi-Fi với máy.
- Android Studio cùng Android SDK/ADB nếu muốn dùng emulator hoặc build native local.

## Cài và chạy

```powershell
npm.cmd ci
npm.cmd start
```

Quét QR bằng Expo Go. Nếu phiên bản Expo Go không hỗ trợ SDK trong package.json,
dùng development build. Trên Windows không build iOS local được; dùng EAS cloud.

```powershell
npm.cmd run web
npm.cmd run check
npm.cmd run build:web
npm.cmd run build:android
```

Hai lệnh export chỉ kiểm tra bundle, không tạo APK hoặc chứng minh app chạy trên thiết bị.
Màn hình hiện tại là luồng tài khoản tiếng Việt. Xem `docs/AUTH.md` để thiết lập email.

## Chứng chỉ mạng trên máy hiện tại

Nếu npm báo `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, dùng kho chứng chỉ Windows:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
npm.cmd ci
```

Không tắt kiểm tra SSL. Biến này chỉ áp dụng cho terminal hiện tại.

## Supabase

Xem `supabase/README.md`. Cần URL và publishable key trong `.env.local` để dùng Auth.
Không commit file `.env.local`. Các thư viện Query, Zustand, form và Supabase
được cài để dùng ở bước xây dựng tính năng; đã có kết nối Auth, chưa có nghiệp vụ đặt vé.

## Build Android bằng EAS

Sau khi có tài khoản Expo:

```powershell
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest build:configure
npx.cmd eas-cli@latest build --platform android --profile preview
```

Profile preview tạo APK. Profile development cần expo-dev-client được cài bằng
`npx.cmd expo install expo-dev-client` trước khi build. Cloud build chưa được thực hiện.

## Làm việc nhóm 3 người

Mỗi tính năng dùng branch riêng và PR vào main. Mỗi người chạy `npm ci` sau khi kéo
lockfile mới, kiểm tra `npm run check` trước PR. Không chỉnh phiên bản React Native
độc lập với Expo; cài module native bằng `npx expo install`.

CI kiểm tra TypeScript, ESLint và web bundle. Khi có nghiệp vụ, bổ sung kiểm thử
giữ ghế, giá tiền, quyền truy cập và luồng thanh toán mô phỏng.

## Dependency cần theo dõi

Ngày 2026-10-28, `npm audit --omit=dev` báo 8 vấn đề (5 low, 3 high),
liên quan deepmerge và bản Zod lồng trong Expo CLI. Zod trực tiếp của app là
4.6.7. Đề xuất `audit fix --force` hiện hạ Expo về SDK 51 nên chưa áp dụng.
Cần kiểm tra bản vá upstream trước khi phát hành; chưa coi bộ dependency là sạch audit.
