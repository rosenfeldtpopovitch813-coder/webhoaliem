import { db, identity, fail, assert } from '../lib/exam-server.js';
import { MAX_PLAYERS, INITIAL_HP, ROUND_MS, BETWEEN_ROUNDS_MS, damageFor, publicRoom, isValidQuestion, winner, safeCode } from '../shared/arena-core.js';
import { randomBytes } from 'node:crypto';
const reject=(message,status=400)=>Object.assign(new Error(message),{status});
const delayReason='Lượt trả lời đã đóng hoặc câu hỏi không hợp lệ.';
function finish(room,now){room.status='FINISHED';room.finishedAt=now;room.roundEndsAt=0;room.winnerUid=winner(room.players);}
function advance(room,now){
  if(room.status!=='PLAYING')return;
  if(room.roundEndsAt>now)return;
  if(room.round>=room.questions.length || Object.values(room.players||{}).filter(p=>p.hp>0).length<=1){finish(room,now);return;}
  room.round++;
  room.roundStartedAt=now;
  room.roundEndsAt=now+ROUND_MS;
}
function validateQuestions(questions){assert(Array.isArray(questions) && questions.length>=2 && questions.length<=20,'Cần từ 2 đến 20 câu hỏi.');assert(questions.every(isValidQuestion),'Câu hỏi không hợp lệ (4 đáp án, A–D, cấp độ và chuyên đề).');return questions.map(q=>({prompt:q.prompt.trim(),options:q.options.map(s=>s.trim()),answer:q.answer,topic:q.topic.trim(),level:q.level}));}
async function roomRef(code){assert(safeCode(code),'Mã phòng gồm 8 chữ/số in hoa.');return db().ref(`arena_rooms/${code}`);}
function ensureMember(room,uid){assert(room && room.players?.[uid], 'Không thuộc phòng đấu.',403);}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    const method=req.method;
    assert(['POST','GET'].includes(method),'HTTP method không được hỗ trợ.',405);
    const id=await identity(req);
    const data=method==='GET'?req.query:req.body||{};
    const action=String(data.action||'');
    assert(JSON.stringify(data).length<=24000,'Yêu cầu quá lớn.',413);
    if(action==='create'){
      assert(method==='POST','Yêu cầu POST.',405);
      const questions=validateQuestions(data.questions);
      const code=randomBytes(5).toString('hex').toUpperCase().slice(0,8);
      const now=Date.now();
      const room={id:code,hostUid:id.uid,createdAt:now,status:'LOBBY',round:0,players:{[id.uid]:{name:id.name,hp:INITIAL_HP,score:0,joinedAt:now}},questions,events:{}};
      const ref=await roomRef(code);
      const saved=await ref.transaction(cur=>cur===null?room:undefined,undefined,false);
      assert(saved.committed,'Không thể tạo phòng, hãy thử lại.',409);
      return res.status(201).json({room:publicRoom(room,now)});
    }
    const code=String(data.code||'').trim().toUpperCase();
    const ref=await roomRef(code);
    if(action==='join'){
      assert(method==='POST','Yêu cầu POST.',405);
      let error='';const now=Date.now();
      const result=await ref.transaction(room=>{
        if(!room){error='Không tìm thấy phòng.';return;}
        if(room.players?.[id.uid])return room;
        if(room.status!=='LOBBY'){error='Trận đấu đã bắt đầu.';return;}
        if(Object.keys(room.players||{}).length>=MAX_PLAYERS){error='Phòng đủ 8 người.';return;}
        room.players[id.uid]={name:id.name,hp:INITIAL_HP,score:0,joinedAt:now};return room;
      },undefined,false);
      if(!result.committed)throw reject(error||'Không thể tham gia phòng.',409);
      return res.json({room:publicRoom(result.snapshot.val(),now)});
    }
    if(action==='state'){
      assert(method==='GET','Yêu cầu GET.',405);
      const snap=await ref.get();let room=snap.val();ensureMember(room,id.uid);
      const now=Date.now();
      if(room.status==='PLAYING' && now>=room.roundEndsAt){
        const updated=await ref.transaction(cur=>{if(!cur||cur.status!=='PLAYING')return;advance(cur,Date.now());return cur;},undefined,false);
        if(updated.committed)room=updated.snapshot.val();
      }
      const response=publicRoom(room,Date.now());
      response.myAnswered=Boolean(room.answers?.[room.round]?.[id.uid]);
      return res.json({room:response});
    }
    if(action==='start'){
      assert(method==='POST','Yêu cầu POST.',405);let error='';
      const result=await ref.transaction(room=>{
        if(!room){error='Không tìm thấy phòng.';return;}
        if(room.hostUid!==id.uid){error='Chỉ chủ phòng được bắt đầu.';return;}
        if(room.status!=='LOBBY'){error='Trận đấu đã bắt đầu.';return;}
        if(Object.keys(room.players||{}).length<2){error='Cần ít nhất 2 người chơi.';return;}
        const now=Date.now();room.status='PLAYING';room.round=1;room.roundStartedAt=now;room.roundEndsAt=now+ROUND_MS;return room;
      },undefined,false);
      if(!result.committed)throw reject(error||'Không thể bắt đầu.',409);
      return res.json({room:publicRoom(result.snapshot.val())});
    }
    if(action==='answer'){
      assert(method==='POST','Yêu cầu POST.',405);
      const chosen=String(data.answer||'').toUpperCase();assert(/^[ABCD]$/.test(chosen),'Chọn A/B/C/D.');
      let error='';
      const result=await ref.transaction(room=>{
        if(!room){error='Không tìm thấy phòng.';return;}
        if(!room.players?.[id.uid]){error='Không thuộc phòng.';return;}
        if(room.status!=='PLAYING' || room.round!==Number(data.round)){error=delayReason;return;}
        const now=Date.now();
        if(now>=room.roundEndsAt || now<room.roundStartedAt){error=delayReason;return;}
        if(room.players[id.uid].hp<=0){error='Bạn đã hết HP.';return;}
        room.answers ||= {};room.answers[room.round]||={};
        if(room.answers[room.round][id.uid]){error='Bạn đã trả lời lượt này.';return;}
        const q=room.questions[room.round-1];
        const isCorrect=chosen===q.answer;
        const dmg=isCorrect?damageFor(now-room.roundStartedAt):0;
        room.answers[room.round][id.uid]={chosen,correct:isCorrect,at:now};
        if(isCorrect){
          const targets=Object.keys(room.players).filter(uid=>uid!==id.uid&&room.players[uid].hp>0);
          const target=targets.sort((a,b)=>room.players[b].hp-room.players[a].hp||a.localeCompare(b))[0];
          if(target){room.players[target].hp=Math.max(0,room.players[target].hp-dmg);room.players[id.uid].score+=dmg;}
          room.events ||= {};room.events[`${room.round}_${id.uid}`]={by:id.uid,target:target||null,damage:target?dmg:0,at:now};
        }
        const eligible=Object.keys(room.players).filter(uid=>room.players[uid].hp>0);
        if(eligible.length<=1)finish(room,now);
        else if(eligible.every(uid=>room.answers[room.round][uid])){
          room.roundEndsAt=Math.min(room.roundEndsAt,now+BETWEEN_ROUNDS_MS);
        }
        return room;
      },undefined,false);
      if(!result.committed)throw reject(error||'Không ghi nhận được câu trả lời.',409);
      // Recalculate acceptance from committed snapshot; update function can be retried.
      const committed=result.snapshot.val();const entry=committed.answers?.[Number(data.round)]?.[id.uid];
      return res.json({accepted:!!entry,correct:entry?.correct??false,damage:entry?.correct?committed.events?.[`${data.round}_${id.uid}`]?.damage||0:0,room:publicRoom(committed)});
    }
    if(action==='leave'){
      assert(method==='POST','Yêu cầu POST.',405);let error='';
      const result=await ref.transaction(room=>{
        if(!room||!room.players?.[id.uid]){error='Không thuộc phòng.';return;}
        if(room.status==='LOBBY'){
          delete room.players[id.uid];
          if(!Object.keys(room.players).length)return null;
          if(room.hostUid===id.uid)room.hostUid=Object.keys(room.players).sort((a,b)=>room.players[a].joinedAt-room.players[b].joinedAt)[0];
        }else if(room.status==='PLAYING'){
          room.players[id.uid].hp=0;
          if(Object.values(room.players).filter(p=>p.hp>0).length<=1)finish(room,Date.now());
        }
        return room;
      },undefined,false);
      if(!result.committed)throw reject(error||'Không thể rời phòng.',409);
      return res.json({ok:true});
    }
    throw reject('Hành động không được hỗ trợ.',404);
  }catch(error){return fail(res,error);}
}
