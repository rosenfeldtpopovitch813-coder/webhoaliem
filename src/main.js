import 'katex/dist/katex.min.css';
import './css/input.css';
import { AppStore } from './core/store.js';
import { AppClock } from './core/clock.js';
import { startRouter, ROUTES, resolveRoute, loadRouteView, navigate } from './core/router.js';
import { initializeTheme, THEMES, changeTheme } from './core/theme.js';
import { firebaseReady, databaseReady, signInGoogle, signOutUser } from './core/firebase.js';
import { startAuth } from './core/auth.js';
import { element, button } from './core/dom.js';
import { mountAIBot } from './modules/ai-bot.js';

const root = document.getElementById('app');
const nav = [ ['/', '⌂', 'Tổng quan'], ['/exam', '▤', 'Phòng thi'], ['/arena', 'ϟ', 'Chem Arena'], ['/chemmaker', '◈', 'ChemMaker'], ['/handbook', '▦', 'Sổ tay'], ['/focus', '◷', 'Góc tập trung'], ['/library', '▧', 'Thư viện học liệu'], ['/admissions', '⌁', 'Nguyện vọng'] ];
let renderId = 0;
let frame;
let sidebarOpen = false;
function makeButton(text, className, handler) { return button(text, className, handler); }
function createShell() {
  root.replaceChildren();
  const shell = element('div', 'app-shell');
  const sidebar = element('aside', 'sidebar'); sidebar.id = 'sidebar';
  const brand = element('div', 'brand');
  brand.append(element('span', 'brand-symbol', 'H'), element('div', 'brand-copy'));
  brand.lastChild.append(element('strong', '', 'HTVVM'), element('span', '', 'STUDIO')); 
  const navLabel = element('div', 'nav-section-label', 'ĐIỀU HƯỚNG');
  const links = element('nav', 'nav-list');
  for (const [path, glyph, title] of nav) {
    const link = element('a', 'nav-link'); link.href = path; link.dataset.path = path;
    link.append(element('span', 'nav-glyph', glyph), element('span', '', title));
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); sidebarOpen = false; updateSidebar(); navigate(path);
    }); links.append(link);
  }
  const sideFooter = element('div', 'sidebar-bottom');
  sideFooter.append(element('span', 'brand-status-dot'), element('span', '', 'Không gian học tập')); 
  sidebar.append(brand, navLabel, links, sideFooter);
  const content = element('div', 'content-area');
  const topbar = element('header', 'topbar');
  const left = element('div', 'top-left');
  left.append(makeButton('☰', 'mobile-menu', () => { sidebarOpen = !sidebarOpen; updateSidebar(); }), element('div', 'page-title', 'Tổng quan'));
  left.lastChild.id = 'page-title';
  const right = element('div', 'top-right');
  const status = element('span', 'server-status', '◌ Đang đồng bộ giờ'); status.id = 'server-status';
  const select = element('select', 'theme-select'); select.id = 'theme-select'; select.setAttribute('aria-label', 'Chọn giao diện');
  Object.entries(THEMES).forEach(([key, label]) => { const option = document.createElement('option'); option.value = key; option.textContent = label; select.append(option); });
  select.addEventListener('change', () => changeTheme(select.value));
  const account = element('div', 'account'); account.id = 'account';
  const installApp = makeButton('Cài ứng dụng', 'install-app-btn', async () => {
    const promptEvent = window.__htvvmInstallPrompt;
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
    window.__htvvmInstallPrompt = null;
    installApp.hidden = true;
  });
  installApp.hidden = true; installApp.id = 'install-app-btn';
  const diagnosticsButton = makeButton('Chẩn đoán Firebase', 'firebase-diagnostics-btn', () => runFirebaseDiagnostics());
  right.append(status, diagnosticsButton, installApp, select, account); topbar.append(left, right);
  const notice = element('div', 'notice'); notice.id = 'notice'; notice.hidden = true;
  const main = element('main', 'main-content'); main.id = 'main-content';
  content.append(topbar, notice, main); shell.append(sidebar, content); root.append(shell);
  frame = { sidebar, links, select, account, main, notice, status, installApp };
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
    loading.append(element('span', 'entry-logo', 'H'), element('p', 'entry-eyebrow', 'HTVVM STUDIO'), element('h1', 'entry-title', 'Đang kiểm tra phiên đăng nhập'), element('p', 'entry-copy', 'Đang kết nối an toàn với không gian học tập…'));
    screen.append(loading);
  } else if (!user) {
    const layout = element('div', 'entry-layout');
    const intro = element('div', 'entry-intro');
    intro.append(element('span', 'entry-logo', 'H'), element('p', 'entry-eyebrow', 'HTVVM STUDIO'), element('h1', 'entry-title', 'Không gian học tập của bạn.'), element('p', 'entry-copy', 'Luyện thi, hệ thống kiến thức, tập trung và theo dõi tiến trình học trên một nền tảng duy nhất.'));
    const featureList = element('div', 'entry-feature-list');
    for (const [icon, title, desc] of [['▤','Phòng thi','Luyện tập và xem kết quả'],['◷','Góc tập trung','Pomodoro, tài liệu và âm nhạc'],['✦','Trợ lý AI','Hỏi đáp và giải thích từng bước']]) {
      const item = element('div', 'entry-feature'); item.append(element('span','',icon), element('div','', ''));
      item.lastChild.append(element('strong','',title), element('small','',desc)); featureList.append(item);
    }
    intro.append(featureList);
    const login = element('div', 'entry-login-card');
    login.append(element('span','entry-google-mark','G'), element('h2','entry-login-title','Đăng nhập để bắt đầu'), element('p','entry-login-copy','Dùng tài khoản Google để đồng bộ hồ sơ và lưu tiến trình học tập của bạn.'));
    const loginButton = makeButton('Tiếp tục với Google', 'entry-google-button', async () => {
      loginButton.disabled = true; loginButton.textContent = 'Đang chuyển đến Google…';
      try { await signInGoogle(); }
      catch (error) { const message = error.message || 'Không thể đăng nhập Google.'; authError.textContent = message; AppStore.set('notice', `Không thể đăng nhập: ${message}`); loginButton.disabled = false; loginButton.textContent = 'Tiếp tục với Google'; }
    });
    const authError = element('p', 'entry-auth-error', '');
    login.append(loginButton, authError, element('p','entry-privacy-note','Thông tin xác thực được xử lý qua Firebase Authentication.'));
    layout.append(intro, login); screen.append(layout);
  } else if (!safeWelcomeSeen(user.uid)) {
    const card = element('div', 'entry-welcome-card');
    card.append(element('span', 'entry-logo', 'H'), element('p', 'entry-eyebrow', 'SẴN SÀNG HỌC TẬP'), element('h1', 'entry-title', `Chào mừng${user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!`), element('p', 'entry-copy', 'Không gian học tập đã sẵn sàng. Chọn mục tiêu hôm nay và bắt đầu từ bước nhỏ nhất.'));
    const checklist = element('div', 'entry-welcome-points');
    checklist.append(element('span','','✓  Theo dõi thời gian học'), element('span','','✓  Lưu tài liệu và nhạc học'), element('span','','✓  Hỏi trợ lý AI bất cứ lúc nào'));
    const enter = makeButton('Vào không gian học tập →', 'entry-google-button', () => { markWelcomeSeen(user.uid); removeEntryScreen(); });
    card.append(checklist, enter); screen.append(card);
  } else {
    entryScreen = null;
    return;
  }
  root.append(screen);
}

async function runFirebaseDiagnostics() {
  const overlay = element('div', 'firebase-diagnostic-backdrop');
  const dialog = element('section', 'firebase-diagnostic-dialog');
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'firebase-diagnostic-title'); dialog.tabIndex = -1;
  const heading = element('div', 'firebase-diagnostic-heading');
  heading.append(element('h2', '', 'Chẩn đoán Firebase'), makeButton('Đóng', 'firebase-diagnostic-close', () => overlay.remove()));
  const summary = element('p', 'firebase-diagnostic-summary', 'Đang kiểm tra cấu hình phía máy chủ…');
  const results = element('div', 'firebase-diagnostic-results');
  const steps = element('ol', 'firebase-diagnostic-steps');
  dialog.append(heading, summary, results, steps); overlay.append(dialog);
  overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') overlay.remove(); });
  root.append(overlay); dialog.focus();
  try {
    const response = await fetch('/api/diagnostics/firebase', { cache: 'no-store' });
    const data = await response.json();
    summary.textContent = data.ok ? 'Kết nối Realtime Database đã được xác minh.' : `Chẩn đoán chưa đạt. HTTP ${response.status}.`;
    summary.classList.toggle('is-ok', Boolean(data.ok));
    if (data.checks) {
      for (const [key, check] of Object.entries(data.checks)) {
        const line = element('div', `firebase-diagnostic-row ${(check?.ok === false) ? 'is-fail' : 'is-ok'}`);
        const labelText = ({databaseUrl:'URL Realtime Database',adminCredentials:'Thông tin xác thực Firebase Admin',projectIds:'Project ID frontend/backend',databaseConnection:'Kết nối Realtime Database',authenticationAdmin:'Firebase Admin Authentication',frontend:'Biến Firebase frontend'})[key] || key;
        line.append(element('strong', '', `${check?.ok === false ? '✕' : '✓'} ${labelText}`));
        const detail = Object.entries(check || {}).filter(([field]) => !['ok'].includes(field)).map(([field, value]) => `${field}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`).join(' · ');
        if (detail) line.append(element('small', '', detail));
        results.append(line);
      }
    }
    if (data.rootCauseHint) results.append(element('p', 'firebase-diagnostic-hint', data.rootCauseHint));
    for (const text of (data.nextSteps || [])) steps.append(element('li', '', text));
    if (!response.ok) AppStore.set('notice', 'Firebase cần được sửa cấu hình. Mở “Chẩn đoán Firebase” để xem chính xác biến nào thiếu hoặc sai.');
  } catch (error) {
    summary.textContent = `Không gọi được API chẩn đoán: ${error.message || 'Lỗi mạng'}`;
    results.append(element('p', 'firebase-diagnostic-hint', 'Kiểm tra deployment có chứa api/diagnostics/firebase.js không; mở Vercel → Deployments → Functions Logs để xem lỗi serverless.'));
  }
}

function updateSidebar() { frame.sidebar.classList.toggle('open', sidebarOpen); }
function drawAccount() {
  const { user, authLoading } = AppStore.getState();
  frame.account.replaceChildren();
  if (authLoading) { frame.account.append(element('span', 'account-loading', 'Đang xác thực…')); return; }
  if (!firebaseReady) { frame.account.append(element('span', 'setup-pill', 'Chưa cấu hình Firebase')); return; }
  if (!user) {
    frame.account.append(makeButton('Đăng nhập Google', 'login-btn', async () => {
      try { await signInGoogle(); } catch (error) { AppStore.set('notice', `Không thể đăng nhập: ${error.message}`); }
    })); return;
  }
  const badge = element('div', 'user-chip');
  if (user.photoURL?.startsWith('https://')) {
    const avatar = document.createElement('img'); avatar.src = user.photoURL; avatar.alt = ''; avatar.referrerPolicy = 'no-referrer'; badge.append(avatar);
  } else { badge.append(element('span', 'avatar-fallback', (user.displayName || 'H').slice(0, 1).toUpperCase())); }
  const texts = element('div', 'user-meta'); texts.append(element('strong', '', user.displayName || 'Người học'), element('small', '', 'Tài khoản Google'));
  badge.append(texts);
  frame.account.append(badge, makeButton('Thoát', 'logout-btn', () => signOutUser().catch((error) => AppStore.set('notice', error.message))));
}
async function drawRoute() {
  const id = ++renderId;
  const state = AppStore.getState();
  const route = resolveRoute(state.route);
  document.getElementById('page-title').textContent = route.title;
  for (const link of frame.links.children) {
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
function setSyncBadge() { frame.status.textContent = AppClock.isSynced ? '● Giờ máy chủ đã đồng bộ' : '◌ Giờ máy chủ chưa đồng bộ'; frame.status.classList.toggle('synced', AppClock.isSynced); }
async function syncClock() { await AppClock.syncWithServer(); AppStore.set('timeSynced', AppClock.isSynced); setSyncBadge(); }

initializeTheme(); createShell(); mountAIBot(); startRouter(); startAuth();
frame.select.value = AppStore.get('theme');
AppStore.subscribe('theme', value => { frame.select.value = value; });
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
else if (!databaseReady) AppStore.set('notice', 'Chưa cấu hình URL Realtime Database hợp lệ. Bấm “Chẩn đoán Firebase” để xem biến còn thiếu hoặc URL sai.');
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); window.__htvvmInstallPrompt = event; if (frame?.installApp) frame.installApp.hidden = false; });
window.addEventListener('appinstalled', () => { window.__htvvmInstallPrompt = null; if (frame?.installApp) frame.installApp.hidden = true; });
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('PWA worker registration failed:', error));
drawAccount(); drawEntryScreen(); drawRoute(); syncClock();
window.addEventListener('pageshow', syncClock);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncClock(); });
