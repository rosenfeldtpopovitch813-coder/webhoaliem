# HTVVM — Sửa đồng hồ Pomodoro và ghi nhận thời gian học

## File bắt buộc cập nhật (4 file)
- `src/modules/focus-zone/index.js`
- `api/study-tracker.js`
- `shared/study-core.js`
- `shared/focus-timer.js` (mới, bắt buộc vì Focus Zone import file này)

## File kiểm thử (không bắt buộc để website chạy)
- `test/study.test.js`
- `test/focus-timer.test.js` (mới)
- `test/integrations.test.js`

## Những thay đổi chính
- Bắt đầu đồng hồ ở chế độ Tập trung sẽ tự bắt đầu phiên ghi nhận giờ học; giờ học hiển thị tăng ngay theo giây, không phải đợi heartbeat đầu tiên.
- Tạm dừng, hết giờ, đặt lại hoặc đổi preset sẽ lưu/dừng phiên ghi nhận tương ứng.
- Đồng hồ dùng `performance.now()` để tính thời lượng, lưu số giây còn lại vào localStorage và mở lại ở trạng thái tạm dừng.
- Khi tab bị ẩn hoặc rời Góc tập trung, timer và ghi nhận thời gian học sẽ dừng, tránh tính giờ khi không xem trang.
- Ping mỗi 15 giây được đối soát với số liệu server; tăng cửa sổ chấp nhận heartbeat lên 45 giây để chịu được một nhịp trễ thông thường.
- Có thể khôi phục phiên thủ công sau reload; các khoảng mất kết nối dài không được tính thành giờ học.
- Nếu yêu cầu dừng phiên gặp lỗi mạng, lưu dấu chờ dừng để thử lại thay vì bỏ mất ID phiên.
- Giữ nút ghi nhận thủ công cho thời gian học không dùng Pomodoro.

## Cách cập nhật
1. Giải nén ZIP ở thư mục gốc repository HTVVM.
2. Chép các đường dẫn giữ nguyên cấu trúc, ghi đè 3 file cũ và thêm `shared/focus-timer.js`.
3. Nếu muốn giữ kiểm thử, chép cả thư mục `test/`. Không cần sửa `package.json`, biến môi trường, hoặc Firebase Rules.
4. Commit/push GitHub và Redeploy Vercel.
5. Trên website: mở Góc tập trung, bấm `Tập trung · 25′` → `Bắt đầu`. Sau khoảng 1 giây, `Hôm nay` và `Tổng giờ` sẽ tăng; tạm dừng hoặc kết thúc để gửi lần lưu cuối lên server.

Ghi chú: các số liệu tăng theo thời gian thực là tạm tính phía giao diện giữa các heartbeat. API/Firebase vẫn là nguồn số liệu đã lưu chính thức. Nếu kết nối đứt, UI dừng cộng giờ cho tới khi kết nối lại.
