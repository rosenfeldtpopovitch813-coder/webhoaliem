const admin = require('firebase-admin');
const crypto = require('crypto');

const MAX_DAILY_SECONDS = 24 * 60 * 60;
const MAX_HEARTBEAT_SECONDS = 30;

function getAdmin() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Thiếu FIREBASE_SERVICE_ACCOUNT_JSON trên Vercel.');
  const serviceAccount = JSON.parse(raw);
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://thikscl-default-rtdb.firebaseio.com'
  });
}

async function verifyUser(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) {
    const e = new Error('Thiếu Firebase ID token.'); e.status = 401; throw e;
  }
  return admin.auth().verifyIdToken(header.slice(7).trim());
}

// Firebase/Vercel có thể chạy ở UTC. Web của bạn dùng ngày Việt Nam,
// nên tuyệt đối không dùng new Date().getDate() trực tiếp ở server.
function vietnamDayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ nhận POST request.' });

  try {
    const app = getAdmin();
    const user = await verifyUser(req);
    const db = app.database();
    const body = req.body || {};
    const action = String(body.action || 'heartbeat');
    const now = Date.now();
    const uid = user.uid;
    const day = vietnamDayKey(new Date(now));

    // Mỗi thiết bị/phiên có session riêng. Không cho điện thoại ghi đè session của PC.
    const sessionsRoot = db.ref(`studySessions/${uid}`);

    if (action === 'start') {
      const sessionId = crypto.randomBytes(18).toString('hex');
      const sessionRef = sessionsRoot.child(sessionId);
      await sessionRef.set({
        uid,
        sessionId,
        startedAt: now,
        lastHeartbeatAt: now,
        day,
        active: true
      });
      return res.status(200).json({ ok: true, sessionId, serverTime: now, day });
    }

    const sessionId = String(body.sessionId || '');
    if (!sessionId) return res.status(400).json({ error: 'Thiếu sessionId.' });
    const sessionRef = sessionsRoot.child(sessionId);

    if (action === 'heartbeat') {
      const seconds = Math.floor(Number(body.seconds));
      if (!Number.isFinite(seconds) || seconds < 1 || seconds > MAX_HEARTBEAT_SECONDS) {
        return res.status(400).json({ error: 'Heartbeat không hợp lệ.' });
      }

      const snap = await sessionRef.once('value');
      const session = snap.val();
      if (!session || !session.active || session.uid !== uid) {
        return res.status(409).json({ error: 'Phiên học không còn hợp lệ.', code: 'INVALID_SESSION' });
      }

      if (session.day !== day) {
        await sessionRef.remove();
        return res.status(409).json({ error: 'Đã sang ngày mới. Hãy bắt đầu phiên mới.', code: 'NEW_DAY' });
      }

      const last = Number(session.lastHeartbeatAt) || now;
      const elapsed = Math.max(0, Math.floor((now - last) / 1000));
      // Chỉ chấp nhận tối đa thời gian thực + 2s chống lệch mạng/timer.
      const allowedByClock = Math.min(MAX_HEARTBEAT_SECONDS, elapsed + 2);
      const requested = Math.min(MAX_HEARTBEAT_SECONDS, seconds);
      const candidate = Math.min(requested, allowedByClock);
      if (candidate <= 0) return res.status(200).json({ ok: true, accepted: 0 });

      const dailyRef = db.ref(`users/${uid}/dailyStudy/${day}`);
      const totalRef = db.ref(`users/${uid}/totalStudySeconds`);

      let accepted = 0;
      await dailyRef.transaction(current => {
        const currentDay = Math.max(0, Number(current) || 0);
        if (currentDay >= MAX_DAILY_SECONDS) {
          accepted = 0;
          return currentDay;
        }
        accepted = Math.min(candidate, MAX_DAILY_SECONDS - currentDay);
        return currentDay + accepted;
      });

      if (accepted > 0) {
        await totalRef.transaction(current => Math.max(0, Number(current) || 0) + accepted);
      }

      // Luôn tiến heartbeat theo server time để client không thể tích lũy backlog vô hạn.
      await sessionRef.update({ lastHeartbeatAt: now });

      const [totalSnap, daySnap] = await Promise.all([totalRef.once('value'), dailyRef.once('value')]);
      return res.status(200).json({
        ok: true,
        accepted,
        totalStudySeconds: Number(totalSnap.val()) || 0,
        todayStudySeconds: Math.min(MAX_DAILY_SECONDS, Number(daySnap.val()) || 0),
        serverTime: now,
        day
      });
    }

    if (action === 'stop') {
      const snap = await sessionRef.once('value');
      if (snap.val()?.uid === uid && snap.val()?.sessionId === sessionId) {
        await sessionRef.remove();
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Action không hợp lệ.' });
  } catch (e) {
    console.error('study-time:', e);
    return res.status(e.status || 500).json({ error: e.message || 'Lỗi máy chủ.' });
  }
};
