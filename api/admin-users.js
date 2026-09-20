'use strict';
const {getAdmin, verifyRole} = require('../lib/firebase-admin');
const http = require('../lib/http');

module.exports = async function(req, res) {
  http.noStore(res);
  if (!http.method(res, req, ['GET'])) return;
  try {
    const app = getAdmin();
    const adminUser = await verifyRole(req, 'admin');
    const q = String(req.query?.q || '').trim();
    if (!q || q.length > 320) return http.badRequest(res, 'Nhập email hoặc UID để tìm.');
    let records = [];
    if (/^[A-Za-z0-9_-]{20,200}$/.test(q)) {
      const snap = await app.database().ref(`users/${q}`).once('value');
      if (snap.exists()) records.push({uid:q, ...snap.val()});
    } else {
      const normalized = q.toLowerCase();
      const snap = await app.database().ref('users').orderByChild('email').equalTo(q).once('value');
      if (snap.exists()) records = Object.entries(snap.val()).map(([uid,data]) => ({uid,...data}));
      if (!records.length) {
        const nameSnap = await app.database().ref('users').orderByChild('name').startAt(q).endAt(q+'\uf8ff').limitToFirst(20).once('value');
        if (nameSnap.exists()) records = Object.entries(nameSnap.val()).map(([uid,data]) => ({uid,...data})).filter(x => String(x.email||'').toLowerCase().includes(normalized) || String(x.name||'').toLowerCase().includes(normalized));
      }
    }
    return http.ok(res, {
      users: records.slice(0,20).map(u => ({uid:u.uid,name:u.name||u.displayName||'Học viên',email:u.email||'',role:u.role||'',wallet:u.wallet||{}})),
      adminUid: adminUser.uid
    });
  } catch (error) {
    if (error?.status === 401) return http.unauthorized(res);
    if (error?.status === 403) return http.forbidden(res);
    console.error('[admin-users]', error?.message || error);
    return http.serverError(res);
  }
};
