import { element, button } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { auth } from '../../core/firebase.js';
import { AppStore } from '../../core/store.js';

const modules = [
  ['✦', 'Khảo thí', 'Luyện thi, chấm điểm và sổ tay câu sai', '/exam'],
  ['⚡', 'Chem Arena', 'Đấu trường Hóa học cùng bạn học', '/arena'],
  ['◈', 'ChemMaker', 'Soạn đề thi và công thức Hóa học', '/chemmaker'],
  ['▦', 'Sổ tay học tập', 'Tra cứu kiến thức và vẽ đồ thị', '/handbook'],
  ['◷', 'Góc tập trung', 'Pomodoro, tài liệu và nhạc học', '/focus'],
  ['⌁', 'Nguyện vọng', 'So sánh tổ hợp và tính điểm xét tuyển', '/admissions']
];
const fmt = seconds => `${Math.floor(seconds / 3600)} giờ ${Math.floor(seconds % 3600 / 60)} phút`;

export function renderHome() {
  const wrap = element('div', 'home-page');
  const hero = element('section', 'hero home-hero');
  hero.append(
    element('div', 'eyebrow', 'KHÔNG GIAN HỌC TẬP'),
    element('h2', 'hero-title', 'Học tập theo cách của bạn.'),
    element('p', 'hero-subtitle', 'Một nơi để luyện thi, hệ thống kiến thức, tập trung và theo dõi hành trình học tập của bạn.')
  );
  wrap.append(hero);

  const boardPanel = element('section', 'home-leaderboard-panel');
  const boardHeader = element('div', 'home-board-header');
  const boardTitle = element('div', 'home-board-title');
  boardTitle.append(element('span', 'home-board-icon', '🏆'), element('div', '', ''));
  boardTitle.lastChild.append(element('h3', 'section-heading', 'Bảng xếp hạng'), element('p', 'home-board-subtitle', 'Xếp hạng thời gian học do người dùng tự nguyện chia sẻ.'));
  const refresh = button('Làm mới', 'focus-btn', () => loadBoard());
  boardHeader.append(boardTitle, refresh);
  const board = element('div', 'home-board-list');
  boardPanel.append(boardHeader, board);
  let alive = true;
  const unsubscribeUser = AppStore.subscribe('user', () => { if (alive) loadBoard(); });
  const watcher = new MutationObserver(() => { if (!wrap.isConnected) { alive = false; unsubscribeUser(); watcher.disconnect(); } });
  watcher.observe(document.getElementById('main-content') || document.body, { childList: true });
  const examProgress = element('section', 'home-exam-stats-panel');
  const examProgressHeader = element('div', 'home-exam-stats-header');
  const examProgressTitle = element('div', '');
  examProgressTitle.append(element('h3', 'section-heading', 'Tiến trình luyện thi'), element('p', 'home-board-subtitle', 'Tổng hợp các lượt thi đã nộp trên máy chủ.'));
  const examOpen = button('Mở phòng thi →', 'primary-btn', () => navigate('/exam'));
  examProgressHeader.append(examProgressTitle, examOpen);
  const examProgressBody = element('div', 'home-exam-stats-body');
  examProgress.append(examProgressHeader, examProgressBody);
  wrap.append(boardPanel, examProgress, element('h3', 'section-heading', 'Không gian học tập'));

  const grid = element('div', 'module-grid');
  for (const [glyph, title, description, path] of modules) {
    const card = element('button', 'module-card'); card.type = 'button';
    card.append(element('span', 'module-icon', glyph), element('strong', 'module-title', title), element('span', 'module-description', description), element('span', 'module-link', 'Khám phá →'));
    card.addEventListener('click', () => navigate(path)); grid.append(card);
  }
  wrap.append(grid);

  async function loadBoard() {
    if (!alive) return;
    refresh.disabled = true; refresh.textContent = 'Đang tải…';
    board.replaceChildren(element('p', 'focus-muted', 'Đang tải bảng xếp hạng…'));
    try {
      const user = auth?.currentUser;
      if (!user) {
        board.replaceChildren(element('p', 'home-board-empty', 'Đăng nhập Google để xem bảng xếp hạng. Chỉ người bật chia sẻ trong Góc tập trung mới xuất hiện tại đây.'));
        return;
      }
      const token = await user.getIdToken();
      const response = await fetch('/api/leaderboards', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!alive) return;
      if (!response.ok) throw new Error(data.error || 'Không tải được bảng xếp hạng.')
      board.replaceChildren();
      if (!data.rows?.length) {
        board.append(element('p', 'home-board-empty', 'Chưa có người bật chia sẻ thời gian học. Bạn có thể bật chia sẻ trong Góc tập trung.'));
        return;
      }
      data.rows.slice(0, 10).forEach((row, index) => {
        const line = element('div', `home-board-row${index < 3 ? ` top-${index + 1}` : ''}`);
        const rank = element('span', 'home-board-rank', index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : String(index + 1));
        const details = element('div', 'home-board-person');
        details.append(element('strong', '', row.name || 'Người học'), element('small', '', row.title || 'Đang học'));
        line.append(rank, details, element('strong', 'home-board-time', fmt(Number(row.totalSeconds) || 0)));
        board.append(line);
      });
    } catch (error) {
      if (alive) board.replaceChildren(element('p', 'home-board-empty', error.message || 'Không tải được bảng xếp hạng.'));
    } finally { if (alive) { refresh.disabled = false; refresh.textContent = 'Làm mới'; } }
  }
  async function loadExamProgress() {
    if (!alive) return;
    examProgressBody.replaceChildren(element('p', 'home-board-empty', 'Đang tải thống kê luyện thi…'));
    const user = auth?.currentUser;
    if (!user) {
      examProgressBody.replaceChildren(element('p', 'home-board-empty', 'Đăng nhập Google để lưu và xem lịch sử thi đồng bộ.'));
      return;
    }
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/exam?action=history', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!alive) return;
      if (!response.ok) throw new Error(data.error || 'Không tải được tiến trình luyện thi.');
      const stats = data.summary || {}, history = data.history || [];
      const cards = element('div', 'home-exam-stats-cards');
      for (const [label, value] of [['Lượt thi', stats.total ?? history.length], ['Điểm TB', `${Number(stats.averageScore || 0).toFixed(2)}/10`], ['Cao nhất', `${Number(stats.bestScore || 0).toFixed(2)}/10`]]) {
        const card = element('article', 'home-exam-stat'); card.append(element('small', '', label), element('strong', '', String(value))); cards.append(card);
      }
      examProgressBody.replaceChildren(cards);
      if (!history.length) examProgressBody.append(element('p', 'home-board-empty', 'Chưa có bài thi nào được nộp. Vào Phòng thi để bắt đầu.'));
      for (const record of history.slice(0, 3)) {
        const row = element('div', 'home-exam-recent');
        const info = element('div', 'home-exam-recent-info');
        info.append(element('strong', '', record.examTitle || record.examId), element('small', '', record.submittedAt ? new Date(record.submittedAt).toLocaleDateString('vi-VN') : ''));
        row.append(info, element('strong', 'home-exam-recent-score', `${Number(record.score || 0).toFixed(2)}/10`)); examProgressBody.append(row);
      }
    } catch (error) {
      if (alive) examProgressBody.replaceChildren(element('p', 'home-board-empty', error.message || 'Không tải được tiến trình luyện thi.'));
    }
  }
  loadBoard();
  loadExamProgress();
  return wrap;
}
