import { element, button } from '../../core/dom.js';

const E = element;
const safeHttpUrl = (value) => {
  try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; }
  catch { return ''; }
};

export function renderLibrary() {
  const root = E('div', 'library-page');
  const hero = E('section', 'hero library-hero');
  hero.append(E('div', 'eyebrow', 'HỌC LIỆU HTVVM'), E('h1', 'hero-title', 'Thư viện tài liệu'), E('p', 'hero-subtitle', 'Tài liệu được đồng bộ từ Google Sheets. Mở xem trước, đọc tài liệu hoặc tải xuống; thư mục chỉ có nút mở thư mục.'));
  const toolbar = E('div', 'library-toolbar');
  const search = document.createElement('input'); search.type = 'search'; search.className = 'exam-input'; search.placeholder = 'Tìm tên tài liệu, môn học hoặc mô tả…'; search.setAttribute('aria-label', 'Tìm tài liệu trong thư viện');
  const refresh = button('↻ Làm mới', 'exam-tab', loadItems);
  const count = E('span', 'library-count', 'Đang tải…');
  toolbar.append(search, count, refresh);
  const status = E('p', 'exam-message', 'Đang kết nối bảng học liệu…');
  const grid = E('div', 'library-grid');

  const modal = E('div', 'library-preview-backdrop'); modal.hidden = true;
  const dialog = E('section', 'library-preview-dialog'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-label', 'Xem trước học liệu'); dialog.tabIndex = -1;
  const modalHeader = E('div', 'library-preview-header'); const modalTitle = E('h2', '', 'Xem trước tài liệu');
  const modalClose = button('Đóng ✕', 'element-modal-close', closePreview); modalHeader.append(modalTitle, modalClose);
  const previewFrame = document.createElement('iframe'); previewFrame.className = 'library-preview-frame'; previewFrame.title = 'Khung xem trước học liệu'; previewFrame.referrerPolicy = 'strict-origin-when-cross-origin';
  const previewFallback = E('p', 'library-preview-fallback', 'Nếu không hiển thị được, hãy mở tài liệu ở tab mới.');
  const previewOpen = document.createElement('a'); previewOpen.className = 'focus-resource-open'; previewOpen.target = '_blank'; previewOpen.rel = 'noopener noreferrer'; previewOpen.textContent = 'Mở tài liệu ở tab mới ↗';
  dialog.append(modalHeader, previewFrame, previewFallback, previewOpen); modal.append(dialog); root.append(hero, toolbar, status, grid, modal);
  modal.addEventListener('click', event => { if (event.target === modal) closePreview(); });
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') closePreview(); });

  let items = [];
  let loading = false;
  function closePreview() { modal.hidden = true; previewFrame.removeAttribute('src'); }
  function showPreview(item) {
    const url = safeHttpUrl(item.previewUrl || item.viewUrl);
    const openUrl = safeHttpUrl(item.viewUrl);
    if (!url || !openUrl) { status.textContent = 'Link tài liệu không hợp lệ hoặc không dùng HTTPS.'; return; }
    modalTitle.textContent = item.name;
    previewFrame.src = url;
    previewOpen.href = openUrl;
    modal.hidden = false;
    dialog.focus();
  }

  function draw() {
    const query = search.value.trim().toLocaleLowerCase('vi');
    const visible = items.filter(item => `${item.name} ${item.description} ${item.subject} ${item.extension}`.toLocaleLowerCase('vi').includes(query));
    grid.replaceChildren();
    count.textContent = `${visible.length}/${items.length} mục`;
    if (!visible.length) { grid.append(E('p', 'exam-message', items.length ? 'Không có học liệu phù hợp từ khóa.' : 'Bảng tính chưa có tài liệu có liên kết.')); return; }
    for (const item of visible) {
      const card = E('article', 'library-card');
      const icon = E('div', `library-card-icon ${item.kind === 'folder' ? 'is-folder' : item.kind === 'video' ? 'is-video' : 'is-document'}`, item.kind === 'folder' ? '📁' : item.kind === 'video' ? '▶' : '▤');
      const name = E('h3', '', item.name);
      const typeText = item.kind === 'folder' ? 'Thư mục Google Drive' : item.kind === 'video' ? 'Video' : `${item.extension && item.extension !== 'com' ? item.extension.toUpperCase() : 'Tài liệu'}${item.subject ? ` · ${item.subject}` : ''}`;
      const meta = E('small', 'library-card-meta', typeText);
      const description = E('p', 'library-card-description', item.description || (item.kind === 'folder' ? 'Mở thư mục để xem các tài liệu bên trong.' : 'Tài liệu được lấy từ bảng học liệu công khai.'));
      const actions = E('div', 'library-card-actions');
      const url = safeHttpUrl(item.url);
      if (!url) { card.classList.add('is-invalid'); actions.append(E('span', 'library-disabled-note', 'Link không hợp lệ')); }
      else if (item.kind === 'folder') {
        // Folder rows deliberately expose only one action, as requested.
        const openFolder = button('Mở thư mục ↗', 'primary-btn', () => window.open(url, '_blank', 'noopener,noreferrer'));
        actions.append(openFolder);
      } else {
        actions.append(button('Xem trước', 'exam-tab', () => showPreview(item)));
        const open = document.createElement('a'); open.className = 'library-link-btn'; open.href = safeHttpUrl(item.viewUrl || item.url); open.target = '_blank'; open.rel = 'noopener noreferrer'; open.textContent = 'Xem tài liệu ↗'; actions.append(open);
        if (item.kind === 'document' && item.downloadUrl) {
          const downloadUrl = safeHttpUrl(item.downloadUrl);
          if (downloadUrl) { const download = document.createElement('a'); download.className = 'library-link-btn'; download.href = downloadUrl; download.target = '_blank'; download.rel = 'noopener noreferrer'; download.textContent = 'Tải xuống ↓'; download.setAttribute('download', ''); actions.append(download); }
        }
      }
      card.append(icon, name, meta, description, actions); grid.append(card);
    }
  }

  async function loadItems() {
    if (loading) return;
    loading = true; refresh.disabled = true; refresh.textContent = 'Đang tải…'; status.textContent = 'Đang đồng bộ danh sách từ Google Sheets…';
    try {
      const response = await fetch(`/api/library?refresh=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Không tải được thư viện (HTTP ${response.status}).`);
      if (!Array.isArray(data.items)) throw new Error('API thư viện trả về dữ liệu không hợp lệ.');
      items = data.items;
      status.textContent = `Đã tải ${items.length} mục từ Google Sheets${data.cached ? ' (bản lưu tạm)' : ''}.`;
      draw();
    } catch (error) {
      status.textContent = error.message || 'Không tải được thư viện.';
      grid.replaceChildren(E('p', 'library-load-error', `${status.textContent} Kiểm tra bảng tính đã Publish to web dạng CSV và triển khai API /api/library.`));
      count.textContent = 'Chưa tải được';
    } finally { loading = false; refresh.disabled = false; refresh.textContent = '↻ Làm mới'; }
  }
  search.addEventListener('input', draw);
  loadItems();
  return root;
}
