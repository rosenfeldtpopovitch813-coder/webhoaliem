import { AppStore } from './store.js';
import { observeAuth, settleRedirect, upsertUserProfile, getUserTheme, consumeRedirectPending, describeAuthError, auth } from './firebase.js';
import { applyTheme } from './theme.js';

let generation = 0;
export function startAuth() {
  let pendingRedirect = consumeRedirectPending();
  let redirectError = null;
  const redirectSettlement = (auth?.authStateReady ? auth.authStateReady() : Promise.resolve())
    .then(() => settleRedirect())
    .catch((error) => {
      redirectError = error;
      AppStore.set('notice', describeAuthError(error));
      return null;
    });
  return observeAuth(async (user) => {
    const current = ++generation;
    AppStore.set('authLoading', true);
    AppStore.set('user', user ? { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL, email: user.email } : null);
    // Current build deliberately has no admin/teacher/student UI split. Authentication only
    // confirms the user identity; server APIs still verify Firebase ID tokens individually.
    AppStore.set('role', 'user');
    AppStore.set('roleVerified', Boolean(user));
    if (!user) {
      const redirectResult = await redirectSettlement;
      if (current !== generation) return;
      const recoveredUser = redirectResult?.user || auth?.currentUser || null;
      if (recoveredUser) {
        pendingRedirect = false;
        user = recoveredUser;
        AppStore.set('user', { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL, email: user.email });
      } else {
        if (pendingRedirect && !redirectError) {
          AppStore.set('notice', 'Trình duyệt di động không giữ được phiên đăng nhập (thường do WebView Zalo/Messenger hoặc chặn cookie chéo trang). Hãy mở bằng Chrome hoặc Safari.');
        }
        pendingRedirect = false;
        AppStore.set('authLoading', false);
        return;
      }
    }
    pendingRedirect = false;
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
