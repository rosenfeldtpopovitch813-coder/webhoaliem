'use strict';
const crypto = require('crypto');
const {getAdmin, verifyRole} = require('../lib/firebase-admin');
const {consumeRateLimit} = require('../lib/rate-limit');
const {applyWallet, validateAmount, ensureWallet} = require('../lib/token-core');
const http = require('../lib/http');

function cleanType(value, amount) {
  if (value === 'grant') return 'manual_grant';
  if (value === 'deduct') return 'manual_deduct';
  if (value === 'refund') return 'refund';
  throw Object.assign(new Error('Invalid type'), {code:'INVALID_TYPE'});
}

module.exports = async function(req, res) {
  http.noStore(res);
  if (!http.method(res, req, ['GET','POST'])) return;
  try {
    const app = getAdmin();
    const adminUser = await verifyRole(req, 'admin');
    const db = app.database();
    if (req.method === 'GET') {
      const uid = String(req.query?.uid || '').trim();
      if (!/^[A-Za-z0-9_-]{20,200}$/.test(uid)) return http.badRequest(res, 'UID không hợp lệ.');
      const snap = await db.ref(`users/${uid}`).once('value');
      if (!snap.exists()) return http.notFound(res, 'Không tìm thấy người dùng.');
      const data = snap.val() || {};
      const ledger = Object.entries(data.tokenLedger || {}).map(([id,tx]) => ({transactionId:id,...tx})).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,200);
      const audits = Object.entries(data.tokenAudit || {}).map(([id,tx]) => ({transactionId:id,...tx})).sort((a,b)=>Number(b.timestamp||0)-Number(a.timestamp||0)).slice(0,200);
      return http.ok(res, {user:{uid,name:data.name||data.displayName||'Học viên',email:data.email||''},wallet:ensureWallet(data.wallet),ledger,audits});
    }

    const limited = await consumeRateLimit(db, `admin-token:${adminUser.uid}`, {limit: 30, windowMs: 60_000});
    if (!limited.allowed) return http.tooMany(res);
    const uid = String(req.body?.uid || '').trim();
    const amount = validateAmount(req.body?.amount, {max: 1_000_000});
    const operation = String(req.body?.type || '').trim();
    const reason = String(req.body?.reason || '').trim();
    if (!/^[A-Za-z0-9_-]{20,200}$/.test(uid)) return http.badRequest(res, 'UID không hợp lệ.');
    if (reason.length < 3 || reason.length > 500) return http.badRequest(res, 'Lý do bắt buộc, dài 3–500 ký tự.');
    const type = cleanType(operation, amount);
    if (type === 'manual_deduct' && amount > 100_000) return http.forbidden(res, 'Khoản trừ thủ công vượt hạn mức mỗi giao dịch.');

    const ref = db.ref(`users/${uid}`);
    let transactionId = crypto.randomUUID();
    const now = Date.now();
    const result = await ref.transaction(current => {
      const data = current && typeof current === 'object' ? structuredClone(current) : null;
      if (!data) return;
      data.wallet = ensureWallet(data.wallet);
      data.tokenLedger ||= {};
      data.tokenAudit ||= {};
      if (data.tokenLedger[transactionId]) return data;
      const delta = type === 'manual_deduct' ? -amount : amount;
      data.wallet = applyWallet(data.wallet, delta, now);
      data.tokenLedger[transactionId] = {type, amount, source:'admin', sourceId:transactionId, adminUid:adminUser.uid, reason, createdAt:now};
      data.tokenAudit[transactionId] = {action:type, amount, reason, adminUid:adminUser.uid, targetUid:uid, transactionId, timestamp:now};
      return data;
    });
    if (!result.committed) return http.conflict(res, 'Giao dịch không được ghi nhận. Có thể số dư không đủ hoặc dữ liệu thay đổi đồng thời.');
    const data = result.snapshot.val() || {};
    return http.ok(res, {ok:true, transactionId, wallet:ensureWallet(data.wallet)});
  } catch (error) {
    if (error?.status === 401) return http.unauthorized(res);
    if (error?.status === 403) return http.forbidden(res);
    if (error?.code === 'INVALID_AMOUNT') return http.badRequest(res, 'Số token phải là số nguyên dương hợp lệ.');
    if (error?.code === 'INVALID_TYPE') return http.badRequest(res, 'Loại giao dịch không hợp lệ.');
    if (error?.code === 'INSUFFICIENT_BALANCE') return http.conflict(res, 'Không thể để số dư token âm.');
    console.error('[admin-token]', error?.message || error);
    return http.serverError(res);
  }
};
