'use strict';
const {getAdmin, verifyUser} = require('../lib/firebase-admin');
const {sanitizePublicState} = require('../lib/study-core');
const http = require('../lib/http');

module.exports = async function(req, res) {
  http.noStore(res);
  if (!http.method(res, req, ['GET'])) return;
  try {
    const user = await verifyUser(req);
    const snap = await getAdmin().database().ref(`users/${user.uid}`).once('value');
    const data = snap.val() || {};
    return http.ok(res, {wallet: sanitizePublicState(data).wallet});
  } catch (error) {
    if (error?.status === 401) return http.unauthorized(res);
    console.error('[token]', error?.message || error);
    return http.serverError(res);
  }
};
