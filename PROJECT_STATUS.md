# HTVVM Studio — trạng thái cập nhật

## Cập nhật sổ tay khoa học
- Bảng tuần hoàn hiển thị đủ 118 nguyên tố, hỗ trợ tìm theo số hiệu nguyên tử, ký hiệu, tên và họ nguyên tố.
- Mỗi nguyên tố mở bảng thông tin, mô hình nguyên tử minh hoạ kiểu hạt nhân ở tâm/electron xung quanh, phân bố electron theo lớp/cấu hình orbital khi tải được dữ liệu nguồn, cùng ảnh mẫu thực tế hoặc ảnh minh hoạ từ nguồn tham khảo.
- Ảnh và cấu hình chi tiết được làm giàu từ nguồn dữ liệu công khai khi có internet; khi nguồn ảnh lỗi, dữ liệu cơ bản và liên kết Wikipedia vẫn dùng được.
- Máy đồ thị hỗ trợ nhiều hàm mỗi lượt, nhân ẩn, nhiều hàm lượng giác/hàm mũ/log/căn, phạm vi x-y tuỳ chỉnh, mẫu nhanh, zoom, pan bằng nút và kéo chuột, Ctrl+wheel để zoom, bảng giá trị và xuất PNG.
- Không dùng `eval()` hay `Function()` trong bộ phân tích biểu thức.

## Kiểm thử
- `node --test ./test/*.test.js`: 67 kiểm thử đạt ở lần chạy mới nhất.
- Kiểm tra cú pháp JS: xem lệnh ở README.
- `npm run build` chưa chạy được trong môi trường sửa vì chưa có `vite` cài trong `node_modules` và môi trường không truy cập được registry để cài phụ thuộc. Trên máy deploy, chạy `npm install` rồi `npm run build`.

## Nguồn tham khảo dữ liệu
- https://staticdata.dev/datasets/periodic-table/
- https://github.com/Bowserinator/Periodic-Table-JSON
- https://en.wikipedia.org/wiki/Periodic_table


## Sửa lỗi triển khai Vercel (23-10-2026)
- Bỏ rewrite tự trỏ `/api/(.*)` về `/api/$1`; giữ API Functions tại `api/` và loại `/api/` khỏi SPA fallback.
- Khôi phục `.env.example` để cung cấp danh sách biến cấu hình, không chứa bí mật thật.
- Bổ sung hướng dẫn Root Directory, build/output/install command và phân biệt biến môi trường frontend với biến server-only trong README.
- `npm test`: 67 kiểm thử đạt sau khi hợp nhất một Phòng thi, gồm xác thực cờ đánh dấu câu hỏi. `node --check` đạt cho các module/API đã chỉnh.
- Chưa xác minh được `npm run build` trong môi trường hiện tại: `vite: not found`; lệnh `npm install --no-audit --no-fund` bị timeout khi truy cập registry. Đây là giới hạn môi trường kiểm tra, không phải log lỗi build từ Vercel.


## Hợp nhất giao diện 3D vào một Phòng thi HTVVM (23-10-2026)
- Loại bỏ route/menu `/exam3d`, module iframe app độc lập và bundle SPA thi thử tách riêng.
- Chuyển cảnh Three.js 3D trích từ source tặng vào `public/exam-visual/scene.html`, chỉ làm hình nền/trang trí bên trong `src/modules/exam-room/`. Đã loại bỏ script hiệu ứng nút không cần thiết (~36 KB) để giảm tải.
- `/exam` là nơi duy nhất để mở kho đề, nhập mã, làm bài, lưu/khôi phục bản nháp, nộp bài, xem chấm điểm phía máy chủ, lịch sử, thống kê, sổ tay câu sai và Creator Studio. Trong phòng thi có thanh tiến độ, sơ đồ câu hỏi để chuyển nhanh, đánh dấu câu cần xem lại, toàn màn hình và cảnh báo sắp hết giờ; các cờ đánh dấu được kiểm tra theo ID câu hỏi trước khi đồng bộ máy chủ.
- Cập nhật Vercel rewrite và service worker để phục vụ trực tiếp cảnh 3D nhưng không tạo tuyến thi thứ hai; tăng cache version PWA.
- Đã điều chỉnh test để xác nhận `/exam3d` không còn là route và toàn bộ submit/history dùng API chính thức.
- Trạng thái kiểm thử build ghi nhận sau lần chạy gần nhất; production build cần được xác nhận trên môi trường có dependencies đã cài.


## Firebase, quyền sử dụng, Sổ tay popup, khung tài nguyên và thư viện (23-10-2026)
- **Nguyên nhân gốc Firebase đã xác định:** `lib/exam-server.js` gọi `getDatabase(app, url)` theo kiểu tham số của browser SDK thay vì Admin SDK; trong Admin SDK, `databaseURL` phải được cung cấp khi `initializeApp`, và app mặc định có thể đã khởi tạo từ bước Auth trước khi DB được gọi. Đã sửa trong `lib/firebase-admin.js`, thêm kiểm tra URL/project/config và thêm endpoint `GET /api/diagnostics/firebase` không lộ bí mật. Thêm nút **Chẩn đoán Firebase** trên giao diện.
- Đã chuẩn hoá `VITE_FIREBASE_DATABASE_URL` và `FIREBASE_DATABASE_URL`; `.env.example` chỉ để placeholder dưới dạng chú thích để không bị dùng nhầm. Cần nhập URL thật trong Vercel và redeploy.
- Bỏ các gate UI admin/giáo viên/học sinh trong router và tạo đề; tạo đề vẫn cần tài khoản Google xác thực, API cho phép mọi người dùng đã xác thực. Chưa mở viết dữ liệu cho khách vô danh để tránh spam.
- Sổ tay mở modal popup khi chọn nguyên tố; có đóng bằng X, click nền, Escape.
- Góc tập trung có hai khung riêng cạnh nhau cho YouTube và xem trước tài liệu/PDF.
- Thêm `/library` và `/api/library` đọc published CSV; chuẩn hoá link, preview, open/download; nhận diện thư mục Google Drive và chỉ hiện nút mở thư mục. Không xác minh được kết nối trực tiếp tới CSV bên ngoài trong môi trường build (mạng/DNS không truy cập được), nên cần kiểm tra live sau deploy.
- Bổ sung bộ test cho CSV, Admin SDK URL init, route/quyền. Kết quả: `npm test` có 74 kiểm thử đạt; các file JS được kiểm tra bằng `node --check`. `npm run build` chưa xác nhận: môi trường này không có Vite trong `node_modules` và không tải được package registry.


## Phase update — LaTeX/PDF, Lớp học Mực, and adjustable focus timer

- Added KaTeX display for `$...$`, `\(...\)`, `$$...$$`, and `\[...\]` inside prompts/options, plus a separate optional formula field on each exam question.
- Extended server-side question validation with optional `latex` (max 4,000 characters); public question payload continues to remove answer/tolerance only.
- Added A4 print stylesheet/export workflow, with optional answer key. Browser native print flow is used; users select Save as PDF in the print dialog.
- Added custom Pomodoro minutes/seconds from 1 second to 240 minutes; custom duration persists locally.
- Integrated uploaded Lớp học Mực 1.2.46 source as a separate Vite-built same-origin sub-app at `/focus-notes/`, surfaced in Focus Zone via iframe/fullscreen/open-new-tab controls.
- Updated Vercel rewrite and service-worker bypass rules so `/focus-notes/` is never rewritten/cached as the HTVVM root index.
- Automated tests: `npm test` passed 78 assertions after adding the final static base-path test.
- Production build not verified: `npm install --no-audit --no-fund` timed out in the editing environment. TypeScript/TSX syntax transpilation passed for 41 files using the system TypeScript compiler.
