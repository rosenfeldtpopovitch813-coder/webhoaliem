import 'katex/dist/katex.min.css';
import './css/input.css';
import { AppStore } from './core/store.js';
import { AppClock } from './core/clock.js';
import { startRouter, resolveRoute, loadRouteView, navigate } from './core/router.js';
import { initializeTheme, THEMES, changeTheme } from './core/theme.js';
import { auth, firebaseReady, databaseReady, signInGoogle, signOutUser, detectInAppBrowser, describeAuthError } from './core/firebase.js';
import { startAuth } from './core/auth.js';
import { element, button } from './core/dom.js';
import { icon } from './core/icons.js';
import { mountPersistentMusicPlayer, subscribeMusic, toggleMusicPlay } from './core/music-player.js';
import {
  mountPersistentFocusWidget,
  subscribeFocus,
  togglePomodoro,
  toggleFocusPopupDisplay,
  formatTimerClock
} from './core/focus-session.js';
import { mountPersistentYouTubePlayer, subscribeYouTube, stopYouTubePlayer } from './core/youtube-player.js';
import { readActiveCountdownSummary } from './modules/home/index.js';
import { mountAIBot } from './modules/ai-bot.js';

const root = document.getElementById('app');

const NAV_GROUPS = [
  {
    label: 'HỌC & LUYỆN THI',
    items: [
      ['/', 'home', 'Tổng quan', ''],
      ['/exam', 'exam-room', 'Phòng thi OMR', ''],
      ['/arena', 'arena', 'Đấu trường', '']
    ]
  },
  {
    label: 'SOẠN ĐỀ & CÔNG CỤ',
    items: [
      ['/exam-paper', 'exam-paper', 'Soạn đề', 'Mới'],
      ['/whiteboard', 'whiteboard', 'Bảng vẽ Mực', ''],
      ['/experiments', 'flask', 'Thí nghiệm 3D', ''],
      ['/handbook', 'handbook', 'Sổ tay Hóa - Toán', '']
    ]
  },
  {
    label: 'CÁ NHÂN',
    items: [
      ['/focus', 'focus', 'Góc tập trung', ''],
      ['/admissions', 'admissions', 'Nguyện vọng ĐH', ''],
      ['/library', 'library', 'Thư viện học liệu', ''],
      ['/community', 'ai', 'Trợ lý AI', '']
    ]
  }
];

const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items);

let renderId = 0;
let frame;
let sidebarOpen = false;
const SIDEBAR_COLLAPSED_KEY = 'htvvm-sidebar-collapsed-v1';
const SIDEBAR_WIDTH_KEY = 'htvvm-sidebar-width-v1';
let sidebarCollapsed = (() => {
  try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'; } catch { return false; }
})();
let sidebarWidth = (() => {
  try {
    const v = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return Number.isFinite(v) && v >= 180 && v <= 340 ? Math.round(v) : 236;
  } catch { return 236; }
})();

function makeButton(text, className, handler) { return button(text, className, handler); }

function formatTodayVi() {
  try {
    return new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

function openQuickCommandModal() {
  if (AppStore.get('examLockdown')) return;
  const prevFocused = document.activeElement;
  const overlay = element('div', 'cmd-modal-backdrop');
  const dialog = element('section', 'cmd-modal-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Tìm nhanh công cụ');

  const closeCmd = () => {
    overlay.remove();
    if (prevFocused && typeof prevFocused.focus === 'function') prevFocused.focus();
  };

  const inputWrap = element('div', 'cmd-input-row');
  inputWrap.append(icon('search', 16));
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'cmd-search-input';
  searchInput.placeholder = 'Tìm nhanh công cụ (VD: Phòng thi, Soạn đề, Bảng tuần hoàn, Tập trung…)';
  const escHint = button('Esc', 'cmd-esc-pill', closeCmd);
  inputWrap.append(searchInput, escHint);

  const resultsBox = element('div', 'cmd-results-list');

  function renderHits(query = '') {
    resultsBox.replaceChildren();
    const q = query.trim().toLowerCase();
    const filtered = FLAT_NAV.filter(([, , label, badge]) =>
      !q || label.toLowerCase().includes(q) || badge.toLowerCase().includes(q)
    );
    if (!filtered.length) {
      resultsBox.append(element('p', 'cmd-empty', 'Không tìm thấy mục phù hợp.'));
      return;
    }
    filtered.forEach(([path, iconName, title, badge], idx) => {
      const row = button('', `cmd-hit-row${idx === 0 ? ' is-first' : ''}`, () => {
        closeCmd();
        navigate(path);
      });
      const ic = element('span', 'cmd-hit-icon');
      ic.append(icon(iconName, 17));
      row.append(ic, element('span', 'cmd-hit-title', title));
      if (badge) row.append(element('span', 'nav-badge', badge));
      resultsBox.append(row);
    });
  }

  searchInput.addEventListener('input', () => renderHits(searchInput.value));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeCmd();
    } else if (e.key === 'Enter') {
      const first = resultsBox.querySelector('.cmd-hit-row');
      if (first) {
        e.preventDefault();
        first.click();
      }
    }
  });

  renderHits('');
  dialog.append(inputWrap, resultsBox);
  overlay.append(dialog);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCmd(); });
  document.body.append(overlay);
  searchInput.focus();
}

function createShell() {
  root.replaceChildren();
  const shell = element('div', 'app-shell');
  shell.style.setProperty('--sidebar-w', `${sidebarWidth}px`);
  const sidebar = element('aside', 'sidebar'); sidebar.id = 'sidebar';
  const backdrop = element('div', 'sidebar-backdrop');
  backdrop.addEventListener('click', () => { sidebarOpen = false; updateSidebar(); });

  const brand = element('div', 'brand');
  const brandMark = element('span', 'brand-symbol');
  brandMark.append(icon('flask', 20));
  const collapsePinBtn = makeButton('', 'sidebar-collapse-pin', () => toggleSidebar(false));
  collapsePinBtn.append(icon('chevron-left', 15));
  collapsePinBtn.title = 'Thu gọn thanh điều hướng (Ctrl+B hoặc kéo mép phải)';
  collapsePinBtn.setAttribute('aria-label', 'Thu gọn thanh điều hướng');
  const brandCopy = element('div', 'brand-copy');
  brandCopy.append(element('strong', '', 'HTVVM Studio'));
  brand.append(brandMark, brandCopy, collapsePinBtn);

  // Quick Search Trigger (Ctrl + K)
  const searchBtn = button('', 'sidebar-search-trigger', () => openQuickCommandModal());
  const sLeft = element('span', 'sidebar-search-left');
  sLeft.append(icon('search', 14), element('span', '', 'Tìm nhanh...'));
  searchBtn.append(sLeft, element('kbd', 'sidebar-search-kbd', 'Ctrl K'));

  const links = element('nav', 'nav-list');
  const navAnchors = [];
  for (const group of NAV_GROUPS) {
    const groupWrap = element('div', 'nav-group');
    groupWrap.append(element('div', 'nav-section-label', group.label));
    for (const [path, iconName, title, badge] of group.items) {
      const link = element('a', 'nav-link');
      link.href = path;
      link.dataset.path = path;
      link.title = title;
      const glyphWrap = element('span', 'nav-glyph');
      glyphWrap.append(icon(iconName, 17));
      link.append(glyphWrap, element('span', 'nav-link-text', title));
      if (badge) link.append(element('span', 'nav-badge', badge));
      link.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        sidebarOpen = false;
        updateSidebar();
        navigate(path);
      });
      groupWrap.append(link);
      navAnchors.push(link);
    }
    links.append(groupWrap);
  }

  // Sidebar Footer: User Profile Summary + Settings Gear Popover (houses Theme, Sync Status, Install PWA, Firebase Diagnostics)
  const sideFooter = element('div', 'sidebar-bottom');
  const sideUserSlot = element('div', 'sidebar-user-slot');
  const settingsWrap = element('div', 'sidebar-settings-wrap');
  const settingsPopover = element('div', 'sidebar-settings-popover');
  settingsPopover.hidden = true;

  const select = element('select', 'theme-select');
  select.id = 'theme-select';
  select.setAttribute('aria-label', 'Chọn giao diện');
  Object.entries(THEMES).forEach(([key, label]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = label;
    select.append(option);
  });
  select.addEventListener('change', () => changeTheme(select.value));

  const status = element('span', 'server-status', 'Đang đồng bộ giờ');
  status.id = 'server-status';

  const installApp = makeButton('Cài ứng dụng về máy', 'install-app-btn', async () => {
    const promptEvent = window.__htvvmInstallPrompt;
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
    window.__htvvmInstallPrompt = null;
    installApp.hidden = true;
  });
  installApp.hidden = true;
  installApp.id = 'install-app-btn';

  const diagnosticsButton = makeButton('Chẩn đoán Firebase', 'firebase-diagnostics-btn', () => {
    settingsPopover.hidden = true;
    void runFirebaseDiagnostics();
  });

  const themeField = element('label', 'settings-field');
  themeField.append(element('span', 'settings-field-label', 'Giao diện (5 chủ đề)'), select);
  settingsPopover.append(themeField, status, installApp, diagnosticsButton);

  const gearBtn = button('', 'sidebar-gear-btn', (e) => {
    e.stopPropagation();
    settingsPopover.hidden = !settingsPopover.hidden;
    gearBtn.setAttribute('aria-expanded', String(!settingsPopover.hidden));
  });
  gearBtn.append(icon('settings', 16));
  gearBtn.title = 'Cài đặt giao diện & hệ thống';
  gearBtn.setAttribute('aria-label', 'Cài đặt giao diện & hệ thống');
  settingsWrap.append(gearBtn, settingsPopover);
  sideFooter.append(sideUserSlot, settingsWrap);

  document.addEventListener('click', (e) => {
    if (!settingsPopover.hidden && !settingsWrap.contains(e.target)) {
      settingsPopover.hidden = true;
      gearBtn.setAttribute('aria-expanded', 'false');
    }
  });

  const resizer = element('div', 'sidebar-resizer');
  resizer.title = 'Kéo sang trái để ẩn hoặc thay đổi độ rộng thanh điều hướng (Nhấp đúp để đặt lại)';
  resizer.addEventListener('dblclick', () => {
    sidebarWidth = 236;
    sidebarCollapsed = false;
    updateSidebar();
  });
  resizer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    resizer.setPointerCapture?.(e.pointerId);
    shell.classList.add('is-resizing-sidebar');
    const onMove = (ev) => {
      const x = ev.clientX;
      if (x < 120) {
        if (!sidebarCollapsed) {
          sidebarCollapsed = true;
          updateSidebar();
        }
      } else {
        sidebarCollapsed = false;
        sidebarWidth = Math.max(180, Math.min(340, Math.round(x)));
        shell.style.setProperty('--sidebar-w', `${sidebarWidth}px`);
        updateSidebar();
      }
    };
    const onUp = () => {
      shell.classList.remove('is-resizing-sidebar');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      updateSidebar();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  sidebar.append(brand, searchBtn, links, sideFooter, resizer);

  const expandEdgeBtn = makeButton('', 'sidebar-expand-edge', () => {
    sidebarCollapsed = false;
    sidebarOpen = true;
    updateSidebar();
  });
  expandEdgeBtn.append(icon('chevron-right', 15));
  expandEdgeBtn.title = 'Hiện thanh điều hướng (Ctrl+B)';
  expandEdgeBtn.setAttribute('aria-label', 'Hiện thanh điều hướng');

  const content = element('div', 'content-area');
  const topbar = element('header', 'topbar');
  const left = element('div', 'top-left');
  const toggleBtn = makeButton('', 'mobile-menu sidebar-toggle-btn', () => toggleSidebar(false));
  toggleBtn.append(icon('menu', 17));
  toggleBtn.title = 'Ẩn / hiện thanh điều hướng (Ctrl+B)';
  toggleBtn.setAttribute('aria-label', 'Mở thanh điều hướng');

  const titleStack = element('div', 'top-title-stack');
  const pageTitleEl = element('div', 'page-title', 'Không gian học tập');
  pageTitleEl.id = 'page-title';
  const dateSubEl = element('span', 'top-date-sub', formatTodayVi());
  titleStack.append(pageTitleEl, dateSubEl);
  left.append(toggleBtn, titleStack);

  // Topbar Right: Compact Countdown Pill + Unified Live Dock (Focus + Audio + YouTube + PiP) + Quick Theme + Account
  const right = element('div', 'top-right');

  const countdownPill = button('', 'topbar-countdown-pill', () => {
    try { sessionStorage.setItem('htvvm_open_countdown_drawer', '1'); } catch {}
    if (AppStore.get('route') === '/') {
      const dr = document.getElementById('home-countdown-drawer');
      if (dr) {
        dr.open = true;
        dr.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      navigate('/');
    }
  });
  countdownPill.title = 'Xem lịch đếm ngược kỳ thi';

  const liveDock = element('div', 'topbar-live-dock');
  const dockFocusBtn = button('', 'dock-segment is-focus', () => togglePomodoro());
  dockFocusBtn.title = 'Bắt đầu / Tạm dừng đồng hồ tập trung';
  const dockDot = element('span', 'dock-live-dot');
  const dockFocusText = element('span', 'dock-mono-text', 'Tập trung 25:00');
  dockFocusBtn.append(dockDot, dockFocusText);

  const dockAudioBtn = button('', 'dock-segment is-audio', () => toggleMusicPlay());
  dockAudioBtn.title = 'Phát / Tạm dừng nhạc học tập';
  dockAudioBtn.append(icon('music', 13), element('span', 'dock-audio-label', 'Lofi Study'));

  const dockYtBtn = button('', 'dock-segment is-yt', () => stopYouTubePlayer('user'));
  dockYtBtn.hidden = true;
  dockYtBtn.title = 'YouTube đang phát nền — Bấm để tắt YouTube';
  dockYtBtn.append(icon('video', 13), element('span', '', 'YouTube ✕'));

  const dockPipBtn = button('', 'dock-segment is-pip', () => { void toggleFocusPopupDisplay(); });
  dockPipBtn.title = 'Mở / Đóng cửa sổ nổi chạy nền (PiP)';
  dockPipBtn.append(icon('pip', 13), element('span', '', 'PiP'));

  liveDock.append(dockFocusBtn, dockAudioBtn, dockYtBtn, dockPipBtn);

  // Quick theme select mirrored in topbar on desktop for 1-click theme testing
  const topThemeSelect = element('select', 'theme-select topbar-theme-select');
  topThemeSelect.setAttribute('aria-label', 'Đổi nhanh giao diện');
  Object.entries(THEMES).forEach(([key, label]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    topThemeSelect.append(opt);
  });
  topThemeSelect.addEventListener('change', () => changeTheme(topThemeSelect.value));

  const account = element('div', 'account');
  account.id = 'account';
  right.append(countdownPill, liveDock, topThemeSelect, account);
  topbar.append(left, right);

  const notice = element('div', 'notice'); notice.id = 'notice'; notice.hidden = true;
  const main = element('main', 'main-content'); main.id = 'main-content';
  content.append(topbar, notice, main);
  shell.append(sidebar, expandEdgeBtn, backdrop, content);
  root.append(shell);

  frame = {
    shell, sidebar, backdrop, links, navAnchors, select, topThemeSelect,
    account, sideUserSlot, main, notice, status, installApp,
    toggleBtn, expandEdgeBtn, countdownPill, dockDot, dockFocusText, dockAudioBtn, dockYtBtn, dockPipBtn
  };
  updateSidebar();
  refreshTopCountdown();
}

function refreshTopCountdown() {
  if (!frame?.countdownPill) return;
  const summary = readActiveCountdownSummary();
  frame.countdownPill.textContent = summary ? summary.text : 'Đặt lịch kỳ thi';
}

let entryScreen = null;
function safeWelcomeSeen(uid) { try { return localStorage.getItem(`htvvm-welcome-seen:${uid}`) === '1'; } catch { return false; } }
function markWelcomeSeen(uid) { try { localStorage.setItem(`htvvm-welcome-seen:${uid}`, '1'); } catch {} }
function removeEntryScreen() { if (entryScreen) entryScreen.remove(); entryScreen = null; }
function drawEntryScreen() {
  removeEntryScreen();
  if (!firebaseReady) return;
  const { user, authLoading } = AppStore.getState();
  const screen = element('section', 'entry-screen');
  entryScreen = screen;
  if (authLoading) {
    const loading = element('div', 'entry-loading-card');
    loading.append(element('span', 'entry-logo', 'H'), element('h1', 'entry-title', 'Đang kiểm tra phiên đăng nhập'), element('p', 'entry-copy', 'Đang kết nối tới tài khoản Google của bạn…'));
    screen.append(loading);
  } else if (!user) {
    const layout = element('div', 'entry-layout');
    const intro = element('div', 'entry-intro');
    intro.append(element('span', 'entry-logo', 'H'), element('h1', 'entry-title', 'HTVVM Studio'), element('p', 'entry-copy', 'Soạn đề chuẩn in, tách & trộn đề Word/PDF, tổ chức thi trên phiếu OMR 2025 và ôn tập Hóa – Toán – Anh.'));
    const featureList = element('div', 'entry-feature-list');
    for (const [iconName, title, desc] of [['exam-room', 'Phòng thi OMR', 'Tách đôi đề PDF/Drive bên trái và phiếu tô chuẩn 2025 bên phải'], ['exam-paper', 'Soạn đề', 'Gõ trực tiếp trên trang, tách đề .docx/.pdf, công thức KaTeX và trộn mã đề'], ['focus', 'Góc tập trung', 'Đồng hồ Pomodoro, YouTube chạy nền xuyên tác vụ & cửa sổ nổi PiP']]) {
      const item = element('div', 'entry-feature'); const ic = element('span', ''); ic.append(icon(iconName, 18)); item.append(ic, element('div', '', ''));
      item.lastChild.append(element('strong', '', title), element('small', '', desc)); featureList.append(item);
    }
    intro.append(featureList);
    const login = element('div', 'entry-login-card');
    login.append(element('span', 'entry-google-mark', 'G'), element('h2', 'entry-login-title', 'Đăng nhập để bắt đầu'), element('p', 'entry-login-copy', 'Dùng tài khoản Google để đồng bộ hồ sơ và lưu tiến trình học tập của bạn.'));
    const inApp = detectInAppBrowser();
    if (inApp.isInApp) {
      const tip = element('div', 'entry-webview-tip');
      tip.append(
        element('strong', '', `Đang mở bằng ${inApp.name}`),
        element('p', '', inApp.isIOS
          ? 'Google thường chặn hoặc làm mất phiên đăng nhập trong ứng dụng. Hãy bấm ⋯ hoặc biểu tượng chia sẻ → Mở bằng Safari.'
          : 'Google thường chặn đăng nhập trong ứng dụng. Hãy bấm Mở bằng Chrome hoặc dấu ⋮ → Mở bằng trình duyệt.')
      );
      const actions = element('div', 'entry-webview-actions');
      if (inApp.isAndroid) {
        const scheme = location.protocol.replace(':', '') || 'https';
        const chromeLink = element('a', 'entry-webview-btn', 'Mở bằng Chrome');
        chromeLink.href = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=${scheme};package=com.android.chrome;end`;
        actions.append(chromeLink);
      }
      const copyBtn = makeButton('Sao chép liên kết', 'entry-webview-btn is-secondary', async () => {
        try {
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(location.href);
          copyBtn.textContent = 'Đã chép liên kết';
        } catch {
          copyBtn.textContent = 'Hãy chép trên thanh địa chỉ';
        }
      });
      actions.append(copyBtn);
      tip.append(actions);
      login.append(tip);
    }
    const authError = element('p', 'entry-auth-error', '');
    const resetLoginButton = () => {
      loginButton.disabled = false;
      loginButton.textContent = 'Tiếp tục với Google';
    };
    const redirectFallbackBtn = makeButton('Thử đăng nhập chuyển hướng', 'entry-redirect-fallback', async () => {
      redirectFallbackBtn.disabled = true;
      redirectFallbackBtn.textContent = 'Đang chuyển trang Google…';
      try { await signInGoogle({ preferRedirect: true }); }
      catch (error) {
        const message = describeAuthError(error);
        authError.textContent = message;
        AppStore.set('notice', `Không thể đăng nhập: ${message}`);
        redirectFallbackBtn.disabled = false;
        redirectFallbackBtn.textContent = 'Thử đăng nhập chuyển hướng';
      }
    });
    redirectFallbackBtn.hidden = true;
    const loginButton = makeButton('Tiếp tục với Google', 'entry-google-button', async () => {
      authError.textContent = '';
      loginButton.disabled = true; loginButton.textContent = 'Đang mở đăng nhập Google…';
      try { await signInGoogle(); }
      catch (error) {
        const message = describeAuthError(error);
        authError.textContent = message;
        AppStore.set('notice', `Không thể đăng nhập: ${message}`);
        resetLoginButton();
        if (!inApp.isInApp && error?.code !== 'auth/popup-closed-by-user') redirectFallbackBtn.hidden = false;
      }
    });
    login.append(loginButton, redirectFallbackBtn, authError, element('p', 'entry-privacy-note', 'Thông tin xác thực được xử lý qua Firebase Authentication.'));
    layout.append(intro, login); screen.append(layout);
  } else if (!safeWelcomeSeen(user.uid)) {
    const cleanFirstName = String(user.displayName || '').trim().split(/\s+/).filter(Boolean).slice(-1)[0] || 'bạn';
    const card = element('div', 'entry-welcome-card');
    card.append(
      element('span', 'entry-logo', 'H'),
      element('h1', 'entry-title', `Chào ${cleanFirstName}`),
      element('p', 'entry-copy', 'Tài khoản đã đồng bộ. Bạn có thể vào ngay không gian học tập để làm đề OMR, tách đề Word/PDF hoặc bật Pomodoro.')
    );
    const enter = makeButton('Mở không gian học tập', 'entry-google-button', () => { markWelcomeSeen(user.uid); removeEntryScreen(); });
    card.append(enter); screen.append(card);
  } else {
    entryScreen = null;
    return;
  }
  root.append(screen);
}

async function runFirebaseDiagnostics() {
  const prevFocused = document.activeElement;
  const overlay = element('div', 'firebase-diagnostic-backdrop');
  const dialog = element('section', 'firebase-diagnostic-dialog');
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'firebase-diagnostic-title'); dialog.tabIndex = -1;
  const closeDiag = () => {
    overlay.remove();
    if (prevFocused && typeof prevFocused.focus === 'function') prevFocused.focus();
  };
  const heading = element('div', 'firebase-diagnostic-heading');
  const h2 = element('h2', '', 'Chẩn đoán Firebase');
  h2.id = 'firebase-diagnostic-title';
  heading.append(h2, makeButton('Đóng', 'firebase-diagnostic-close', closeDiag));
  const summary = element('p', 'firebase-diagnostic-summary', 'Đang kiểm tra cấu hình phía máy chủ…');
  const results = element('div', 'firebase-diagnostic-results');
  const steps = element('ol', 'firebase-diagnostic-steps');
  dialog.append(heading, summary, results, steps); overlay.append(dialog);
  overlay.addEventListener('click', event => { if (event.target === overlay) closeDiag(); });
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') closeDiag(); });
  root.append(overlay); dialog.focus();
  try {
    const token = auth?.currentUser ? await auth.currentUser.getIdToken().catch(() => '') : '';
    if (!token) {
      summary.textContent = 'Cần đăng nhập Google để chạy chẩn đoán Firebase.';
      summary.classList.remove('is-ok');
      results.append(element('p', 'firebase-diagnostic-hint', 'API chẩn đoán chỉ cho phép tài khoản đã đăng nhập (và quản trị viên khi đã cấu hình ADMIN_EMAILS).'));
      return;
    }
    const response = await fetch('/api/diagnostics/firebase', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      summary.textContent = data.error || 'Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.';
      return;
    }
    if (response.status === 403) {
      summary.textContent = data.error || 'Chỉ quản trị viên mới có quyền chạy chẩn đoán hệ thống.';
      results.append(element('p', 'firebase-diagnostic-hint', 'Quản trị viên có thể thêm email của mình vào biến môi trường ADMIN_EMAILS trên Vercel.'));
      return;
    }
    if (response.status === 429) {
      summary.textContent = data.error || 'Bạn gọi chẩn đoán quá nhiều lần. Vui lòng thử lại sau.';
      return;
    }
    summary.textContent = data.ok ? 'Kết nối Realtime Database đã được xác minh.' : `Chẩn đoán chưa đạt. HTTP ${response.status}.`;
    summary.classList.toggle('is-ok', Boolean(data.ok));
    if (data.checks) {
      for (const [key, check] of Object.entries(data.checks)) {
        const line = element('div', `firebase-diagnostic-row ${(check?.ok === false) ? 'is-fail' : 'is-ok'}`);
        const labelText = ({ databaseUrl: 'URL Realtime Database', adminCredentials: 'Thông tin xác thực Firebase Admin', projectIds: 'Project ID frontend/backend', databaseConnection: 'Kết nối Realtime Database', authenticationAdmin: 'Firebase Admin Authentication', frontend: 'Biến Firebase frontend' })[key] || key;
        line.append(element('strong', '', `${check?.ok === false ? '✕' : '✓'} ${labelText}`));
        const detail = Object.entries(check || {}).filter(([field]) => !['ok'].includes(field)).map(([field, value]) => `${field}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`).join(' · ');
        if (detail) line.append(element('small', '', detail));
        results.append(line);
      }
    }
    if (data.rootCauseHint) results.append(element('p', 'firebase-diagnostic-hint', data.rootCauseHint));
    for (const text of (data.nextSteps || [])) steps.append(element('li', '', text));
    if (!response.ok) AppStore.set('notice', 'Firebase cần được sửa cấu hình. Mở Cài đặt (⚙) → Chẩn đoán Firebase để xem biến còn thiếu.');
  } catch (error) {
    summary.textContent = `Không gọi được API chẩn đoán: ${error.message || 'Lỗi mạng'}`;
    results.append(element('p', 'firebase-diagnostic-hint', 'Kiểm tra deployment có chứa api/diagnostics/firebase.js không.'));
  }
}

function toggleSidebar(fromKeyboard = false) {
  if (fromKeyboard && frame?.shell) {
    frame.shell.classList.add('is-keyboard-toggle');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => frame?.shell?.classList.remove('is-keyboard-toggle'));
    });
  }
  if (window.matchMedia('(max-width: 780px)').matches) {
    sidebarOpen = !sidebarOpen;
  } else {
    sidebarCollapsed = !sidebarCollapsed;
  }
  updateSidebar();
}

function updateSidebar() {
  if (!frame) return;
  frame.sidebar.classList.toggle('open', sidebarOpen);
  frame.sidebar.classList.toggle('is-collapsed', sidebarCollapsed);
  if (frame.shell) {
    frame.shell.classList.toggle('sidebar-collapsed', sidebarCollapsed);
    frame.shell.style.setProperty('--sidebar-w', `${sidebarWidth}px`);
  }
  if (frame.backdrop) frame.backdrop.classList.toggle('open', sidebarOpen);
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  } catch {}
}

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
    const key = e.key.toLowerCase();
    if (key === 'k') {
      e.preventDefault();
      openQuickCommandModal();
      return;
    }
    if (key === 'b') {
      const target = e.target;
      if (target && typeof target.closest === 'function' && target.closest('input, textarea, select, [contenteditable="true"]')) {
        return;
      }
      e.preventDefault();
      toggleSidebar(true);
    }
  }
});

function buildAvatarNode(user) {
  if (user?.photoURL?.startsWith('https://')) {
    const avatar = document.createElement('img');
    avatar.src = user.photoURL;
    avatar.alt = '';
    avatar.referrerPolicy = 'no-referrer';
    return avatar;
  }
  const initial = String(user?.displayName || 'H').trim().slice(0, 1).toUpperCase() || 'H';
  return element('span', 'avatar-fallback', initial);
}

function drawAccount() {
  const { user, authLoading } = AppStore.getState();
  frame.account.replaceChildren();
  frame.sideUserSlot.replaceChildren();

  if (authLoading) {
    frame.account.append(element('span', 'account-loading', 'Đang xác thực…'));
    frame.sideUserSlot.append(element('span', 'sidebar-user-guest', 'Đang kết nối…'));
    return;
  }
  if (!firebaseReady) {
    frame.account.append(element('span', 'setup-pill', 'Chế độ xem thử'));
    frame.sideUserSlot.append(element('span', 'sidebar-user-guest', 'Khách · Xem thử'));
    return;
  }
  if (!user) {
    frame.account.append(makeButton('Đăng nhập', 'login-btn', async () => {
      try { await signInGoogle(); } catch (error) { AppStore.set('notice', `Không thể đăng nhập: ${describeAuthError(error)}`); }
    }));
    frame.sideUserSlot.append(element('span', 'sidebar-user-guest', 'Chưa đăng nhập'));
    return;
  }

  const fullName = user.displayName || 'Người học';
  // Sidebar profile row
  const sideProfile = element('div', 'sidebar-user-profile');
  sideProfile.title = `${fullName} (${user.email || 'Google'})`;
  sideProfile.append(
    buildAvatarNode(user),
    element('strong', 'sidebar-user-name', fullName)
  );
  frame.sideUserSlot.append(sideProfile);

  // Topbar compact account + logout
  const badge = element('div', 'user-chip');
  badge.title = `${fullName} (${user.email || 'Tài khoản Google'})`;
  badge.append(buildAvatarNode(user));
  const texts = element('div', 'user-meta');
  texts.append(element('strong', '', fullName));
  badge.append(texts);

  frame.account.append(badge, makeButton('Thoát', 'logout-btn', () => {
    if (AppStore.get('examLockdown')) {
      AppStore.set('notice', 'Không thể đăng xuất khi đang làm bài thi. Hãy nộp bài trước.');
      return;
    }
    signOutUser().catch((error) => AppStore.set('notice', error.message));
  }));
}

async function drawRoute() {
  const state = AppStore.getState();
  const route = resolveRoute(state.route);
  if (state.examLockdown && route.path === '/exam' && frame.main.querySelector('.exam-runner-shell')) {
    return;
  }
  const id = ++renderId;
  document.getElementById('page-title').textContent = route.path === '/' ? 'Không gian học tập' : route.title;
  for (const link of frame.navAnchors) {
    const active = link.dataset.path === route.path;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  }
  frame.main.replaceChildren(element('div', 'route-loading', 'Đang mở không gian…'));
  try {
    const view = await loadRouteView(route);
    if (id === renderId) frame.main.replaceChildren(view);
  } catch (error) {
    console.error('Route failed:', error);
    if (id === renderId) {
      const problem = element('section', 'route-error-panel');
      problem.append(element('h2', '', `Không mở được ${route.title.toLowerCase()}`));
      problem.append(element('p', '', 'Hãy tải lại trang bằng Ctrl + F5 để cập nhật mã nguồn. Nếu lỗi vẫn còn, mở phần Chi tiết kỹ thuật bên dưới để biết nguyên nhân.'));
      const details = document.createElement('details'); details.className = 'route-error-details';
      details.append(element('summary', '', 'Chi tiết kỹ thuật'));
      details.append(element('code', '', `${error?.name || 'Error'}: ${error?.message || String(error)}`));
      problem.append(details);
      frame.main.replaceChildren(problem);
    }
  }
}

function updateNotice() {
  const message = AppStore.get('notice');
  frame.notice.hidden = !message;
  frame.notice.textContent = message;
}
function setSyncBadge() {
  frame.status.textContent = AppClock.isSynced ? 'Giờ máy chủ đã đồng bộ' : 'Giờ máy chủ chưa đồng bộ';
  frame.status.classList.toggle('synced', AppClock.isSynced);
}
async function syncClock() { await AppClock.syncWithServer(); AppStore.set('timeSynced', AppClock.isSynced); setSyncBadge(); }

initializeTheme();
createShell();
mountAIBot();
mountPersistentMusicPlayer();
mountPersistentFocusWidget();
mountPersistentYouTubePlayer();
startRouter();
startAuth();

const syncSelects = (val) => {
  if (frame?.select) frame.select.value = val;
  if (frame?.topThemeSelect) frame.topThemeSelect.value = val;
};
syncSelects(AppStore.get('theme'));
AppStore.subscribe('theme', syncSelects);

// Wire Topbar Live Dock to Focus, Music & YouTube states
subscribeFocus((fState) => {
  if (!frame || !fState) return;
  frame.dockDot.classList.toggle('is-running', Boolean(fState.running || fState.counting));
  frame.dockFocusText.textContent = `${fState.selectedMode === 'break' ? 'Nghỉ' : 'Tập trung'} ${formatTimerClock(fState.seconds)}`;
  frame.dockPipBtn.classList.toggle('is-active', Boolean(fState.popupOpen));
});

subscribeMusic((mState) => {
  if (!frame || !mState) return;
  frame.dockAudioBtn.classList.toggle('is-active', Boolean(mState.playing));
  const lbl = frame.dockAudioBtn.querySelector('.dock-audio-label');
  if (lbl) lbl.textContent = mState.playing ? (mState.title || 'Đang phát').slice(0, 16) : 'Lofi Study';
});

subscribeYouTube((ytState) => {
  if (!frame || !ytState) return;
  frame.dockYtBtn.hidden = !ytState.active;
  frame.dockYtBtn.classList.toggle('is-active', Boolean(ytState.active));
});

window.setInterval(refreshTopCountdown, 1000);
window.addEventListener('htvvm-events-updated', refreshTopCountdown);

AppStore.subscribe('route', drawRoute);
AppStore.subscribe('role', drawRoute);
AppStore.subscribe('roleVerified', drawRoute);
AppStore.subscribe('user', drawAccount);
AppStore.subscribe('role', drawAccount);
AppStore.subscribe('roleVerified', drawAccount);
AppStore.subscribe('authLoading', drawAccount);
AppStore.subscribe('user', drawEntryScreen);
AppStore.subscribe('authLoading', drawEntryScreen);
AppStore.subscribe('notice', updateNotice);
if (!firebaseReady) AppStore.set('notice', 'Chế độ xem thử: thêm các biến VITE_FIREBASE_* để bật đăng nhập.');
else if (!databaseReady) AppStore.set('notice', 'Chưa cấu hình URL Realtime Database hợp lệ. Mở Cài đặt (⚙) → Chẩn đoán Firebase để xem chi tiết.');
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); window.__htvvmInstallPrompt = event; if (frame?.installApp) frame.installApp.hidden = false; });
window.addEventListener('appinstalled', () => { window.__htvvmInstallPrompt = null; if (frame?.installApp) frame.installApp.hidden = true; });
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('PWA worker registration failed:', error));
drawAccount(); drawEntryScreen(); drawRoute(); syncClock();
window.addEventListener('pageshow', syncClock);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncClock(); });
