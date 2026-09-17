# WEBHOALIEM — mã nguồn nâng cấp

Bản bàn giao ngày 16/09/2026. Bao gồm frontend, API Node.js, kiểm thử, CSS đã biên dịch và tài liệu. ZIP gốc được giữ nguyên. Đây là bản đã kiểm thử cục bộ, chưa triển khai và nghiệm thu trên Firebase thật.

## Chạy cục bộ

Yêu cầu Node.js 22 trở lên. Mở terminal tại thư mục chứa tệp này:

```sh
npm ci
```

Sao chép `.env.example` thành `.env.local`, điền thông tin Firebase Admin của môi trường thử nghiệm. Không đưa khóa bí mật vào frontend hoặc Git. Sau đó:

```sh
npm start
```

Mở http://127.0.0.1:3000. Cấu hình Firebase Auth cho domain thử nghiệm. Các API học/thi cần biến môi trường hợp lệ; mở HTML trực tiếp không thay thế được backend.

## Kiểm tra và chỉnh sửa

```sh
npm test
npm run check
npm run build:css
```

Kiểm thử trình duyệt tùy chọn cần Playwright: `npm install --no-save playwright`, `npx playwright install chromium`, rồi `npm run test:browser`. Có thể đặt `PLAYWRIGHT_MODULE` và `BROWSER_EXECUTABLE` để dùng bản đã cài. Bộ kiểm thử dùng dữ liệu giả lập cô lập, không chứng minh tích hợp Firebase thật.

## Deploy Vercel

`vercel.json`, `index.html`, `package.json`, `api/`, `js/` và `css/` phải cùng nằm ở **Root Directory** của Vercel. Gói `webhoaliem-vercel-ready.zip` đã đặt các tệp này ngay ở cấp đầu tiên.

1. Giải nén gói deploy và đẩy toàn bộ nội dung bên trong lên một repository; không tạo thêm một lớp thư mục cha.
2. Import repository vào Vercel, chọn Framework Preset là `Other`.
3. Để Root Directory là `./` nếu `index.html` nằm ở gốc repository. Nếu repository có thư mục cha `webhoaliem`, đặt Root Directory thành `webhoaliem`.
4. Output Directory đặt là `.` (hoặc để Vercel đọc từ `vercel.json`). Không đặt là `public`. Build Command và Install Command đã nằm trong `vercel.json`.
5. Thêm `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_DATABASE_URL` và khóa AI tùy chọn trong Project Settings → Environment Variables, rồi Redeploy.
6. Thêm domain Vercel vào Firebase Authentication → Settings → Authorized domains.

Sau deploy, `/` phải trả giao diện; `/api/time` phải trả JSON có `serverTime`. Nếu `/` vẫn báo `NOT_FOUND`, kiểm tra Deployment → Source để chắc rằng `index.html` và `vercel.json` thật sự nằm tại root mà Vercel đang dùng.

Xem hướng dẫn từng bước cho repository GitHub, Vercel và Firebase tại [`docs/VERCEL-ENVIRONMENT.md`](docs/VERCEL-ENVIRONMENT.md).

## Cấu trúc

- `index.html`, `scripts.js`, `style.css`: ứng dụng gốc đã chỉnh sửa.
- `js/`, `css/`: mô-đun học/thi, điều hướng, giao diện và thư viện client.
- `api/`, `lib/`: xác thực, chấm thi và ghi nhận thời gian ở backend.
- `tests/`: kiểm thử logic, cú pháp và trình duyệt.
- `database.rules.candidate.json`: rules đề xuất, cần đối chiếu rules thực tế trước khi áp dụng.
- `docs/UPGRADE-REPORT.md`: báo cáo bàn giao, kết quả và phạm vi chưa hoàn tất.
- `docs/DEPLOYMENT.md`: cấu hình, dữ liệu bổ sung, triển khai và rollback.
- `docs/FILES-CHANGED.md`: danh mục tệp đối chiếu bản gốc.

Không đóng gói `node_modules`; `npm ci` cài lại theo `package-lock.json`. Một số công cụ hóa học, video và xuất PDF vẫn cần thư viện CDN.
