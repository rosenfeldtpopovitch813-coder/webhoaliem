import { element, button } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

export function renderWhiteboardApp() {
  const wrap = element('section', 'standalone-suite-wrap');
  const bar = element('div', 'standalone-suite-bar');
  const info = element('span', 'standalone-suite-caption');
  info.append(icon('whiteboard', 15), document.createTextNode(' Bảng vẽ Lớp học Mực độc lập — Viết tay mượt mà, dựng hình không gian 3D, vẽ đồ thị & viết lên PDF.'));
  const actions = element('div', 'standalone-suite-actions');

  const iframe = document.createElement('iframe');
  iframe.className = 'standalone-suite-iframe';
  iframe.src = '/focus-notes/index.html?app=board';
  iframe.title = 'Bảng vẽ Lớp học Mực';
  iframe.allow = 'clipboard-read; clipboard-write; fullscreen';
  iframe.allowFullscreen = true;

  const fullBtn = button('', 'focus-btn is-sm', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await iframe.requestFullscreen();
    } catch {
      window.open('/focus-notes/index.html?app=board', '_blank', 'noopener,noreferrer');
    }
  });
  fullBtn.append(icon('maximize', 14), document.createTextNode(' Toàn màn hình'));
  const tabBtn = button('', 'focus-btn is-sm', () => {
    window.open('/focus-notes/index.html?app=board', '_blank', 'noopener,noreferrer');
  });
  tabBtn.append(icon('external', 14), document.createTextNode(' Mở tab riêng'));

  actions.append(fullBtn, tabBtn);
  bar.append(info, actions);
  wrap.append(bar, iframe);
  return wrap;
}
