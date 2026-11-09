import { randomUUID } from 'node:crypto';
import { adminApp } from '../lib/firebase-admin.js';
import { db, identity, fail, assert } from '../lib/exam-server.js';
import { applyHeartbeat, resumeHeartbeat, titleFor } from '../shared/study-core.js';
import { getVNDayIndex } from '../shared/time-utils.js';

const summarize = (s = {}, now = Date.now()) => ({
  totalSeconds: Math.floor((s.totalMs || 0) / 1000),
  todaySeconds: s.dayIndex === getVNDayIndex(now) ? Math.floor((s.dailyMs || 0) / 1000) : 0,
  streak: s.lastStudyDay >= getVNDayIndex(now) - 1 ? s.streak || 0 : 0,
  title: titleFor(Math.floor((s.totalMs || 0) / 1000)),
  sharing: !!s.sharing
});

/**
 * Stateless HTTPS REST helper for Firebase Realtime Database.
 * Avoids frozen WebSocket hangs (10s Vercel Hobby timeout) across warm Lambda invocations.
 */
async function restDbUrl(path) {
  const app = adminApp();
  const baseUrl = String(app.options.databaseURL || process.env.FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    // Trigger standard descriptive error from adminDatabase()
    db();
  }
  const tokenObj = await app.options.credential.getAccessToken();
  const accessToken = tokenObj?.access_token;
  if (!accessToken) throw new Error('Không lấy được access token cho Realtime Database.');
  return `${baseUrl}/${path.replace(/^\/+/, '')}.json?access_token=${encodeURIComponent(accessToken)}`;
}

async function readUserNode(uid) {
  const url = await restDbUrl(`study_tracking/${uid}`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4500);
  try {
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`RTDB GET ${res.status}`);
    const data = await res.json();
    return data && typeof data === 'object' ? data : {};
  } finally {
    clearTimeout(timer);
  }
}

async function writeUserNode(uid, nextState) {
  const url = await restDbUrl(`study_tracking/${uid}`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4500);
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextState),
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`RTDB PUT ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
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

    if (action === 'start') {
      const sessionId = randomUUID();
      const cur = await readUserNode(user.uid);
      // Cho phép tiếp nhận phiên mới ngay lập tức (không khóa cứng nếu người dùng vừa F5)
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
      const updated = applyHeartbeat(baseCur, now, id, user.name);
      const nextState = { ...updated.state };
      if (action === 'stop') delete nextState.session;
      const saved = await writeUserNode(user.uid, nextState);
      return res.json({ stats: summarize(saved, now) });
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
