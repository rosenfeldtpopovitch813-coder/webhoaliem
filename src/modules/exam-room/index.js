import { element, button } from '../../core/dom.js';
import { AppStore } from '../../core/store.js';
import { auth } from '../../core/firebase.js';
const E=element; let ticker=null; let current=null; let answers={}; let currentExamId=null;
function clearTimer(){if(ticker) clearInterval(ticker);ticker=null;}
async function api(action,payload={},method='POST'){
  if(!auth?.currentUser) throw Error('Bạn cần đăng nhập Google để sử dụng phòng thi.');
  const token=await auth.currentUser.getIdToken();
  const url=method==='GET' ? `/api/exam?${new URLSearchParams({action,...payload})}` : '/api/exam';
  const response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,...(method==='POST'?{'Content-Type':'application/json'}:{})},body:method==='POST'?JSON.stringify({action,...payload}):undefined,cache:'no-store'});
  const data=await response.json().catch(()=>({})); if(!response.ok) throw Error(data.error || `HTTP ${response.status}`);return data;
}
function label(text){return E('label','exam-label',text);}
function field(type,placeholder,value=''){const el=E(type==='textarea'?'textarea':'input','exam-input');if(type!=='textarea')el.type=type;el.placeholder=placeholder;el.value=value;return el;}
function panel(title){const d=E('section','exam-panel');d.append(E('h3','exam-heading',title));return d;}
function showError(host,error){host.replaceChildren(E('p','exam-error',error.message||String(error)));}
function requireLogin(host){if(!AppStore.get('roleVerified')){host.replaceChildren(E('p','exam-message','Đăng nhập và xác minh quyền Firebase để vào phòng thi.'));return false;}return true;}
export function renderExam(){clearTimer();const wrap=E('div','exam-root'),heading=E('section','hero exam-hero');heading.append(E('div','eyebrow','HTVVM • EXAM ENGINE'),E('h2','hero-title','Khảo thí thông minh'),E('p','hero-subtitle','Ba phần thi THPT · Đáp án được bảo vệ ở Server · Nộp bài một lần · Ôn lại câu sai'));
 const bar=E('div','exam-tabs'),body=E('div','exam-body');
 const actions=[['Kho đề',showList],['Vào bằng mã',showJoin],['Sổ tay câu sai',showMistakes]];
 if(['teacher','admin'].includes(AppStore.get('role')))actions.push(['Creator Studio',showCreator]);
 for(const [name,action] of actions)bar.append(button(name,'exam-tab',()=>{clearTimer(); action(body);}));
 wrap.append(heading,bar,body);showList(body);return wrap;}
async function showList(host){host.replaceChildren(E('p','exam-message','Đang tải danh sách đề...'));if(!requireLogin(host))return;
 try {const data=await api('list',{},'GET');const section=panel('Đề thi đang mở');const grid=E('div','exam-grid');if(!data.exams.length)grid.append(E('p','exam-message','Chưa có đề thi. Giáo viên có thể tạo đề tại Creator Studio.'));
 for(const x of data.exams){const card=E('article','exam-card');card.append(E('strong','',x.title),E('span','',`Mã ${x.id} • ${x.durationMinutes} phút • ${x.counts.I+x.counts.II+x.counts.III} câu`),button('Vào phòng →','primary-btn',()=>begin(host,x.id)));grid.append(card);}section.append(grid);host.replaceChildren(section);}catch(e){showError(host,e);}}
function showJoin(host){const p=panel('Nhập mã phòng thi'),input=field('text','Mã gồm 12 ký tự');input.maxLength=12;p.append(label('Mã đề thi'),input,button('Vào phòng thi','primary-btn',()=>begin(host,input.value.trim().toUpperCase())));host.replaceChildren(p);}
async function begin(host,id){host.replaceChildren(E('p','exam-message','Đang kết nối phòng thi...'));try{const data=await api('start',{id});current=data;currentExamId=id;answers={};if(data.session.status==='submitted')return showResult(host,data.result,id);
 const p=panel(data.exam.title),timer=E('div','exam-timer');p.append(E('p','exam-message',`Mã đề: ${id} • ${data.exam.durationMinutes} phút. Bài làm sẽ được lưu khi nộp. Không đóng trang trước khi nộp.`),timer);
  const initialPerf=performance.now(),serverAt= data.serverNow;
 let busy=false;
 const remaining=()=>Math.max(0,data.session.endsAt-(serverAt+performance.now()-initialPerf));
 const submit=async(automatic=false)=>{if(busy)return;busy=true;clearTimer();timer.textContent='Đang nộp bài...';try{const output=await api('submit',{id,answers});showResult(host,output.result,id);}catch(err){busy=false;showError(host,err);host.append(button('Thử nộp lại','primary-btn',()=>submit(automatic)));}};
 const update=()=>{const ms=remaining(),seconds=Math.ceil(ms/1000);timer.textContent=`Còn ${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;if(ms<=0)submit(true);};
 for(const q of data.questions){const item=E('section','exam-question');item.append(E('h4','',`Câu ${q.id.slice(1)} • Phần ${q.part}`),E('p','',q.prompt));if(q.part==='I'){const options=E('div','exam-options');q.options.forEach((opt,i)=>{const text='ABCD'[i],b=button(`${text}. ${opt}`,'exam-option',()=>{answers[q.id]=text;for(const child of options.children)child.classList.toggle('selected',child===b);});options.append(b);});item.append(options);}else if(q.part==='II'){q.options.forEach((opt,i)=>{const row=E('div','exam-tf');row.append(E('span','',`${'abcd'[i]}) ${opt}`));const select=E('select','exam-input');for(const [val,text] of [['','Chưa chọn'],['true','Đúng'],['false','Sai']]){const option=E('option','',text);option.value=val;select.append(option);}select.onchange=()=>{if(!answers[q.id])answers[q.id]=[null,null,null,null];answers[q.id][i]=select.value===''?null:select.value==='true';};row.append(select);item.append(row);});}else{const input=field('text','Nhập đáp án số (ví dụ 12,5)');input.inputMode='decimal';input.oninput=()=>answers[q.id]=input.value;item.append(input);}p.append(item);}
 p.append(button('Nộp bài & xem kết quả','primary-btn',()=>{if(confirm('Xác nhận nộp bài? Sau khi nộp, bạn không thể sửa đáp án.'))submit(false);}));host.replaceChildren(p);ticker=setInterval(update,250);update();
 }catch(e){showError(host,e);}}
function showResult(host,result,id){clearTimer();const p=panel('Kết quả bài thi');if(!result)return showError(host,Error('Chưa nhận được kết quả.'));
 p.append(E('div','exam-score',`${result.score.toFixed(2)} / 10`),E('p','exam-message',`Đúng trọn vẹn ${result.fullyCorrect}/${result.total} câu`));
 for(const d of result.details){const item=E('div','exam-result-line');item.append(E('strong','',`${d.id} · Phần ${d.part} · ${d.earned/100}/${d.possible/100} điểm`),E('span','',d.prompt),E('span','',`Bạn chọn: ${JSON.stringify(d.response)} | Đáp án: ${JSON.stringify(d.answer)}`));p.append(item);}
 p.append(button('Xem bảng vinh danh','primary-btn',()=>showLeaderboard(host,id)),button('Quay lại kho đề','exam-tab',()=>showList(host)));host.replaceChildren(p);}
async function showLeaderboard(host,id){const p=panel('Bảng vinh danh');host.replaceChildren(p);try{const data=await api('leaderboard',{id},'GET');for(const [i,r] of data.ranking.entries())p.append(E('div','exam-result-line',`${i+1}. ${r.name} — ${r.score.toFixed(2)} điểm`));}catch(e){showError(host,e);}}
async function showMistakes(host){const p=panel('Sổ tay câu sai');host.replaceChildren(p);if(!requireLogin(host))return;try{const data=await api('mistakes',{},'GET');if(!data.mistakes.length)p.append(E('p','exam-message','Bạn chưa có câu trả lời sai được lưu.'));for(const d of data.mistakes){const item=E('div','exam-result-line');item.append(E('strong','',`${d.examId} • ${d.id} • Phần ${d.part}`),E('span','',d.prompt),E('span','',`Đã trả lời: ${JSON.stringify(d.response)} | Đáp án đúng: ${JSON.stringify(d.answer)}`));p.append(item);}}catch(e){showError(host,e);}}
function showCreator(host){if(!['teacher','admin'].includes(AppStore.get('role')) || !AppStore.get('roleVerified'))return showError(host,Error('Cần quyền Giáo viên/Admin.'));
 const p=panel('Creator Studio • Biên soạn đề'),title=field('text','Ví dụ: Đề luyện thi Hóa 12 - số 01'),duration=field('number','Thời gian (phút)','50'),questions=E('div','exam-editor');let data=[];
 const renderEditors=()=>{questions.replaceChildren();data.forEach((q,idx)=>{const card=E('div','exam-question');card.append(E('strong','',`Câu ${idx+1} · Phần ${q.part}`));const prompt=field('textarea','Nội dung câu hỏi',q.prompt);prompt.oninput=()=>q.prompt=prompt.value;card.append(prompt);
 if(q.part==='I'||q.part==='II'){for(let i=0;i<4;i++){const text=field('text',`Lựa chọn/nhận định ${'ABCD'[i]}`,q.options[i]);text.oninput=()=>q.options[i]=text.value;card.append(text);}}
 if(q.part==='I'){const answer=E('select','exam-input');for(const c of 'ABCD'){const op=E('option','',`Đáp án ${c}`);op.value=c;answer.append(op);}answer.value=q.answer;answer.onchange=()=>q.answer=answer.value;card.append(answer);}
 else if(q.part==='II'){for(let i=0;i<4;i++){const row=E('div','exam-tf');row.append(E('span','',`Ý ${'abcd'[i]}`));const sel=E('select','exam-input');for(const [v,name] of [['true','Đúng'],['false','Sai']]){const op=E('option','',name);op.value=v;sel.append(op);}sel.value=String(q.answer[i]);sel.onchange=()=>q.answer[i]=sel.value==='true';row.append(sel);card.append(row);}}
 else{const answer=field('text','Đáp án số',q.answer);answer.oninput=()=>q.answer=answer.value;card.append(answer);}
 card.append(button('Xóa câu','exam-tab',()=>{data.splice(idx,1);renderEditors();}));questions.append(card);});};
 const buttons=E('div','exam-tabs');for(const part of ['I','II','III'])buttons.append(button(`+ Câu phần ${part}`,'exam-tab',()=>{data.push({part,prompt:'',...(part==='III'?{answer:''}:{options:['','','',''],answer:part==='I'?'A':[true,true,true,true]})});renderEditors();}));
 const importArea=field('textarea','Dán JSON: [{"part":"I","prompt":"...","options":["..."],"answer":"A"}]');
 p.append(label('Tên đề thi'),title,label('Thời gian (phút)'),duration,buttons,questions,E('h4','','Nhập nhanh câu hỏi bằng JSON'),importArea,button('Nạp JSON','exam-tab',()=>{try{const imported=JSON.parse(importArea.value);if(!Array.isArray(imported))throw Error('Cần mảng JSON.');data=imported;renderEditors();}catch(e){alert(e.message);}}));
 const message=E('p','exam-message');p.append(button('Xuất bản đề thi','primary-btn',async()=>{message.textContent='Đang lưu đề...';try{const response=await api('create',{title:title.value,durationMinutes:Number(duration.value),questions:data});message.textContent=`Đã tạo đề! Mã phòng: ${response.exam.id}`;const link=E('a','exam-link',`Sao chép mã / vào phòng: ${response.exam.id}`);link.href='/exam';link.onclick=event=>{event.preventDefault();begin(host,response.exam.id);};p.append(link);}catch(e){message.textContent=e.message;}}),message);host.replaceChildren(p);
}
