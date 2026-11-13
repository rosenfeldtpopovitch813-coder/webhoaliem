import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import { getDatabase, ref, get, set, serverTimestamp } from 'firebase/database';

const env = import.meta.env;
export const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID
};
export const firebaseReady = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
function normalizeDatabaseUrl(value) {
  try { const url = new URL(String(value || '').trim()); return ['https:', 'http:'].includes(url.protocol) ? url.href.replace(/\/$/, '') : ''; }
  catch { return ''; }
}
export const normalizedDatabaseURL = normalizeDatabaseUrl(config.databaseURL);
export const databaseReady = Boolean(firebaseReady && normalizedDatabaseURL);
const appConfig = { apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId, appId: config.appId };
if (normalizedDatabaseURL) appConfig.databaseURL = normalizedDatabaseURL;
const app = firebaseReady ? (getApps().find(item => item.name === '[DEFAULT]') || initializeApp(appConfig)) : null;
function initFirebaseAuth(firebaseApp) {
  if (!firebaseApp) return null;
  try {
    return initializeAuth(firebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(firebaseApp);
  }
}
export const auth = initFirebaseAuth(app);
export const database = app && databaseReady ? getDatabase(app, normalizedDatabaseURL) : null;
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const REDIRECT_PENDING_KEY = 'htvvm-auth-redirect-pending';
const IN_APP_PATTERNS = [
  ['Zalo', /\bzalo/i],
  ['Messenger', /FBAN\/Messenger|MessengerForiOS|Orca-Android|\bMessenger\b/i],
  ['Facebook', /FBAN|FBAV|FB_IAB/i],
  ['Instagram', /Instagram/i],
  ['TikTok', /BytedanceWebview|musical_ly|\bTikTok\b/i],
  ['Line', /\bLine\//i],
  ['WebView Android', /;\s*wv\)/i],
];

export function detectInAppBrowser(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const ua = String(userAgent || '');
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  for (const [name, pattern] of IN_APP_PATTERNS) {
    if (pattern.test(ua)) return { isInApp: true, name, isAndroid, isIOS };
  }
  const isStandalone = typeof navigator !== 'undefined' && userAgent === navigator.userAgent && navigator.standalone === true;
  const isIOSWebView = !isStandalone && isIOS && /AppleWebKit/i.test(ua) && !/Safari\/|CriOS\/|FxiOS\/|EdgiOS\//i.test(ua);
  if (isIOSWebView) return { isInApp: true, name: 'trình duyệt trong ứng dụng', isAndroid, isIOS };
  return { isInApp: false, name: '', isAndroid, isIOS };
}

function markRedirectPending() {
  try { sessionStorage.setItem(REDIRECT_PENDING_KEY, String(Date.now())); } catch {}
}

export function consumeRedirectPending() {
  try {
    const raw = sessionStorage.getItem(REDIRECT_PENDING_KEY);
    if (!raw) return false;
    sessionStorage.removeItem(REDIRECT_PENDING_KEY);
    return Date.now() - Number(raw) < 10 * 60 * 1000;
  } catch {
    return false;
  }
}

export function describeAuthError(error) {
  const code = error?.code || '';
  const rawMessage = String(error?.message || '');
  if (/disallowed_useragent/i.test(rawMessage) || code === 'auth/operation-not-supported-in-this-environment') {
    return 'Trình duyệt trong ứng dụng (Zalo, Messenger, TikTok…) bị Google chặn đăng nhập. Hãy mở trang bằng Safari hoặc Chrome.';
  }
  switch (code) {
    case 'auth/popup-blocked':
      return 'Trình duyệt đã chặn cửa sổ đăng nhập. Đang chuyển sang đăng nhập toàn trang…';
    case 'auth/popup-closed-by-user':
      return 'Bạn đã đóng cửa sổ đăng nhập trước khi hoàn tất. Hãy bấm Đăng nhập lại.';
    case 'auth/cancelled-popup-request':
      return 'Yêu cầu đăng nhập trước đó đã bị huỷ. Vui lòng thử lại.';
    case 'auth/network-request-failed':
      return 'Lỗi kết nối mạng khi đăng nhập Google. Vui lòng kiểm tra Wi-Fi/4G và thử lại.';
    case 'auth/unauthorized-domain':
      return 'Tên miền hiện tại chưa được cấp quyền đăng nhập trên Firebase.';
    case 'auth/web-storage-unsupported':
      return 'Trình duyệt đang tắt cookie hoặc bộ nhớ cục bộ. Hãy bật cookie hoặc mở bằng Chrome/Safari.';
    case 'auth/user-disabled':
      return 'Tài khoản Google này hiện đang bị vô hiệu hoá.';
    default:
      return rawMessage || 'Không thể đăng nhập Google. Vui lòng thử mở bằng Chrome hoặc Safari.';
  }
}

export function observeAuth(callback) {
  if (!auth) { callback(null); return () => {}; }
  return onAuthStateChanged(auth, callback);
}
export async function signInGoogle({ preferRedirect = false } = {}) {
  if (!auth) throw new Error('Chưa cấu hình Firebase.');
  if (preferRedirect) {
    markRedirectPending();
    return signInWithRedirect(auth, provider, browserPopupRedirectResolver);
  }
  try {
    return await signInWithPopup(auth, provider, browserPopupRedirectResolver);
  } catch (error) {
    if (error?.code === 'auth/popup-blocked') {
      markRedirectPending();
      return signInWithRedirect(auth, provider, browserPopupRedirectResolver);
    }
    throw error;
  }
}
export async function settleRedirect() {
  if (!auth) return null;
  return getRedirectResult(auth, browserPopupRedirectResolver);
}
export function signOutUser() { if (!auth) return Promise.resolve(); return signOut(auth); }
export async function getUserTheme(uid) {
  if (!database) return null;
  const snap = await get(ref(database, `users/${uid}/preferences/theme`));
  return snap.exists() ? snap.val() : null;
}
export async function setUserTheme(uid, name) {
  if (!database || !uid) throw new Error('Chưa đăng nhập hoặc Firebase chưa được cấu hình.');
  return set(ref(database, `users/${uid}/preferences/theme`), name);
}
export async function upsertUserProfile(user) {
  if (!database || !user) return;
  const profileRef = ref(database, `users/${user.uid}/profile`);
  const snapshot = await get(profileRef);
  if (!snapshot.exists()) {
    await set(profileRef, { displayName: (user.displayName || 'Học sinh').slice(0, 80), photoURL: user.photoURL || '', updatedAt: serverTimestamp() });
  }
}
