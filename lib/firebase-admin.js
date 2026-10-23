import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

function readDatabaseUrl() {
  const raw = String(process.env.FIREBASE_DATABASE_URL || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    return url.href.replace(/\/$/, '');
  } catch {
    return '';
  }
}

function credentialForAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    let credentials;
    try { credentials = JSON.parse(raw); }
    catch {
      throw Object.assign(Error('FIREBASE_SERVICE_ACCOUNT_JSON không phải JSON hợp lệ. Hãy dán nguyên nội dung service account JSON vào Vercel Environment Variables.'), { code: 'FIREBASE_CREDENTIAL_JSON_INVALID', status: 500 });
    }
    if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
      throw Object.assign(Error('FIREBASE_SERVICE_ACCOUNT_JSON thiếu project_id, client_email hoặc private_key.'), { code: 'FIREBASE_CREDENTIAL_JSON_INVALID', status: 500 });
    }
    return cert(credentials);
  }

  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  if (projectId && clientEmail && privateKey) return cert({ projectId, clientEmail, privateKey });
  return applicationDefault();
}

/**
 * Initialize Firebase Admin with databaseURL before any handler can call getDatabase().
 * In the Admin SDK, getDatabase(app) reads app.options.databaseURL; passing a second URL
 * argument is not supported (unlike the browser SDK). This ordering prevents
 * "Can't determine Firebase Database URL" when identity() initializes Admin Auth first.
 */
export function adminApp() {
  const apps = getApps();
  const existing = apps.find((item) => item.name === '[DEFAULT]');
  if (existing) return existing;

  const databaseURL = readDatabaseUrl();
  const explicitProjectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const config = { credential: credentialForAdmin() };
  if (databaseURL) config.databaseURL = databaseURL;
  if (explicitProjectId) config.projectId = explicitProjectId;
  return initializeApp(config);
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function adminDatabase() {
  const raw = String(process.env.FIREBASE_DATABASE_URL || '').trim();
  if (!raw) {
    throw Object.assign(Error('Thiếu FIREBASE_DATABASE_URL. Trên Vercel, hãy sao chép URL trong Firebase Console → Realtime Database → Data, rồi thêm biến FIREBASE_DATABASE_URL vào Production/Preview.'), { status: 500, code: 'FIREBASE_DATABASE_URL_MISSING' });
  }
  let databaseURL;
  try {
    const parsed = new URL(raw);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('scheme');
    databaseURL = parsed.href.replace(/\/$/, '');
  } catch {
    throw Object.assign(Error('FIREBASE_DATABASE_URL không hợp lệ. Giá trị phải là URL đầy đủ bắt đầu bằng https://, lấy từ Realtime Database chứ không phải Firestore.'), { status: 500, code: 'FIREBASE_DATABASE_URL_INVALID' });
  }
  const app = adminApp();
  const configured = String(app.options.databaseURL || '').replace(/\/$/, '');
  if (!configured) {
    throw Object.assign(Error('Firebase Admin đã được khởi tạo trước khi có databaseURL. Hãy cấu hình FIREBASE_DATABASE_URL trong Vercel rồi Redeploy toàn bộ deployment.'), { status: 500, code: 'FIREBASE_DATABASE_URL_NOT_ON_ADMIN_APP' });
  }
  if (configured !== databaseURL) {
    throw Object.assign(Error('URL database của Firebase Admin không khớp FIREBASE_DATABASE_URL hiện tại. Kiểm tra biến trùng lặp và Redeploy.'), { status: 500, code: 'FIREBASE_DATABASE_URL_MISMATCH' });
  }
  // IMPORTANT: the Admin SDK accepts the database URL through initializeApp options only.
  // Do not pass a second argument to getDatabase(app).
  return getDatabase(app);
}

export function firebaseAdminConfiguration() {
  const serviceJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  const individualCredentialParts = [process.env.FIREBASE_PROJECT_ID, process.env.FIREBASE_CLIENT_EMAIL, process.env.FIREBASE_PRIVATE_KEY].map((v) => Boolean(String(v || '').trim()));
  let serviceJsonValid = false;
  let serviceProjectId = '';
  if (serviceJson) {
    try {
      const parsed = JSON.parse(serviceJson);
      serviceJsonValid = Boolean(parsed?.project_id && parsed?.client_email && parsed?.private_key);
      serviceProjectId = String(parsed?.project_id || '');
    } catch { serviceJsonValid = false; }
  }
  const databaseURL = String(process.env.FIREBASE_DATABASE_URL || '').trim();
  let databaseURLValid = false;
  let databaseHost = '';
  try {
    const parsed = new URL(databaseURL);
    databaseURLValid = ['https:', 'http:'].includes(parsed.protocol);
    databaseHost = parsed.host;
  } catch { /* deliberately omit raw value */ }
  const webProject = String(process.env.VITE_FIREBASE_PROJECT_ID || '').trim();
  const explicitProjectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const backendProject = String(serviceProjectId || explicitProjectId || '').trim();
  return {
    databaseURLPresent: Boolean(databaseURL),
    databaseURLValid,
    databaseHost: databaseURLValid ? databaseHost : null,
    serviceAccountJsonPresent: Boolean(serviceJson),
    serviceAccountJsonValid: serviceJson ? serviceJsonValid : null,
    individualCredentialParts,
    backendCredentialSource: serviceJsonValid ? 'service-account-json' : individualCredentialParts.every(Boolean) ? 'individual-environment-variables' : 'application-default-or-incomplete',
    webProjectConfigured: Boolean(webProject),
    backendProjectConfigured: Boolean(backendProject),
    projectIdsMatch: webProject && backendProject ? webProject === backendProject : null,
    explicitProjectMatchesServiceAccount: explicitProjectId && serviceProjectId ? explicitProjectId === serviceProjectId : null
  };
}
