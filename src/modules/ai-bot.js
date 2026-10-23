import { element, button } from '../core/dom.js';
import { auth } from '../core/firebase.js';
import { AppStore } from '../core/store.js';

const makeMessage = (role, text) => {
  const line = element('div', `ai-chat-message ${role}`);
  line.append(element('div', 'ai-chat-bubble', text));
  return line;
};

export function mountAIBot() {
  if (document.getElementById('ai-chat-launcher')) return;
  const launcher = button('✦', 'ai-chat-launcher', () => toggle());
  launcher.id = 'ai-chat-launcher';
  launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Mở trợ lý AI');
  launcher.title = 'Trợ lý AI';

  const panel = element('section', 'ai-chat-window');
  panel.id = 'ai-chat-window';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Trợ lý AI');
  const header = element('header', 'ai-chat-header');
  const heading = element('div', 'ai-chat-heading');
  heading.append(element('strong', '', 'Trợ lý học tập'), element('span', '', 'Hóa học · Toán · ôn thi'));
  const headerActions = element('div', 'ai-chat-header-actions');
  const clearBtn = button('Xóa chat', 'ai-chat-small-button', () => { messages = []; history.replaceChildren(); history.append(makeMessage('assistant', 'Đã xóa cuộc trò chuyện. Bạn muốn học gì tiếp theo?')); });
  const closeBtn = button('×', 'ai-chat-close', () => toggle(false));
  closeBtn.setAttribute('aria-label', 'Đóng trợ lý AI');
  headerActions.append(clearBtn, closeBtn); header.append(heading, headerActions);

  const history = element('div', 'ai-chat-history');
  history.setAttribute('aria-live', 'polite');
  history.append(makeMessage('assistant', 'Xin chào! Gửi câu hỏi hoặc yêu cầu giải thích từng bước. Hãy đăng nhập Google để bắt đầu trò chuyện.'));
  const form = element('form', 'ai-chat-form');
  const input = document.createElement('textarea');
  input.className = 'ai-chat-input'; input.rows = 2; input.maxLength = 8000;
  input.placeholder = 'Nhập câu hỏi…'; input.setAttribute('aria-label', 'Tin nhắn gửi trợ lý AI');
  const send = button('Gửi ↑', 'ai-chat-send', () => {}); send.type = 'submit';
  form.append(input, send);
  const foot = element('p', 'ai-chat-footnote', 'AI có thể sai. Kiểm tra lại dữ kiện và phép tính quan trọng.');
  panel.append(header, history, form, foot);
  document.body.append(launcher, panel);

  let messages = [];
  let busy = false;
  let sessionUid = auth?.currentUser?.uid || null;
  AppStore.subscribe('user', (user) => {
    const nextUid = user?.uid || null;
    if (nextUid === sessionUid) return;
    sessionUid = nextUid; messages = [];
    history.replaceChildren(makeMessage('assistant', nextUid ? 'Bạn đã đăng nhập. Hãy gửi câu hỏi đầu tiên.' : 'Bạn đã đăng xuất. Đăng nhập Google để tiếp tục trò chuyện.'));
  });
  function toggle(force) {
    const open = typeof force === 'boolean' ? force : panel.hidden;
    panel.hidden = !open;
    launcher.classList.toggle('is-open', open);
    launcher.textContent = open ? '×' : '✦';
    if (open) input.focus();
  }
  function add(role, text) {
    const safeText = String(text || '').trim();
    history.append(makeMessage(role, safeText));
    history.scrollTop = history.scrollHeight;
    return safeText;
  }
  async function sendMessage(event) {
    event.preventDefault();
    const question = input.value.trim();
    if (!question || busy) return;
    const user = auth?.currentUser;
    if (!user) { add('assistant', 'Bạn cần đăng nhập Google để sử dụng trợ lý AI.'); return; }
    input.value = '';
    add('user', question);
    const past = messages.slice(-12);
    messages.push({ role: 'user', text: question });
    busy = true; send.disabled = true; send.textContent = '…';
    const thinking = makeMessage('assistant', '');
    thinking.firstChild.textContent = 'Đang suy nghĩ…'; thinking.classList.add('is-thinking'); history.append(thinking); history.scrollTop = history.scrollHeight;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history: past }),
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Không thể gọi AI (${response.status}).`);
      thinking.remove();
      add('assistant', data.answer || 'AI chưa trả về nội dung.');
      messages.push({ role: 'assistant', text: String(data.answer || '').slice(0, 16000) });
      if (messages.length > 16) messages = messages.slice(-16);
    } catch (error) {
      thinking.remove(); add('assistant', error.message || 'Không kết nối được AI.');
      messages.pop();
    } finally {
      busy = false; send.disabled = false; send.textContent = 'Gửi ↑'; input.focus();
    }
  }
  form.addEventListener('submit', sendMessage);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
  });
}
