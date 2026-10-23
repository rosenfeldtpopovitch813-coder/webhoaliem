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


## Chẩn đoán lỗi Firebase: "Can't determine Firebase Database URL"

Nguyên nhân đã xác định trong mã nguồn trước đây: backend dùng `getDatabase(app, url)` theo chữ ký không đúng của Firebase Admin SDK. Ngoài ra, `adminAuth()` có thể khởi tạo app mặc định trước khi database URL được gắn vào app. Khi đó Auth có thể hoạt động nhưng thao tác Realtime Database báo không xác định được URL. Bản hiện tại chuyển `databaseURL` vào `initializeApp(...)` và gọi `getDatabase(app)` sau khi đã kiểm tra cấu hình.

1. Trong Firebase Console, mở **Build → Realtime Database → Data** và sao chép URL chính xác hiển thị ở đó. Không tự đoán URL theo tên project; một số database có vùng/miền khác.
2. Trong Vercel → **Project → Settings → Environment Variables**, đặt `FIREBASE_DATABASE_URL` bằng URL trên cho **Production** và **Preview**. Đặt `VITE_FIREBASE_DATABASE_URL` cùng URL để SDK phía trình duyệt dùng đúng database. Chọn cùng project với `VITE_FIREBASE_PROJECT_ID` và tài khoản dịch vụ Firebase Admin.
3. Cấu hình xác thực backend bằng `FIREBASE_SERVICE_ACCOUNT_JSON` hoặc đủ ba biến `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (có thể dùng Application Default Credentials ở môi trường hỗ trợ). Không đặt service account hoặc private key vào biến `VITE_`.
4. Sau khi đổi biến môi trường, **redeploy** Vercel để hàm server khởi tạo lại app với cấu hình mới.
5. Trên website, nhấn **Chẩn đoán Firebase** để xem mục nào thiếu/sai. Endpoint `GET /api/diagnostics/firebase` chỉ trả trạng thái cấu hình và lỗi tổng quát, không trả bí mật. Với đúng lỗi `Can't determine Firebase Database URL`, không cần mở Database Rules ra công khai: lỗi này xảy ra trước khi có đường dẫn DB hợp lệ. Nếu sau khi URL đã đúng xuất hiện lỗi quyền khác, mới kiểm tra xác thực/service account và chỉ sửa Rules khi đó là lỗi từ Firebase Client SDK.

## Các thay đổi trong phiên sửa này

- Loại bỏ kiểm soát giao diện theo các vai trò admin/giáo viên/học sinh khỏi luồng hiện tại; người dùng Google đã xác thực dùng vai trò chung. Tạo đề vẫn yêu cầu đăng nhập để gắn đề với tài khoản và tránh tài khoản ẩn danh. Nếu muốn thực sự cho cả khách chưa đăng nhập tạo/ghi đề dùng chung, cần bổ sung giới hạn chống spam/rate-limit ở máy chủ trước khi mở công khai.
- Mỗi nguyên tố trong Sổ tay mở popup/modal ở giữa màn hình; đóng bằng nút X, bấm nền ngoài hoặc phím Escape.
- Góc tập trung được chia thành hai khung cạnh nhau: YouTube và xem trước tài liệu (Google Drive/Docs/PDF), thay vì một khung link chung.
- Thêm mục **Thư viện học liệu** từ CSV đã cho. API `/api/library` lấy dữ liệu CSV khi chạy trên Vercel, chuẩn hoá các cột tên/tựa đề/môn/loại/link và nhận diện thư mục Google Drive. Tệp thường có xem trước, mở tài liệu và tải xuống; thư mục chỉ có nút **Mở thư mục**.
- CSV cần được xuất bản công khai và cột liên kết phải chứa URL thật (không chỉ hyperlink gắn vào ô không xuất hiện trong CSV). Các định dạng tiêu đề phổ biến tiếng Việt/Anh được tự nhận dạng; nếu tiêu đề của sheet dùng tên cột khác, hãy cập nhật alias trong `shared/library-csv.js`.

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


## Update: LaTeX exam authoring, PDF print, and Lớp học Mực

- In **Phòng thi → Tạo đề thi**, each question has a dedicated optional LaTeX field. Inline math also works in prompt/options using `$...$`, `\(...\)`, and display math using `$$...$$` or `\[...\]`.
- **Xuất PDF / In đề** opens a print-ready A4 view; choose **Save as PDF / Lưu dưới dạng PDF** in Chrome's print dialog. An optional answer-key page can be included.
- **Góc tập trung** now supports custom Pomodoro duration from 1 second to 240 minutes, stored locally in `localStorage`.
- The provided **Lớp học Mực 1.2.46** browser renderer is built as a second Vite page at `/focus-notes/` and embedded in Focus Zone. Boards and projects are stored in IndexedDB/localStorage in the same browser profile; they do not automatically sync to Firebase or across devices.
- `npm run build` builds the HTVVM app first, then builds the Lớp học Mực renderer into `dist/focus-notes`. Vercel rewrites and the service worker explicitly bypass this path to preserve its own HTML entry point and assets.
- Install dependencies using `npm install --no-audit --no-fund` before building. The source must be validated with `npm run build` on a networked build environment; the current editing sandbox timed out while installing dependencies, so production build success has not been confirmed here.
