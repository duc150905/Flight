# Flyora — các màn hình cần hoàn thiện trong Figma

Nguồn tham chiếu: `8_flight.rar` (17 ảnh PNG, khung rộng 390 px). File Figma hiện có 6 màn: Home, Flight Search - Round-trip, Flight Booking - Search Results, Checkout - Passenger Information, Checkout - Payment, Checkout - Payment Success. Thiết kế thêm 11 màn bên dưới; giữ nguyên các màn đã có để đối chiếu.

## Hệ thống giao diện

- Khung mobile: rộng 390 px; cao 844 px, riêng Flight Details 1640 px và Baggage 1212 px để thể hiện trang cuộn.
- Nền trắng `#FFFFFF`; chữ chính `#434A54`; chữ phụ `#8B95A5`; nền ô nhập `#F2F3F5`; đường phân cách `#E9EDF1`; màu hành động chính `#00B8D0` theo màn checkout đang có trong repo.
- Lề ngang 20 px. Nút chính cao tối thiểu 44 px, bo góc 7–10 px; vùng chạm tối thiểu 44 × 44 px. Nhãn ô nhập luôn hiện khi có giá trị. Không dùng icon emoji trong bản hoàn thiện.
- Ưu tiên nội dung tiếng Việt theo lựa chọn trước đó của nhóm. Ví dụ dữ liệu dùng tuyến `HAN ↔ SGN`, hãng Vietnam Airlines/Vietjet và tiền VND để phù hợp dữ liệu mẫu của project; số tiền là mô phỏng.
- Thanh trạng thái, nút quay lại, tab hành trình, bước checkout và thanh hành động cuối trang dùng component dùng lại trong Figma.

## Các frame bổ sung

| Frame | Kích thước | Nội dung và trạng thái chính |
|---|---:|---|
| Flight Search - One-way | 390 × 844 | Tab Một chiều đang chọn; sân bay đi/đến và nút hoán đổi; ngày đi; 1 hành khách, Phổ thông; nút Tìm chuyến bay ở đáy. |
| Flight Search - Multi-city | 390 × 844 | Tab Nhiều chặng; 2 chặng ban đầu, mỗi chặng có đi/đến/ngày; nút Thêm chặng; hành khách/hạng ghế; nút tìm. |
| Flight Search - Select origin | 390 × 844 | Hộp tìm sân bay đi, nhóm thành phố, mã IATA, danh sách sân bay; một kết quả đang mở; trạng thái bàn phím. |
| Flight Search - Select destination | 390 × 844 | Hộp tìm sân bay đến, gợi ý thành phố và sân bay; một kết quả đang chọn; trạng thái bàn phím. |
| Flight Search - Select dates | 390 × 844 | Chọn ngày đi/về trên lịch 2 tháng; hai ngày chọn nổi bật bằng cyan; xác nhận ở đáy. |
| Flight Search - Travellers & cabin | 390 × 844 | Bộ đếm người lớn/trẻ em/em bé; chọn Phổ thông/Phổ thông đặc biệt/Thương gia/Hạng nhất; nút Xong. |
| Flight Results - Sort & filters | 390 × 844 | Sắp xếp, số điểm dừng, hãng bay; chọn nhiều hãng; Xóa lọc và Xem kết quả ở đáy. |
| Flight Details | 390 × 1640 | Tóm tắt hành trình, hai thẻ chặng, thông tin dịch vụ có sẵn, hành lý mua thêm, điều kiện vé, giá và nút Chọn. |
| Checkout - Baggage | 390 × 1212 | Bước 2/4; hành lý xách tay có sẵn, hành lý ký gửi theo từng khách/chặng, bảo hiểm ghi rõ là mô phỏng; giá và Tiếp tục. |
| Checkout - Seat overview | 390 × 844 | Bước 3/4; các chặng và giá ghế từ; vào sơ đồ ghế riêng cho từng chặng; Tiếp tục. |
| Checkout - Select seats | 390 × 844 | Chú giải ghế trống/không khả dụng/đã chọn; sơ đồ 3–3 có lối đi; giá ghế đang chọn và nút Xác nhận. |

## Quy tắc để code theo Figma

1. Các frame tìm kiếm tương ứng chế độ một chiều, khứ hồi, nhiều chặng và các picker trong `src/features/discovery`.
2. Chỉ hiển thị hành lý/ghế của từng hành khách và chặng, cùng trạng thái ghế do server trả về. Không biểu diễn ghế đã chọn là đã giữ nếu chưa có hold thành công.
3. Màn Payment hiện tại trong Figma có thẻ Mastercard; checkout của project chỉ thanh toán mô phỏng. Khi đồng bộ giao diện với code cần thay phần thẻ thật bằng lựa chọn kết quả mô phỏng, không nhập số thẻ/CVV.
4. Với màn dài, thanh hành động cuối trang là vùng cố định trên viewport; nội dung cuộn bên dưới và không bị che bởi safe area.
