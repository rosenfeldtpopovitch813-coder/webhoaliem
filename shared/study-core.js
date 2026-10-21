import { getVNDayIndex } from './time-utils.js';
export const HEARTBEAT_MS = 15000;
export const MAX_GAP_MS = 35000;
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
