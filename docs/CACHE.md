# Cache và đồng bộ dữ liệu Flyora

Flyora dùng một `QueryClient` chung trong `src/features/cache/provider.tsx`. Cache giúp mở lại các màn đọc dữ liệu nhanh hơn và giảm request lặp; Supabase vẫn là nguồn dữ liệu chính. Các giao dịch luôn được RPC kiểm tra lại.

## Chính sách theo dữ liệu

| Nhóm | Bộ nhớ | Lưu sau khi đóng app | Làm mới |
| --- | --- | --- | --- |
| Sân bay, điểm đến nổi bật | 10 phút mới được xem là cũ | AsyncStorage, tối đa 24 giờ | Khi mở lại và hết hạn, hoặc sau khi admin sửa danh mục |
| Kết quả tìm chuyến và chi tiết | 30 giây | Không | Sau thời hạn, tìm lại, hoặc khi admin sửa chuyến/giá trên cùng thiết bị |
| Hồ sơ, vé cá nhân và màn admin | Theo tài khoản, thời hạn ngắn (vé: 15 giây; mặc định khác: 30 giây) | Không | Khi hết hạn, thao tác liên quan thành công, hoặc app trở lại foreground |
| Ghế, báo giá, đơn pending, payment | Dữ liệu chỉ để trình bày bước hiện tại; các query giao dịch dùng `staleTime: 0` | Không | Khi vào lại màn, app trở lại foreground và trước khi quyết định giao dịch |
| Ảnh điểm đến, tỷ giá | Cơ chế riêng của `expo-image` và dịch vụ tỷ giá | Có | Theo cache ảnh và thời điểm cập nhật tỷ giá |

`PersistQueryClientProvider` chỉ ghi hai query công khai `airports` và `featured-destinations`; các query khác và mutation không được serialize xuống ổ đĩa. Cache được phục hồi trước khi các query bắt đầu fetch, có `buster` để bỏ bản cũ khi cấu trúc thay đổi. Chỉ dùng AsyncStorage cho dữ liệu công khai, không ghi hồ sơ, hành khách, vé, quyền admin hoặc kết quả thanh toán vào cache bền.

Query key của vé chứa ID chủ tài khoản. Khi phiên đổi người dùng hoặc bị lỗi khôi phục, `AuthProvider` loại toàn bộ query không công khai trước khi cập nhật phiên; cache công khai vẫn dùng được. Quyền xem dữ liệu vẫn do Supabase RLS/RPC quyết định. Cache không phải lớp bảo mật.

Sau khi tạo đơn, xử lý thanh toán hoặc hủy, các query vé của đúng chủ tài khoản được đánh dấu cũ. Khi admin sửa chuyến/giá, các query kết quả và chi tiết chuyến bị đánh dấu cũ; khi sửa danh mục, sân bay và điểm đến cũng được làm mới. Thay đổi từ **thiết bị khác** chỉ xuất hiện sau thời hạn cache hoặc lần làm mới tiếp theo; Flyora chưa dùng realtime subscription cho toàn bộ dữ liệu.

## Cách demo và đo

1. Xóa dữ liệu ứng dụng, mở trang chủ hai lần: ghi số request tới bảng `airports`/`destinations` và thời gian từ khi mở tới khi thấy nội dung. Lần thứ hai trong thời hạn cache không cần request lặp.
2. Đóng/mở app trong 10 phút: danh mục công khai được phục hồi từ AsyncStorage. Mở khi mất mạng để xem phần danh mục đã lưu; tìm chuyến và checkout vẫn có thể cần mạng.
3. Đăng nhập A, xem Vé của tôi, đăng xuất rồi đăng nhập B: không được thấy vé hay dữ liệu admin của A. Kiểm tra cả khi request cũ trả về muộn.
4. Sửa điểm đến/chuyến trên cùng thiết bị admin, quay về trang công khai và tìm lại: dữ liệu mới phải được tải. Tạo/hủy đơn và xác nhận vé tương tự.
5. Với cùng dữ liệu và mạng, ghi thời gian mở màn, số request, dung lượng phản hồi và độ mượt cuộn trước/sau. Thử trên APK release; thời gian đo ở Expo development không đại diện hiệu năng thiết bị thật. Chưa có số đo chuẩn được công bố trong repo, vì vậy không điền phần trăm cải thiện nếu chưa chạy phép đo.

Kiểm tra bằng `npm test` (gồm `tests/cache-policy.test.mjs`) và `npm run check`. Unit test chứng minh lựa chọn dữ liệu lưu bền, cách xóa cache theo tài khoản và invalidation; kiểm thử Android thực tế vẫn cần thực hiện riêng.
