import { randomUUID } from 'node:crypto';
import { db, identity, fail, assert } from '../lib/exam-server.js';
import { applyHeartbeat, titleFor } from '../shared/study-core.js';
import { getVNDayIndex } from '../shared/time-utils.js';
const summarize=(s={},now=Date.now())=>({totalSeconds:Math.floor((s.totalMs||0)/1000),todaySeconds:s.dayIndex===getVNDayIndex(now)?Math.floor((s.dailyMs||0)/1000):0,streak:s.lastStudyDay>=getVNDayIndex(now)-1?s.streak||0:0,title:titleFor(Math.floor((s.totalMs||0)/1000)),sharing:!!s.sharing});
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{
 assert(['GET','POST'].includes(req.method),'Method không hợp lệ.',405);
 const user=await identity(req);const body=req.body||{};const action=req.method==='GET'?'status':String(body.action||'');
 const ref=db().ref(`study_tracking/${user.uid}`);let result;
 if(action==='status'){const snap=await ref.get();return res.json({stats:summarize(snap.val())});}
 if(action==='start'){const sessionId=randomUUID();const now=Date.now();
   // Bắt đầu phiên mới chỉ khi phiên trước đã hết hạn: tránh các tab tranh nhau chiếm phiên.
   let busy=false;result=await ref.transaction(cur=>{
     if(cur?.session && now-cur.session.lastPing<90000){busy=true;return;}
     return applyHeartbeat(cur,now,sessionId,user.name).state;
   },undefined,false);
   assert(result.committed,busy?'Một tab khác đang ghi nhận thời gian. Hãy kết thúc phiên cũ hoặc chờ phiên hết hạn.':'Không thể bắt đầu.',409);
   return res.json({sessionId,stats:summarize(result.snapshot.val(),now)});
 }
 if(action==='ping'||action==='stop'){
   const id=String(body.sessionId||'');assert(/^[0-9a-f-]{36}$/i.test(id),'Phiên không hợp lệ.');
   const now=Date.now();let reason='';result=await ref.transaction(cur=>{
     if(!cur?.session||cur.session.id!==id){reason='Phiên không tồn tại hoặc đã bị thay thế.';return;}
     const updated=applyHeartbeat(cur,now,id,user.name);if(!updated.accepted){reason='Phiên đang được dùng ở nơi khác.';return;}
     if(action==='stop')delete updated.state.session;
     return updated.state;
   },undefined,false);
   assert(result.committed,reason||'Không thể cập nhật phiên.',409);
   return res.json({stats:summarize(result.snapshot.val(),now)});
 }
 if(action==='sharing'){
   assert(typeof body.enabled==='boolean','Giá trị chia sẻ không hợp lệ.');
   result=await ref.transaction(cur=>({...cur,sharing:body.enabled,displayName:user.name}),undefined,false);
   return res.json({stats:summarize(result.snapshot.val())});
 }
 assert(false,'Thao tác không hợp lệ.');
 }catch(error){return fail(res,error);}}
