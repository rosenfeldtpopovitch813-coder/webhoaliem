# HTVVM Studio V2 · Source integrated through Phase 7

This source package layers the seven planned development phases on the Phase 1 project skeleton: Firebase Auth/RBAC, Exam Engine, Chem Arena, ChemMaker/Handbook, Focus Zone/Study Tracker, admissions calculator, AI Tutor API and PWA app shell. The package has unit tests, but the final Vite production build and live Firebase/Gemini integration still must be verified in an environment where npm dependencies and project credentials are available. Features that depend on current official university cutoff datasets or the community realtime feed are intentionally marked as incomplete rather than filled with invented data.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local`; set `VITE_FIREBASE_*` values from Firebase Console → Project settings → Your apps. **No service account secrets in `VITE_` values.**
3. Enable Firebase Authentication → Google provider; add your deployment domain to **Authorized domains**.
4. Create a Firebase Realtime Database and deploy `database.rules.json` as its Rules (review existing live data/rules first; replacing rules can deny access to earlier clients).
5. `npm run dev` starts the frontend on port 5173. To run the Vercel API locally, run `npx vercel dev` separately on port 3000 and configure `FIREBASE_SERVICE_ACCOUNT_JSON` or the backend credential variables for that service. Without the API, the role check fails closed (students cannot gain privileged routes).
6. `npm run check` runs tests and builds `dist`.

## Vercel

Import repository and use Vite framework, build command `npm run build`, output `dist`. Set `VITE_FIREBASE_*` in Vercel environment settings. Set **server-side only** `FIREBASE_SERVICE_ACCOUNT_JSON` (full JSON, not exposed to browser), or `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. Add the domain to Firebase Auth authorized domains. Use only HTTPS in production.

## Roles

`/api/auth-token` verifies the Firebase ID token and returns `student`, `teacher`, or `admin` from trusted custom claims `teacher === true` and `admin === true`. Role controls in the UI **are not database permissions**; future server endpoints must re-verify tokens and authorize every operation. Assign custom claims only from trusted Admin SDK operations, never a public client endpoint. Refresh the ID token or log in again after assigning a role.

## Security notes

- Exam answers, arena state and study statistics are blocked from direct Firebase Client reads/writes. Protected server APIs must use Firebase Admin SDK and verify ID tokens and role claims on each request.
- The clock offset helps render countdowns; the exam API independently enforces server-side deadlines.
- `users/{uid}/profile` has a limited schema; roles must not be stored here.
- Development preview works without Firebase configuration, but authentication/sync need real Firebase setup.
- There is no full Firebase Emulator or multi-user load test in this package. Validate rules with Firebase Emulator and test with a separate staging Firebase project before production.

## Phase 3 — Exam Engine (2026-10-21)

- `/exam`: danh sách đề, vào phòng bằng mã, Creator Studio dành cho tài khoản có custom claim `teacher`/`admin`, sổ tay câu sai.
- API `/api/exam`: `GET list/detail/mistakes/leaderboard`, `POST create/start/submit`. Mọi request cần `Authorization: Bearer <Firebase ID token>`.
- Mỗi đề chứa câu phần `I` (4 lựa chọn), `II` (4 nhận định đúng/sai), `III` (trả lời số). Có thể nhập từng câu hoặc dán mảng JSON vào Creator Studio. Đáp án được lưu tại `exams_private` chỉ Admin SDK đọc.
- Thang điểm: Phần I 0,25 điểm/câu; Phần II 0 / 0,1 / 0,25 / 0,5 / 1,0 điểm theo số ý đúng; Phần III 0,25 điểm/câu. Điểm chuẩn hóa về thang 10 nếu cơ cấu đề không đầy đủ. Khi tạo đủ 18 câu I, 4 câu II, 6 câu III tổng điểm gốc đúng 10. Đáp án trả lời ngắn là số thập phân (dấu `,` hoặc `.`).
- Không thể ghi/đọc dữ liệu thi qua Firebase Client SDK. **Cần triển khai `database.rules.json` lên Realtime Database** và cấu hình biến môi trường Server `FIREBASE_DATABASE_URL` + Firebase Admin credentials. Không dùng `VITE_` cho thông tin bí mật.
- **Giới hạn hiện tại:** tự nộp khi hết giờ chỉ hoạt động khi trang thi đang chạy; đóng trình duyệt/mất mạng lúc hết giờ không có job nền nộp bài. Server vẫn chặn nộp trễ (cho phép 30 giây truyền mạng) nên không thể tăng thời gian bằng chỉnh đồng hồ. Cần bổ sung lưu nháp định kỳ về Server và job kết thúc phiên ở bản hoàn thiện.
- **Chưa tích hợp:** đọc/nhập câu hỏi trực tiếp từ PDF, link PDF, QR, màn hình xem PDF đề, hệ thống chống gian lận nâng cao, danh sách giám thị/giáo viên quản lý từng phòng, rate limit phân tán, lưu nháp server, tự hoàn tất các phiên hết hạn kể cả khi người dùng offline. Không được nhầm phần này với hệ thống thi production.

### Example JSON nhập nhanh

```json
[
  {"part":"I","prompt":"Câu hỏi trắc nghiệm?","options":["Phương án A","Phương án B","Phương án C","Phương án D"],"answer":"B"},
  {"part":"II","prompt":"Xét các nhận định sau","options":["Nhận định a","Nhận định b","Nhận định c","Nhận định d"],"answer":[true,false,true,false]},
  {"part":"III","prompt":"Kết quả bằng bao nhiêu?","answer":"12,5"}
]
```

Chạy `npm test` để kiểm tra unit tests, `npm run build` để build, `npm run check` kiểm cả hai.

## Phase 4 — Chem Arena (PvP tối đa 8 người)

- `/arena`: tạo phòng 8 người, sửa kho câu hỏi mẫu (2–20 câu), chia sẻ mã, vào phòng và chơi đấu trường.
- API `/api/arena` yêu cầu Firebase ID Token; mọi thay đổi phòng (join, start, answer, leave) chạy bằng Realtime Database transaction và bảo đảm mỗi uid chỉ trả lời một lần mỗi vòng.
- 200 HP/người; sát thương 30–45 theo tốc độ trả lời trong 20 giây. Đánh đối thủ còn HP cao nhất. Host rời phòng chờ được chuyển quyền; khi đang chơi người rời phòng bị loại.
- API chỉ trả câu hỏi và đáp án lựa chọn, không gửi đáp án đúng tới client. Firebase Rules mới chặn hoàn toàn client đọc và ghi `arena_rooms`.
- Vào Firebase Console → Realtime Database → Rules, áp dụng `database.rules.json` **trước khi chạy**. API dùng `FIREBASE_DATABASE_URL` và Firebase Admin credentials từ `.env` trên Vercel.
- Khi mở đường dẫn `/arena` cần đăng nhập Google; chế độ local `npm run dev` cần proxy hoặc Vercel dev để chạy `/api/arena` (Vite không tự chạy Serverless Function). Nên thử trên Vercel Preview hoặc `vercel dev` sau khi cấu hình biến môi trường.
- `npm test`: chạy toàn bộ unit tests; `npm run build`: cần cài npm dependencies.

### Phạm vi và giới hạn

- Hiện dùng polling 1,5 giây qua API và transaction Realtime Database: trạng thái lưu Firebase realtime nhưng giao diện **chưa** kết nối qua Firebase onValue để push tức thì. Polling nhiều người có thể gây chi phí; nên tối ưu tiếp khi nâng cấp.
- Có thể nhập câu hỏi tùy ý và đổi độ khó/chuyên đề; chưa có ngân hàng câu hỏi lưu bền độc lập hoặc nhập CSV.
- Chưa áp dụng API-level distributed rate limit, CAPTCHA hoặc retention/cleanup phòng; cân nhắc trước khi đưa ra công khai.
- Phiên đấu phụ thuộc API truy cập; chưa hỗ trợ tự động loại người mất mạng sau timeout và chưa có cơ chế tái tạo phòng sau thời gian dài. Host rời trong phòng chờ bằng nút sẽ chuyển quyền.
- Mã phòng 8 ký tự là mã mời, không phải mật khẩu bí mật; chỉ thành viên đã vào được đọc trạng thái từ API. Chưa có chế độ phòng riêng có mật khẩu.

## Phase 5 — HTVVM ChemMaker & Handbook

- `/chemmaker` yêu cầu role `teacher` hoặc `admin` được Server xác nhận; bài soạn lưu **localStorage trên thiết bị đang dùng**, không phải Firebase và không đồng bộ qua các thiết bị.
- Soạn từng khối câu, ghi LaTeX/mhchem, upload PNG/JPEG/WebP (tối đa 1,2 MB), vẽ sơ đồ phân tử 2D cơ bản (chèn ảnh raster), in A4 bằng Print → Save as PDF, xuất/nhập JSON để sao lưu. Công cụ vẽ không diễn giải SMILES, không tự sinh liên kết hay kiểm tra hóa trị.
- Công thức toán/hóa sử dụng **MathJax CDN** khi có kết nối mạng. Mất mạng vẫn sửa nội dung và in văn bản được, nhưng công thức có thể chỉ hiện mã gốc. MathJax được gọi cho khối câu thay đổi sau debounce 250 ms, không quét toàn trang.
- `/handbook` công khai: tra nhanh nguyên tố Z=1–20, dải phổ IR tham khảo, đồ thị hàm số với bộ parser riêng **không dùng eval / Function**. Máy vẽ đồ thị ngắt đoạn theo heuristics, chưa phải CAS có chứng minh tiệm cận.
- Các tính năng PDF biên dịch chuyên nghiệp, toàn bộ 118 nguyên tố, tra obitan trực quan, phổ IR dạng đồ thị mẫu, xuất SVG cấu trúc phân tử, đồ thị co giãn/zoom và sổ tay đa môn **chưa hoàn thành**.
- Chạy `npm test` để kiểm thử và `npm run build` sau `npm install`. Việc chạy test **không thay thế** kiểm thử giao diện và Firebase trên trình duyệt thật.

## Phase 6 — Focus Zone và Study Tracker

- Route `/focus`: Pomodoro dùng `performance.now()`, chọn PDF và file nhạc **cục bộ** không upload, thống kê học tập, danh hiệu, streak, bảng xếp hạng tự nguyện.
- API `/api/study-tracker` yêu cầu Firebase ID Token, hỗ trợ `GET status`, `POST start`, `ping`, `stop`, `sharing`. Ghi nhận server-side, mỗi tài khoản chỉ có một phiên hợp lệ, transaction chống cộng chồng từ nhiều tab. Ping mỗi 15 giây; khoảng ngắt quá 35 giây không được cộng, do vậy mạng gián đoạn / trình duyệt ngủ có thể bị thiếu giờ. Chưa có xác minh người dùng thực sự đang học.
- API `/api/leaderboards` chỉ trả tên và tổng thời gian của tài khoản **chủ động bật chia sẻ**. Yêu cầu token đăng nhập.
- Firebase RTDB: triển khai lại `database.rules.json`; đảm bảo biến `FIREBASE_DATABASE_URL` và service account chỉ ở backend. Node tests: `npm test`; build: `npm install && npm run build`.
- Hạn chế: Phòng tự học chung và phát YouTube chưa có; chỉ phát nhạc từ máy. Thời gian tích lũy được cấp server-side, nhưng không phải bằng chứng chống gian lận tuyệt đối. Streak bắt đầu khi có phiên học được ghi nhận; danh hiệu tính theo tổng thời gian.


## Phase 7 — Admissions, AI Tutor & PWA

### Tư vấn nguyện vọng (`/admissions`)
- Ghép 12 tổ hợp mẫu từ 11 môn đầu vào; loại bỏ tổ hợp thiếu môn bằng bitmask và xếp theo điểm sau ưu tiên. Hỗ trợ dấu phẩy thập phân.
- Công thức ưu tiên được triển khai theo quy tắc trong đặc tả dự án: nếu tổng tổ hợp dưới 22,5 thì dùng điểm ưu tiên gốc; từ 22,5 trở lên thì `((30 - S) / 7.5) × ĐƯT_gốc`, làm tròn 2 chữ số. Hãy xác minh quy chế chính thức của đúng năm tuyển sinh trước khi dùng kết quả thực tế.
- Danh sách nguyện vọng do người dùng nhập trường/ngành/tổ hợp/điểm chuẩn tham khảo và lưu trên `localStorage` của trình duyệt. Công cụ không chứa dữ liệu điểm chuẩn chính thức và không dự báo chắc chắn việc trúng tuyển.
- `GET /api/admissions` trả danh mục tổ hợp; `POST /api/admissions` kiểm tra và tính điểm ở Server. Endpoint giới hạn tốc độ theo IP trong bộ nhớ tiến trình (best-effort, không phải limiter phân tán).

### AI Tutor (`/community`)
- Gửi câu hỏi văn bản hoặc ảnh JPG/PNG/WebP tối đa 2 MB qua `POST /api/ai-tutor`. Bắt buộc Firebase ID Token đã được xác minh.
- Khóa Gemini chỉ được đọc từ biến môi trường Server `GEMINI_API_KEY`; mặc định model `gemini-3.8-flash`, có thể đổi qua `GEMINI_MODEL`. Không thêm khóa AI vào biến `VITE_*` hoặc gửi xuống trình duyệt.
- Giới hạn quota lưu bằng Firebase Admin tại `server_rate_limits/{uid}/aiTutor`: tối đa 8 yêu cầu/10 phút và 35 yêu cầu/ngày theo UTC+7. Firebase Client bị chặn đọc/ghi node này.
- Tạo khóa API tại Google AI Studio và đặt `GEMINI_API_KEY` trong Project Settings → Environment Variables của Vercel (Production/Preview/Development tùy môi trường). Cài lại deploy sau khi thay đổi biến môi trường. Cấu hình cả `FIREBASE_DATABASE_URL` và Firebase Admin credentials cho rate limiting.
- Nội dung câu hỏi/ảnh được gửi tới nhà cung cấp AI để xử lý; không đưa thông tin cá nhân nhạy cảm vào câu hỏi.

### PWA / offline shell
- Có `public/manifest.webmanifest`, icon 192/512, `public/sw.js` và nút cài ứng dụng khi trình duyệt hỗ trợ. Service Worker cache app shell/tài nguyên tĩnh và fallback điều hướng về `index.html` khi offline. `/api/*` không bị cache.
- Offline chỉ hỗ trợ mở phần vỏ giao diện và các tài nguyên đã được cache; Firebase, chấm thi, AI và đồng bộ thời gian vẫn cần mạng.

### Kiểm thử và triển khai
- Chạy `npm test` để thực hiện unit tests. Chạy `npm run build` để kiểm tra bản build sau `npm install`.
- Triển khai `database.rules.json` lên Firebase Realtime Database trước khi bật AI quota. Cấu hình Firebase Web variables (`VITE_FIREBASE_*`), Server variables (`FIREBASE_DATABASE_URL`, Firebase Admin credentials) và `GEMINI_API_KEY` trên Vercel.
- Chưa có dữ liệu điểm chuẩn chính thức được tự động tải/cập nhật, chưa triển khai feed cộng đồng realtime/moderation, và chưa chạy kiểm thử tích hợp Gemini/Firebase trên project production.


### Official integration references
- Gemini API model list: https://ai.google.dev/gemini-api/docs/models
- Gemini Generate Content REST format: https://ai.google.dev/gemini-api/docs/generate-content/text-generation
- Vercel Functions runtime and environment variables: https://vercel.com/docs/functions/configuring-functions/runtime and https://vercel.com/docs/environment-variables
