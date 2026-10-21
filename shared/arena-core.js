export const MAX_PLAYERS = 8;
export const INITIAL_HP = 200;
export const ROUND_MS = 20000;
export const BETWEEN_ROUNDS_MS = 2500;
export function damageFor(elapsedMs, roundMs=ROUND_MS, base=30, alpha=0.5) {
  if (![elapsedMs,roundMs,base,alpha].every(Number.isFinite) || roundMs<=0) throw Error('Thông số sát thương sai');
  return Math.round(base*(1+alpha*(roundMs-Math.min(roundMs,Math.max(0,elapsedMs)))/roundMs));
}
export function publicRoom(room, now=Date.now()) {
  if (!room) return null;
  const players=Object.entries(room.players||{}).map(([uid,p])=>({uid,name:p.name,hp:p.hp,score:p.score||0,joinedAt:p.joinedAt}));
  const result={id:room.id,hostUid:room.hostUid,status:room.status,players,maxPlayers:MAX_PLAYERS,round:room.round||0,totalRounds:room.questions?.length||0,serverNow:now,roundEndsAt:room.roundEndsAt||null,winnerUid:room.winnerUid||null,events:Object.values(room.events||{}).slice(-15),createdAt:room.createdAt};
  if(room.status==='PLAYING' && room.roundEndsAt>now && room.round>0){const q=room.questions[room.round-1];result.question={prompt:q.prompt,options:q.options,topic:q.topic,level:q.level};}
  if(room.status==='FINISHED') result.finishedAt=room.finishedAt;
  return result;
}
export function isValidQuestion(q) {return !!(q && typeof q.prompt==='string' && q.prompt.trim().length>=8 && q.prompt.length<=800 && Array.isArray(q.options) && q.options.length===4 && q.options.every(x=>typeof x==='string' && x.trim() && x.length<=250) && 'ABCD'.includes(q.answer) && q.answer.length===1 && ['Nhận biết','Thông hiểu','Vận dụng','Vận dụng cao'].includes(q.level) && typeof q.topic==='string' && q.topic.length<=80);}
export function winner(players){return Object.entries(players).sort((a,b)=>b[1].hp-a[1].hp||b[1].score-a[1].score||a[1].joinedAt-b[1].joinedAt)[0]?.[0]||null;}
export function safeCode(code) {return typeof code==='string' && /^[A-Z0-9]{8}$/.test(code);}
