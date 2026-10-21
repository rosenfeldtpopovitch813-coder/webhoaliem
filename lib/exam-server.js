import { getDatabase } from 'firebase-admin/database';
import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { adminAuth } from './firebase-admin.js';
export function db() {
  adminAuth();
  return getDatabase(getApps()[0], process.env.FIREBASE_DATABASE_URL || undefined);
}
export async function identity(req) {
  const bearer = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!bearer) throw Object.assign(Error('Cần đăng nhập Google.'), {status:401});
  const decoded = await adminAuth().verifyIdToken(bearer[1], true);
  return { uid:decoded.uid, name:String(decoded.name || decoded.email || 'Học sinh').slice(0,80), role: decoded.admin === true ? 'admin' : decoded.teacher === true ? 'teacher' : 'student' };
}
export function fail(res, err) { console.error('Exam API:', err); return res.status(err.status || 400).json({ error: err.status >= 500 ? 'Lỗi máy chủ.' : err.message || 'Yêu cầu không hợp lệ.' }); }
export function assert(condition, message, status=400) { if (!condition) throw Object.assign(Error(message),{status}); }
export function newId() { return crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase(); }
