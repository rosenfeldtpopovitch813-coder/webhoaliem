const crypto=require('crypto');
const {getAdmin,verifyUser}=require('../lib/firebase-admin');
const {applyStudy,dayKey}=require('../lib/study-core');
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Chỉ nhận POST.'});
 try{
  const app=getAdmin(),user=await verifyUser(req),action=req.body?.action||'heartbeat';
  if(!['start','heartbeat','stop','continue'].includes(action))return res.status(400).json({error:'Thao tác không hợp lệ.'});
  const id=action==='start'?crypto.randomBytes(18).toString('hex'):String(req.body?.sessionId||'');
  if(!/^[a-f0-9]{36}$/.test(id))return res.status(400).json({error:'Mã phiên không hợp lệ.'});
  const now=Date.now(),result=await app.database().ref(`users/${user.uid}`).transaction(data=>applyStudy(data,action,id,now));
  if(!result.committed)return res.status(409).json({error:'Phiên học đã dừng hoặc quá giới hạn.',code:'INVALID_SESSION'});
  const data=result.snapshot.val(),session=data._studySessions?.[id];
  return res.status(200).json({ok:true,sessionId:id,serverTime:now,day:dayKey(now),totalStudySeconds:Number(data.totalStudySeconds)||0,todayStudySeconds:Number(data.dailyStudy?.[dayKey(now)])||0,confirmAt:session?.confirmAt||0,needsConfirmation:!!session&&now>=session.confirmAt});
 }catch(error){console.error('study-time',error);return res.status(error.status||503).json({error:'Không thể đồng bộ phiên học. Hãy thử lại khi có kết nối.'});}
};
