const {getAdmin,verifyUser}=require('../lib/firebase-admin');
const {beginAttempt,advanceAttempt}=require('../lib/exam-core');
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Chỉ nhận POST.'});
 try{
  const app=getAdmin(),user=await verifyUser(req),body=req.body||{},roomId=String(body.roomId||''),id=String(body.attemptId||''),action=body.action;
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(roomId)||!/^[a-f0-9-]{36}$/.test(id)||!['start','save','submit','resume'].includes(action)||JSON.stringify(body).length>200000)return res.status(400).json({error:'Dữ liệu bài thi không hợp lệ.'});
  const db=app.database(),ref=db.ref(`examAttempts/${user.uid}/${roomId}/${id}`),now=Date.now();let result;
  if(action==='start'){
   const room=(await db.ref('rooms/'+roomId).once('value')).val();
   const started=beginAttempt(room,{uid:user.uid,name:body.name||user.name},id,now);
   // All starts for this user/room share one transaction for attempt limits.
   const parent=ref.parent;
   const tx=await parent.transaction(current=>{current=current||{};if(current[id])return current;const max=Number(room.config?.maxAttempts)||0;if((max>0&&Object.keys(current).length>=max)||Object.keys(current).length>=500)return;return {...current,[id]:started};});
   if(!tx.committed)return res.status(409).json({error:'Bạn đã dùng hết số lượt làm đề này.'});result=tx.snapshot.val()[id];
  }else if(action==='resume'){result=(await ref.once('value')).val();}
  else{const tx=await ref.transaction(current=>advanceAttempt(current,action,body,now));if(!tx.committed)return res.status(404).json({error:'Không tìm thấy lượt làm.'});result=tx.snapshot.val();}
  if(!result)return res.status(404).json({error:'Không tìm thấy lượt làm.'});
  let entry;
  if(result.status==='submitted'){
   entry={uid:user.uid,name:result.name,title:result.title,roomId,attemptId:id,score:result.result.score,timeSpent:result.timeSpent,date:result.submittedAt,correct:result.result.correct,wrong:result.result.wrong,blank:result.result.blank,accuracy:result.result.accuracy,parts:result.result.parts,verified:true};
   // Retry-safe writes; do not recreate a room deleted during an attempt.
   await Promise.all([
    db.ref(`rooms/${roomId}`).transaction(room=>room?{...room,results:{...(room.results||{}),[id]:entry}}:undefined),
    db.ref(`users/${user.uid}/examHistory/${id}`).set(entry)
   ]);
  }
  const review=result.config.allowReview!==false;
  return res.status(200).json({ok:true,serverTime:now,id,startAt:result.startAt,duration:result.duration,status:result.status,revision:result.revision,answers:result.answers,config:result.config,title:result.title,entry:entry||null,result:result.result?{...result.result,details:review?result.result.details:[]}:null,allowReview:review,usedCheckpoint:!!result.usedCheckpoint});
 }catch(error){console.error('Exam',error);return res.status(error.status||503).json({error:'Không thể xử lý bài thi. Bản nháp trên thiết bị vẫn được giữ.'});}
};
