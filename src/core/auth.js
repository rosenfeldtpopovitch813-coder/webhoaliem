import { AppStore } from './store.js';
import { observeAuth, settleRedirect, upsertUserProfile, auth } from './firebase.js';
import { getUserTheme } from './firebase.js';
import { applyTheme } from './theme.js';

let generation = 0;
export function startAuth() {
  settleRedirect().catch((error) => AppStore.set('notice', `Đăng nhập: ${error.code || error.message}`));
  return observeAuth(async (user) => {
    const current = ++generation;
    AppStore.set('authLoading', true);
    AppStore.set('user', user ? { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL, email: user.email } : null);
    AppStore.set('role', 'student');
    AppStore.set('roleVerified', false);
    if (!user) { AppStore.set('authLoading', false); return; }
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/auth-token', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error(`Không xác minh được quyền (${response.status})`);
      const identity = await response.json();
      if (current !== generation) return;
      if (identity.uid !== user.uid) throw new Error('Thông tin đăng nhập không khớp');
      AppStore.set('role', identity.role);
      AppStore.set('roleVerified', true);
    } catch (error) {
      if (current === generation) AppStore.set('notice', `Tài khoản đang ở chế độ hạn chế: ${error.message}`);
    }
    if (current !== generation) return;
    try {
      await upsertUserProfile(user);
      const theme = await getUserTheme(user.uid);
      if (current === generation && theme) applyTheme(theme, { persist: false });
    } catch (error) {
      if (current === generation) AppStore.set('notice', `Không thể đồng bộ hồ sơ: ${error.message}`);
    } finally {
      if (current === generation) AppStore.set('authLoading', false);
    }
  });
}
export async function refreshRole() {
  const user = auth?.currentUser;
  if (!user) return;
  const token = await user.getIdToken(true);
  const response = await fetch('/api/auth-token', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) throw new Error('Xác minh vai trò thất bại');
  const data = await response.json();
  AppStore.set('role', data.role);
  AppStore.set('roleVerified', true);
}
