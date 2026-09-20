'use strict';
const {getAdmin, verifyUser} = require('../lib/firebase-admin');
const {consumeRateLimit} = require('../lib/rate-limit');
const {applyWallet, ensureWallet} = require('../lib/token-core');
const {randomUUID} = require('crypto');
const themes = require('../config/themes');
const http = require('../lib/http');

const ACTIVE_THEMES = themes.filter(t => t.active !== false);

module.exports = async function(req, res) {
  http.noStore(res);
  if (!http.method(res, req, ['GET','POST'])) return;
  try {
    const app = getAdmin();
    const user = await verifyUser(req);
    if (req.method === 'GET') {
      const snap = await app.database().ref(`users/${user.uid}`).once('value');
      const data = snap.val() || {};
      return http.ok(res, {
        themes: ACTIVE_THEMES,
        owned: Object.keys(data.themeOwnerships || {}).filter(Boolean),
        wallet: ensureWallet(data.wallet),
        support: { url: process.env.ZALO_SUPPORT_URL || '', label: process.env.ZALO_SUPPORT_LABEL || 'Liên hệ hỗ trợ qua Zalo', qrUrl: process.env.ZALO_SUPPORT_QR_URL || '' }
      });
    }

    const limited = await consumeRateLimit(app.database(), `theme-purchase:${user.uid}`, {limit: 10, windowMs: 60_000});
    if (!limited.allowed) return http.tooMany(res);
    const themeId = String(req.body?.themeId || '').trim();
    const theme = ACTIVE_THEMES.find(t => t.id === themeId);
    if (!theme || !theme.premium || theme.price !== 2500) return http.badRequest(res, 'Theme không hợp lệ.');

    const ref = app.database().ref(`users/${user.uid}`);
    let meta = {};
    const result = await ref.transaction(current => {
      const data = current && typeof current === 'object' ? structuredClone(current) : {};
      data.themeOwnerships ||= {};
      data.wallet = ensureWallet(data.wallet);
      if (data.themeOwnerships[theme.id]) {
        meta = {owned: true, transactionId: null};
        return data;
      }
      if (data.wallet.balance < theme.price) return;
      const txId = randomUUID();
      data.wallet = applyWallet(data.wallet, -theme.price, Date.now());
      data.tokenLedger ||= {};
      data.tokenLedger[txId] = {type:'theme_purchase', amount:theme.price, source:'theme_store', sourceId:theme.id, createdAt:Date.now(), reason:`Mua theme ${theme.name}`};
      data.themeOwnerships[theme.id] = {themeId:theme.id, price:theme.price, transactionId:txId, purchasedAt:Date.now()};
      meta = {owned:false, transactionId:txId};
      return data;
    });
    if (!result.committed) return http.conflict(res, 'Không đủ token để mua theme hoặc giao dịch vừa thay đổi.');
    const data = result.snapshot.val() || {};
    const owned = !!data.themeOwnerships?.[theme.id];
    if (!owned) return http.conflict(res, 'Không thể hoàn tất giao dịch.');
    return http.ok(res, {ok:true, alreadyOwned:!!meta.owned, transactionId:meta.transactionId||data.themeOwnerships[theme.id].transactionId, wallet:ensureWallet(data.wallet), owned:[theme.id]});
  } catch (error) {
    if (error?.status === 401) return http.unauthorized(res);
    if (error?.code === 'INSUFFICIENT_BALANCE') return http.conflict(res, 'Không đủ token để mua theme.');
    console.error('[themes]', error?.message || error);
    return http.serverError(res);
  }
};
