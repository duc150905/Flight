# TV2 — Kiểm tra thông tin liên hệ đặt vé

Task nhỏ F04, ngày 30/10/2026. Module:
`src/features/booking/contact.ts`; kiểm thử: `tests/booking-contact.test.mjs`.

Thông tin liên hệ là của người nhận thông báo về đơn. Người này có thể khác
chủ tài khoản và khác tất cả hành khách, nên module không tự lấy từ Auth hoặc
hành khách đầu tiên.

## Quy tắc

- `contactName`: bắt buộc, bỏ khoảng trắng hai đầu, từ 2 đến 100 ký tự;
  giữ nguyên dấu tiếng Việt, dấu nháy và dấu gạch nối.
- `contactEmail`: bắt buộc và đúng định dạng; bỏ khoảng trắng hai đầu và đổi
  thành chữ thường, thống nhất với cách nhập email đang có trong Auth.
- `contactPhone`: bắt buộc, từ 7 đến 15 chữ số sau chuẩn hóa. Cho nhập dấu cách,
  `(`, `)`, `-`, `.` và một dấu `+` ở đầu; kết quả bỏ các dấu phân cách.
  Dạng `+` phải bắt đầu bằng chữ số khác 0. Không tự thêm `+84` hoặc đổi số nội địa.

Đây là quy ước kiểm tra định dạng cho demo; không xác minh số điện thoại/email
có thật. Chuẩn số liên hệ này chấp nhận cả số nội địa, khác với trường
`profiles.contact_phone` chỉ nhận E.164; không dùng trực tiếp để cập nhật profile.

## Cách dùng ở bước checkout sau này

```ts
const result = bookingContactSchema.safeParse({
  contactName: ' Nguyễn Minh An ',
  contactEmail: ' AN@Example.COM ',
  contactPhone: '+84 (90) 123-45.67',
});
```

Khi hợp lệ, `result.data` chứa tên `Nguyễn Minh An`, email `an@example.com`
và điện thoại `+84901234567`. Khi không hợp lệ, lấy `result.error.issues` để
gắn lỗi vào trường tương ứng. Module không sửa object form gốc.

`BookingContactInput` là kiểu dữ liệu form; `BookingContact` là kiểu kết quả
sau chuẩn hóa. Kết quả chỉ gồm ba trường liên hệ, bỏ trường lạ như giá,
trạng thái đơn, user ID hoặc danh sách hành khách.

Đã có module và 10 test; bản nháp dùng chung ở [CHECKOUT-DRAFT.md](CHECKOUT-DRAFT.md).
Chưa gắn vào màn hình hoặc ghi Supabase.
Khi có RPC tạo đơn, server vẫn phải kiểm tra lại dữ liệu và tự xác định quyền,
giá, trạng thái đơn; kiểm tra client không thay thế bảo vệ phía server.

Chạy `node --test tests/booking-contact.test.mjs` hoặc `npm test`.
Schema sử dụng [API Zod hiện có trong project](https://zod.dev/api).
