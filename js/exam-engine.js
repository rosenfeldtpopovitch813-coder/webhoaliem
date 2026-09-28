(function(){
 'use strict';
 let attempt=null,busy=false,clock=null,tickId=null,saveTimer=null,syncing=false;
 const owner=()=>window.auth?.currentUser?.uid;
 const key=(roomId=currentRoomId,userId=owner())=>`htvvm.examDraft.${roomId}.${userId||'guest'}`;
 const now=()=>clock?clock.server+performance.now()-clock.monotonic:Date.now();
 async function request(action,data){
  const user=auth?.currentUser;if(!user)throw Error('AUTH');const token=await user.getIdToken(),start=performance.now();
  const response=await fetch('/api/exam',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,...data}),signal:AbortSignal.timeout(15000)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Không thể kết nối máy chủ.');if(owner()!==user.uid)throw Error('ACCOUNT_CHANGED');
  clock={server:result.serverTime+(performance.now()-start)/2,monotonic:performance.now()};return result;
 }
 function save(){if(!attempt||attempt.status==='submitted')return;attempt.answers={...answers};attempt.savedAt=now();if(!HL.storage.set(key(attempt.roomId,attempt.uid),attempt))window.toast?.('Bộ nhớ thiết bị đầy: không thể lưu nháp.');}
 function payload(){return {roomId:attempt.roomId,attemptId:attempt.id,revision:attempt.revision,answers:{...answers}};}
 function lock(){document.querySelectorAll('#student-sheet input').forEach(el=>el.disabled=true);}
 function renderTimer(){if(!attempt)return;timeRemaining=Math.max(0,Math.ceil((attempt.startAt+attempt.duration*1000-now())/1000));timeSpent=Math.min(attempt.duration,Math.max(0,Math.floor((now()-attempt.startAt)/1000)));document.getElementById('timer').textContent=`${String(Math.floor(timeRemaining/60)).padStart(2,'0')}:${String(timeRemaining%60).padStart(2,'0')}`;if(timeRemaining===0&&attempt.status==='active'){attempt.status='pending';save();submitExam();}}
 function showResult(data){
  if(!data.entry||!data.result)return;
  attempt.status='submitted';attempt.result=data.result;HL.storage.set(key(),attempt);clearInterval(tickId);lock();
  document.getElementById('submit-btn').style.display='none';document.getElementById('score').textContent=data.result.score+'/10';const box=document.getElementById('result');box.classList.remove('hidden');document.getElementById('exam-detail-result')?.remove();
  const extra=document.createElement('div');extra.id='exam-detail-result';extra.className='hl-result';extra.textContent=`Đúng ${data.result.correct} · Sai ${data.result.wrong} · Bỏ trống ${data.result.blank} · Chính xác ${data.result.accuracy}% · ${data.entry.timeSpent} giây. Đúng/sai tính theo từng ý.`;box.append(extra);
  if(data.usedCheckpoint){const p=document.createElement('p');p.textContent='Bài đến máy chủ sau hạn: chấm theo đáp án đã đồng bộ trước khi hết giờ.';extra.append(p);}
  if(data.allowReview){for(const d of data.result.details)showAnswerReview(d.id,d.expected,d.answer,d.type);window.HLLearning?.recordMistakes(attempt,data.result);}
  const print=document.createElement('button');print.textContent='In kết quả';print.className='hl-button';print.onclick=()=>window.print();extra.append(print);
  document.dispatchEvent(new CustomEvent('hl:exam-result',{detail:data.entry}));
 }
 async function checkpoint(){
  if(syncing||busy||!attempt||attempt.status!=='active'||!navigator.onLine)return;
  syncing=true;const id=attempt.id;
  try{const data=await request('save',payload());if(attempt?.id!==id)return;if(data.status==='submitted')showResult(data);}
  catch(error){console.warn('Exam checkpoint',error);window.toast?.('Đáp án đã lưu trên thiết bị, đang chờ đồng bộ.',3500);}
  finally{syncing=false;}
 }
 window.startExam=async function(){
  if(busy)return;const name=document.getElementById('studentName').value.trim();if(!name||!owner())return alert('Hãy đăng nhập và nhập tên.');busy=true;
  try{
   const saved=HL.storage.get(key()),resume=!!saved?.serverBacked&&saved.uid===owner()&&saved.status!=='submitted';let data;
   if(navigator.onLine)data=await request(resume?'resume':'start',{roomId:currentRoomId,attemptId:resume?saved.id:crypto.randomUUID(),name});
   else if(!resume)throw Error('Cần kết nối để bắt đầu bài thi.');
   if(resume)attempt=saved;
   else attempt={id:data.id,uid:owner(),name,roomId:currentRoomId,startAt:data.startAt,duration:data.duration,status:'active',answers:saved?.answers||{},marked:{},revision:0,serverBacked:true,room:{title:data.title,config:data.config}};
   if(data){attempt.startAt=data.startAt;attempt.duration=data.duration;if(data.revision>attempt.revision){attempt.answers=data.answers;attempt.revision=data.revision;}attempt.room={title:data.title,config:data.config};}
   studentName=attempt.name;answers={...attempt.answers};examConfig=attempt.room.config;
   document.getElementById('student-sheet').innerHTML=sheetHTML(examConfig,false);
   for(const [q,v]of Object.entries(answers)){const input=document.getElementById('input-'+q);if(input)input.value=v;else document.querySelector(`#student-sheet input[name="${CSS.escape(q)}"][value="${CSS.escape(String(v))}"]`)?.setAttribute('checked','');}
   for(const [q,v]of Object.entries(attempt.marked||{}))if(v)document.getElementById('row-'+q)?.classList.add('row-marked');
   document.getElementById('result').classList.add('hidden');const button=document.getElementById('submit-btn');button.style.display='block';button.textContent='Nộp bài';button.disabled=false;
   renderQuickNav();
   updateExamStats();
   if(window.innerWidth<1024) switchMobileExamTab('pdf');
   if(examConfig?.lockFullscreen&&document.documentElement.requestFullscreen){
     document.documentElement.requestFullscreen().catch(()=>{});
   }
   switchSection('sec-taking-exam');clearInterval(tickId);save();tickId=setInterval(renderTimer,500);renderTimer();
   if(data?.status==='submitted')showResult(data);else if(attempt.status==='pending'){lock();setTimeout(submitExam,0);}else setTimeout(checkpoint,0);
  }catch(error){console.warn('Start exam',error);alert(error.message||'Không thể mở bài thi.');}finally{busy=false;}
 };
 function updateExamStats(){
  const answeredKeys=Object.keys(answers||{}).filter(k=>answers[k]!==undefined&&answers[k]!=='');
  const total=(examConfig?.abcd||0)+(examConfig?.tf||0)*4+(examConfig?.short||0);
  const count=answeredKeys.length;
  const progressText=document.getElementById('exam-progress-text');
  if(progressText) progressText.textContent=`${count} / ${total}`;
  const sheetCount=document.getElementById('btn-mobile-sheet-count');
  if(sheetCount) sheetCount.textContent=count;
  const floatCount=document.getElementById('mobile-float-count');
  if(floatCount) floatCount.textContent=count;
  const summary=document.getElementById('exam-sheet-summary');
  if(summary) summary.textContent=`${count} đã làm`;
  document.querySelectorAll('#exam-quick-nav button').forEach(btn=>{
    const q=btn.dataset.question;
    const isAnswered=q&&(answers[q]!==undefined&&answers[q]!=='');
    btn.className=isAnswered?'px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 bg-blue-600 text-white shadow-sm':'px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 bg-slate-200 text-slate-700 hover:bg-slate-300';
  });
 }
 function renderQuickNav(){
  const nav=document.getElementById('exam-quick-nav');
  if(!nav) return;
  nav.innerHTML='';
  const rows=document.querySelectorAll('#student-sheet [id^="row-"]');
  rows.forEach((row,i)=>{
    const qId=row.id.replace('row-','');
    const btn=document.createElement('button');
    btn.type='button';
    btn.dataset.question=qId;
    btn.textContent=String(i+1);
    btn.className='px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 bg-slate-200 text-slate-700 hover:bg-slate-300';
    btn.onclick=()=>{
      row.scrollIntoView({behavior:'smooth',block:'center'});
      if(window.innerWidth<1024) switchMobileExamTab('sheet');
    };
    nav.appendChild(btn);
  });
 }
 window.switchMobileExamTab=function(tab){
  const pdfContainer=document.getElementById('exam-pdf-container');
  const sheetContainer=document.getElementById('exam-sheet-container');
  const btnPdf=document.getElementById('btn-mobile-pdf');
  const btnSheet=document.getElementById('btn-mobile-sheet');
  updateExamStats();
  if(tab==='pdf'){
    if(pdfContainer){ pdfContainer.classList.remove('hidden'); pdfContainer.classList.add('flex'); }
    if(sheetContainer){ sheetContainer.classList.add('hidden'); sheetContainer.classList.remove('flex'); }
    if(btnPdf) btnPdf.className='flex-1 py-2.5 rounded-xl font-black text-sm bg-white text-blue-600 shadow-sm transition-all flex items-center justify-center gap-2';
    if(btnSheet) btnSheet.className='flex-1 py-2.5 rounded-xl font-black text-sm text-slate-600 transition-all flex items-center justify-center gap-2';
  }else{
    if(pdfContainer){ pdfContainer.classList.add('hidden'); pdfContainer.classList.remove('flex'); }
    if(sheetContainer){ sheetContainer.classList.remove('hidden'); sheetContainer.classList.add('flex'); }
    if(btnSheet) btnSheet.className='flex-1 py-2.5 rounded-xl font-black text-sm bg-white text-blue-600 shadow-sm transition-all flex items-center justify-center gap-2';
    if(btnPdf) btnPdf.className='flex-1 py-2.5 rounded-xl font-black text-sm text-slate-600 transition-all flex items-center justify-center gap-2';
  }
 };
 window.resumeExamFullscreen=function(){
  const alertBox=document.getElementById('exam-fullscreen-alert');
  if(alertBox) alertBox.classList.add('hidden');
  if(!document.fullscreenElement&&document.documentElement.requestFullscreen){
    document.documentElement.requestFullscreen().catch(()=>{});
  }
 };
 window.exitExamPrompt=function(){
  if(!confirm('Bạn có chắc chắn muốn rời khỏi bài thi?\nBài làm của bạn đã được tự động lưu nháp trên thiết bị.')) return;
  if(document.fullscreenElement&&document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  const alertBox=document.getElementById('exam-fullscreen-alert');
  if(alertBox) alertBox.classList.add('hidden');
  switchSection('sec-exam-list');
  window.toast?.('Đã tạm dừng bài thi. Bản nháp được lưu trên thiết bị.',3000);
 };
 document.addEventListener('fullscreenchange',()=>{
  if(attempt&&attempt.status==='active'&&examConfig?.lockFullscreen){
    const alertBox=document.getElementById('exam-fullscreen-alert');
    if(!document.fullscreenElement){
      if(alertBox) alertBox.classList.remove('hidden');
    }else{
      if(alertBox) alertBox.classList.add('hidden');
    }
  }
 });
 window.saveAns=function(q,v){if(!attempt||attempt.status!=='active')return;answers[q]=String(v).trim();attempt.revision++;updateExamStats();save();clearTimeout(saveTimer);saveTimer=setTimeout(checkpoint,800);};
 window.mark=function(q,checked){if(!attempt||attempt.status!=='active')return;attempt.marked[q]=checked;document.getElementById('row-'+q)?.classList.toggle('row-marked',checked);save();};
 window.submitExam=async function(){
  if(!attempt||busy||attempt.status==='submitted')return;busy=true;attempt.status='pending';attempt.submittedAt=attempt.submittedAt||Math.min(now(),attempt.startAt+attempt.duration*1000);clearInterval(tickId);clearTimeout(saveTimer);lock();save();
  const button=document.getElementById('submit-btn');button.disabled=true;button.textContent='Đang lưu kết quả…';
  try{if(!navigator.onLine)throw Error('OFFLINE');if(owner()!==attempt.uid)throw Error('ACCOUNT_CHANGED');showResult(await request('submit',payload()));}
  catch(error){console.warn('Submit exam',error);button.textContent='Thử lưu lại kết quả';button.style.display='block';window.toast?.('Bài được giữ trên thiết bị. Kết nối lại rồi thử lưu kết quả.',5000);}
  finally{busy=false;button.disabled=false;}
 };
 window.HLExam={get active(){return !!attempt;},get attempt(){return attempt;},save};
 window.addEventListener('pagehide',save);window.addEventListener('online',()=>{if(attempt?.status==='pending')submitExam();else checkpoint();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&attempt?.status==='active'){renderTimer();checkpoint();}});
 window.addEventListener('hl:auth-change',event=>{if(attempt&&event.detail.uid!==attempt.uid){save();clearInterval(tickId);clearTimeout(saveTimer);attempt=null;answers={};clock=null;document.getElementById('student-sheet')?.replaceChildren();}});
})();
