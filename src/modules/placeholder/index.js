import { element, button } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
export function renderPlaceholder(route) {
  const wrap = element('section', 'empty-state');
  wrap.append(element('div', 'empty-orb', route.status === 403 ? '🔒' : route.status === 404 ? '⌕' : '✧'));
  wrap.append(element('h2', 'empty-title', route.title));
  wrap.append(element('p', 'empty-desc', route.status === 403 ? 'Khu vực này yêu cầu quyền được xác minh từ máy chủ. Bạn không thể tự đổi vai trò ở trình duyệt.' : route.status === 404 ? 'Đường dẫn không tồn tại.' : 'Khung điều hướng đã hoạt động. Chức năng của phân hệ này sẽ được triển khai trong giai đoạn tiếp theo.'));
  wrap.append(button('Về trang chủ', 'primary-btn', () => navigate('/')));
  return wrap;
}
