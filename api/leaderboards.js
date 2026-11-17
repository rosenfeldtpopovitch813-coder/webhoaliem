import { identity, fail, assert } from '../lib/exam-server.js';
import { rtdbGet } from '../lib/rtdb-rest.js';
import { summarizeStudyStats } from '../shared/study-core.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    assert(req.method === 'GET', 'Method không hợp lệ.', 405);
    const user = await identity(req);
    const all = (await rtdbGet('study_tracking')) || {};
    const now = Date.now();

    const rows = [];
    const streakRows = [];
    for (const [uid, s] of Object.entries(all)) {
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

    const me = all[user.uid] && typeof all[user.uid] === 'object' ? all[user.uid] : {};
    return res.json({
      rows: rows.slice(0, 30),
      streakRows: streakRows.slice(0, 30),
      myStats: summarizeStudyStats(me, now)
    });
  } catch (err) {
    return fail(res, err);
  }
}
