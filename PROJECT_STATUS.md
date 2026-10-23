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
