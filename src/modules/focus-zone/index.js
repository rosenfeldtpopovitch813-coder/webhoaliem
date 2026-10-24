import { element, button } from '../../core/dom.js';
import { auth } from '../../core/firebase.js';
import { HEARTBEAT_MS, titleFor } from '../../../shared/study-core.js';
import { DEFAULT_FOCUS_SECONDS, durationFromFields, normalizeRemaining, remainingFocusSeconds, validFocusDuration } from '../../../shared/focus-timer.js';
import { resolveResourceLink } from '../../../shared/resource-links.js';
const fmt=s=>`${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
function field(type, placeholder, value = '') { const el = element(type === 'textarea' ? 'textarea' : 'input', 'exam-input'); if (type !== 'textarea') el.type = type; el.placeholder = placeholder; el.value = value; return el; }
let cleanup=()=>{};
export function renderFocus(){cleanup();const root=element('div','focus-page');const heading=element('section','focus-hero');heading.append(element('h2','hero-title','◷ Góc tập trung'),element('p','hero-subtitle','Pomodoro, tài liệu, nhạc học và theo dõi thời gian học.'));root.append(heading);
 const grid=element('div','focus-layout');const left=element('div','focus-stack');const right=element('div','focus-stack');grid.append(left,right);root.append(grid);
 const timerBox=element('section','focus-card');
 timerBox.append(element('h3','','Đồng hồ Pomodoro'));
 const modes=element('div','focus-actions');
 const readDuration=()=>{try{const n=Number(localStorage.getItem('htvvm-focus-duration-v1'));return validFocusDuration(n)?n:DEFAULT_FOCUS_SECONDS}catch{return DEFAULT_FOCUS_SECONDS}};
 const initialDuration=readDuration();
 const restoredTimer=(()=>{try{const s=JSON.parse(localStorage.getItem('htvvm-focus-timer-state-v2')||'null');if(s&&s.duration===initialDuration&&validFocusDuration(s.duration)&&Number.isFinite(s.remaining))return s;}catch{}return null;})();
 let duration=initialDuration;
 let seconds=restoredTimer?normalizeRemaining(restoredTimer.remaining,duration):duration;
 let selectedMode=(()=>{try{const mode=restoredTimer?.mode||localStorage.getItem('htvvm-focus-mode-v1');return mode==='break'?'break':'focus'}catch{return 'focus'}})();
 let running=false,started=0,remainingAtStart=seconds;
 let modeButtons=[],minutesInput=null,secondsInput=null,customStatus=null;
 const digits=element('div','focus-time',fmt(seconds));
 function saveTimerState(){try{localStorage.setItem('htvvm-focus-duration-v1',String(duration));localStorage.setItem('htvvm-focus-mode-v1',selectedMode);localStorage.setItem('htvvm-focus-timer-state-v2',JSON.stringify({duration,remaining:seconds,mode:selectedMode,savedAt:Date.now()}));}catch{}}
 function updateControls(){toggle.textContent=running?'Tạm dừng':'Bắt đầu';toggle.setAttribute('aria-pressed',String(running));}
 function syncModeButtons(){modeButtons.forEach((b,i)=>b.classList.toggle('selected',(i===0&&duration===1500&&selectedMode==='focus')||(i===1&&duration===300&&selectedMode==='break')||(i===2&&duration===900&&selectedMode==='break')));}
 async function selectPreset(s,mode){
   if(running){seconds=remainingFocusSeconds(remainingAtStart,started,performance.now());running=false;}
   if(sessionOrigin==='pomodoro')await stopSession('Đã dừng phiên ghi nhận theo đồng hồ.');
   duration=s;seconds=s;selectedMode=mode;remainingAtStart=seconds;digits.textContent=fmt(seconds);
   if(minutesInput)minutesInput.value=String(Math.floor(s/60));if(secondsInput)secondsInput.value=String(s%60);
   if(customStatus)customStatus.textContent=`Đang dùng ${Math.floor(s/60)} phút ${s%60} giây.`;
   syncModeButtons();saveTimerState();updateControls();
 }
 for(const [label,s,mode] of [['Tập trung · 25′',1500,'focus'],['Nghỉ ngắn · 5′',300,'break'],['Nghỉ dài · 15′',900,'break']]){
   const b=button(label,'focus-btn',()=>selectPreset(s,mode));modes.append(b);modeButtons.push(b);
 }
 syncModeButtons();
 const controls=element('div','focus-actions');
 const toggle=button('Bắt đầu','focus-btn primary',async()=>{
   if(running){
     seconds=remainingFocusSeconds(remainingAtStart,started,performance.now());running=false;digits.textContent=fmt(seconds);saveTimerState();updateControls();
     if(sessionOrigin==='pomodoro')await stopSession('Đã tạm dừng đồng hồ; thời gian học đã được lưu.');
     else status.textContent='Đồng hồ đã tạm dừng.';
     return;
   }
   if(seconds<=0)seconds=duration;
   if(selectedMode==='focus'&&!sessionId){const ok=await startSession('pomodoro');if(!ok)return;}
   running=true;started=performance.now();remainingAtStart=seconds;lastTimerPersist=0;saveTimerState();updateControls();
   if(selectedMode==='break'&&!sessionId)status.textContent='Đồng hồ nghỉ đang chạy; thời gian nghỉ không cộng vào giờ học.';
 });
 const reset=button('Đặt lại','focus-btn',async()=>{
   running=false;seconds=duration;digits.textContent=fmt(seconds);saveTimerState();updateControls();
   if(sessionOrigin==='pomodoro')await stopSession('Đã đặt lại đồng hồ và lưu phiên học.');
 });
 controls.append(toggle,reset);
 const durationEditor=element('div','focus-duration-editor');durationEditor.append(element('label','focus-duration-label','Tùy chỉnh thời lượng'));
 minutesInput=field('number','Phút',String(Math.floor(duration/60)));minutesInput.min='0';minutesInput.max='240';minutesInput.step='1';minutesInput.setAttribute('aria-label','Số phút');
 secondsInput=field('number','Giây',String(duration%60));secondsInput.min='0';secondsInput.max='59';secondsInput.step='1';secondsInput.setAttribute('aria-label','Số giây');
 const durationFields=element('div','focus-duration-fields');durationFields.append(minutesInput,element('span','focus-duration-unit','phút'),secondsInput,element('span','focus-duration-unit','giây'));
 customStatus=element('p','focus-muted',`Đang dùng ${Math.floor(duration/60)} phút ${duration%60} giây.`);
 const applyDuration=button('Áp dụng thời lượng','focus-btn primary',async()=>{
   const next=durationFromFields(Number(minutesInput.value),Number(secondsInput.value));
   if(next===null){customStatus.textContent='Nhập thời lượng từ 1 giây đến 240 phút.';return;}
   running=false;if(sessionOrigin==='pomodoro')await stopSession('Đã thay thời lượng và lưu phiên học trước đó.');
   duration=next;seconds=next;selectedMode='focus';digits.textContent=fmt(seconds);remainingAtStart=seconds;
   modeButtons.forEach(x=>x.classList.remove('selected'));customStatus.textContent=`Đã đặt ${Math.floor(next/60)} phút ${next%60} giây.`;
   saveTimerState();updateControls();
 });
 durationEditor.append(durationFields,applyDuration,customStatus);
 timerBox.append(modes,durationEditor,digits,controls,element('p','focus-muted','Bắt đầu đồng hồ tập trung sẽ tự ghi nhận giờ học. Đồng hồ tự dừng khi chuyển tab hoặc rời Góc tập trung.'));
 left.append(timerBox);
 const statsBox=element('section','focus-card');statsBox.append(element('h3','','Tiến độ học tập'));
 const stateLine=element('p','focus-muted','Bắt đầu đồng hồ tập trung để tự ghi nhận thời gian học.');
 const stats=element('div','focus-stats');const status=element('p','focus-muted','Sẵn sàng ghi nhận giờ học.');
 const actions=element('div','focus-actions');
 const begin=button('Bắt đầu ghi nhận giờ học','focus-btn primary',()=>startSession('manual'));
 const end=button('Kết thúc phiên','focus-btn',async()=>{if(running){seconds=remainingFocusSeconds(remainingAtStart,started,performance.now());running=false;digits.textContent=fmt(seconds);saveTimerState();updateControls();}await stopSession('Đã lưu và kết thúc phiên học.');});end.disabled=true;actions.append(begin,end);
 const shareLabel=element('label','focus-share');const shareInput=document.createElement('input');shareInput.type='checkbox';shareLabel.append(shareInput,document.createTextNode(' Hiện tôi trên bảng xếp hạng (tự nguyện)'));
 statsBox.append(stateLine,stats,status,actions,shareLabel);left.append(statsBox);
 const resources=element('section','focus-card');resources.append(element('h3','','Tài liệu & YouTube'));const resourceStatus=element('p','focus-muted','Hai khung tài nguyên độc lập: video bên trái, tài liệu bên phải.');
 const resourceSplit=element('div','focus-resource-split');
 // LEFT PANE — compact YouTube screen with its own URL and controls.
 const youtubePane=element('section','focus-resource-pane');youtubePane.append(element('h4','','YouTube'),element('p','focus-muted','Màn hình video riêng · hỗ trợ video và playlist.'));
 const youtubeInput=document.createElement('input');youtubeInput.type='url';youtubeInput.className='exam-input';youtubeInput.placeholder='Dán link YouTube…';youtubeInput.setAttribute('aria-label','Liên kết YouTube');
 const youtubeFrame=document.createElement('iframe');youtubeFrame.className='focus-youtube-frame';youtubeFrame.title='Trình phát YouTube';youtubeFrame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';youtubeFrame.allowFullscreen=true;youtubeFrame.referrerPolicy='strict-origin-when-cross-origin';youtubeFrame.hidden=true;
 const youtubeActions=element('div','focus-actions');const openYoutube=button('Phát video','focus-btn primary',()=>playYoutube());const clearYoutube=button('Xóa video','focus-btn',()=>{youtubeInput.value='';youtubeFrame.removeAttribute('src');youtubeFrame.hidden=true;youtubeOpen.hidden=true;});youtubeActions.append(openYoutube,clearYoutube);
 const youtubeOpen=document.createElement('a');youtubeOpen.className='focus-resource-open';youtubeOpen.target='_blank';youtubeOpen.rel='noopener noreferrer';youtubeOpen.textContent='Mở YouTube trong tab mới ↗';youtubeOpen.hidden=true;
 function playYoutube(){try{const resource=resolveResourceLink(youtubeInput.value);if(resource.type!=='youtube')throw Error('Khung này chỉ nhận link YouTube.');youtubeFrame.src=resource.embedUrl;youtubeFrame.hidden=false;youtubeOpen.href=resource.openUrl;youtubeOpen.hidden=false;resourceStatus.textContent='Đã mở video YouTube.';}catch(error){youtubeFrame.hidden=true;youtubeOpen.hidden=true;resourceStatus.textContent=error.message;}}
 youtubeInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();playYoutube();}});
 youtubePane.append(youtubeInput,youtubeActions,youtubeFrame,youtubeOpen);
 // RIGHT PANE — document link/local PDF and one preview screen.
 const documentPane=element('section','focus-resource-pane');documentPane.append(element('h4','','Tài liệu'),element('p','focus-muted','Xem trước PDF, Google Docs, Sheets, Slides hoặc tệp Drive được chia sẻ.'));
 const documentInput=document.createElement('input');documentInput.type='url';documentInput.className='exam-input';documentInput.placeholder='Dán link tài liệu Google Drive…';documentInput.setAttribute('aria-label','Liên kết tài liệu');
 const documentActions=element('div','focus-actions');const previewDocument=button('Xem tài liệu','focus-btn primary',()=>openDocumentLink());const clearDocument=button('Xóa tài liệu','focus-btn',()=>{documentInput.value='';documentFrame.removeAttribute('src');documentFrame.hidden=true;documentOpen.hidden=true;if(pdfURL){URL.revokeObjectURL(pdfURL);pdfURL='';}pdf.value='';});documentActions.append(previewDocument,clearDocument);
 const pdf=document.createElement('input');pdf.type='file';pdf.accept='application/pdf';pdf.className='exam-input';pdf.setAttribute('aria-label','Chọn PDF từ máy');let pdfURL='';
 const documentFrame=document.createElement('iframe');documentFrame.className='focus-document-frame';documentFrame.title='Màn hình xem trước tài liệu';documentFrame.referrerPolicy='strict-origin-when-cross-origin';documentFrame.hidden=true;
 const documentOpen=document.createElement('a');documentOpen.className='focus-resource-open';documentOpen.target='_blank';documentOpen.rel='noopener noreferrer';documentOpen.textContent='Mở tài liệu trong tab mới ↗';documentOpen.hidden=true;
 function openDocumentLink(){try{const resource=resolveResourceLink(documentInput.value);if(resource.type!=='drive')throw Error('Khung này chỉ nhận liên kết Google Drive/Docs. Dùng khung bên trái cho YouTube.');if(pdfURL){URL.revokeObjectURL(pdfURL);pdfURL='';}documentFrame.src=resource.embedUrl;documentFrame.hidden=false;documentOpen.href=resource.openUrl;documentOpen.hidden=false;resourceStatus.textContent='Đã mở bản xem trước tài liệu.';}catch(error){documentFrame.hidden=true;documentOpen.hidden=true;resourceStatus.textContent=error.message;}}
 documentInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();openDocumentLink();}});
 pdf.addEventListener('change',()=>{if(pdfURL){URL.revokeObjectURL(pdfURL);pdfURL='';}const file=pdf.files?.[0];if(!file)return;if(file.type!=='application/pdf'||file.size>30*1024*1024){resourceStatus.textContent='Chỉ hỗ trợ PDF tối đa 30 MB.';pdf.value='';return;}pdfURL=URL.createObjectURL(file);documentFrame.src=pdfURL;documentFrame.hidden=false;documentOpen.href=pdfURL;documentOpen.hidden=false;documentOpen.textContent='Mở PDF trong tab mới ↗';resourceStatus.textContent=`Đang xem trước PDF từ thiết bị: ${file.name}. Tệp chưa được tải lên máy chủ.`;});
 documentPane.append(documentInput,documentActions,element('label','focus-resource-label','Hoặc chọn PDF trên thiết bị'),pdf,documentFrame,documentOpen);
 resourceSplit.append(youtubePane,documentPane);
 const musicBox=element('div','focus-music-box');musicBox.append(element('h4','','Nhạc học từ thiết bị'),element('p','focus-muted','Chọn tệp âm thanh trên máy; tệp không tải lên máy chủ.'));
 const music=document.createElement('audio');music.controls=true;music.loop=true;music.className='focus-audio';const audioInput=document.createElement('input');audioInput.type='file';audioInput.accept='audio/*';audioInput.className='exam-input';audioInput.setAttribute('aria-label','Chọn tệp nhạc từ máy');let audioURL='';
 audioInput.addEventListener('change',()=>{if(audioURL){URL.revokeObjectURL(audioURL);audioURL='';}if(audioInput.files?.[0]){const file=audioInput.files[0];if(!file.type.startsWith('audio/')){resourceStatus.textContent='Tệp đã chọn không phải tệp âm thanh.';audioInput.value='';return;}audioURL=URL.createObjectURL(file);music.src=audioURL;resourceStatus.textContent=`Đang phát nhạc: ${file.name}`;}});
 musicBox.append(audioInput,music);
 resources.append(resourceStatus,resourceSplit,musicBox,element('p','focus-muted','Lưu ý: tài liệu Google Drive phải được chia sẻ đúng quyền. Nếu chủ sở hữu chặn nhúng, dùng nút mở ở tab mới.'));right.append(resources);
 const notesBox=element('section','focus-card focus-notes-card');notesBox.append(element('h3','','Lớp học Mực · Bảng ghi chú'));notesBox.append(element('p','focus-muted','Mở bảng viết nhiều trang để ghi công thức, phác thảo bài giải, chèn ảnh/PDF và xuất bài giảng. Bảng được lưu trong bộ nhớ trình duyệt trên thiết bị này.'));
 const notesActions=element('div','focus-actions');const openNotes=button('Mở bảng ghi chú','focus-btn primary',()=>{if(notesFrame.hidden){notesFrame.hidden=false;if(!notesFrame.src||notesFrame.src==='about:blank')notesFrame.src='/focus-notes/index.html?embed=1';openNotes.textContent='Ẩn bảng ghi chú';notesFrame.scrollIntoView({behavior:'smooth',block:'nearest'});}else{notesFrame.hidden=true;openNotes.textContent='Mở bảng ghi chú';}});const fullNotes=button('Toàn màn hình','focus-btn',async()=>{try{if(document.fullscreenElement){await document.exitFullscreen();return}if(notesFrame.hidden){notesFrame.hidden=false;if(!notesFrame.src||notesFrame.src==='about:blank')notesFrame.src='/focus-notes/index.html?embed=1';openNotes.textContent='Ẩn bảng ghi chú';}await notesFrame.requestFullscreen()}catch{notesStatus.textContent='Không thể mở toàn màn hình trong trình duyệt hiện tại.';}});const popNotes=button('Mở riêng ↗','focus-btn',()=>window.open('/focus-notes/index.html','_blank','noopener,noreferrer'));notesActions.append(openNotes,fullNotes,popNotes);
 const notesFrame=document.createElement('iframe');notesFrame.className='focus-notes-frame';notesFrame.title='Ứng dụng bảng viết Lớp học Mực';notesFrame.hidden=true;notesFrame.loading='lazy';notesFrame.referrerPolicy='strict-origin-when-cross-origin';notesFrame.allow='clipboard-read; clipboard-write; fullscreen';notesFrame.allowFullscreen=true;
 const notesStatus=element('p','focus-muted','Bảng ghi chú chưa mở. Bấm “Mở bảng ghi chú” để tải ứng dụng.');notesFrame.addEventListener('load',()=>{notesStatus.textContent='Đã mở Lớp học Mực. Bảng viết lưu trên thiết bị/trình duyệt hiện tại; chưa tự đồng bộ sang thiết bị khác.';});notesFrame.addEventListener('error',()=>{notesStatus.textContent='Không tải được ứng dụng ghi chú. Hãy kiểm tra đường dẫn /focus-notes/ sau khi deploy.';});notesBox.append(notesActions,notesStatus,notesFrame);right.append(notesBox);
 let sessionId=null,sessionOrigin=null,pingBusy=false,alive=true,trackingConnected=false,sessionStopping=false,sessionStarting=false;
 let statsSnapshot=null,pendingMs=0,lastStatsRenderPerf=performance.now(),lastTimerPersist=0;
 const SESSION_STORAGE_KEY='htvvm-study-session-v1';
 async function request(path,method='GET',body,options={}){
   const user=auth?.currentUser;if(!user)throw Error('Hãy đăng nhập Google trước để đồng bộ giờ học.');
   const token=await user.getIdToken();
   const res=await fetch(path,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',keepalive:!!options.keepalive});
   let json={};try{json=await res.json();}catch{}
   if(!res.ok){const error=Error(json.error||`Lỗi máy chủ ${res.status}`);error.status=res.status;throw error;}
   return json;
 }
 function saveSession(id,origin){try{sessionStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify({id,origin,savedAt:Date.now()}));}catch{}}
 function touchSavedSession(){if(sessionId)saveSession(sessionId,sessionOrigin||'manual');}
 function clearSavedSession(){try{sessionStorage.removeItem(SESSION_STORAGE_KEY);}catch{}}
 function getSavedSession(){try{const v=JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY)||'null');return v&&typeof v.id==='string'&&['manual','pomodoro','stopping'].includes(v.origin)?v:null;}catch{return null;}}
 function drawStats(){
   if(!statsSnapshot)return;
   const liveSeconds=sessionId&&trackingConnected&&!document.hidden?Math.floor(pendingMs/1000):0;
   const totalSeconds=(statsSnapshot.totalSeconds||0)+liveSeconds;
   const todaySeconds=(statsSnapshot.todaySeconds||0)+liveSeconds;
   stats.replaceChildren();
   for(const [label,val] of [['Hôm nay',fmt(todaySeconds)],['Tổng giờ',fmt(totalSeconds)],['Streak',`${statsSnapshot.streak||0} ngày`],['Danh hiệu',titleFor(totalSeconds)]]){const item=element('div','focus-stat');item.append(element('small','',label),element('strong','',val));stats.append(item);}
   shareInput.checked=!!statsSnapshot.sharing;
   if(todaySeconds>=18000)stateLine.textContent='Bạn đã học 5 giờ hôm nay. Hãy nghỉ ngơi và vận động một chút nhé!';
   else if(sessionId&&trackingConnected)stateLine.textContent='Đang ghi nhận theo thời gian thực. Chuyển tab hoặc rời trang sẽ tạm dừng ghi nhận.';
   else stateLine.textContent='Bắt đầu đồng hồ tập trung hoặc phiên ghi nhận thủ công để tính giờ học.';
 }
 function showStats(s,reconcile=true){
   if(!s)return;
   if(!statsSnapshot||reconcile){statsSnapshot={...s};if(reconcile)pendingMs=0;}
   else statsSnapshot={...statsSnapshot,sharing:!!s.sharing};
   drawStats();
 }
 function updateSessionButtons(){begin.disabled=!!sessionId||sessionStopping||sessionStarting;end.disabled=!sessionId;}
 async function startSession(source='manual'){
   if(sessionStopping){status.textContent='Đang lưu phiên học trước đó; hãy thử lại sau giây lát.';return false;}
   if(sessionStarting){status.textContent='Đang mở phiên học…';return false;}
   if(sessionId){status.textContent='Một phiên học đang được ghi nhận.';return true;}
   sessionStarting=true;updateSessionButtons();
   try{
     const pendingStop=getSavedSession();
     if(pendingStop?.origin==='stopping'){
       try{const previous=await request('/api/study-tracker','POST',{action:'stop',sessionId:pendingStop.id},{keepalive:true});showStats(previous.stats,true);clearSavedSession();}
       catch(e){if(e.status===409)clearSavedSession();else{status.textContent=`Chưa lưu xong phiên trước: ${e.message}. Kiểm tra kết nối rồi thử lại.`;return false;}}
     }
     const data=await request('/api/study-tracker','POST',{action:'start'});
     if(!alive){request('/api/study-tracker','POST',{action:'stop',sessionId:data.sessionId},{keepalive:true}).catch(()=>{});return false;}
     sessionId=data.sessionId;sessionOrigin=source;trackingConnected=true;pendingMs=0;saveSession(sessionId,sessionOrigin);updateSessionButtons();
     showStats(data.stats,true);status.textContent=source==='pomodoro'?'● Đồng hồ đang tự ghi nhận giờ học.':'● Đang ghi nhận giờ học thủ công.';return true;
   }catch(e){status.textContent=`Chưa ghi nhận được giờ học: ${e.message}`;return false;}
   finally{sessionStarting=false;updateSessionButtons();}
 }
 async function resumeSavedSession(saved){
   const fresh=Number.isFinite(saved.savedAt)&&Date.now()-saved.savedAt<80000;
   // A page reload always pauses Pomodoro; a failed stop is retried from the saved 'stopping' marker.
   if(saved.origin==='stopping'||saved.origin==='pomodoro'||!fresh){
     try{const data=await request('/api/study-tracker','POST',{action:'stop',sessionId:saved.id},{keepalive:true});showStats(data.stats,true);status.textContent=saved.origin==='pomodoro'?'Đã lưu phiên trước và tạm dừng đồng hồ sau khi tải lại.':'Đã kết thúc phiên cũ; khoảng thời gian không hoạt động không được tính.';clearSavedSession();}
     catch(e){if(e.status===409)clearSavedSession();status.textContent=`Chưa thể kết thúc phiên trước: ${e.message}`;}
     return;
   }
   try{
     const data=await request('/api/study-tracker','POST',{action:'resume',sessionId:saved.id});
     if(!alive)return;
     sessionId=saved.id;sessionOrigin='manual';trackingConnected=true;pendingMs=0;saveSession(sessionId,sessionOrigin);updateSessionButtons();showStats(data.stats,true);status.textContent='● Đã khôi phục phiên học đang ghi nhận.';
   }catch(e){
     if(e.status===409){clearSavedSession();status.textContent='Phiên học cũ đã kết thúc. Hãy bắt đầu phiên mới.';}
     else {sessionId=saved.id;sessionOrigin='manual';trackingConnected=false;updateSessionButtons();status.textContent=`Đang thử kết nối lại phiên học: ${e.message}`;}
   }
 }
 async function loadStatus(){
   try{const data=await request('/api/study-tracker');if(!alive)return;showStats(data.stats,true);const saved=getSavedSession();if(saved)await resumeSavedSession(saved);else status.textContent='Sẵn sàng ghi nhận giờ học.';}
   catch(e){if(alive)status.textContent=`Không tải được tiến độ học tập: ${e.message}`;}
 }
 async function resumeCurrentSession(id){
   try{const data=await request('/api/study-tracker','POST',{action:'resume',sessionId:id});if(!alive)return false;trackingConnected=true;showStats(data.stats,true);saveSession(id,sessionOrigin||'manual');status.textContent='● Đã kết nối lại việc ghi nhận giờ học.';return true;}
   catch(e){if(e.status===409){sessionId=null;sessionOrigin=null;trackingConnected=false;pendingMs=0;clearSavedSession();updateSessionButtons();status.textContent='Phiên học đã kết thúc ở máy chủ. Hãy bắt đầu phiên mới.';}else status.textContent=`Mất kết nối; đang thử lại: ${e.message}`;return false;}
 }
 async function ping(){
   if(!sessionId||pingBusy||document.hidden||!alive)return;
   pingBusy=true;const id=sessionId;
   try{const data=await request('/api/study-tracker','POST',{action:'ping',sessionId:id});if(alive&&sessionId===id){trackingConnected=true;showStats(data.stats,true);touchSavedSession();}}
   catch(e){trackingConnected=false;drawStats();status.textContent=`Gián đoạn kết nối: ${e.message}. Đang thử khôi phục phiên…`;if(e.status===409&&sessionId===id)await resumeCurrentSession(id);}
   finally{pingBusy=false;}
 }
 async function stopSession(message='Đã lưu phiên học.'){
   const id=sessionId;if(!id||sessionStopping)return !sessionStopping;
   sessionStopping=true;sessionId=null;trackingConnected=false;pendingMs=0;saveSession(id,'stopping');updateSessionButtons();drawStats();
   try{
     const data=await request('/api/study-tracker','POST',{action:'stop',sessionId:id},{keepalive:true});
     clearSavedSession();if(alive){showStats(data.stats,true);status.textContent=message;}return true;
   }catch(firstError){
     // Retry once and leave a durable stop marker if the network is still unavailable.
     try{
       const data=await request('/api/study-tracker','POST',{action:'stop',sessionId:id},{keepalive:true});
       clearSavedSession();if(alive){showStats(data.stats,true);status.textContent=message;}return true;
     }catch(secondError){
       if(secondError.status===409){clearSavedSession();status.textContent='Phiên học đã kết thúc ở máy chủ.';return true;}
       status.textContent=`Chưa xác nhận được việc lưu phiên (${secondError.message||firstError.message}). Bản ghi sẽ được thử kết thúc lại khi mở Góc tập trung.`;
       return false;
     }
   }finally{sessionOrigin=null;sessionStopping=false;updateSessionButtons();}
 }
 shareInput.addEventListener('change',async()=>{try{const data=await request('/api/study-tracker','POST',{action:'sharing',enabled:shareInput.checked});showStats(data.stats,false);status.textContent=shareInput.checked?'Bạn đã bật chia sẻ trên bảng xếp hạng.':'Bạn đã tắt chia sẻ trên bảng xếp hạng.';}catch(e){status.textContent=e.message;shareInput.checked=!shareInput.checked;}});
 let lastUiTick=performance.now();
 const timerInterval=setInterval(()=>{
   const now=performance.now();
   // Bounded monotonic delta prevents long throttled timer callbacks from inventing study time.
   const delta=Math.max(0,Math.min(1000,now-lastUiTick));lastUiTick=now;
   if(sessionId&&trackingConnected&&!document.hidden)pendingMs+=delta;
   if(running){
     seconds=remainingFocusSeconds(remainingAtStart,started,now);digits.textContent=fmt(seconds);
     if(now-lastTimerPersist>=1000){saveTimerState();lastTimerPersist=now;}
     if(seconds===0){running=false;saveTimerState();updateControls();if(sessionOrigin==='pomodoro')stopSession('Hết giờ tập trung. Phiên học đã được lưu.');else status.textContent='Đã hết giờ.';}
   }
   if(now-lastStatsRenderPerf>=1000){drawStats();lastStatsRenderPerf=now;}
 },250);
 const heartbeat=setInterval(ping,HEARTBEAT_MS);
 const onVisibility=()=>{
   if(document.hidden){
     if(running){seconds=remainingFocusSeconds(remainingAtStart,started,performance.now());running=false;digits.textContent=fmt(seconds);saveTimerState();updateControls();}
     if(sessionId)stopSession('Đã tạm dừng ghi nhận vì trang không còn hiển thị. Bấm Bắt đầu để tiếp tục.');
   }else if(!sessionId&&!sessionStopping&&!sessionStarting){loadStatus();}
 };
 document.addEventListener('visibilitychange',onVisibility);
 const watcher=new MutationObserver(()=>{if(!root.isConnected)cleanup();});watcher.observe(document.getElementById('main-content')||document.body,{childList:true});
 cleanup=()=>{
   if(!alive)return;alive=false;if(running){seconds=remainingFocusSeconds(remainingAtStart,started,performance.now());running=false;saveTimerState();}clearInterval(timerInterval);clearInterval(heartbeat);document.removeEventListener('visibilitychange',onVisibility);watcher.disconnect();
   if(pdfURL)URL.revokeObjectURL(pdfURL);if(audioURL)URL.revokeObjectURL(audioURL);
   if(sessionId){const id=sessionId;sessionId=null;saveSession(id,'stopping');request('/api/study-tracker','POST',{action:'stop',sessionId:id},{keepalive:true}).then(()=>clearSavedSession()).catch(()=>{});}
 };
 loadStatus();return root;
}
