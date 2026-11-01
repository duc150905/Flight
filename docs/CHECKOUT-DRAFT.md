# TV2 — Bản nháp liên hệ và hành khách

Task F04 ngày 30/10/2026. Module `src/features/booking/draft.ts` dùng Zustand
đã có trong project; 13 test ở `tests/checkout-draft.test.mjs`.

## Hành vi

Mỗi luồng checkout tạo **một** store bằng `createCheckoutDraftStore()`, dùng lại
cùng instance ở các bước. Không tạo store lại mỗi lần render hoặc mỗi màn hình.
Store giữ dữ liệu trong RAM; đóng app/tải lại trang sẽ mất bản nháp. Chưa có UI
hoặc Provider kết nối các màn hình, chưa lưu xuống thiết bị/database.

- `updateContact(patch)`: sửa từng trường liên hệ, giữ các trường khác.
- `updatePassenger(id, patch)`: thêm/sửa theo mã hành khách ổn định; không dùng
  vị trí mảng làm danh tính. Mã này chỉ dùng trong bản nháp, không phải ID database.
- `removePassenger(id)`: bỏ đúng hành khách đó.
- `reset()`: xóa liên hệ và danh sách hành khách, vẫn giữ được các action.

Bản nháp cho giữ chuỗi chưa nhập xong hoặc chưa hợp lệ. Chuỗi rỗng xóa trường;
trường không truyền/undefined giữ giá trị cũ. Action chỉ lấy các trường form
đã biết, không sao chép giá, user ID hoặc trạng thái đơn vào dữ liệu.

## Kiểm tra trước bước xem lại đầy đủ

Ở từng màn hình dùng bộ kiểm tra riêng cho liên hệ hoặc hành khách.
`validateCheckoutDraft` kiểm tra toàn bộ hai phần trước khi xem lại/xác nhận.

```ts
const store = createCheckoutDraftStore();
store.getState().updateContact({
  contactName: 'Nguyễn An', contactEmail: ' AN@Example.COM ', contactPhone: '090 123 4567',
});
store.getState().updatePassenger('p1', {
  givenNames: ' Minh An ', familyName: 'Nguyễn', dateOfBirth: '2000-02-29',
});
const result = validateCheckoutDraft(store.getState(), '2026-10-30');
```

Khi thành công, `result.data` là bản sao chuẩn hóa theo hai bộ kiểm tra liên hệ/
hành khách đã có. Dữ liệu gõ trong store giữ nguyên. Khi thất bại, dùng
`result.error.issues` để chỉ lỗi theo đường dẫn như
`contact.contactEmail` hoặc `passengers.0.values.dateOfBirth`.
Ngày đặt vé phải được cung cấp từ ngữ cảnh checkout; không hardcode ngày ví dụ.

Kiểm tra yêu cầu ít nhất một hành khách và không trùng mã. Chưa đối chiếu số
người đã chọn, loại tuổi, hành trình, hạng vé, ghế hoặc giá; không coi bản nháp
hợp lệ là đơn đã được server chấp nhận. Các quy tắc đó thuộc các bước tiếp theo.

Khi nối UI, caller cần reset/bỏ store khi đổi hành trình, đổi người dùng/đăng xuất,
hủy checkout hoặc hoàn tất đơn. Việc này chưa được gắn vào Auth/navigation.
Các store khác nhau không chia sẻ dữ liệu.

Chạy `npm test` hoặc `node --test tests/checkout-draft.test.mjs`.
`allowImportingTsExtensions` trong tsconfig cho phép import `.ts` rõ ràng để bộ
test Node hiện tại chạy cùng module mà TypeScript kiểm tra với `noEmit`.
Tham khảo [Zustand createStore](https://zustand.docs.pmnd.rs/reference/apis/create-store).
