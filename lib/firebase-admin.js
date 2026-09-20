'use strict';
const admin = require('firebase-admin');

function getAdmin() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw Object.assign(new Error('Missing server Firebase credentials'), {status: 503});
  let credential;
  try { credential = admin.credential.cert(JSON.parse(raw)); }
  catch { throw Object.assign(new Error('Invalid Firebase service account configuration'), {status: 503}); }
  return admin.initializeApp({
    credential,
    databaseURL: process.env.FIREBASE_DATABASE_URL || undefined
  });
}

async function verifyUser(req) {
  const token = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw Object.assign(new Error('Authentication required'), {status: 401});
  try {
    return await getAdmin().auth().verifyIdToken(token);
  } catch {
    throw Object.assign(new Error('Invalid token'), {status: 401});
  }
}

function hasRole(user, role) {
  const claims = user?.claims || user;
  if (role === 'admin') return claims?.admin === true || claims?.role === 'admin';
  if (role === 'teacher') return claims?.admin === true || claims?.role === 'admin' || claims?.teacher === true || claims?.role === 'teacher';
  return false;
}

async function verifyRole(req, role) {
  const user = await verifyUser(req);
  if (!hasRole(user, role)) throw Object.assign(new Error('Forbidden'), {status: 403});
  return user;
}

module.exports = {getAdmin, verifyUser, verifyRole, hasRole};
