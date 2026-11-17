import { element, button } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { navigate } from '../../core/router.js';
import { auth } from '../../core/firebase.js';
import { AppStore } from '../../core/store.js';

const modules = [
  ['exam-paper', 'Soạn đề A4', 'Soạn đề nhiều trang A4 như Word, công thức Toán/Hóa, xuất .docx & PDF', '/exam-paper'],
  ['whiteboard', 'Bảng vẽ Mực', 'Bảng viết tay, dựng hình không gian, vẽ đồ thị và ghi chú lên PDF', '/whiteboard'],
  ['exam-room', 'Phòng thi trực tuyến', 'Đề bên trái, phiếu OMR bên phải, chấm điểm tự động', '/exam'],
  ['arena', 'Đấu trường học tập', 'Đối kháng theo vòng, ôn Tiếng Anh, Ai là Triệu Phú và Đấu trường 100', '/arena'],
  ['handbook', 'Sổ tay học tập', 'Bảng tuần hoàn, phổ IR và vẽ đồ thị hàm số', '/handbook'],
  ['focus', 'Góc tập trung', 'Đồng hồ Pomodoro, thống kê giờ học và nhạc tập trung', '/focus'],
  ['library', 'Thư viện học liệu', 'Kho tài liệu, đề cương và bài giảng chọn lọc', '/library'],
  ['admissions', 'Nguyện vọng', 'So sánh tổ hợp và tính điểm xét tuyển đại học', '/admissions']
];
const fmt = seconds => `${Math.floor(seconds / 3600)} giờ ${Math.floor(seconds % 3600 / 60)} phút`;

export function renderHome() {
  const wrap = element('div', 'home-page');
  const hero = element('section', 'hero home-hero');
  hero.append(
    element('h2', 'hero-title', 'Luyện thi & Học tập trực tuyến'),
    element('p', 'hero-subtitle', 'Soạn đề A4, làm bài kiểm tra tính giờ, tra cứu bảng tuần hoàn, theo dõi giờ học và hỏi đáp bài tập.')
  );
  wrap.append(hero);

  const boardPanel = element('section', 'home-leaderboard-panel');
  const boardHeader = element('div', 'home-board-header');
  const boardTitle = element('div', 'home-board-title');
  const boardIcon = element('span', 'home-board-icon');
  boardIcon.append(icon('trophy', 22));
  boardTitle.append(boardIcon, element('div', '', ''));
  const boardSubtitle = element('p', 'home-board-subtitle', 'Tự nguyện chia sẻ giờ học và chuỗi đăng nhập liên tiếp.');
  boardTitle.lastChild.append(element('h3', 'section-heading', 'Bảng xếp hạng'), boardSubtitle);
  const refresh = button('Làm mới', 'focus-btn', () => loadBoard());
  boardHeader.append(boardTitle, refresh);

  const boardToolbar = element('div', 'home-board-toolbar');
  const boardTabs = element('div', 'home-board-tabs');
  let activeBoardTab = 'study'; // 'study' | 'login'
  const tabStudyBtn = button('Giờ tập trung', 'home-board-tab is-active', () => switchBoardTab('study'));
  const tabLoginBtn = button('', 'home-board-tab', () => switchBoardTab('login'));
  tabLoginBtn.append(icon('flame', 14), document.createTextNode(' Chuỗi đăng nhập'));
  boardTabs.append(tabStudyBtn, tabLoginBtn);

  const shareWrap = element('label', 'home-board-optin');
  const shareToggle = document.createElement('input');
  shareToggle.type = 'checkbox';
  shareWrap.append(shareToggle, document.createTextNode(' Hiện tôi trên BXH'));
  boardToolbar.append(boardTabs, shareWrap);

  const myStreakBanner = element('div', 'home-board-my-streak');
  myStreakBanner.hidden = true;
  const board = element('div', 'home-board-list');
  boardPanel.append(boardHeader, boardToolbar, myStreakBanner, board);

  let cachedBoardData = null;
  function switchBoardTab(nextTab) {
    activeBoardTab = nextTab;
    tabStudyBtn.classList.toggle('is-active', nextTab === 'study');
    tabLoginBtn.classList.toggle('is-active', nextTab === 'login');
    renderBoardRows();
  }

  let alive = true;
  const unsubscribeUser = AppStore.subscribe('user', () => { if (alive) { loadBoard(); loadExamProgress(); } });
  const unsubscribeStreak = AppStore.subscribe('loginStreak', () => { if (alive) loadBoard(); });
  const unsubscribeStats = AppStore.subscribe('studyStats', (stats) => { if (alive && stats) paintMyBanner(stats); });
  const watcher = new MutationObserver(() => {
    if (!wrap.isConnected) { alive = false; unsubscribeUser(); unsubscribeStreak(); unsubscribeStats(); watcher.disconnect(); }
  });
  watcher.observe(document.getElementById('main-content') || document.body, { childList: true });
  const examProgress = element('section', 'home-exam-stats-panel');
  const examProgressHeader = element('div', 'home-exam-stats-header');
  const examProgressTitle = element('div', '');
  examProgressTitle.append(element('h3', 'section-heading', 'Tiến trình luyện thi'), element('p', 'home-board-subtitle', 'Tổng hợp các lượt thi đã nộp trên máy chủ.'));
  const examOpen = button('Mở phòng thi', 'primary-btn', () => navigate('/exam'));
  examProgressHeader.append(examProgressTitle, examOpen);
  const examProgressBody = element('div', 'home-exam-stats-body');
  examProgress.append(examProgressHeader, examProgressBody);
  const dashboardGrid = element('div', 'home-dashboard-grid');
  dashboardGrid.append(examProgress, boardPanel);
  wrap.append(dashboardGrid, element('h3', 'section-heading', 'Không gian học tập'));

  const grid = element('div', 'module-grid');
  for (const [iconName, title, description, path] of modules) {
    const card = element('button', 'module-card'); card.type = 'button';
    const modIcon = element('span', 'module-icon');
    modIcon.append(icon(iconName, 22));
    card.append(modIcon, element('strong', 'module-title', title), element('span', 'module-description', description), element('span', 'module-link', 'Mở mục'));
    card.addEventListener('click', () => navigate(path)); grid.append(card);
  }
  wrap.append(grid);

  shareToggle.addEventListener('change', async () => {
    const user = auth?.currentUser;
    if (!user) {
      shareToggle.checked = false;
      return;
    }
    shareToggle.disabled = true;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/study-tracker', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sharing', enabled: shareToggle.checked }),
        cache: 'no-store'
      });
      if (res.ok) await loadBoard();
    } finally {
      if (alive) shareToggle.disabled = false;
    }
  });

  function renderBoardRows() {
    board.replaceChildren();
    if (!cachedBoardData) return;
    const list = activeBoardTab === 'login' ? (cachedBoardData.streakRows || []) : (cachedBoardData.rows || []);
    if (!list.length) {
      const emptyMsg = activeBoardTab === 'login'
        ? 'Chưa có thành viên bật chia sẻ chuỗi đăng nhập. Hãy tick "Hiện tôi trên BXH" để góp mặt!'
        : 'Chưa có người bật chia sẻ thời gian học. Bạn có thể bật chia sẻ tại đây hoặc trong Góc tập trung.';
      board.append(element('p', 'home-board-empty', emptyMsg));
      return;
    }
    list.slice(0, 10).forEach((row, index) => {
      const line = element('div', `home-board-row${index < 3 ? ` top-${index + 1}` : ''}`);
      const rank = element('span', 'home-board-rank', String(index + 1));
      const details = element('div', 'home-board-person');
      const subText = activeBoardTab === 'login'
        ? `Kỷ lục ${row.bestLoginStreak || row.loginStreak || 1} ngày · ${row.title || 'Đang học'}`
        : `${row.title || 'Đang học'}${row.streak ? ` · Chuỗi học ${row.streak} ngày` : ''}${row.loginStreak ? ` · Đăng nhập ${row.loginStreak} ngày` : ''}`;
      details.append(element('strong', '', row.name || 'Người học'), element('small', '', subText));
      const metric = activeBoardTab === 'login'
        ? `${row.loginStreak || 0} ngày`
        : fmt(Number(row.totalSeconds) || 0);
      line.append(rank, details, element('strong', 'home-board-time', metric));
      board.append(line);
    });
  }

  function paintMyBanner(my = {}) {
    if (!auth?.currentUser) {
      myStreakBanner.hidden = true;
      return;
    }
    const storeStats = AppStore.get('studyStats') || {};
    const streakNow = Math.max(Number(my.loginStreak) || 0, Number(storeStats.loginStreak) || 0, Number(AppStore.get('loginStreak')) || 0);
    const streakBest = Math.max(Number(my.bestLoginStreak) || 0, Number(storeStats.bestLoginStreak) || 0, streakNow);
    const studyStreak = Math.max(Number(my.streak) || 0, Number(storeStats.streak) || 0);
    const totalSec = Number.isFinite(Number(my.totalSeconds)) ? Number(my.totalSeconds) : (Number(storeStats.totalSeconds) || 0);
    const todaySec = Number.isFinite(Number(my.todaySeconds)) ? Number(my.todaySeconds) : (Number(storeStats.todaySeconds) || 0);
    myStreakBanner.hidden = false;
    myStreakBanner.replaceChildren(
      icon('flame', 15),
      element('span', '', 'Chuỗi đăng nhập: '),
      element('strong', '', `${streakNow} ngày liên tiếp`),
      element('small', '', `(Kỷ lục ${streakBest} ngày · Chuỗi học ${studyStreak} ngày · Hôm nay ${fmt(todaySec)} · Tổng ${fmt(totalSec)})`)
    );
  }

  async function loadBoard() {
    if (!alive) return;
    refresh.disabled = true; refresh.textContent = 'Đang tải…';
    board.replaceChildren(element('p', 'focus-muted', 'Đang tải bảng xếp hạng…'));
    try {
      const user = auth?.currentUser;
      if (!user) {
        cachedBoardData = null;
        myStreakBanner.hidden = true;
        shareToggle.checked = false;
        shareToggle.disabled = true;
        board.replaceChildren(element('p', 'home-board-empty', 'Đăng nhập Google để theo dõi chuỗi đăng nhập liên tiếp và xem bảng xếp hạng.'));
        return;
      }
      shareToggle.disabled = false;
      const token = await user.getIdToken();
      const response = await fetch('/api/leaderboards', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!alive) return;
      if (!response.ok) throw new Error(data.error || 'Không tải được bảng xếp hạng.');
      cachedBoardData = data;
      const my = data.myStats || {};
      shareToggle.checked = Boolean(my.sharing);
      paintMyBanner(my);
      renderBoardRows();
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
