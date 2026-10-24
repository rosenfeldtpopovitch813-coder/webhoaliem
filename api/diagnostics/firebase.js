import { adminDatabase, firebaseAdminConfiguration } from '../../lib/firebase-admin.js';

const requests = new Map();
function send(res, status, payload) { return res.status(status).json(payload); }
function allow(ip) {
  const now = Date.now(); const prev = requests.get(ip);
  const next = !prev || now - prev.start >= 60000 ? { start: now, count: 1 } : { ...prev, count: prev.count + 1 };
  requests.set(ip, next);
  if (requests.size > 1000) for (const [key, item] of requests) if (now - item.start > 120000) requests.delete(key);
  return next.count <= 15;
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); }
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 80);
  if (!allow(ip)) return send(res, 429, { error: 'Chẩn đoán được gọi quá nhiều lần. Hãy thử lại sau.' });

  const configuration = firebaseAdminConfiguration();
  const checks = {
    databaseUrl: { ok: configuration.databaseURLPresent && configuration.databaseURLValid, host: configuration.databaseHost },
    adminCredentials: { ok: configuration.serviceAccountJsonPresent ? configuration.serviceAccountJsonValid === true : configuration.individualCredentialParts.every(Boolean), source: configuration.backendCredentialSource },
    projectIds: { ok: configuration.projectIdsMatch !== false && configuration.explicitProjectMatchesServiceAccount !== false, webConfigured: configuration.webProjectConfigured, backendConfigured: configuration.backendProjectConfigured, match: configuration.projectIdsMatch, explicitMatchesServiceAccount: configuration.explicitProjectMatchesServiceAccount }
  };
  let overall = true;
  if (!checks.databaseUrl.ok) { overall = false; checks.databaseConnection = { ok: false, code: configuration.databaseURLPresent ? 'FIREBASE_DATABASE_URL_INVALID' : 'FIREBASE_DATABASE_URL_MISSING', message: configuration.databaseURLPresent ? 'FIREBASE_DATABASE_URL không phải URL HTTP(S) hợp lệ.' : 'Thiếu FIREBASE_DATABASE_URL trong Environment Variables của Vercel.' }; }
  if (!checks.adminCredentials.ok) { overall = false; checks.authenticationAdmin = { ok: false, code: configuration.serviceAccountJsonPresent && !configuration.serviceAccountJsonValid ? 'FIREBASE_CREDENTIAL_JSON_INVALID' : 'FIREBASE_ADMIN_CREDENTIALS_MISSING', message: 'Thêm FIREBASE_SERVICE_ACCOUNT_JSON hợp lệ hoặc đủ FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL và FIREBASE_PRIVATE_KEY.' }; }
  if (configuration.projectIdsMatch === false) { overall = false; checks.projectIds.message = 'VITE_FIREBASE_PROJECT_ID khác project_id của thông tin xác thực phía máy chủ. Hãy chọn cùng một Firebase project.'; }
  if (configuration.explicitProjectMatchesServiceAccount === false) { overall = false; checks.projectIds.message = 'FIREBASE_PROJECT_ID không khớp project_id trong FIREBASE_SERVICE_ACCOUNT_JSON. Dùng cùng project hoặc bỏ biến ghi đè sai.'; }
  if (!checks.projectIds.webConfigured) { overall = false; checks.projectIds.message = 'Thiếu VITE_FIREBASE_PROJECT_ID ở cấu hình build frontend.'; }

  if (checks.databaseUrl.ok && checks.adminCredentials.ok && checks.projectIds.ok) {
    try {
      // Probe a harmless, ordinary RTDB path. The .info namespace belongs to client SDK
      // server-info listeners and is rejected as a normal path by the Admin SDK.
      // This path is read-only; we never create or return student data.
      const database = adminDatabase();
      let timeoutId;
      const result = await Promise.race([
        database.ref('__htvvm_diagnostics_probe__').get(),
        new Promise((_, reject) => { timeoutId = setTimeout(() => reject(Object.assign(Error('Database probe timeout'), { code: 'FIREBASE_DATABASE_TIMEOUT' })), 8000); })
      ]).finally(() => clearTimeout(timeoutId));
      checks.databaseConnection = { ok: true, code: 'OK', message: 'Truy vấn kiểm tra tới Realtime Database hoàn tất thành công.' };
    } catch (error) {
      overall = false;
      checks.databaseConnection = { ok: false, code: error?.code || 'FIREBASE_DATABASE_CONNECT_FAILED', message: error?.message || 'Không thể kết nối Realtime Database.' };
    }
  }
  checks.frontend = {
    ok: Boolean(process.env.VITE_FIREBASE_API_KEY && process.env.VITE_FIREBASE_AUTH_DOMAIN && process.env.VITE_FIREBASE_PROJECT_ID && process.env.VITE_FIREBASE_APP_ID && process.env.VITE_FIREBASE_DATABASE_URL),
    apiKey: Boolean(process.env.VITE_FIREBASE_API_KEY), authDomain: Boolean(process.env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: Boolean(process.env.VITE_FIREBASE_PROJECT_ID), appId: Boolean(process.env.VITE_FIREBASE_APP_ID),
    databaseUrl: Boolean(process.env.VITE_FIREBASE_DATABASE_URL)
  };
  if (!checks.frontend.ok) { overall = false; checks.frontend.message = 'Thiếu một hoặc nhiều biến VITE_FIREBASE_* cần được khai báo trước khi build frontend.'; }
  return send(res, overall ? 200 : 503, {
    ok: overall,
    checkedAt: new Date().toISOString(),
    rootCauseHint: checks.databaseConnection?.ok ? 'Kết nối Realtime Database phía máy chủ hoạt động. Phép thử chỉ đọc một nút kiểm tra riêng, không đọc dữ liệu học sinh.' : (checks.databaseConnection?.message === 'Invalid token in path' ? 'Lỗi đến từ đường dẫn kiểm tra dành riêng cho .info trong probe chẩn đoán, không phải bằng chứng rằng URL database sai. Bản cập nhật dùng một đường dẫn kiểm tra hợp lệ của Firebase Admin SDK.' : 'Nếu URL và thông tin xác thực đều hợp lệ nhưng kết nối vẫn thất bại, kiểm tra thông báo lỗi kết nối chi tiết. Không mở công khai Database Rules chỉ để bỏ lỗi.'),
    checks,
    nextSteps: [
      'Vercel → Settings → Environment Variables: đặt FIREBASE_DATABASE_URL bằng URL trong Firebase Console → Realtime Database → Data.',
      'Đảm bảo biến được bật cho đúng môi trường Production/Preview và FIREBASE_SERVICE_ACCOUNT_JSON thuộc cùng project.',
      'VITE_FIREBASE_PROJECT_ID và project_id của service account phải cùng Firebase project.',
      'Kiểm tra VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID và VITE_FIREBASE_DATABASE_URL có trước lần build frontend.',
      'Sau khi đổi biến, Redeploy deployment mới; sau đó bấm Chẩn đoán Firebase để kiểm tra lại.'
    ]
  });
}
