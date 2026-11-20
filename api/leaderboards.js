import { identity, fail, assert } from '../lib/exam-server.js';
import { rtdbGet, rtdbPut } from '../lib/rtdb-rest.js';
import { summarizeStudyStats } from '../shared/study-core.js';

const CACHE_TTL_MS = 25_000;
let publicCache = null;

function buildBoardRows(sourceMap, now) {
  const rows = [];
  const streakRows = [];
  for (const [uid, s] of Object.entries(sourceMap || {})) {
    if (!s || typeof s !== 'object') continue;
    if (s.sharing !== true) continue;
    const st = summarizeStudyStats(s, now);
    const name = String(s.displayName || 'Người học').slice(0, 80);
    rows.push({
      uid,
      name,
      totalSeconds: st.totalSeconds,
      todaySeconds: st.todaySeconds,
      streak: st.streak,
      bestStreak: st.bestStreak,
      title: st.title
    });
    if (st.streak > 0) {
      streakRows.push({
        uid,
        name,
        streak: st.streak,
        bestStreak: st.bestStreak,
        totalSeconds: st.totalSeconds,
        title: st.title
      });
    }
  }
  rows.sort((a, b) => b.totalSeconds - a.totalSeconds || b.todaySeconds - a.todaySeconds);
  streakRows.sort((a, b) => b.streak - a.streak || b.bestStreak - a.bestStreak || b.totalSeconds - a.totalSeconds);
  return { rows: rows.slice(0, 30), streakRows: streakRows.slice(0, 30) };
}

async function loadPublicBoard(now) {
  if (publicCache && now - publicCache.fetchedAt < CACHE_TTL_MS) {
    return publicCache;
  }
  let source = await rtdbGet('leaderboard_public');
  if (!source || typeof source !== 'object' || Object.keys(source).length === 0) {
    // One-time lazy backfill from study_tracking so existing opted-in users remain visible.
    const legacy = (await rtdbGet('study_tracking')) || {};
    const seeded = {};
    for (const [uid, s] of Object.entries(legacy)) {
      if (!s || typeof s !== 'object' || s.sharing !== true) continue;
      seeded[uid] = {
        displayName: String(s.displayName || 'Người học').slice(0, 80),
        sharing: true,
        totalMs: Math.max(0, Math.floor(Number(s.totalMs) || 0)),
        todayKey: String(s.todayKey || ''),
        todayMs: Math.max(0, Math.floor(Number(s.todayMs) || 0)),
        streak: Math.max(0, Math.floor(Number(s.streak) || 0)),
        bestStreak: Math.max(0, Math.floor(Number(s.bestStreak) || 0)),
        lastStudyDay: Number.isInteger(s.lastStudyDay) ? s.lastStudyDay : null,
        updatedAt: now
      };
    }
    if (Object.keys(seeded).length) {
      await rtdbPut('leaderboard_public', seeded).catch(() => {});
    }
    source = seeded;
  }
  const built = buildBoardRows(source, now);
  publicCache = { ...built, fetchedAt: now };
  return publicCache;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    assert(req.method === 'GET', 'Method không hợp lệ.', 405);
    const user = await identity(req);
    const now = Date.now();
    const [board, myRaw] = await Promise.all([
      loadPublicBoard(now),
      rtdbGet(`study_tracking/${user.uid}`)
    ]);
    const me = myRaw && typeof myRaw === 'object' ? myRaw : {};
    return res.json({
      rows: board.rows,
      streakRows: board.streakRows,
      myStats: summarizeStudyStats(me, now)
    });
  } catch (err) {
    return fail(res, err);
  }
}
