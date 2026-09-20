(function(){
 'use strict';
 const SESSION_KEY='htvvm.studySessionId';
 const CLIENT_KEY='htvvm.studyClientInstanceId';
 let sessionId=sessionStorage.getItem(SESSION_KEY)||'';
 let uid='',busy=false,lastSend=0,confirmation=false,stopping=false;
 const clientInstanceId=sessionStorage.getItem(CLIENT_KEY)||(()=>{const id=crypto.randomUUID();sessionStorage.setItem(CLIENT_KEY,id);return id;})();
 function show(message){window.toast?.(message,4500);}
 function persist(){if(sessionId)sessionStorage.setItem(SESSION_KEY,sessionId);else sessionStorage.removeItem(SESSION_KEY);}
 async function request(action,id=sessionId){
  const user=window.auth?.currentUser;if(!user)throw Object.assign(new Error('AUTH'),{code:'AUTH'});
  const owner=user.uid,token=await user.getIdToken();
  const response=await fetch('/api/study-time',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,sessionId:id,clientInstanceId}),signal:AbortSignal.timeout(12000)});
  let data={};try{data=await response.json();}catch{}
  if(!response.ok)throw Object.assign(new Error(data.error||'SYNC'),{code:data.code||'HTTP_'+response.status,status:response.status});
  if(window.auth?.currentUser?.uid!==owner)throw Object.assign(new Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});
  return data;
 }
 function reconcile(data){
  if(data.sessionId){sessionId=data.sessionId;persist();}
  if(typeof data.totalStudySeconds==='number')window.totalStudySeconds=data.totalStudySeconds;
  try{
   localStorage.setItem('htvvm.studyDay',data.day);
   localStorage.setItem('htvvm.todayStudySeconds',String(data.todayStudySeconds||0));
   localStorage.setItem('htvvm.todaySessions',String(data.todaySessions||0));
  }catch{}
  window.updateStudyDashboard?.();window.updateRankUI?.();window.__checkStudyBreakMilestone?.();
 }
 async function sync(force=false){
  const user=window.auth?.currentUser;
  if(!user||!window.isPomoRunning||window.currentPomoMode==='short'||window.currentPomoMode==='long'||confirmation||stopping||busy)return;
  if(!navigator.onLine){show('Mất mạng: thời gian chưa được xác nhận sẽ không được cộng ngược tự động.');return;}
  if(!force&&performance.now()-lastSend<12000)return;
  busy=true;lastSend=performance.now();
  try{
   if(uid!==user.uid){uid=user.uid;sessionId='';persist();}
   const data=await request(sessionId?'heartbeat':'start',sessionId||undefined);
   reconcile(data);
   if(data.needsConfirmation){confirmation=true;window.isPomoRunning=false;show('Phiên học đã tới mốc xác nhận. Chọn tiếp tục để mở phiên mới.');}
  }catch(error){
   if(['INVALID_SESSION','CONFLICT'].includes(error.code)){sessionId='';persist();if(error.code==='CONFLICT')show('Đang có một phiên học khác hoặc phiên cũ chưa hết hạn.');}
   console.warn('Study sync',error);
  }finally{busy=false;}
 }
 async function stop(){
  stopping=true;confirmation=false;
  const id=sessionId;sessionId='';persist();
  try{if(id&&navigator.onLine){const data=await request('stop',id);reconcile(data);sessionId='';persist();}}catch(error){
   // Stop is idempotent. If the server is unreachable, do not manufacture local credit.
   console.warn('Study stop',error);
  }finally{stopping=false;}
 }
 async function resume(){
  try{
   const data=await request('continue',sessionId);reconcile(data);confirmation=false;lastSend=0;return true;
  }catch{await stop();return false;}
 }
 window.HLStudy={sync,stop,resume,pauseForConfirmation(){confirmation=true;}};
 const originalToggle=window.togglePomodoro;
 window.togglePomodoro=function(){
   const was=!!window.isPomoRunning;
   const result=originalToggle?.();
   if(was)stop();else{lastSend=0;sync(true);}
   return result;
 };
 for(const name of ['resetPomodoro','setPomoMode']){
  const original=window[name];
  window[name]=function(...args){stop();return original?.(...args);};
 }
 window.addEventListener('online',()=>{if(window.isPomoRunning)sync(true);});
 window.addEventListener('hl:auth-change',event=>{if(event.detail.uid!==uid){uid=event.detail.uid||'';sessionId='';persist();confirmation=false;window.isPomoRunning=false;}});
 setInterval(()=>{if(window.isPomoRunning&&!confirmation)sync();else if(!window.isPomoRunning&&sessionId&&!stopping){sessionId='';persist();}},15000);
})();
