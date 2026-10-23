import { adminAuth } from '../lib/firebase-admin.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const authorization = req.headers.authorization || '';
  const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(authorization);
  if (!match) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  try {
    const decoded = await adminAuth().verifyIdToken(match[1], true);
    return res.status(200).json({ uid: decoded.uid, role: 'user', emailVerified: decoded.email_verified === true });
  } catch (err) {
    console.error('Token validation failed:', err.code || 'UNKNOWN');
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}
