# HTVVM Studio

Không gian học tập dành cho học sinh THPT: phòng thi, đấu trường Hóa học, ChemMaker, sổ tay, góc tập trung, tư vấn nguyện vọng và trợ lý AI dạng cửa sổ chat nổi.

## Chạy trên máy

1. Cài Node.js bản LTS.
2. Chạy `npm install`.
3. Sao chép `.env.example` thành `.env.local` và điền cấu hình Firebase.
4. Chạy `npm run dev` để mở giao diện.
5. Để chạy API serverless ở máy local, cài Vercel CLI và chạy `npx vercel dev`; Vite đơn thuần không thực thi thư mục `api/`.
6. Chạy `npm run check` để chạy unit test và build thư mục `dist/`.


## Sửa lỗi triển khai Vercel

- Mở thư mục dự án có `package.json` ở ngay cấp gốc. Khi import từ ZIP, giải nén rồi đưa **nội dung** thư mục này vào Git repository; không đặt thêm một lớp thư mục cha khiến Vercel không tìm thấy `package.json`.
- Vercel Project Settings: Framework Preset `Vite`, Build Command `npm run build`, Output Directory `dist`, Install Command `npm install --no-audit --no-fund`. Có thể để Root Directory trống nếu `package.json` nằm ngay gốc repository.
- `vercel.json` không còn rule tự viết lại `/api/...` về chính `/api/...`. Các tệp trong `api/` được Vercel nhận diện là Functions; SPA fallback không bắt các URL `/api/`, tài nguyên `/assets/`, biểu tượng, manifest hoặc service worker.
- Chỉ dùng `.env.example` làm mẫu. Tạo biến môi trường trong Vercel cho cả Production/Preview tương ứng; không commit `.env` hoặc khóa bí mật. Các biến `VITE_FIREBASE_*` là cấu hình web công khai, còn `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PRIVATE_KEY` và `GEMINI_API_KEY` phải giữ ở phía máy chủ, không đặt tiền tố `VITE_`.
- Nếu vẫn thất bại, mở Deployments → deployment lỗi → Build Logs và lấy **dòng lỗi đầu tiên** (không chỉ dòng cuối `Command exited with 1`). Lỗi dependency, thiếu biến môi trường runtime và lỗi cấu hình Firebase là ba nhóm khác nhau.

## Phòng thi hợp nhất HTVVM

- Chỉ còn **một Phòng thi chính thức** tại `/exam`; menu và router không còn `/exam3d`.
- Giao diện 3D được trích từ source Panamera đặt tại `public/exam-visual/scene.html` và dùng như hình nền trang trí bên trong `/exam`. Phần cảnh 3D không chứa kho đề, tài khoản hay dữ liệu kết quả riêng.
- Kho đề, vào bằng mã, đồng hồ, lưu/khôi phục bản nháp, chấm điểm, lịch sử, sổ tay câu sai, bảng vinh danh và Creator Studio vẫn đi qua module `src/modules/exam-room/` và API `/api/exam` của HTVVM.
- Kết quả được chấm ở máy chủ và lịch sử tổng hợp từ các lượt thi đã nộp trên Firebase. Bản nháp được ghi cục bộ ngay, sau đó đồng bộ lên Realtime Database khi mạng hoạt động.
- Vercel phục vụ riêng các file nền tại `/exam-visual/`; service worker bỏ qua những file này và API để không bắt nhầm request.

### Triển khai

1. Đưa nội dung source vào thư mục gốc repository.
2. Vercel dùng Framework `Vite`, Build Command `npm run build`, Output Directory `dist`.
3. Cấu hình các biến Firebase trong Vercel. API thi cần `FIREBASE_DATABASE_URL` cùng thông tin xác thực Firebase Admin; không đưa khóa bí mật vào mã frontend.
4. Sau deploy, kiểm tra `/exam`, mở kho đề, bắt đầu và khôi phục bản nháp, nộp bài, rồi kiểm tra mục Lịch sử & thống kê.

### Giới hạn đã biết

- Cảnh 3D là phần trình diễn thị giác, không phải mô-đun thi riêng. Mọi thao tác làm bài và kết quả nằm trong HTVVM.
- Chưa xác minh được production build trong môi trường đóng gói nếu Vite và các dependencies chưa được cài đặt. Hãy xác nhận `npm run build` thành công trong Vercel trước khi công bố bản mới.
