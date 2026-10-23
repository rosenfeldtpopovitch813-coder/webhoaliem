import { adminAuth, adminDatabase } from './firebase-admin.js';

export function db() {
  return adminDatabase();
}
export async function identity(req) {
  const bearer = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!bearer) throw Object.assign(Error('Cần đăng nhập Google.'), { status: 401 });
  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(bearer[1], true);
  } catch (error) {
    const wrapped = Object.assign(Error(error?.code === 'auth/id-token-expired' ? 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.' : 'Không xác minh được token Firebase Authentication. Kiểm tra biến Firebase Admin phía máy chủ.'), { status: 401, code: error?.code || 'AUTH_TOKEN_INVALID' });
    throw wrapped;
  }
  return { uid: decoded.uid, name: String(decoded.name || decoded.email || 'Người học').slice(0, 80), role: 'user' };
}
export function fail(res, err) {
  console.error('HTVVM API:', { code: err?.code || 'UNCLASSIFIED', status: err?.status || 500, message: err?.message || 'unknown' });
  const status = err.status || 400;
  // Return useful, non-secret Firebase configuration messages. Never return credentials or tokens.
  const firebaseError = typeof err.code === 'string' && (err.code.startsWith('FIREBASE_') || err.code.startsWith('auth/'));
  const message = firebaseError || status < 500 ? err.message || 'Yêu cầu không hợp lệ.' : 'Lỗi máy chủ. Mở mục “Chẩn đoán Firebase” để xem nguyên nhân cụ thể.';
  return res.status(status).json({ error: message, ...(err.code ? { code: err.code } : {}) });
}
export function assert(condition, message, status = 400) { if (!condition) throw Object.assign(Error(message), { status }); }
export function newId() { return crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(); }
