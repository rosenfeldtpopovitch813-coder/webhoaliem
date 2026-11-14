import { getVNDayIndex } from './time-utils.js';
export const HEARTBEAT_MS = 15000;
export const MAX_GAP_MS = 45000;
export const MAX_FOCUS_AWAY_MS = 30 * 60 * 1000;
export const MAX_ALLOWLIST_ITEMS = 3;
export const SESSION_TTL_MS = 90000;
export const TITLES = Object.freeze([{seconds:0,label:'Nước tinh khiết'},{seconds:3600,label:'Caffein'},{seconds:7200,label:'Dopamine'},{seconds:10800,label:'Adrenaline'},{seconds:14400,label:'Serotonin'},{seconds:18000,label:'Cortisol'}]);
export function titleFor(seconds){ return [...TITLES].reverse().find(x=>seconds>=x.seconds)?.label||TITLES[0].label; }
export function streakNext(previousDay,previousStreak,timestamp){const day=getVNDayIndex(timestamp);return previousDay===day?previousStreak:previousDay===day-1?previousStreak+1:1;}
export function safeIncrement(lastPing,now){if(!Number.isFinite(lastPing)||now<lastPing)return 0;return Math.min(MAX_GAP_MS,Math.max(0,now-lastPing));}
export function applyHeartbeat(current,now,sessionId,name){const day=getVNDayIndex(now);const state=current&&typeof current==='object'?current:{};const session=state.session;
 if(session&&session.id!==sessionId&&now-session.lastPing<SESSION_TTL_MS)return {state,accepted:false,reason:'another-session'};
 if(!session||session.id!==sessionId){return {state:{...state,displayName:name,session:{id:sessionId,lastPing:now},dayIndex:day,dailyMs:state.dayIndex===day?(state.dailyMs||0):0,totalMs:state.totalMs||0,streak:state.streak||0},accepted:true,added:0};}
 const gap=now-session.lastPing;const added=gap<=MAX_GAP_MS&&gap>=0?gap:0;
 const dayChanged=state.dayIndex!==day;
 const dailyMs=(dayChanged?0:(state.dailyMs||0))+added;
 const totalMs=(state.totalMs||0)+added;
 const streak=added>0?streakNext(state.lastStudyDay,state.streak||0,now):state.streak||0;
 return {state:{...state,displayName:name,dayIndex:day,dailyMs,totalMs,streak,lastStudyDay:added>0?day:state.lastStudyDay??null,session:{id:sessionId,lastPing:now}},accepted:true,added};
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
 return {
  state: {
   ...state,
   displayName: name,
   dayIndex: day,
   dailyMs,
   totalMs,
   streak,
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
