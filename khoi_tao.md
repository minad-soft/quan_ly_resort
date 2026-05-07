# 🚀 Antigravity Master Blueprint: ROM (Resort Operations Manager) - Zero-Cost SaaS Edition

**Ngày khởi tạo:** 2026-05-08
**Trạng thái:** 🟡 Execution / Bắt đầu triển khai
**Kiến trúc lõi:** Frontend (Next.js/Vercel) + Backend (FastAPI/Koyeb) + Database (Supabase PostgreSQL) + Payment (PayOS Webhook).
**Mục tiêu hệ thống:** Web App quản lý đa chi nhánh (SaaS), thao tác POS/PMS mượt mà không độ trễ (Zero-latency), xử lý chính xác định mức nguyên vật liệu (BOM) và dòng tiền, tối ưu chi phí hạ tầng ở mức 0 Đồng trong giai đoạn đầu.

---

## 🤖 1. Phân công Hệ sinh thái AI Agents (Agent Roster)

Toàn bộ dự án sẽ được điều phối bởi `User_Proxy`. Khi nhận được lệnh, `User_Proxy` có trách nhiệm gọi đúng Agent chuyên trách theo danh sách sau:

1.  **DB_Gatekeeper:** Chuyên gia PostgreSQL & Supabase. Chịu trách nhiệm thiết kế Schema, xử lý khóa ngoại (Foreign Keys) và thiết lập bảo mật dòng (Row Level Security - RLS) để chia tách dữ liệu đa chi nhánh.
2.  **Backend_Engine:** Kỹ sư Python/FastAPI. Chịu trách nhiệm viết API, thuật toán trừ lùi kho (FIFO/FEFO), xử lý logic BOM (Bill of Materials) và tiếp nhận Webhook từ PayOS. Viết file `Dockerfile` để deploy lên Koyeb.
3.  **Frontend_Ninja:** Kỹ sư Next.js/TailwindCSS. Chịu trách nhiệm xây dựng giao diện UI/UX siêu mượt, quản lý State trên trình duyệt để gọi API, tối ưu trải nghiệm Mobile cho nhân viên buồng phòng.

---

## 🔄 2. Kế hoạch Triển khai (Execution Phases) cho AI Agents

> **⚠️ LƯU Ý DÀNH CHO CÁC AGENTS:** KHÔNG bỏ bước. KHÔNG chuyển sang Phase mới nếu Phase trước đó chưa được test thành công và xác nhận bởi User. 

### 🗄️ Phase 1: Foundation & Database (Agent: DB_Gatekeeper)
**Mục tiêu:** Xây dựng móng nhà vững chắc trên Supabase. Đảm bảo nhân viên chi nhánh A tuyệt đối không thấy dữ liệu của chi nhánh B.
*   **Task 1.1:** Viết script SQL tạo các bảng cốt lõi: 
    *   `branches` (Chi nhánh)
    *   `users` (Nhân sự / Phân quyền Role)
    *   `rooms` (Phòng lưu trú)
    *   `inventory_items` (Nguyên vật liệu kho)
    *   `menu_items` & `bom_recipes` (Định mức F&B / Sản phẩm bán lẻ)
    *   `orders` & `order_details` (Hóa đơn phòng và dịch vụ)
*   **Task 1.2:** Viết script SQL kích hoạt RLS (Row Level Security) cho TẤT CẢ các bảng. Logic: `auth.uid()` -> lấy được `branch_id` -> filter data theo `branch_id`.
*   **Đầu ra:** File `01_database_schema.sql` hoàn chỉnh để chạy trên Supabase.

### ⚙️ Phase 2: Core API & Logic (Agent: Backend_Engine)
**Mục tiêu:** Dựng lõi logic bằng FastAPI, chạy trên môi trường không "ngủ đông" (Koyeb).
*   **Task 2.1:** Khởi tạo project FastAPI. Viết file `requirements.txt` và `Dockerfile` tối ưu nhẹ nhất.
*   **Task 2.2:** Viết API `GET /rooms` và `POST /check-in` (Quản lý trạng thái phòng).
*   **Task 2.3:** Viết API `POST /orders` xử lý logic phức tạp: Khi có order món ăn/nước uống, tự động truy vấn bảng `bom_recipes` và trừ lùi số lượng tương ứng trong bảng `inventory_items` chuẩn xác.
*   **Task 2.4:** Viết API `POST /webhook/payos` để nhận thông báo chuyển khoản thành công và gạch nợ tự động vào `orders`.
*   **Đầu ra:** Source code Backend sẵn sàng push lên GitHub và deploy lên Koyeb.

### 🎨 Phase 3: The POS & PMS Frontend (Agent: Frontend_Ninja)
**Mục tiêu:** Xây dựng màn hình điều khiển tốc độ cao bằng Next.js, host miễn phí trên Vercel.
*   **Task 3.1:** Khởi tạo Next.js App Router, cài đặt `TailwindCSS` và `Supabase-js` client.
*   **Task 3.2:** Dựng UI Đăng nhập & Xác thực, lưu trữ `branch_id` vào session.
*   **Task 3.3:** Dựng Dashboard Lễ tân (Sơ đồ phòng): Hiển thị phòng trống/có khách/đang dọn. Có thể thao tác click để check-in trực tiếp không cần load lại trang.
*   **Task 3.4:** Dựng giao diện POS order dịch vụ (F&B, vé, đồ dùng lẻ) kết hợp tạo mã QR VietQR (hiển thị động theo tổng tiền bill).
*   **Đầu ra:** Source code Frontend sẵn sàng push lên GitHub và tự động build trên Vercel.

### 📱 Phase 4: Mobile View & Nhân sự (Agent: Frontend_Ninja + Backend_Engine)
**Mục tiêu:** Hỗ trợ quy trình vận hành và nội bộ.
*   **Task 4.1:** Tối ưu UI riêng (Mobile-first) cho nhân viên buồng phòng nhận thông báo dọn phòng.
*   **Task 4.2:** Viết module tính lương, chấm công theo ca (Tích hợp logic từ dữ liệu đăng nhập và thao tác nghiệp vụ).

---

## 🛠️ 3. Quy tắc Code (Coding Guidelines cho Agents)
1.  **Bảo mật:** Không bao giờ hardcode API Keys, DB Passwords trong mã nguồn. Bắt buộc dùng `os.getenv` (Python) hoặc `process.env` (Next.js).
2.  **Tối ưu tốc độ:** Backend_Engine ưu tiên dùng các hàm `async/await` của FastAPI. Frontend_Ninja sử dụng React Query (hoặc SWR) để cache dữ liệu phòng trống.
3.  **BOM Logging:** Với các nghiệp vụ xuất/nhập kho nguyên liệu bếp, Backend_Engine phải luôn tạo log giao dịch (transaction) để đảm bảo không bị thất thoát nếu xảy ra lỗi đường truyền.