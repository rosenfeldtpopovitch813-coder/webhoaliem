'use strict';
const {getAdmin,verifyUser}=require('../lib/firebase-admin');
const {dayKey}=require('../lib/study-core');
const http=require('../lib/http');
function top(rows){return rows.sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,'vi')).slice(0,10);}
module.exports=async function(req,res){
 http.noStore(res);if(!http.method(res,req,['GET']))return;
 try{const app=getAdmin();await verifyUser(req);const day=dayKey(Date.now());const snap=await app.database().ref('users').once('value');const users=Object.values(snap.val()||{});
  const study=top(users.map(u=>({name:u.name||u.displayName||'Học viên',value:Number(u.dailyStudy?.[day])||0,unit:'giây'})).filter(x=>x.value>0));
  const streak=top(users.map(u=>({name:u.name||u.displayName||'Học viên',value:Number(u.studyStreak)||0,unit:'ngày'})).filter(x=>x.value>0));
  const token=top(users.map(u=>({name:u.name||u.displayName||'Học viên',value:Number(u.wallet?.balance)||0,unit:'token'})).filter(x=>x.value>0));
  const exam=top(users.map(u=>{const rows=Object.values(u.examHistory||{});const max=rows.reduce((m,r)=>Math.max(m,Number(r.score)||0),0);return {name:u.name||u.displayName||'Học viên',value:+max.toFixed(2),unit:'/10'};}).filter(x=>x.value>0));
  return http.ok(res,{day,study,streak,exam,token,criteria:{study:'Hôm nay · Thời gian học',streak:'Streak · Chuỗi ngày',exam:'Điểm thi · Điểm cao nhất trong lịch sử bài thi',token:'Token · Tổng số dư hiện tại'}});
 }catch(error){if(error?.status===401)return http.unauthorized(res);console.error('[leaderboards]',error?.message||error);return http.serverError(res,'Không thể tải bảng xếp hạng.');}
};
