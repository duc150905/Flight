# Backend Flight

App đã có Supabase client và Auth provider. Mỗi máy cấu hình project qua biến môi trường.

1. Tạo development project trên Supabase, lưu mật khẩu database trong password manager.
2. Sao chép `.env.example` thành `.env.local` ở root.
3. Điền Project URL và publishable key từ trang Connect của Supabase.
4. Khởi động lại Metro sau khi đổi biến môi trường.

Không đưa database password, secret key hoặc service_role key vào app hay Git.
Xem `docs/AUTH.md` để áp dụng mẫu email và kiểm thử Auth.
Schema, RLS, migrations và seed được thiết kế cùng nghiệp vụ ở giai đoạn tiếp theo.
Không dùng key giả để coi như đã kết nối thành công.

Nếu chạy Supabase local về sau, cần Docker Desktop và Supabase CLI.
Hiện tại phát triển với Supabase cloud không yêu cầu Docker.
