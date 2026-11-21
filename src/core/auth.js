import { AppStore } from './store.js';
import { observeAuth, settleRedirect, upsertUserProfile, getUserTheme, consumeRedirectPending, describeAuthError, auth } from './firebase.js';
import { applyTheme } from './theme.js';

export function syncStudyStatsToStore(stats) {
  if (!stats || typeof stats !== 'object') return;
  const streak = Math.max(0, Math.floor(Number(stats.streak) || 0));
  const bestStreak = Math.max(Math.floor(Number(stats.bestStreak) || 0), streak);
  AppStore.set('studyStats', {
    totalSeconds: Math.max(0, Math.floor(Number(stats.totalSeconds) || 0)),
    todaySeconds: Math.max(0, Math.floor(Number(stats.todaySeconds) || 0)),
    streak,
    bestStreak,
    title: stats.title || '',
    sharing: Boolean(stats.sharing)
  });
}

async function syncDailyLoginCheckin(user) {
  if (!user?.uid) return;
  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/study-tracker', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (data?.stats) syncStudyStatsToStore(data.stats);
  } catch { /* non-blocking background stats sync */ }
}

function withTimeout(promise, ms, fallbackValue = null) {
  let timerId;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timerId)),
    new Promise((resolve) => {
      timerId = setTimeout(() => resolve(fallbackValue), ms);
    })
  ]);
}

let generation = 0;
export function startAuth() {
  let pendingRedirect = consumeRedirectPending();
  let redirectError = null;
  let settledOnce = false;
  const redirectSettlement = withTimeout(
    (auth?.authStateReady ? auth.authStateReady() : Promise.resolve())
      .then(() => settleRedirect())
      .catch((error) => {
        redirectError = error;
        AppStore.set('notice', describeAuthError(error));
        return null;
      }),
    3500,
    null
  );

  // Failsafe watchdog: if Chrome IndexedDB / Firebase Auth listener hangs > 4.5s, never lock user on loading screen.
  const bootWatchdog = setTimeout(() => {
    if (settledOnce) return;
    const fallbackUser = auth?.currentUser || null;
    AppStore.set('user', fallbackUser ? { uid: fallbackUser.uid, displayName: fallbackUser.displayName, photoURL: fallbackUser.photoURL, email: fallbackUser.email } : null);
    AppStore.set('role', 'user');
    AppStore.set('roleVerified', Boolean(fallbackUser));
    AppStore.set('authLoading', false);
  }, 4500);

  return observeAuth(async (user) => {
    settledOnce = true;
    clearTimeout(bootWatchdog);
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
        AppStore.set('roleVerified', true);
      } else {
        if (pendingRedirect && !redirectError) {
          AppStore.set('notice', 'Trình duyệt di động không giữ được phiên đăng nhập (thường do WebView Zalo/Messenger hoặc chặn cookie chéo trang). Hãy mở bằng Chrome hoặc Safari.');
        }
        pendingRedirect = false;
        AppStore.set('studyStats', null);
        AppStore.set('loginStreak', 0);
        AppStore.set('bestLoginStreak', 0);
        AppStore.set('authLoading', false);
        return;
      }
    }
    pendingRedirect = false;
    // Release the loading screen immediately once user identity is known; sync RTDB profile/theme non-blockingly.
    AppStore.set('authLoading', false);
    if (current === generation) void syncDailyLoginCheckin(user);
    void (async () => {
      try {
        await withTimeout(upsertUserProfile(user), 6000);
        const theme = await withTimeout(getUserTheme(user.uid), 6000, null);
        if (current === generation && theme) applyTheme(theme, { persist: false });
      } catch (error) {
        if (current === generation) AppStore.set('notice', `Không thể đồng bộ hồ sơ: ${error.message}`);
      }
    })();
  });
}
export async function refreshRole() {
  // Kept as a compatibility no-op for older UI code. Roles are not used to gate features.
  AppStore.set('role', 'user');
  AppStore.set('roleVerified', Boolean(auth?.currentUser));
}
