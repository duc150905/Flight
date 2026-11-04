# Kế hoạch tích hợp AI: Tìm kiếm chuyến bay bằng ngôn ngữ tự nhiên (AI Conversational Search)

> Tài liệu hướng dẫn thiết kế, kiến trúc và lộ trình triển khai tính năng trợ lý AI tìm kiếm chuyến bay qua khung chat cho ứng dụng Flyora.

---

## 1. Tổng quan & Mục tiêu

* **Mục tiêu**: Cho phép người dùng tìm kiếm vé máy bay bằng cách trò chuyện tự nhiên (gõ văn bản hoặc giọng nói) thay vì phải tự chọn từng trường trên biểu mẫu truyền thống.
* **Ví dụ câu lệnh người dùng**:
  * *"Tìm cho mình vé khứ hồi đi Đà Nẵng cuối tuần sau cho 2 người lớn, giá dưới 3 triệu."*
  * *"Tuần này có chuyến nào từ Hà Nội đi Phú Quốc rẻ nhất không?"*
* **Giá trị mang lại**:
  * Đơn giản hóa tối đa trải nghiệm người dùng, đặc biệt trên thiết bị di động.
  * Tận dụng công nghệ Generative AI hiện đại (LLM Tool Calling) làm điểm nhấn cho dự án.
  * Không làm ảnh hưởng đến tính toàn vẹn của hệ thống: AI chỉ đóng vai trò phân tích ngữ nghĩa (Parser), toàn bộ việc truy vấn, giữ ghế và thanh toán vẫn đi qua backend an toàn của Supabase.

---

## 2. Luồng trải nghiệm người dùng (UX / UI Flow)

```
[Trang chủ Home]
       │
       ▼ (Bấm nút nổi tròn "Tìm bằng AI ✨")
[Khung Chat AI Modal / Bottom Sheet]
       │
       ▼ (Người dùng gõ câu lệnh tự nhiên)
[Trợ lý AI phân tích ngữ nghĩa & thời gian]
       │
   ┌───┴────────────────────────┐
   ▼ (Thiếu thông tin)          ▼ (Đủ thông tin)
[AI hỏi thêm tự nhiên]    [Sinh thẻ tóm tắt chuyến bay mini]
                                │
                                ▼ (Bấm "Xem các chuyến bay này ➔")
                        [Chuyển sang trang Kết quả tìm kiếm (/results)]
```

### Chi tiết các bước tương tác:
1. **Điểm chạm (Entry Point)**:
   * Đặt một nút nổi (**Floating Action Button - FAB**) ở góc dưới bên phải trang chủ (`home-screen.tsx`) với icon lấp lánh (Sparkles ✨) và nhãn *"Tìm bằng AI"*.
2. **Khung trò chuyện (Chat Sheet)**:
   * Mở modal dạng Bottom Sheet trượt từ dưới lên, có sẵn 3 gợi ý mẫu để người dùng bấm thử nhanh.
   * Hiển thị lịch sử chat dạng bong bóng tin nhắn (User bubble và AI bubble).
3. **Phản hồi thông minh (Smart Response)**:
   * Nếu người dùng nói câu mơ hồ hoặc thiếu ngày: AI tiếp tục hỏi lịch sự bằng văn phong tự nhiên.
   * Khi đã đủ thông tin: AI hiển thị một **Thẻ tóm tắt hành trình (Flight Card Preview)** ngay bên dưới tin nhắn:
     * Chặng bay: SGN $\rightarrow$ DAD (Khứ hồi).
     * Ngày bay: 14/11/2026 – 16/11/2026.
     * Hành khách: 2 người lớn.
     * Hạng vé: Phổ thông (Economy).
     * Nút bấm hành động: **"Xem danh sách chuyến bay ➔"**.
4. **Điều hướng kết quả (Navigation)**:
   * Khi bấm vào nút, hệ thống tự động nạp các tiêu chí này vào `searchStore` và điều hướng sang `/results`.

---

## 3. Kiến trúc kỹ thuật & Công nghệ

### 3.1. Mô hình đề xuất
* **Google Gemini 1.5 Flash**:
  * Tốc độ phản hồi cực nhanh (< 1 giây).
  * Hỗ trợ tiếng Việt rất tốt, hiểu rõ ngữ cảnh thời gian (cuối tuần sau, ngày mai, thứ sáu tuần tới...).
  * Chi phí: Miễn phí hoàn toàn qua gói **Google AI Studio Free Tier** (15 requests/phút).
  * Hỗ trợ chuẩn **Tool Calling / Function Calling** chính xác.

### 3.2. Sơ đồ kiến trúc hệ thống

```
┌────────────────────────────────────────────────────────┐
│                   CLIENT (Expo App)                    │
│                                                        │
│  [UI Chat Modal] ──── gõ câu lệnh ───► [ai-service.ts] │
│          ▲                                   │         │
│          │                                   ▼         │
│  [Render kết quả] ◄─── nhận JSON ───── [Gemini API]    │
│          │                                             │
│          ▼ nạp Store                                   │
│  [searchStore] ────── điều hướng ────► [/results]      │
└──────────────────────────────────────────────┬─────────┘
                                               │
                                               ▼
                              ┌──────────────────────────┐
                              │    SUPABASE BACKEND      │
                              │ (Tra cứu lịch & giá vé)  │
                              └──────────────────────────┘
```

---

## 4. Đặc tả Kỹ thuật (Technical Specification)

### 4.1. Khai báo Tool Calling Schema (`search_flights`)

AI sẽ được trang bị công cụ sau để trả về kết quả dạng JSON có cấu trúc:

```json
{
  "name": "search_flights",
  "description": "Tìm kiếm các chuyến bay phù hợp với nhu cầu của người dùng",
  "parameters": {
    "type": "OBJECT",
    "properties": {
      "origin": {
        "type": "STRING",
        "description": "Mã IATA 3 ký tự của sân bay khởi hành (ví dụ SGN, HAN, DAD, DLI...)"
      },
      "destination": {
        "type": "STRING",
        "description": "Mã IATA 3 ký tự của sân bay đến"
      },
      "tripType": {
        "type": "STRING",
        "enum": ["one_way", "round_trip"],
        "description": "Loại hành trình: một chiều hoặc khứ hồi"
      },
      "departureDate": {
        "type": "STRING",
        "description": "Ngày khởi hành định dạng YYYY-MM-DD"
      },
      "returnDate": {
        "type": "STRING",
        "description": "Ngày về định dạng YYYY-MM-DD (bắt buộc nếu là round_trip)"
      },
      "adults": {
        "type": "INTEGER",
        "description": "Số lượng người lớn (từ 12 tuổi trở lên)"
      },
      "children": {
        "type": "INTEGER",
        "description": "Số lượng trẻ em (từ 2 đến 11 tuổi)"
      },
      "infants": {
        "type": "INTEGER",
        "description": "Số lượng em bé (dưới 2 tuổi)"
      },
      "cabinClass": {
        "type": "STRING",
        "enum": ["economy", "premium_economy", "business", "first"],
        "description": "Hạng khoang đặt chỗ"
      }
    },
    "required": ["origin", "destination", "tripType", "departureDate", "adults"]
  }
}
```

### 4.2. Mẫu System Prompt chuẩn

```markdown
Bạn là trợ lý ảo thông minh của hãng hàng không Flyora.
Hôm nay là ngày: {{CURRENT_DATE}} (Múi giờ Asia/Ho_Chi_Minh).

Nhiệm vụ của bạn là hỗ trợ khách hàng tìm kiếm chuyến bay phù hợp nhất bằng tiếng Việt thân thiện, lịch sự và ngắn gọn.

QUY TẮC BẮT BUỘC:
1. Ánh xạ tên thành phố sang mã IATA:
   - TP.HCM / Sài Gòn -> SGN
   - Hà Nội -> HAN
   - Đà Nẵng -> DAD
   - Nha Trang / Cam Ranh -> CXR
   - Phú Quốc -> PQC
   - Đà Lạt -> DLI
2. Tính toán ngày bay chính xác dạng YYYY-MM-DD dựa trên ngày hôm nay.
3. Nếu người dùng chưa nêu đủ nơi đi, nơi đến hoặc ngày bay, hãy hỏi lại một cách tự nhiên.
4. Khi đã đủ thông tin, HÃY GỌI HÀM `search_flights` để trả về dữ liệu.
```

---

## 5. Lộ trình Triển khai (Roadmap)

### Giai đoạn 1: Chuẩn bị Backend & Client AI Service
- [ ] Lấy API Key miễn phí từ [Google AI Studio](https://aistudio.google.com/).
- [ ] Thêm biến môi trường `EXPO_PUBLIC_GEMINI_API_KEY` vào file `.env.local`.
- [ ] Viết module `src/features/ai/gemini-client.ts`: Quản lý gửi tin nhắn kèm context ngày giờ và gọi Tool `search_flights`.

### Giai đoạn 2: Xây dựng Giao diện Chat (UI Components)
- [ ] Tạo thư mục `src/features/ai/` chứa:
  - `ai-fab.tsx`: Nút bấm tròn nổi mở khung chat trên trang chủ.
  - `ai-chat-sheet.tsx`: Khung Bottom Sheet trượt mượt mà có bàn phím và cuộn tin nhắn.
  - `chat-bubble.tsx`: Giao diện bong bóng tin nhắn (Avatar bot, thời gian, trạng thái typing).
  - `flight-card-preview.tsx`: Thẻ tóm tắt thông tin chuyến bay nhúng trực tiếp trong tin nhắn.

### Giai đoạn 3: Ghép nối với Bộ lọc Tìm kiếm hiện tại
- [ ] Khi nhận được kết quả `search_flights` từ AI:
  - Cập nhật state vào `searchStore` trong `src/features/discovery/search-state.ts`.
  - Đóng chat modal và dùng `router.push('/results')` để hiển thị danh sách vé.

### Giai đoạn 4: Kiểm thử và Xử lý tình huống đặc biệt
- [ ] **Mạng chập chờn / Lỗi API**: Hiển thị thông báo thân thiện và nút "Thử lại".
- [ ] **Người dùng hỏi chuyện ngoài lề**: Bot lịch sự từ chối và hướng người dùng quay lại chủ đề đặt vé.
- [ ] **Sân bay chưa có đường bay thẳng**: Gợi ý sân bay gần nhất hoặc chuyến nối chuyến.

---

## 6. Phân công Nhóm 3 Người khi Thực hiện

| Thành viên | Phân công phụ trách |
| :--- | :--- |
| **Thành viên 1** | Tích hợp nút FAB trên Trang chủ, xây dựng giao diện Khung chat (`ai-chat-sheet.tsx`) và hiệu ứng chuyển động. |
| **Thành viên 2** | Viết module gọi Gemini API (`gemini-client.ts`), tối ưu System Prompt, Schema Tool Calling và tính toán ngày giờ. |
| **Thành viên 3** | Ghép nối dữ liệu JSON trả về với `searchStore`, xử lý điều hướng sang trang kết quả `/results` và viết unit test. |

