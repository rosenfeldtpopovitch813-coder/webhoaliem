import { getVNDayIndex } from './time-utils.js';
export const HEARTBEAT_MS = 15000;
export const MAX_GAP_MS = 45000;
export const MAX_FOCUS_AWAY_MS = 30 * 60 * 1000;
export const MAX_ALLOWLIST_ITEMS = 3;
export const SESSION_TTL_MS = 90000;
export const TITLES = Object.freeze([{seconds:0,label:'Nước tinh khiết'},{seconds:3600,label:'Caffein'},{seconds:7200,label:'Dopamine'},{seconds:10800,label:'Adrenaline'},{seconds:14400,label:'Serotonin'},{seconds:18000,label:'Cortisol'}]);
export function titleFor(seconds){ return [...TITLES].reverse().find(x=>seconds>=x.seconds)?.label||TITLES[0].label; }
export function streakNext(previousDay,previousStreak,timestamp){const day=getVNDayIndex(timestamp);const prev=Math.max(0,Math.floor(Number(previousStreak)||0));return previousDay===day?Math.max(1,prev):previousDay===day-1?prev+1:1;}
export function safeIncrement(lastPing,now){if(!Number.isFinite(lastPing)||now<lastPing)return 0;return Math.min(MAX_GAP_MS,Math.max(0,now-lastPing));}
export function applyHeartbeat(current,now,sessionId,name){const day=getVNDayIndex(now);const state=current&&typeof current==='object'?current:{};const session=state.session;
 if(session&&session.id!==sessionId&&now-session.lastPing<SESSION_TTL_MS)return {state,accepted:false,reason:'another-session'};
 if(!session||session.id!==sessionId){return {state:{...state,displayName:name,session:{id:sessionId,lastPing:now},dayIndex:day,dailyMs:state.dayIndex===day?(state.dailyMs||0):0,totalMs:state.totalMs||0,streak:state.streak||0},accepted:true,added:0};}
 const gap=now-session.lastPing;const added=gap<=MAX_GAP_MS&&gap>=0?gap:0;
 const dayChanged=state.dayIndex!==day;
 const dailyMs=(dayChanged?0:(state.dailyMs||0))+added;
 const totalMs=(state.totalMs||0)+added;
 const streak=added>0?streakNext(state.lastStudyDay,state.streak||0,now):state.streak||0;
 const bestStreak=Math.max(Math.floor(Number(state.bestStreak)||0),streak);
 return {state:{...state,displayName:name,dayIndex:day,dailyMs,totalMs,streak,bestStreak,lastStudyDay:added>0?day:state.lastStudyDay??null,session:{id:sessionId,lastPing:now}},accepted:true,added};
}

/** Credit bounded off-tab Focus Mode study time up to elapsed clock delta and MAX_FOCUS_AWAY_MS. */
export function claimFocusAway(current, now, sessionId, name, requestedAwayMs) {
 const day = getVNDayIndex(now);
 const state = current && typeof current === 'object' ? current : {};
 const session = state.session;
 if (!session || session.id !== sessionId) {
  return { state, accepted: false, reason: 'session-not-found', added: 0 };
 }
 const elapsed = Math.max(0, now - (Number(session.lastPing) || now));
 const cappedReq = Math.max(0, Math.min(MAX_FOCUS_AWAY_MS, Math.floor(Number(requestedAwayMs) || 0)));
 const added = Math.min(elapsed, cappedReq);
 const dayChanged = state.dayIndex !== day;
 const dailyMs = (dayChanged ? 0 : (state.dailyMs || 0)) + added;
 const totalMs = (state.totalMs || 0) + added;
 const streak = added > 0 ? streakNext(state.lastStudyDay, state.streak || 0, now) : state.streak || 0;
 const bestStreak = Math.max(Math.floor(Number(state.bestStreak) || 0), streak);
 return {
  state: {
   ...state,
   displayName: name,
   dayIndex: day,
   dailyMs,
   totalMs,
   streak,
   bestStreak,
   lastStudyDay: added > 0 ? day : state.lastStudyDay ?? null,
   session: { id: sessionId, lastPing: now }
  },
  accepted: true,
  added
 };
}

export function normalizeFocusTarget(raw) {
 const text = String(raw || '').trim();
 if (!text) throw Error('Hãy nhập tên ứng dụng hoặc địa chỉ trang web.');
 const trimmed = text.slice(0, 80);
 const looksLikeUrl = /^https?:\/\//i.test(trimmed) || /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?:#]|$)/i.test(trimmed);
 if (looksLikeUrl) {
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url;
  try { url = new URL(candidate); } catch { throw Error('Địa chỉ trang web không hợp lệ.'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw Error('Chỉ hỗ trợ liên kết HTTP/HTTPS.');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!host.includes('.')) throw Error('Tên miền chưa hợp lệ.');
  return { id: `web:${host}`, label: host, kind: 'web', host, openUrl: url.href };
 }
 return { id: `app:${trimmed.toLowerCase()}`, label: trimmed, kind: 'app', host: null, openUrl: '' };
}

export function isUrlAllowedInFocus(urlString, allowlist = []) {
 if (!Array.isArray(allowlist) || !allowlist.length) return false;
 let host = '';
 try { host = new URL(String(urlString || '')).hostname.toLowerCase().replace(/^www\./, ''); }
 catch { return false; }
 return allowlist.some(item => {
  if (!item || item.kind !== 'web' || !item.host) return false;
  const h = item.host.toLowerCase().replace(/^www\./, '');
  if (host === h || host.endsWith(`.${h}`)) return true;
  if (h === 'youtube.com' && (host === 'youtu.be' || host === 'youtube-nocookie.com' || host.endsWith('.youtube.com'))) return true;
  if (h === 'drive.google.com' && (host === 'docs.google.com' || host.endsWith('.google.com'))) return host === 'drive.google.com' || host === 'docs.google.com';
  return false;
 });
}

/** Resume an existing session for the same authenticated user without crediting a long offline gap. */
export function resumeHeartbeat(current, now, sessionId, name) {
 const state = current && typeof current === 'object' ? current : {};
 if (!state.session || state.session.id !== sessionId) {
   return { state, accepted: false, reason: 'session-not-found', added: 0 };
 }
 return applyHeartbeat(state, now, sessionId, name);
}

/** Compute progress ("thanh nộ") toward the next rank title in Focus Zone. */
export function rankProgressFor(totalSeconds = 0) {
 const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
 let idx = 0;
 for (let i = 0; i < TITLES.length; i++) {
   if (sec >= TITLES[i].seconds) idx = i;
 }
 const current = TITLES[idx];
 const next = TITLES[idx + 1] || null;
 if (!next) {
   return {
     currentTitle: current.label,
     nextTitle: null,
     currentMinSeconds: current.seconds,
     nextMinSeconds: current.seconds,
     progressRatio: 1,
     remainingSeconds: 0,
     isMax: true
   };
 }
 const span = Math.max(1, next.seconds - current.seconds);
 const done = Math.max(0, sec - current.seconds);
 return {
   currentTitle: current.label,
   nextTitle: next.label,
   currentMinSeconds: current.seconds,
   nextMinSeconds: next.seconds,
   progressRatio: Math.max(0, Math.min(1, done / span)),
   remainingSeconds: Math.max(0, next.seconds - sec),
   isMax: false
 };
}

/** Return active VN login streak if checked in today or yesterday. */
export function activeLoginStreakFor(state = {}, day = getVNDayIndex()) {
 const lastDay = Number(state?.lastLoginDay);
 if (!Number.isFinite(lastDay) || lastDay < day - 1) return 0;
 return Math.max(0, Math.floor(Number(state?.loginStreak) || 0));
}

/** Update consecutive daily login streak using server VN day index (UTC+7). */
export function applyLoginStreak(current, now = Date.now(), name = 'Người học') {
  const day = getVNDayIndex(now);
  const state = current && typeof current === 'object' ? current : {};
  const prevDay = Number(state.lastLoginDay);
  const activeStudyStreak = Number(state.lastStudyDay) >= day - 1
    ? Math.max(0, Math.floor(Number(state.streak) || 0))
    : 0;
  let loginStreak = Math.max(0, Math.floor(Number(state.loginStreak) || 0));
  let incremented = false;
  if (prevDay === day) {
    loginStreak = Math.max(1, loginStreak);
  } else if (prevDay === day - 1) {
    loginStreak = loginStreak + 1;
    incremented = true;
  } else {
    loginStreak = 1;
    incremented = true;
  }
  // Carry over pre-existing active consecutive study streak once if account lacked loginSeeded.
  if (!state.loginSeeded && activeStudyStreak > loginStreak) {
    loginStreak = activeStudyStreak;
  }
  const bestLoginStreak = Math.max(Math.floor(Number(state.bestLoginStreak) || 0), loginStreak, activeStudyStreak);
  return {
    incremented,
    state: {
      ...state,
      displayName: String(name || state.displayName || 'Người học').slice(0, 80),
      lastLoginDay: day,
      lastLoginAt: now,
      loginStreak,
      bestLoginStreak,
      loginSeeded: true
    }
  };
}

/** Serialize canonical server study + streak stats shared across tracker and leaderboard APIs. */
export function summarizeStudyStats(s = {}, now = Date.now()) {
  const day = getVNDayIndex(now);
  const totalSeconds = Math.floor((s?.totalMs || 0) / 1000);
  const todaySeconds = s?.dayIndex === day ? Math.floor((s?.dailyMs || 0) / 1000) : 0;
  const streak = Number(s?.lastStudyDay) >= day - 1 ? Math.max(0, Math.floor(Number(s?.streak) || 0)) : 0;
  const bestStreak = Math.max(Math.floor(Number(s?.bestStreak) || 0), streak);
  const rawLoginStreak = activeLoginStreakFor(s, day);
  const loginStreak = !s?.loginSeeded && streak > rawLoginStreak ? streak : rawLoginStreak;
  const bestLoginStreak = Math.max(Math.floor(Number(s?.bestLoginStreak) || 0), loginStreak, streak);
  return {
    totalSeconds,
    todaySeconds,
    streak,
    bestStreak,
    loginStreak,
    bestLoginStreak,
    lastStudyDay: s?.lastStudyDay ?? null,
    lastLoginDay: s?.lastLoginDay ?? null,
    title: titleFor(totalSeconds),
    sharing: !!s?.sharing,
    serverNow: now
  };
}
