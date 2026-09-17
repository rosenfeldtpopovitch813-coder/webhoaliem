(function(){
 'use strict';
 let sessionId='',uid='',busy=false,lastSend=0,confirmation=false,stopping=false;
 function show(message){window.toast?.(message,4000);}
 async function request(action,id=sessionId){
  const user=window.auth?.currentUser;if(!user)throw new Error('AUTH');
  const owner=user.uid,token=await user.getIdToken();
  const response=await fetch('/api/study-time',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,sessionId:id}),signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'SYNC'),{code:data.code});
  if(window.auth?.currentUser?.uid!==owner)throw new Error('ACCOUNT_CHANGED');
  return data;
 }
 function reconcile(data){totalStudySeconds=data.totalStudySeconds;localStorage.setItem('htvvm.studyDay',data.day);localStorage.setItem('htvvm.todayStudySeconds',String(data.todayStudySeconds));window.updateStudyDashboard?.();window.updateRankUI?.();window.__checkStudyBreakMilestone?.();}
 async function sync(force=false){
  const user=window.auth?.currentUser;
  if(!user||!window.isPomoRunning||window.currentPomoMode==='short'||window.currentPomoMode==='long'||confirmation||stopping||busy)return;
  if(!navigator.onLine){if(sessionId){sessionId='';show('Mất mạng: đồng hồ vẫn chạy, thời gian chưa xác nhận sẽ không cộng.');}return;}
  if(!force&&performance.now()-lastSend<15000)return;
  busy=true;lastSend=performance.now();
  try{
   if(uid!==user.uid){sessionId='';uid=user.uid;}
   const data=await request(sessionId?'heartbeat':'start');sessionId=data.sessionId;reconcile(data);
   if(data.needsConfirmation){confirmation=true;window.isPomoRunning=false;show('Phiên học cần xác nhận tiếp tục.');}
  }catch(error){if(error.code==='INVALID_SESSION')sessionId='';console.warn('Study sync',error);show('Chưa đồng bộ được thời gian học. Hệ thống sẽ thử lại.');}
  finally{busy=false;}
 }
 async function stop(){
  stopping=true;const id=sessionId;sessionId='';confirmation=false;
  try{if(id&&navigator.onLine)await request('stop',id);}catch(error){console.warn('Study stop',error);}finally{stopping=false;}
 }
 window.HLStudy={sync,stop,pauseForConfirmation(){confirmation=true;},async continue(){try{if(sessionId)reconcile(await request('continue'));confirmation=false;lastSend=0;}catch{await stop();show('Phiên đã dừng. Bấm Bắt đầu để học tiếp.');}}};
 // Pomodoro remains the local countdown, while the server is the only score writer.
 const toggle=window.togglePomodoro;window.togglePomodoro=function(){const was=window.isPomoRunning;toggle();if(was)stop();else{lastSend=0;sync(true);}};
 for(const name of ['resetPomodoro','setPomoMode']){const original=window[name];window[name]=function(...args){stop();return original(...args);};}
 window.addEventListener('online',()=>sync(true));
 window.addEventListener('hl:auth-change',event=>{if(event.detail.uid!==uid){uid=event.detail.uid||'';sessionId='';confirmation=false;window.isPomoRunning=false;}});
 setInterval(()=>{if(!window.isPomoRunning&&!confirmation&&sessionId)stop();else sync();},15000);
})();
