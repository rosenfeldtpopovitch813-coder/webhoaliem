import { getDatabase } from 'firebase-admin/database';
import { getApps } from 'firebase-admin/app';
import { adminAuth } from './firebase-admin.js';

function resolveDatabaseUrl() {
  const raw = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || '';
  if (!raw.trim()) {
    throw Object.assign(
      Error('Thiếu FIREBASE_DATABASE_URL. Hãy sao chép URL trong Firebase Console → Realtime Database → Data và thêm biến này vào Environment Variables của Vercel.'),
      { status: 500, code: 'CONFIG_MISSING' }
    );
  }
  let parsed;
  try { parsed = new URL(raw); } catch {
    throw Object.assign(Error('FIREBASE_DATABASE_URL không phải URL hợp lệ. Hãy sao chép URL Realtime Database đầy đủ từ Firebase Console.'), { status: 500, code: 'CONFIG_MISSING' });
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw Object.assign(Error('FIREBASE_DATABASE_URL phải bắt đầu bằng https:// hoặc http://.'), { status: 500, code: 'CONFIG_MISSING' });
  }
  return parsed.href.replace(/\/$/, '');
}

export function db() {
  const url = resolveDatabaseUrl();
  adminAuth();
  const app = getApps()[0];
  if (!app) throw Object.assign(Error('Firebase Admin chưa được khởi tạo. Kiểm tra thông tin xác thực phía máy chủ.'), { status: 500, code: 'CONFIG_MISSING' });
  return getDatabase(app, url);
}
export async function identity(req) {
  const bearer = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!bearer) throw Object.assign(Error('Cần đăng nhập Google.'), {status:401});
  const decoded = await adminAuth().verifyIdToken(bearer[1], true);
  return { uid:decoded.uid, name:String(decoded.name || decoded.email || 'Học sinh').slice(0,80), role: decoded.admin === true ? 'admin' : decoded.teacher === true ? 'teacher' : 'student' };
}
export function fail(res, err) {
  console.error('Exam API:', err);
  const status = err.status || 400;
  const message = err.code === 'CONFIG_MISSING' ? err.message : status >= 500 ? 'Lỗi máy chủ.' : err.message || 'Yêu cầu không hợp lệ.';
  return res.status(status).json({ error: message, ...(err.code === 'CONFIG_MISSING' ? { code: err.code } : {}) });
}
export function assert(condition, message, status=400) { if (!condition) throw Object.assign(Error(message),{status}); }
export function newId() { return crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase(); }
