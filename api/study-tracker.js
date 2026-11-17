import { randomUUID } from 'node:crypto';
import { identity, fail, assert } from '../lib/exam-server.js';
import { rtdbGet, rtdbPut } from '../lib/rtdb-rest.js';
import {
  applyHeartbeat,
  resumeHeartbeat,
  claimFocusAway,
  applyLoginStreak,
  activeLoginStreakFor,
  titleFor
} from '../shared/study-core.js';
import { getVNDayIndex } from '../shared/time-utils.js';

const summarize = (s = {}, now = Date.now()) => {
  const day = getVNDayIndex(now);
  const loginStreak = activeLoginStreakFor(s, day);
  return {
    totalSeconds: Math.floor((s.totalMs || 0) / 1000),
    todaySeconds: s.dayIndex === day ? Math.floor((s.dailyMs || 0) / 1000) : 0,
    streak: s.lastStudyDay >= day - 1 ? s.streak || 0 : 0,
    loginStreak,
    bestLoginStreak: Math.max(Math.floor(Number(s.bestLoginStreak) || 0), loginStreak),
    title: titleFor(Math.floor((s.totalMs || 0) / 1000)),
    sharing: !!s.sharing
  };
};

async function readUserNode(uid) {
  const data = await rtdbGet(`study_tracking/${uid}`);
  return data && typeof data === 'object' ? data : {};
}

async function writeUserNode(uid, nextState) {
  const res = await rtdbPut(`study_tracking/${uid}`, nextState);
  return res.val && typeof res.val === 'object' ? res.val : nextState;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    assert(['GET', 'POST'].includes(req.method), 'Method không hợp lệ.', 405);
    const user = await identity(req);
    const body = req.body || {};
    const action = req.method === 'GET' ? 'status' : String(body.action || '');
    const now = Date.now();

    if (action === 'status') {
      const cur = await readUserNode(user.uid);
      return res.json({ stats: summarize(cur, now) });
    }

    if (action === 'login-checkin') {
      const cur = await readUserNode(user.uid);
      const { state: nextState, incremented } = applyLoginStreak(cur, now, user.name);
      const saved = await writeUserNode(user.uid, nextState);
      return res.json({ stats: summarize(saved, now), incremented });
    }

    if (action === 'start') {
      const sessionId = randomUUID();
      const cur = await readUserNode(user.uid);
      const next = applyHeartbeat(
        { ...cur, session: { id: sessionId, lastPing: now } },
        now,
        sessionId,
        user.name
      ).state;
      const saved = await writeUserNode(user.uid, next);
      return res.json({ sessionId, stats: summarize(saved, now) });
    }

    if (action === 'resume') {
      const id = String(body.sessionId || '');
      assert(/^[0-9a-f-]{36}$/i.test(id), 'Phiên không hợp lệ.');
      const cur = await readUserNode(user.uid);
      const resumed = resumeHeartbeat(cur, now, id, user.name);
      const nextState = resumed.accepted
        ? resumed.state
        : applyHeartbeat({ ...cur, session: { id, lastPing: now } }, now, id, user.name).state;
      const saved = await writeUserNode(user.uid, nextState);
      return res.json({ sessionId: id, stats: summarize(saved, now), resumed: true });
    }

    if (action === 'ping' || action === 'stop') {
      const id = String(body.sessionId || '');
      assert(/^[0-9a-f-]{36}$/i.test(id), 'Phiên không hợp lệ.');
      const cur = await readUserNode(user.uid);
      const baseCur = !cur?.session || cur.session.id !== id
        ? { ...cur, session: { id, lastPing: cur?.session?.lastPing || now } }
        : cur;
      const focusAwayMs = Number(body.focusAwayMs);
      const updated = (action === 'ping' && body.focusMode === true && Number.isFinite(focusAwayMs) && focusAwayMs > 0)
        ? claimFocusAway(baseCur, now, id, user.name, focusAwayMs)
        : applyHeartbeat(baseCur, now, id, user.name);
      const nextState = { ...updated.state };
      if (action === 'stop') delete nextState.session;
      const saved = await writeUserNode(user.uid, nextState);
      return res.json({ stats: summarize(saved, now), awayAddedSeconds: Math.floor((updated.added || 0) / 1000) });
    }

    if (action === 'sharing') {
      assert(typeof body.enabled === 'boolean', 'Giá trị chia sẻ không hợp lệ.');
      const cur = await readUserNode(user.uid);
      const nextState = { ...cur, sharing: body.enabled, displayName: user.name };
      const saved = await writeUserNode(user.uid, nextState);
      return res.json({ stats: summarize(saved, now) });
    }

    assert(false, 'Thao tác không hợp lệ.');
  } catch (error) {
    return fail(res, error);
  }
}
