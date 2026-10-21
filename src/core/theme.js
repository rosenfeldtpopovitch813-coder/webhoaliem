import { AppStore } from './store.js';
export const THEMES = Object.freeze({ aurora: 'Aurora', light: 'Sáng', midnight: 'Midnight' });
const STORAGE_KEY = 'htvvm-theme-v2';
export function normalizeTheme(value) { return Object.hasOwn(THEMES, value) ? value : 'aurora'; }
export function applyTheme(name, { persist = true } = {}) {
  const theme = normalizeTheme(name);
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
  AppStore.set('theme', theme);
  if (persist && typeof localStorage !== 'undefined') {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* private mode */ }
  }
  return theme;
}
export function initializeTheme() {
  let theme = 'aurora';
  try { theme = localStorage.getItem(STORAGE_KEY) || theme; } catch { /* private mode */ }
  return applyTheme(theme, { persist: false });
}
export async function changeTheme(name) {
  const theme = applyTheme(name);
  const uid = AppStore.get('user')?.uid;
  if (uid) {
    try { const { setUserTheme } = await import('./firebase.js'); await setUserTheme(uid, theme); }
    catch { AppStore.set('notice', 'Đã đổi giao diện trên máy; chưa đồng bộ được lên tài khoản.'); }
  }
}
