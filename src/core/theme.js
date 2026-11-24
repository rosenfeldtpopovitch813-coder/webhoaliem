import { AppStore } from './store.js';
import { setUserTheme } from './firebase.js';
export const THEMES = Object.freeze({
  pine: 'Archival Pine (Mới)',
  clay: 'Clay & Pine',
  light: 'Sáng',
  aurora: 'Aurora',
  midnight: 'Midnight'
});
const THEME_COLORS = Object.freeze({
  pine: '#f6f5f1',
  clay: '#efe9e0',
  light: '#f1f5f9',
  aurora: '#0c1224',
  midnight: '#070712'
});
const STORAGE_KEY = 'htvvm-theme-v2';
export function normalizeTheme(value) { return Object.hasOwn(THEMES, value) ? value : 'pine'; }
export function applyTheme(name, { persist = true } = {}) {
  const theme = normalizeTheme(name);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[theme] || '#f6f5f1');
  }
  AppStore.set('theme', theme);
  if (persist && typeof localStorage !== 'undefined') {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* private mode */ }
  }
  return theme;
}
export function initializeTheme() {
  let theme = 'pine';
  try { theme = localStorage.getItem(STORAGE_KEY) || theme; } catch { /* private mode */ }
  return applyTheme(theme, { persist: false });
}
export async function changeTheme(name) {
  const theme = applyTheme(name);
  const uid = AppStore.get('user')?.uid;
  if (uid) {
    try { await setUserTheme(uid, theme); }
    catch { AppStore.set('notice', 'Đã đổi giao diện trên máy; chưa đồng bộ được lên tài khoản.'); }
  }
}
