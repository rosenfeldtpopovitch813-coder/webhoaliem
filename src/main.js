import './css/input.css';
import { AppStore } from './core/store.js';
import { AppClock } from './core/clock.js';
import { startRouter, ROUTES, resolveRoute, loadRouteView, navigate } from './core/router.js';
import { initializeTheme, THEMES, changeTheme } from './core/theme.js';
import { firebaseReady, signInGoogle, signOutUser } from './core/firebase.js';
import { startAuth } from './core/auth.js';
import { element, button } from './core/dom.js';

const root = document.getElementById('app');
const nav = [ ['/', '⌂', 'Tổng quan'], ['/exam', '▤', 'Phòng thi'], ['/arena', 'ϟ', 'Chem Arena'], ['/chemmaker', '◈', 'ChemMaker'], ['/handbook', '▦', 'Sổ tay'], ['/focus', '◷', 'Góc tập trung'], ['/community', '☷', 'Cộng đồng & AI'], ['/admissions', '⌁', 'Nguyện vọng'], ['/admin', '⚙', 'Quản trị'] ];
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
  brand.lastChild.append(element('strong', '', 'HTVVM'), element('span', '', 'STUDIO V2'));
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
  sideFooter.append(element('span', 'phase-dot'), element('span', '', 'Phase 7 · Admissions, AI & PWA'));
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
  right.append(status, installApp, select, account); topbar.append(left, right);
  const notice = element('div', 'notice'); notice.id = 'notice'; notice.hidden = true;
  const main = element('main', 'main-content'); main.id = 'main-content';
  content.append(topbar, notice, main); shell.append(sidebar, content); root.append(shell);
  frame = { sidebar, links, select, account, main, notice, status, installApp };
}
function updateSidebar() { frame.sidebar.classList.toggle('open', sidebarOpen); }
function drawAccount() {
  const { user, role, roleVerified, authLoading } = AppStore.getState();
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
  const texts = element('div', 'user-meta'); texts.append(element('strong', '', user.displayName || 'Người học'), element('small', '', roleVerified ? ({ student: 'Học sinh', teacher: 'Giáo viên', admin: 'Quản trị viên' }[role]) : 'Chưa xác minh quyền'));
  badge.append(texts);
  frame.account.append(badge, makeButton('Thoát', 'logout-btn', () => signOutUser().catch((error) => AppStore.set('notice', error.message))));
}
async function drawRoute() {
  const id = ++renderId;
  const state = AppStore.getState();
  const route = resolveRoute(state.route, state.role, state.roleVerified);
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
    if (id === renderId) frame.main.replaceChildren(element('p', 'error-text', 'Không tải được phân hệ. Hãy thử tải lại trang.'));
  }
}
function updateNotice() {
  const message = AppStore.get('notice');
  frame.notice.hidden = !message;
  frame.notice.textContent = message;
}
function setSyncBadge() { frame.status.textContent = AppClock.isSynced ? '● Giờ máy chủ đã đồng bộ' : '◌ Giờ máy chủ chưa đồng bộ'; frame.status.classList.toggle('synced', AppClock.isSynced); }
async function syncClock() { await AppClock.syncWithServer(); AppStore.set('timeSynced', AppClock.isSynced); setSyncBadge(); }

initializeTheme(); createShell(); startRouter(); startAuth();
frame.select.value = AppStore.get('theme');
AppStore.subscribe('theme', value => { frame.select.value = value; });
AppStore.subscribe('route', drawRoute);
AppStore.subscribe('role', drawRoute);
AppStore.subscribe('roleVerified', drawRoute);
AppStore.subscribe('user', drawAccount);
AppStore.subscribe('role', drawAccount);
AppStore.subscribe('roleVerified', drawAccount);
AppStore.subscribe('authLoading', drawAccount);
AppStore.subscribe('notice', updateNotice);
if (!firebaseReady) AppStore.set('notice', 'Chế độ xem thử: thêm biến môi trường VITE_FIREBASE_* để bật đăng nhập và đồng bộ Theme.');
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); window.__htvvmInstallPrompt = event; if (frame?.installApp) frame.installApp.hidden = false; });
window.addEventListener('appinstalled', () => { window.__htvvmInstallPrompt = null; if (frame?.installApp) frame.installApp.hidden = true; });
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('PWA worker registration failed:', error));
drawAccount(); drawRoute(); syncClock();
window.addEventListener('pageshow', syncClock);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncClock(); });
