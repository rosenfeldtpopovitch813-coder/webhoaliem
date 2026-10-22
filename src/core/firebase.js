import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from 'firebase/auth';
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
export const databaseReady = Boolean(firebaseReady && config.databaseURL);
const appConfig = { ...config };
if (!appConfig.databaseURL) delete appConfig.databaseURL;
const app = firebaseReady ? (getApps()[0] || initializeApp(appConfig)) : null;
export const auth = app ? getAuth(app) : null;
export const database = app && databaseReady ? getDatabase(app, config.databaseURL) : null;
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export function observeAuth(callback) {
  if (!auth) { callback(null); return () => {}; }
  return onAuthStateChanged(auth, callback);
}
export async function signInGoogle() {
  if (!auth) throw new Error('Chưa cấu hình Firebase.');
  if (window.matchMedia('(max-width: 700px)').matches) return signInWithRedirect(auth, provider);
  try { return await signInWithPopup(auth, provider); }
  catch (error) {
    if (error.code === 'auth/popup-blocked') return signInWithRedirect(auth, provider);
    throw error;
  }
}
export async function settleRedirect() {
  if (!auth) return;
  return getRedirectResult(auth);
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
