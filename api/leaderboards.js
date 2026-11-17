import { identity, fail, assert } from '../lib/exam-server.js';
import { rtdbGet } from '../lib/rtdb-rest.js';
import { getVNDayIndex } from '../shared/time-utils.js';
import { activeLoginStreakFor, titleFor } from '../shared/study-core.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    assert(req.method === 'GET', 'Method không hợp lệ.', 405);
    const user = await identity(req);
    const all = (await rtdbGet('study_tracking')) || {};
    const day = getVNDayIndex();

    const rows = [];
    const streakRows = [];
    for (const [uid, s] of Object.entries(all)) {
      if (!s || typeof s !== 'object') continue;
      if (s.sharing !== true) continue;
      const totalSeconds = Math.floor((s.totalMs || 0) / 1000);
      const todaySeconds = s.dayIndex === day ? Math.floor((s.dailyMs || 0) / 1000) : 0;
      const studyStreak = s.lastStudyDay >= day - 1 ? s.streak || 0 : 0;
      const loginStreak = activeLoginStreakFor(s, day);
      const bestLoginStreak = Math.max(Math.floor(Number(s.bestLoginStreak) || 0), loginStreak);
      const name = String(s.displayName || 'Người học').slice(0, 80);
      const title = titleFor(totalSeconds);
      rows.push({ uid, name, totalSeconds, todaySeconds, streak: studyStreak, loginStreak, title });
      if (loginStreak > 0) {
        streakRows.push({ uid, name, loginStreak, bestLoginStreak, totalSeconds, title });
      }
    }

    rows.sort((a, b) => b.totalSeconds - a.totalSeconds || b.todaySeconds - a.todaySeconds);
    streakRows.sort((a, b) => b.loginStreak - a.loginStreak || b.bestLoginStreak - a.bestLoginStreak || b.totalSeconds - a.totalSeconds);

    const me = all[user.uid] && typeof all[user.uid] === 'object' ? all[user.uid] : {};
    const myTotalSeconds = Math.floor((me.totalMs || 0) / 1000);
    const myLoginStreak = activeLoginStreakFor(me, day);
    return res.json({
      rows: rows.slice(0, 30),
      streakRows: streakRows.slice(0, 30),
      myStats: {
        sharing: Boolean(me.sharing),
        totalSeconds: myTotalSeconds,
        loginStreak: myLoginStreak,
        bestLoginStreak: Math.max(Math.floor(Number(me.bestLoginStreak) || 0), myLoginStreak),
        title: titleFor(myTotalSeconds)
      }
    });
  } catch (err) {
    return fail(res, err);
  }
}
