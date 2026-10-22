import { element as E, button } from '../../core/dom.js';
import { auth } from '../../core/firebase.js';
import { AppStore } from '../../core/store.js';

const starters=[
 {topic:'Ester – Lipid',level:'Nhận biết',prompt:'Chất nào sau đây là ester?',options:['CH3COOCH3','CH3COOH','C2H5OH','CH3CHO'],answer:'A'},
 {topic:'Điện hóa',level:'Thông hiểu',prompt:'Trong pin điện hóa Zn–Cu đang hoạt động, quá trình oxi hóa xảy ra ở đâu?',options:['Cathode đồng','Anode kẽm','Dung dịch CuSO4','Cầu muối'],answer:'B'},
 {topic:'Hợp chất chứa nitrogen',level:'Thông hiểu',prompt:'Dung dịch nào sau đây làm quỳ tím chuyển xanh?',options:['Glycine','Aniline','Methylamine','Glucose'],answer:'C'},
 {topic:'Polymer',level:'Nhận biết',prompt:'Polymer nào sau đây được tạo thành từ phản ứng trùng hợp?',options:['Nylon-6,6','PET','Tơ lapsan','Polyethylene'],answer:'D'},
 {topic:'Kim loại',level:'Vận dụng',prompt:'Cho 0,10 mol Zn tác dụng với HCl dư. Thể tích H2 thu được ở đkc (24,79 L/mol) gần nhất với giá trị nào?',options:['1,24 L','2,48 L','4,96 L','0,25 L'],answer:'B'}
];
let interval=null,activeCode=null,alive=0,answerSent=false,selected=null,lastRound=0;
const field=(place,value='')=>{const e=E('input','exam-input');e.placeholder=place;e.value=value;return e;};
const panel=(name)=>{const d=E('section','exam-panel');d.append(E('h3','exam-heading',name));return d;};
function stop(){if(interval)clearInterval(interval);interval=null;activeCode=null;lastRound=0;answerSent=false;selected=null;alive++;}
async function api(action,payload={},method='POST'){
 if(!auth?.currentUser)throw Error('Đăng nhập Google để chơi Chem Arena.');
 const token=await auth.currentUser.getIdToken();
 const url=method==='GET'?`/api/arena?${new URLSearchParams({action,...payload})}`:'/api/arena';
 const response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,...(method==='POST'?{'Content-Type':'application/json'}:{})},body:method==='POST'?JSON.stringify({action,...payload}):undefined,cache:'no-store'});
 const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);return data;
}
const say=(host,msg,isError=false)=>host.replaceChildren(E('p',isError?'exam-error':'exam-message',msg));
export function renderArena(){stop();const root=E('div','exam-root'),hero=E('section','hero exam-hero');hero.append(E('div','eyebrow','HTVVM · CHEM ARENA'),E('h2','hero-title','Đấu trường Hóa học'),E('p','hero-subtitle','Đối kháng thời gian thực • 2–8 người • 200 HP • Trọng tài Server'));
 const body=E('div','exam-body'),tabs=E('div','exam-tabs');tabs.append(button('Tạo phòng','exam-tab',()=>create(body)),button('Tham gia phòng','exam-tab',()=>join(body)),button('Hướng dẫn','exam-tab',()=>guide(body)));
 root.append(hero,tabs,body);create(body);return root;}
function guide(host){const p=panel('Luật chơi');p.append(E('p','exam-message','Mỗi người bắt đầu với 200 HP. Trả lời đúng càng nhanh, sát thương càng lớn. Một người chỉ được trả lời một lần trong mỗi vòng. Đòn đánh nhắm vào đối thủ còn HP cao nhất. Khi hết câu hỏi hoặc chỉ còn một người sống sót, bảng kết quả được xếp theo HP rồi điểm sát thương. Thời gian và kết quả được trọng tài Server quyết định.'));host.replaceChildren(p);}
function create(host){stop();const p=panel('Chem Question Studio'),questions=starters.map(q=>({...q,options:[...q.options]})),list=E('div','exam-editor');
 const render=()=>{list.replaceChildren();questions.forEach((q,i)=>{const card=E('section','exam-question');card.append(E('h4','',`Câu ${i+1}`));const prompt=field('Nội dung câu hỏi',q.prompt);prompt.oninput=()=>q.prompt=prompt.value;card.append(prompt);for(let j=0;j<4;j++){const input=field(`Đáp án ${'ABCD'[j]}`,q.options[j]);input.oninput=()=>q.options[j]=input.value;card.append(input);}
 const row=E('div','exam-tabs'),topic=field('Chuyên đề',q.topic);topic.oninput=()=>q.topic=topic.value;
 const level=E('select','exam-input');for(const s of ['Nhận biết','Thông hiểu','Vận dụng','Vận dụng cao']){const opt=E('option','',s);opt.value=s;level.append(opt);}level.value=q.level;level.onchange=()=>q.level=level.value;
 const answer=E('select','exam-input');for(const letter of 'ABCD'){const opt=E('option','',`Đáp án ${letter}`);opt.value=letter;answer.append(opt);}answer.value=q.answer;answer.onchange=()=>q.answer=answer.value;
 row.append(topic,level,answer,button('Xóa','exam-tab',()=>{questions.splice(i,1);render();}));card.append(row);list.append(card);});};
 const status=E('p','exam-message','Bộ câu hỏi mẫu có thể chỉnh sửa tùy ý. Tối thiểu 2, tối đa 20 câu.');p.append(status,button('Thêm câu hỏi','exam-tab',()=>{questions.push({topic:'Hóa học',level:'Nhận biết',prompt:'',options:['','','',''],answer:'A'});render();}),list,button('Tạo phòng 8 người','primary-btn',async()=>{try{status.textContent='Đang tạo phòng…';const result=await api('create',{questions});enter(host,result.room.id);}catch(e){status.textContent=e.message;}}));host.replaceChildren(p);render();}
function join(host){stop();const p=panel('Tham gia phòng đấu'),code=field('Nhập mã phòng 8 ký tự');const msg=E('p','exam-message','');code.maxLength=8;p.append(code,button('Vào phòng','primary-btn',async()=>{try{const r=await api('join',{code:code.value.trim().toUpperCase()});enter(host,r.room.id);}catch(e){msg.textContent=e.message;}}),msg);host.replaceChildren(p);}
function enter(host,code){stop();activeCode=code;const seq=alive;const wrap=panel(`Phòng ${code}`);const content=E('div','arena-board'),notice=E('p','exam-message','Đang kết nối…');wrap.append(E('p','exam-message',`Mã mời: ${code} — chia sẻ mã này cho tối đa 7 người chơi khác.`),content,notice);
 wrap.append(button('Sao chép mã phòng','exam-tab',()=>navigator.clipboard?.writeText(code).then(()=>{notice.textContent='Đã sao chép mã phòng.';}).catch(()=>{notice.textContent=code;})),button('Rời phòng','exam-tab',async()=>{try{await api('leave',{code});}catch(e){notice.textContent=e.message;}stop();join(host);}));host.replaceChildren(wrap);
 let busy=false;const refresh=async()=>{if(busy||seq!==alive||activeCode!==code)return;busy=true;try{const {room}=await api('state',{code},'GET');if(seq!==alive)return;renderRoom(room,content,notice,host,refresh);}catch(e){if(seq===alive)notice.textContent=e.message;}finally{busy=false;}};
 refresh();interval=setInterval(refresh,1500);
}
function renderRoom(room,body,notice,host,refresh){const uid=auth?.currentUser?.uid;body.replaceChildren();const list=E('div','arena-players');for(const p of room.players){const item=E('article','arena-player');item.append(E('strong','',`${p.name}${p.uid===uid?' (Bạn)':''}${p.uid===room.hostUid?' ★':''}`),E('span','',`${p.hp} / 200 HP • ${p.score} sát thương`));const bar=E('div','arena-hp'),fill=E('div','arena-hp-fill');fill.style.width=`${Math.min(100,p.hp/2)}%`;bar.append(fill);item.append(bar);list.append(item);}body.append(list);
 if(room.status==='LOBBY'){notice.textContent=`Phòng chờ: ${room.players.length}/8 người. Chủ phòng có thể bắt đầu khi có ít nhất 2 người.`;if(room.hostUid===uid)body.append(button('Bắt đầu trận đấu','primary-btn',async()=>{try{await api('start',{code:room.id});refresh();}catch(e){notice.textContent=e.message;}}));return;}
 if(room.status==='FINISHED'){const win=room.players.find(p=>p.uid===room.winnerUid);notice.textContent=`Trận đấu kết thúc! Người thắng: ${win?.name||'Không xác định'}.`;return;}
 if(room.round!==lastRound){lastRound=room.round;selected=null;answerSent=false;}
 const q=room.question;const seconds=Math.max(0,Math.ceil((room.roundEndsAt-room.serverNow)/1000));notice.textContent=`Vòng ${room.round}/${room.totalRounds} • Còn khoảng ${seconds} giây ${room.myAnswered?'• Đã trả lời':''}`;
 if(!q){body.append(E('p','exam-message','Đang chuyển câu hỏi…'));return;}
 body.append(E('h3','exam-heading',q.prompt),E('p','exam-message',`${q.topic} · ${q.level}`));const options=E('div','exam-options');for(let i=0;i<4;i++){const letter='ABCD'[i];const b=button(`${letter}. ${q.options[i]}`,'exam-option',async()=>{if(room.myAnswered||answerSent)return;answerSent=true;selected=letter;for(const el of options.children)el.disabled=true;try{const result=await api('answer',{code:room.id,round:room.round,answer:letter});notice.textContent=result.correct?`Chính xác! Gây ${result.damage} sát thương.`:'Chưa chính xác. Chờ câu tiếp theo.';setTimeout(()=>refresh(),250);}catch(e){notice.textContent=e.message;answerSent=false;}});b.disabled=room.myAnswered||answerSent||seconds===0;b.classList.toggle('selected',selected===letter);options.append(b);}body.append(options);
 if(room.events?.length){const log=E('div','arena-log');log.append(E('h4','','Diễn biến'));for(const ev of room.events.slice(-6).reverse()){const attacker=room.players.find(p=>p.uid===ev.by);const target=room.players.find(p=>p.uid===ev.target);log.append(E('p','',`${attacker?.name||'Người chơi'} → ${target?.name||'Đối thủ'}: ${ev.damage} sát thương`));}body.append(log);}
}
