# TV2 — Họ tên và ngày sinh hành khách

Task nhỏ F04, ngày 30/10/2026. Module `src/features/booking/passenger.ts`;
kiểm thử `tests/booking-passenger.test.mjs`.

## Phạm vi

- `givenNames`: tên đệm và tên; `familyName`: họ. Bắt buộc, trim hai đầu,
  mỗi phần từ 1 đến 100 ký tự. Giữ dấu tiếng Việt, dấu nháy và dấu gạch nối;
  cho phép phần tên chỉ có một ký tự.
- `dateOfBirth`: ngày có thật theo `YYYY-MM-DD`, năm từ 0001, có kiểm tra
  năm nhuận. Không nhận timestamp hoặc chuỗi ngày/tháng/năm để tránh hiểu sai ngày.
- Ngày sinh không được sau ngày đặt vé truyền vào. Ngày đặt vé cũng phải hợp lệ;
  factory ném lỗi ngay nếu cấu hình sai.

Module không đọc Auth hoặc thông tin liên hệ. Người đặt có thể nhập dữ liệu
cho người khác; xử lý nhiều hành khách không sửa hoặc dùng chung dữ liệu gốc.

## Cách dùng sau này ở checkout

```ts
const schema = createBookingPassengerSchema('2026-10-30');
const result = schema.safeParse({
  givenNames: ' Minh An ',
  familyName: ' Nguyễn ',
  dateOfBirth: '2000-02-29',
});
```

Kết quả hợp lệ chứa `Minh An`, `Nguyễn`, `2000-02-29`. Lỗi trường nằm trong
`result.error.issues`; khi thành công dùng `result.data`. Hai kiểu TypeScript
`BookingPassengerInput` và `BookingPassenger` dùng cho đầu vào/kết quả.

Caller cung cấp ngày đặt vé chuẩn từ ngữ cảnh checkout; không hardcode ví dụ
trên trong app thật và không dùng ngày khởi hành làm giới hạn ngày sinh.
Module so sánh ngày lịch, không đọc đồng hồ thiết bị hoặc tự đổi múi giờ.
Khi thêm RPC, server phải xác định lại ngày đặt vé và kiểm tra toàn bộ dữ liệu.

Kết quả hiện chỉ có ba trường cơ bản. Giấy tờ/quốc tịch theo hành trình,
phân loại tuổi theo từng ngày bay, tuổi tối thiểu được bay và người lớn đi kèm
em bé sẽ là các bước riêng. Sinh đúng ngày đặt vé chỉ qua bước kiểm tra ngày,
không có nghĩa hành khách đủ điều kiện bay.

Chưa có giao diện, lưu bản nháp hay thao tác ghi database. Chạy 12 test mới bằng
`node --test tests/booking-passenger.test.mjs`, hoặc chạy toàn bộ bằng `npm test`.
Phần ngày dùng [ISO date của Zod](https://zod.dev/api#iso-dates).
