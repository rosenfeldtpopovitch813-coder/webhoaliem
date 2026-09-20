'use strict';
const crypto = require('crypto');
const {getAdmin, verifyUser} = require('../lib/firebase-admin');
const {applyStudy, dayKey, sanitizePublicState} = require('../lib/study-core');
const {consumeRateLimit} = require('../lib/rate-limit');
const http = require('../lib/http');

module.exports = async function(req, res) {
  http.noStore(res);
  if (!http.method(res, req, ['POST'])) return;
  try {
    const app = getAdmin();
    const user = await verifyUser(req);
    const limited = await consumeRateLimit(app.database(), `study:${user.uid}`, {limit: 40, windowMs: 60_000});
    if (!limited.allowed) return http.tooMany(res);

    const body = req.body || {};
    const action = String(body.action || 'heartbeat');
    if (!['start', 'heartbeat', 'stop', 'continue'].includes(action)) return http.badRequest(res, 'Thao tác không hợp lệ.');
    if (action !== 'start' && !/^[a-f0-9-]{36}$/i.test(String(body.sessionId || ''))) return http.badRequest(res, 'Mã phiên không hợp lệ.');
    const id = action === 'start' ? crypto.randomUUID() : String(body.sessionId);
    if (action !== 'start' && !/^[a-f0-9]{8}-[a-f0-9-]{27,35}$/i.test(id)) return http.badRequest(res, 'Mã phiên không hợp lệ.');
    const clientInstanceId = String(body.clientInstanceId || '').slice(0, 120);
    const now = Date.now();
    const ref = app.database().ref(`users/${user.uid}`);
    let meta = {};
    const result = await ref.transaction(data => {
      const next = applyStudy(data, action, id, now, {clientInstanceId, rewardEvery: 3600, rewardAmount: 50});
      if (!next) return;
      meta = next.__result || {};
      delete next.__result;
      return next;
    });
    if (!result.committed) return http.conflict(res, 'Phiên học không còn hợp lệ hoặc bạn đang có một phiên khác.');
    const data = result.snapshot.val() || {};
    const session = data.studySessions?.[id];
    return http.ok(res, {
      ok: true,
      sessionId: meta.sessionId || id,
      serverTime: now,
      day: dayKey(now),
      ...sanitizePublicState(data),
      confirmAt: Number(session?.confirmAt || 0),
      needsConfirmation: session?.status === 'needs_confirmation' || !!meta.needsConfirmation,
      rewardAmount: Number(meta.rewardAmount || 0)
    });
  } catch (error) {
    const status = Number(error?.status) || 503;
    if (status === 401) return http.unauthorized(res);
    if (status === 429) return http.tooMany(res);
    console.error('[study-time]', error?.message || error);
    return http.json(res, status >= 500 ? 503 : status, {error: status >= 500 ? 'Không thể đồng bộ phiên học.' : 'Dữ liệu phiên học không hợp lệ.', code: status >= 500 ? 'STUDY_SYNC_FAILED' : 'BAD_REQUEST'});
  }
};
