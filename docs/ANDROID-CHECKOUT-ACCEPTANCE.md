# Checklist Android — thanh toán mô phỏng Flyora

Trạng thái: chưa nghiệm thu thiết bị thật. Không dùng số thẻ/thông tin cá nhân thật; đây là demo, không mất tiền.

## Chuẩn bị

1. `npm ci`, đặt public Supabase config trên máy của bạn, `npm start`.
2. Điện thoại Android mở Expo Go, quét QR trên cùng mạng. Không cần Android Studio cho luồng mock này.
3. Đăng nhập email/password. Không dùng kết quả test web để kết luận Google OAuth trên Expo Go đã hoạt động.
4. Tìm fixture F0103 SGN → HAN vào ngày còn bán; xem CHECKOUT-DEMO.md. Dùng tên/ngày sinh/liên hệ giả, thử cả Standard và Flex.

## Các ca cần chạy

- [ ] Form, bàn phím, nút và footer hoạt động trên máy thật; cuộn/xoay màn không che CTA. Chữ lớn/TalkBack không mất nhãn/nút.
- [ ] Thanh toán thất bại: đơn vẫn pending, có thể đổi kịch bản thành công và thử lại; không tạo payment thành công hai lần.
- [ ] Hủy lần thanh toán: đơn vẫn pending; khác với nút Hủy đơn.
- [ ] Đang xử lý: đóng/mở app → Vé của tôi → tiếp tục; hoàn tất trên attempt pending, không thêm attempt mới hoặc kéo dài giữ ghế.
- [ ] Thành công: màn theo PDF, ghế confirmed, mở vé mô phỏng đầy đủ hành khách/chặng/ghế/hành lý/tổng. Không xem được vé của tài khoản khác.
- [ ] Mất mạng ngay sau bấm, rồi bật lại: Thử lại thao tác trước; chỉ một thành công/đơn, dữ liệu đúng người đang đăng nhập.
- [ ] Bấm nhanh nhiều lần, quay lại trong khi đang gửi, đổi tài khoản: không điều hướng bằng kết quả cũ hoặc gửi dữ liệu sang tài khoản khác.
- [ ] Pending hết hạn: đồng hồ về 0/cron; đơn expired, payment pending dừng, không xác nhận lại bằng kịch bản thành công.
- [ ] Hủy pending: xác nhận hủy toàn đơn, phí 0, ghế released, không có hoàn tiền.
- [ ] Standard đã trả: không được hủy. Flex: xem phí/tiền hoàn, bấm Giữ lại đơn không đổi dữ liệu; xác nhận hủy giải phóng ghế và giữ giá lịch sử.
- [ ] Hoàn Flex: thử failed → pending → succeeded; chỉ một refund với số tiền server tính, thành công không còn nút thử lại.
- [ ] Đổi VI/EN ở trang chủ: checkout/dịch vụ không mất dữ liệu, VI=VND, EN=USD tham khảo; USD có giá gốc VND và attribution dưới total.
- [ ] Hai tài khoản/thiết bị cùng chọn ghế: một bên giữ được; phía còn lại được báo ghế hết. Hủy/hết hạn giải phóng ghế để thử lại.
- [ ] Một chiều/khứ hồi/nhiều chặng, child/infant, sinh nhật giữa chặng: giá/ghế đúng từng chặng trong một đơn; infant không có ghế riêng khi dưới 2.

Ghi kết quả kèm model máy, bản Expo Go/build, bước tái hiện, ngôn ngữ, mã đơn demo và ảnh đã che email/điện thoại. Không gửi token/password/OTP. Những ô chưa chạy phải giữ chưa đánh dấu.
