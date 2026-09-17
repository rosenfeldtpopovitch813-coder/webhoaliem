# Security

Không đưa service account hoặc khóa AI vào trình duyệt. Firebase web API key là cấu hình client, không thay thế Authentication và Database Rules.

Điểm thi chính thức và thời gian học mới được xử lý qua API có Firebase ID token. Điều này chỉ bảo vệ dữ liệu production khi Rules cũng chặn client ghi trực tiếp các trường tương ứng; xem `docs/DEPLOYMENT.md`.

`database.rules.candidate.json` là bản đề xuất chưa qua Emulator/live. Đấu trường còn sử dụng mô hình host đáng tin của source cũ, chưa phải hệ thống thi đấu chống gian lận hoàn chỉnh. Không coi việc ẩn nút/section là phân quyền.

Không có migration hoặc deployment lên Firebase thật được thực hiện trong lần nâng cấp này. Nếu phát hiện lỗ hổng, báo riêng cho người quản trị dự án và tránh đăng token, nội dung bài thi riêng tư hoặc thông tin học sinh trong issue công khai.
