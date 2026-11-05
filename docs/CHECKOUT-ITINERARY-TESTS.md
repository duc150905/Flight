# Hành trình để kiểm thử khứ hồi và nhiều chặng

Đã nạp vào Supabase **flight-dev** ngày 05/11/2026. Các cặp tuyến bổ sung có cả hai chiều hằng ngày từ **06/11 đến 05/12/2026**. Khứ hồi là hai chuyến một chiều được ghép vào một đơn; nhiều chặng cũng dùng cùng một đơn, không có bảng chuyến khứ hồi riêng.

Bản mở rộng C4 bổ sung chuyến **Flyora Airways** trên 71 cặp tuyến hai chiều, có đủ Phổ thông, Phổ thông đặc biệt, Thương gia và Hạng nhất. Từ TP.HCM, Hà Nội hoặc Đà Nẵng có chuyến đến mọi sân bay đang có trong app trong cửa sổ ngày trên. Các bộ nhiều chặng bên dưới cũng có đủ bốn khoang qua chuyến Flyora. Hãng khác vẫn có thể chỉ bán một số khoang; chọn hạng không được khai thác hoặc ngày ngoài lịch đã nạp vẫn có thể không có kết quả.

Ô tìm sân bay chấp nhận tên có/không dấu, viết tắt và mã IATA: `TPHCM`, `TP.HCM`, `HCM`, `Sài Gòn`, `Saigon`, `Tan Son Nhat`, `SGN` đều tìm ra Tân Sơn Nhất. Có thể gõ `danang`, `ha noi`, `noibai`, `camranh`.

Trong app, mở **Tìm chuyến bay**, chọn **Khứ hồi** hoặc **Nhiều chặng**. Lần đầu thử **1 người lớn, Phổ thông**. Chọn gói **Phổ thông Linh hoạt** trên từng chặng nếu muốn thử hành lý có sẵn và chính sách hủy. Ngày bên dưới là ngày địa phương của sân bay khởi hành.

## Khứ hồi

1. **Phú Quốc (PQC) ↔ Nha Trang/Cam Ranh (CXR)**: đi **07/11/2026**, về **11/11/2026**. Tổng vé Linh hoạt cho 1 người lớn: **2.970.000 VND**.
2. **Singapore (SIN) ↔ Bangkok/Suvarnabhumi (BKK)**: đi **08/11/2026**, về **12/11/2026**. Tổng vé Linh hoạt: **6.430.000 VND**.
3. **Seoul/Incheon (ICN) ↔ Tokyo/Narita (NRT)**: đi **10/11/2026**, về **15/11/2026**. Tổng vé Linh hoạt: **8.320.000 VND**.

## Nhiều chặng

**Nội địa — 4 chặng**, tổng vé Linh hoạt 1 người lớn **5.469.000 VND**:

- Đà Nẵng (DAD) → Phú Quốc (PQC): **07/11/2026**.
- Phú Quốc (PQC) → Nha Trang/Cam Ranh (CXR): **09/11/2026**.
- Nha Trang/Cam Ranh (CXR) → Đà Lạt (DLI): **11/11/2026**.
- Đà Lạt (DLI) → Đà Nẵng (DAD): **13/11/2026**.

**Quốc tế — 3 chặng**, tổng vé Linh hoạt **10.860.000 VND**:

- Đà Nẵng (DAD) → Singapore (SIN): **08/11/2026**.
- Singapore (SIN) → Bangkok (BKK): **10/11/2026**.
- Bangkok (BKK) → Đà Nẵng (DAD): **12/11/2026**.

**Đông Nam Á — 5 chặng**, tổng vé Linh hoạt **14.590.000 VND**:

- TP.HCM (SGN) → Kuala Lumpur (KUL): **09/11/2026**.
- Kuala Lumpur (KUL) → Singapore (SIN): **11/11/2026**.
- Singapore (SIN) → Bangkok (BKK): **13/11/2026**.
- Bangkok (BKK) → Kuala Lumpur (KUL): **15/11/2026**.
- Kuala Lumpur (KUL) → TP.HCM (SGN): **17/11/2026**.

**Đông Bắc Á — 5 chặng**, tổng vé Linh hoạt **18.555.000 VND**:

- TP.HCM (SGN) → Seoul/Incheon (ICN): **07/11/2026**.
- Seoul/Incheon (ICN) → Tokyo/Narita (NRT): **10/11/2026**.
- Tokyo/Narita (NRT) → Hà Nội (HAN): **13/11/2026**.
- Hà Nội (HAN) → Đà Nẵng (DAD): **15/11/2026**.
- Đà Nẵng (DAD) → TP.HCM (SGN): **17/11/2026**.

## Cần kiểm tra khi chạy luồng

- Mỗi chặng chọn đúng người, đúng hành lý và ghế; chuyển chặng hoặc quay lại không mất lựa chọn.
- Giá trên là tổng vé Linh hoạt cho 1 người lớn, gồm thuế/phí đã cấu hình; chưa cộng chọn vị trí ghế hoặc hành lý mua thêm. Các phép kiểm tra chọn chuyến sớm nhất còn mở bán; nếu chọn chuyến/gói khác thì tổng có thể khác.
- Chuyến quốc tế cần quốc tịch, số hộ chiếu và ngày hết hạn. Có thể dùng thông tin giả để học; không cần nhập giấy tờ thật.
- Đổi ngày sinh để kiểm tra tuổi theo từng chặng. Ví dụ trẻ sinh **12/11/2014** đi hành trình nội địa 4 chặng ở trên: chọn nhóm Trẻ em lúc tìm kiếm; người đó là trẻ em ở ba chặng đầu, người lớn ở chặng cuối.
- Có thể thêm người lớn thứ hai, trẻ em hoặc em bé để kiểm tra số lượng; mỗi em bé cần người đi kèm từ 18 tuổi trên từng chặng.

Đây là lịch, giá và sơ đồ ghế phục vụ học tập, không phải inventory của hãng. Việc nạp dữ liệu không tạo sẵn đơn hoặc thanh toán. VNPAY vẫn là sandbox. Kiểm tra dữ liệu đã thực hiện bằng SQL chỉ đọc; chưa nghiệm thu thao tác trên điện thoại trong lần bổ sung này.
