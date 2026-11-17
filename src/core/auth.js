import { AppStore } from './store.js';
import { observeAuth, settleRedirect, upsertUserProfile, getUserTheme, consumeRedirectPending, describeAuthError, auth } from './firebase.js';
import { applyTheme } from './theme.js';
import { getVNDateString } from '../../shared/time-utils.js';

export function syncStudyStatsToStore(stats) {
  if (!stats || typeof stats !== 'object') return;
  const loginStreak = Math.max(0, Math.floor(Number(stats.loginStreak) || 0));
  const bestLoginStreak = Math.max(Math.floor(Number(stats.bestLoginStreak) || 0), loginStreak);
  AppStore.set('studyStats', {
    totalSeconds: Math.max(0, Math.floor(Number(stats.totalSeconds) || 0)),
    todaySeconds: Math.max(0, Math.floor(Number(stats.todaySeconds) || 0)),
    streak: Math.max(0, Math.floor(Number(stats.streak) || 0)),
    loginStreak,
    bestLoginStreak,
    title: stats.title || '',
    sharing: Boolean(stats.sharing)
  });
  AppStore.set('loginStreak', loginStreak);
  AppStore.set('bestLoginStreak', bestLoginStreak);
}

async function syncDailyLoginCheckin(user) {
  if (!user?.uid) return;
  const dayKey = getVNDateString();
  const cacheKey = `htvvm-login-checkin-v2:${user.uid}:${dayKey}`;
  let alreadyCheckedToday = false;
  try { alreadyCheckedToday = localStorage.getItem(cacheKey) === '1'; } catch {}
  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/study-tracker', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: alreadyCheckedToday ? 'status' : 'login-checkin' }),
      cache: 'no-store'
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (data?.stats) {
      syncStudyStatsToStore(data.stats);
      if ((Number(data.stats.loginStreak) || 0) >= 1) {
        try { localStorage.setItem(cacheKey, '1'); } catch {}
      }
    }
  } catch { /* non-blocking background streak sync */ }
}

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
        AppStore.set('studyStats', null);
        AppStore.set('loginStreak', 0);
        AppStore.set('bestLoginStreak', 0);
        AppStore.set('authLoading', false);
        return;
      }
    }
    pendingRedirect = false;
    try {
      await upsertUserProfile(user);
      const theme = await getUserTheme(user.uid);
      if (current === generation && theme) applyTheme(theme, { persist: false });
      if (current === generation) void syncDailyLoginCheckin(user);
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
