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
    // Current build deliberately has no admin/teacher/student UI split. Authentication only
    // confirms the user identity; server APIs still verify Firebase ID tokens individually.
    AppStore.set('role', 'user');
    AppStore.set('roleVerified', Boolean(user));
    if (!user) { AppStore.set('authLoading', false); return; }
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
  // Kept as a compatibility no-op for older UI code. Roles are not used to gate features.
  AppStore.set('role', 'user');
  AppStore.set('roleVerified', Boolean(auth?.currentUser));
}
