import { randomUUID } from 'node:crypto';
import { identity, fail, assert } from '../lib/exam-server.js';
import { rtdbGet, rtdbPut, rtdbTransaction, abortTx } from '../lib/rtdb-rest.js';
import {
  SESSION_TTL_MS,
  applyHeartbeat,
  resumeHeartbeat,
  claimFocusAway,
  applyLoginStreak,
  summarizeStudyStats
} from '../shared/study-core.js';

async function syncLeaderboardProjection(uid, state, fallbackName) {
  if (!uid || !state || typeof state !== 'object') return;
  const path = `leaderboard_public/${uid}`;
  try {
    if (state.sharing === true) {
      await rtdbPut(path, {
        displayName: String(state.displayName || fallbackName || 'Người học').slice(0, 80),
        sharing: true,
        totalMs: Math.max(0, Math.floor(Number(state.totalMs) || 0)),
        dayIndex: Number.isInteger(state.dayIndex) ? state.dayIndex : null,
        dailyMs: Math.max(0, Math.floor(Number(state.dailyMs) || Number(state.todayMs) || 0)),
        todayKey: String(state.todayKey || ''),
        todayMs: Math.max(0, Math.floor(Number(state.dailyMs) || Number(state.todayMs) || 0)),
        streak: Math.max(0, Math.floor(Number(state.streak) || 0)),
        bestStreak: Math.max(0, Math.floor(Number(state.bestStreak) || 0)),
        lastStudyDay: Number.isInteger(state.lastStudyDay) ? state.lastStudyDay : null,
        updatedAt: Date.now()
      });
    } else {
      await rtdbPut(path, null);
    }
  } catch { /* non-blocking projection sync */ }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    assert(['GET', 'POST'].includes(req.method), 'Method không hợp lệ.', 405);
    const user = await identity(req);
    const body = req.body || {};
    const action = req.method === 'GET' ? 'status' : String(body.action || '');
    const userPath = `study_tracking/${user.uid}`;
    const now = Date.now();

    if (action === 'status') {
      const cur = (await rtdbGet(userPath)) || {};
      return res.json({ stats: summarizeStudyStats(cur, now) });
    }

    if (action === 'login-checkin') {
      let incremented = false;
      const txRes = await rtdbTransaction(userPath, (raw) => {
        const cur = raw && typeof raw === 'object' ? raw : {};
        const applied = applyLoginStreak(cur, Date.now(), user.name);
        incremented = applied.incremented;
        return applied.state;
      });
      await syncLeaderboardProjection(user.uid, txRes.val, user.name);
      return res.json({ stats: summarizeStudyStats(txRes.val, Date.now()), incremented });
    }

    if (action === 'start') {
      const sessionId = randomUUID();
      const txRes = await rtdbTransaction(userPath, (raw) => {
        const cur = raw && typeof raw === 'object' ? raw : {};
        const txNow = Date.now();
        return applyHeartbeat(
          { ...cur, session: { id: sessionId, lastPing: txNow } },
          txNow,
          sessionId,
          user.name
        ).state;
      });
      await syncLeaderboardProjection(user.uid, txRes.val, user.name);
      return res.json({ sessionId, stats: summarizeStudyStats(txRes.val, Date.now()) });
    }

    if (action === 'resume') {
      const id = String(body.sessionId || '');
      assert(/^[0-9a-f-]{36}$/i.test(id), 'Phiên không hợp lệ.');
      const txRes = await rtdbTransaction(userPath, (raw) => {
        const cur = raw && typeof raw === 'object' ? raw : {};
        const txNow = Date.now();
        const resumed = resumeHeartbeat(cur, txNow, id, user.name);
        if (resumed.accepted) return resumed.state;
        return applyHeartbeat({ ...cur, session: { id, lastPing: txNow } }, txNow, id, user.name).state;
      });
      await syncLeaderboardProjection(user.uid, txRes.val, user.name);
      return res.json({ sessionId: id, stats: summarizeStudyStats(txRes.val, Date.now()), resumed: true });
    }

    if (action === 'ping' || action === 'stop') {
      const id = String(body.sessionId || '');
      assert(/^[0-9a-f-]{36}$/i.test(id), 'Phiên không hợp lệ.');
      let addedMs = 0;
      const focusAwayMs = Number(body.focusAwayMs);
      const txRes = await rtdbTransaction(userPath, (raw) => {
        const cur = raw && typeof raw === 'object' ? raw : {};
        const txNow = Date.now();
        if (cur.session && cur.session.id !== id && txNow - (Number(cur.session.lastPing) || 0) < SESSION_TTL_MS) {
          if (action === 'stop') return undefined;
          return abortTx('Phiên học đã được thay thế ở tab hoặc cửa sổ khác.', 409);
        }
        const baseCur = !cur.session || cur.session.id !== id
          ? { ...cur, session: { id, lastPing: txNow } }
          : cur;
        const updated = (action === 'ping' && body.focusMode === true && Number.isFinite(focusAwayMs) && focusAwayMs > 0)
          ? claimFocusAway(baseCur, txNow, id, user.name, focusAwayMs)
          : applyHeartbeat(baseCur, txNow, id, user.name);
        if (!updated.accepted) return abortTx('Phiên học không hợp lệ hoặc đã thay đổi.', 409);
        addedMs = updated.added || 0;
        const nextState = { ...updated.state };
        if (action === 'stop') delete nextState.session;
        return nextState;
      });
      const finalState = txRes.val && typeof txRes.val === 'object' ? txRes.val : {};
      await syncLeaderboardProjection(user.uid, finalState, user.name);
      return res.json({
        stats: summarizeStudyStats(finalState, Date.now()),
        awayAddedSeconds: Math.floor(addedMs / 1000)
      });
    }

    if (action === 'sharing') {
      assert(typeof body.enabled === 'boolean', 'Giá trị chia sẻ không hợp lệ.');
      const txRes = await rtdbTransaction(userPath, (raw) => {
        const cur = raw && typeof raw === 'object' ? raw : {};
        return { ...cur, sharing: body.enabled, displayName: user.name };
      });
      await syncLeaderboardProjection(user.uid, txRes.val, user.name);
      return res.json({ stats: summarizeStudyStats(txRes.val, Date.now()) });
    }

    assert(false, 'Thao tác không hợp lệ.');
  } catch (error) {
    return fail(res, error);
  }
}
