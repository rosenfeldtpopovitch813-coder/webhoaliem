import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function normalizeExamPasswordInput(raw) {
  if (raw === null || raw === undefined) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';
  if (trimmed.length < 4 || trimmed.length > 32) {
    throw Error('Mật khẩu phòng thi phải từ 4 đến 32 ký tự (hoặc để trống nếu mở tự do).');
  }
  return trimmed;
}

export function hashExamPassword(rawPassword) {
  const clean = normalizeExamPasswordInput(rawPassword);
  if (!clean) return null;
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(clean, salt, 32).toString('hex');
  return { hash, salt, updatedAt: Date.now() };
}

export function verifyExamPassword(candidate, secretRecord) {
  if (!secretRecord || typeof secretRecord !== 'object' || !secretRecord.hash || !secretRecord.salt) {
    return true;
  }
  if (typeof candidate !== 'string') return false;
  const clean = candidate.trim();
  if (!clean || clean.length > 64) return false;
  try {
    const derived = scryptSync(clean, String(secretRecord.salt), 32);
    const expected = Buffer.from(String(secretRecord.hash), 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
