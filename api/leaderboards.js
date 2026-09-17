const {getAdmin,verifyUser}=require('../lib/firebase-admin');const {dayKey}=require('../lib/study-core');
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');
 try{const app=getAdmin();await verifyUser(req);const day=dayKey(Date.now());
  const fields=[`dailyStudy/${day}`,'studyStreak'];const snapshots=await Promise.all(fields.map(field=>app.database().ref('users').orderByChild(field).limitToLast(3).once('value')));
  const values=snapshots.map((s,i)=>Object.values(s.val()||{}).map(u=>({name:u.name||u.displayName||'Học viên',value:Number(i?u.studyStreak:u.dailyStudy?.[day])||0})).filter(u=>u.value>0).sort((a,b)=>b.value-a.value));return res.status(200).json({study:values[0],streak:values[1]});
 }catch(error){console.error('Leaderboard',error);return res.status(error.status||503).json({error:'Không thể tải bảng xếp hạng.'});}
};
