# HTVVM Studio

Không gian học tập dành cho học sinh THPT: phòng thi, đấu trường Hóa học, ChemMaker, sổ tay, góc tập trung, tư vấn nguyện vọng và trợ lý AI dạng cửa sổ chat nổi.

## Chạy trên máy

1. Cài Node.js bản LTS.
2. Chạy `npm install`.
3. Sao chép `.env.example` thành `.env.local` và điền cấu hình Firebase.
4. Chạy `npm run dev` để mở giao diện.
5. Để chạy API serverless ở máy local, cài Vercel CLI và chạy `npx vercel dev`; Vite đơn thuần không thực thi thư mục `api/`.
6. Chạy `npm run check` để chạy unit test và build thư mục `dist/`.

## Cấu hình Firebase

Trong Firebase Console, bật **Authentication → Google**, thêm domain deploy vào Authorized domains và tạo **Realtime Database**.

Lấy URL từ Firebase Console → Realtime Database → Data, rồi đặt URL đó vào cả `VITE_FIREBASE_DATABASE_URL` và biến môi trường phía máy chủ `FIREBASE_DATABASE_URL`. URL thường có dạng `https://<project>-default-rtdb.firebaseio.com` hoặc tên miền `firebasedatabase.app`; hãy dùng đúng URL mà Console hiển thị, không tự đoán phần vùng.

Các biến phía giao diện:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Các biến chỉ dành cho máy chủ:

- `FIREBASE_DATABASE_URL`
- `FIREBASE_SERVICE_ACCOUNT_JSON` hoặc `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (không bắt buộc; mặc định theo cấu hình máy chủ)

**Không** đưa service account hoặc khóa Gemini vào biến `VITE_*`. Nếu API trả thông báo thiếu `FIREBASE_DATABASE_URL`, điền biến ở môi trường Vercel cho đúng các môi trường Production/Preview/Development rồi deploy lại.

## Quy tắc dữ liệu

`database.rules.json` chặn truy cập trực tiếp của trình duyệt vào dữ liệu thi, phòng đấu, thống kê học và giới hạn AI. Các thao tác được phép thực hiện thông qua API server có xác minh Firebase ID Token. Trước khi thay Rules ở dự án đang có dữ liệu, hãy sao lưu và rà soát các quy tắc hiện hành.

## Các chức năng chính

- **Đăng nhập Google và chào mừng:** màn hình riêng khi chưa đăng nhập và màn hình chào mừng ở lần vào đầu tiên trên thiết bị.
- **Tổng quan:** truy cập nhanh các không gian học tập và bảng xếp hạng giờ học tự nguyện.
- **Góc tập trung:** Pomodoro, xem PDF cục bộ, phát nhạc cục bộ và mở nhúng tài nguyên từ YouTube/Google Drive. Với Drive, quyền chia sẻ phải cho phép người dùng mở tệp.
- **Trợ lý AI:** mở bằng nút nổi ở góc dưới màn hình. Lịch sử hội thoại chỉ giữ trong phiên giao diện hiện tại; API xác thực người dùng và giới hạn lượt gọi.
- **PWA:** có thể cài ứng dụng từ trình duyệt tương thích. Khi ngoại tuyến, chỉ vỏ giao diện và tài nguyên đã cache có thể hoạt động; Firebase, AI và các API cần mạng.

## Kiểm thử và triển khai

- `npm test`: chạy unit tests.
- `npm run build`: build bản triển khai.
- Vercel: dùng framework Vite, build command `npm run build`, output directory `dist`.
- Sau khi đổi Firebase Rules hoặc biến môi trường, kiểm tra bằng một project staging trước khi áp dụng lên dữ liệu thật.

Dữ liệu tuyển sinh trong công cụ nguyện vọng là dữ liệu người dùng nhập để tham khảo, không phải bộ điểm chuẩn chính thức được cập nhật tự động. Thông tin AI tạo ra cần được đối chiếu lại với sách giáo khoa hoặc nguồn chính thức.

## Sổ tay khoa học — bảng tuần hoàn và máy vẽ đồ thị

Bảng tuần hoàn có dữ liệu dự phòng cho đủ 118 nguyên tố. Khi có internet, ứng dụng bổ sung cấu hình electron từ [StaticData periodic table](https://staticdata.dev/datasets/periodic-table/) và ảnh/nguồn ảnh từ [Periodic-Table-JSON](https://github.com/Bowserinator/Periodic-Table-JSON), kèm liên kết nguồn Wikipedia. Nếu dữ liệu hoặc ảnh ngoài không tải được, bảng và mô hình hạt nhân/electron minh hoạ vẫn hoạt động; ảnh thực tế có thể được mở qua liên kết nguồn.

Máy đồ thị vẽ nhiều biểu thức cùng lúc (mỗi dòng một hàm), nhân ẩn như `2x` hoặc `x(x-1)`, cho phép chỉnh giới hạn x/y, mẫu nhanh, phóng to/thu nhỏ, kéo đồ thị để pan, Ctrl+con lăn để zoom, bảng giá trị tham khảo và xuất PNG. Trình phân tích chỉ tính toán các hàm được cho phép, không thực thi JavaScript tuỳ ý.

Sau khi cài dependencies, kiểm tra bằng:

```bash
npm install
npm test
npm run build
```
