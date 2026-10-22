# HTVVM Studio — trạng thái cập nhật

## Cập nhật sổ tay khoa học
- Bảng tuần hoàn hiển thị đủ 118 nguyên tố, hỗ trợ tìm theo số hiệu nguyên tử, ký hiệu, tên và họ nguyên tố.
- Mỗi nguyên tố mở bảng thông tin, mô hình nguyên tử minh hoạ kiểu hạt nhân ở tâm/electron xung quanh, phân bố electron theo lớp/cấu hình orbital khi tải được dữ liệu nguồn, cùng ảnh mẫu thực tế hoặc ảnh minh hoạ từ nguồn tham khảo.
- Ảnh và cấu hình chi tiết được làm giàu từ nguồn dữ liệu công khai khi có internet; khi nguồn ảnh lỗi, dữ liệu cơ bản và liên kết Wikipedia vẫn dùng được.
- Máy đồ thị hỗ trợ nhiều hàm mỗi lượt, nhân ẩn, nhiều hàm lượng giác/hàm mũ/log/căn, phạm vi x-y tuỳ chỉnh, mẫu nhanh, zoom, pan bằng nút và kéo chuột, Ctrl+wheel để zoom, bảng giá trị và xuất PNG.
- Không dùng `eval()` hay `Function()` trong bộ phân tích biểu thức.

## Kiểm thử
- `node --test ./test/*.test.js`: 63 kiểm thử đạt.
- Kiểm tra cú pháp JS: xem lệnh ở README.
- `npm run build` chưa chạy được trong môi trường sửa vì chưa có `vite` cài trong `node_modules` và môi trường không truy cập được registry để cài phụ thuộc. Trên máy deploy, chạy `npm install` rồi `npm run build`.

## Nguồn tham khảo dữ liệu
- https://staticdata.dev/datasets/periodic-table/
- https://github.com/Bowserinator/Periodic-Table-JSON
- https://en.wikipedia.org/wiki/Periodic_table
