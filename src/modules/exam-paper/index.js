import { element, button } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { navigate } from '../../core/router.js';

export function renderExamPaperApp() {
  const wrap = element('section', 'standalone-suite-wrap');
  const bar = element('div', 'standalone-suite-bar');
  const info = element('span', 'standalone-suite-caption');
  info.append(icon('exam-paper', 15), document.createTextNode(' Khu Soạn đề thi khổ A4 độc lập — Tự động sang Trang 2, Trang 3… như Word, xuất .docx & PDF.'));
  const actions = element('div', 'standalone-suite-actions');

  const iframe = document.createElement('iframe');
  iframe.className = 'standalone-suite-iframe';
  iframe.src = '/focus-notes/index.html?app=exam';
  iframe.title = 'Trình soạn đề thi khổ A4';
  iframe.allow = 'clipboard-read; clipboard-write; fullscreen';
  iframe.allowFullscreen = true;

  const fullBtn = button('', 'focus-btn is-sm', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await iframe.requestFullscreen();
    } catch {
      window.open('/focus-notes/index.html?app=exam', '_blank', 'noopener,noreferrer');
    }
  });
  fullBtn.append(icon('maximize', 14), document.createTextNode(' Toàn màn hình'));
  const tabBtn = button('', 'focus-btn is-sm', () => {
    window.open('/focus-notes/index.html?app=exam', '_blank', 'noopener,noreferrer');
  });
  tabBtn.append(icon('external', 14), document.createTextNode(' Mở tab riêng'));

  actions.append(fullBtn, tabBtn);
  bar.append(info, actions);
  wrap.append(bar, iframe);

  const onMessage = event => {
    const payload = event?.data;
    if (!payload || payload.type !== 'HTVVM_EXAM_PAPER_EXPORT') return;
    try {
      localStorage.setItem('htvvm_pending_exam_paper', JSON.stringify({
        title: payload.title,
        questions: payload.questions,
        exportedAt: Date.now()
      }));
    } catch { /* ignore */ }
    navigate('/exam');
  };
  window.addEventListener('message', onMessage);

  const observer = new MutationObserver(() => {
    if (!wrap.isConnected) {
      window.removeEventListener('message', onMessage);
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('main-content') || document.body, { childList: true });

  return wrap;
}
