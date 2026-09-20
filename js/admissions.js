(function(){'use strict';
 const core=window.HLAdmissionsCore,local=window.HLAdmissionsData||{year:2026,records:[],rules:{},officialDataAvailable:false},doc=document;
 const subjects=Object.entries(core.SUBJECTS);
 const STORAGE='htvvm.admissionsPlan.'+(window.auth?.currentUser?.uid||'guest');
 function el(tag,cls,text){const x=doc.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=text;return x;}
 function getHost(){return doc.getElementById('hl-learning-body');}
 async function loadOfficial(){try{const r=await fetch('/api/admissions',{cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}catch{return local;}}
 function mount(){const host=getHost();if(!host||host.querySelector('.admissions-planner'))return; if(window.HLAuthz?.teacher||window.HLAuthz?.admin)return;
  const wrap=el('section','st-panel admissions-planner');wrap.dataset.year='2026';
  const intro=el('div','ad-intro');intro.append(el('div','ad-icon','🎓'));const copy=el('div');copy.append(el('h2',null,'Kế hoạch nguyện vọng 2026'),el('p','ad-meta','Nhập nhiều môn bạn có. Hệ thống chỉ ghép các tổ hợp có đủ môn, không giới hạn số môn nhập vào.'));intro.append(copy);wrap.append(intro);
  const notice=el('div','ad-message ad-warning','Đang tải bộ quy tắc tuyển sinh 2026…');wrap.append(notice);
  const form=el('form','ad-form');
  const interestBox=el('fieldset','ad-full');interestBox.append(el('legend',null,'Nhóm ngành quan tâm (tuỳ chọn)'));const checks=el('div','ad-checks');for(const v of ['Công nghệ','Kinh doanh','Truyền thông','Hóa học','Sinh học','Ngoại ngữ','Giáo dục','Kỹ thuật']){const l=el('label');const i=el('input');i.type='checkbox';i.name='interest';i.value=v;l.append(i,doc.createTextNode(v));checks.append(l);}interestBox.append(checks);form.append(interestBox);
  const scoreBox=el('fieldset','ad-full');scoreBox.append(el('legend',null,'Điểm các môn đã có'));const grid=el('div','ad-subject-grid');
  for(const [key,label] of subjects){const l=el('label','ad-subject-input');l.append(doc.createTextNode(label));const i=el('input');i.type='number';i.min='0';i.max='10';i.step='0.01';i.inputMode='decimal';i.name=key;i.placeholder='—';l.append(i);grid.append(l);}scoreBox.append(grid);form.append(scoreBox);
  const methodBox=el('div','ad-scores ad-full');
  const method=el('select');method.name='method';for(const [v,t] of [['thpt','Thi tốt nghiệp THPT'],['school_record','Học bạ'],['other','Phương thức khác']]){const o=el('option');o.value=v;o.textContent=t;method.append(o);}methodBox.append(el('label',null,'Phương thức'),method);
  const priority=el('input');priority.type='number';priority.step='0.01';priority.min='0';priority.max='3';priority.name='priority';priority.value='0';methodBox.append(el('label',null,'Điểm ưu tiên gốc'),priority);
  const bonus=el('input');bonus.type='number';bonus.step='0.01';bonus.min='0';bonus.max='3';bonus.name='bonus';bonus.value='0';methodBox.append(el('label',null,'Điểm cộng/khuyến khích'),bonus);
  form.append(methodBox);
  const aspirationBox=el('div','ad-scores ad-full');const asp=el('input');asp.type='number';asp.min='0';asp.max='15';asp.value='15';asp.name='aspirations';const teacherOnly=el('label');teacherOnly.textContent='Số nguyện vọng dự kiến ';teacherOnly.append(asp);const teacherCheck=el('label');const isTeacherProgram=el('input');isTeacherProgram.type='checkbox';isTeacherProgram.name='teacherProgram';teacherCheck.append(isTeacherProgram,doc.createTextNode(' Có ngành đào tạo giáo viên'));aspirationBox.append(teacherOnly,teacherCheck);form.append(aspirationBox);
  const controls=el('div','ad-controls ad-full');const run=el('button','st-button st-primary','Tính các tổ hợp hợp lệ');run.type='submit';const reset=el('button','st-button','Xóa');reset.type='button';controls.append(run,reset);form.append(controls);
  const resultBox=el('div','ad-results');form.append(resultBox);wrap.append(form);host.append(wrap);
  let dataset=local;
  function setNotice(text,kind=''){notice.textContent=text;notice.className='ad-message '+(kind||'');}
  function renderCalculations(scores,fd){resultBox.replaceChildren();const combinations=core.findValidCombinations(scores,Object.keys(core.COMMON_COMBINATIONS));if(!combinations.length){resultBox.append(el('div','ad-message','Chưa có tổ hợp phổ biến nào đủ môn để tính. Bạn có thể nhập thêm môn; việc ngành nào chấp nhận tổ hợp nào vẫn phải kiểm tra theo đề án chính thức của trường.'));return;}
   const rows=core.evaluateCombinations(scores,combinations.map(id=>id));const head=el('div','ad-message',`Đã tìm thấy ${rows.length} tổ hợp đủ môn. Đây chỉ là phép tính theo tổ hợp môn; không phải danh sách ngành/trường chính thức.`);resultBox.append(head);
   for(const r of rows){const row=el('article','ad-row');row.append(el('div','ad-number',r.combination));const body=el('div');body.append(el('h3',null,`${r.combination} · ${r.finalScore.toFixed(2)}/30`));body.append(el('p','ad-meta',`Điểm gốc ${r.baseScore.toFixed(2)} · Ưu tiên ${r.priorityScore.toFixed(2)} · Cộng ${r.bonusScore.toFixed(2)} · ${r.capped?'Đã giới hạn tối đa 30':'Không vượt 30'}`));row.append(body);resultBox.append(row);}
   if(dataset.officialDataAvailable&&dataset.records?.length){const msg=el('div','ad-message','Có dữ liệu trường/ngành chính thức đã được nạp; chỉ các record có nguồn hợp lệ mới được dùng để lập danh sách.');resultBox.append(msg);}else resultBox.append(el('div','ad-message ad-warning','Chưa có dữ liệu điểm chuẩn/ngành-trường 2026 đã được xác minh trong hệ thống. Không dùng số liệu 2025 để thay thế.'));
   const count=Number(fd.get('aspirations'));const check=core.validateAspirationCount(count,{isTeacherProgram:fd.get('teacherProgram')==='on',rules:dataset.rules});if(!check.valid)resultBox.append(el('div','ad-message ad-error',`Số nguyện vọng không hợp lệ theo quy tắc 2026: tối đa ${check.limit}.`));
   HL.storage.set(STORAGE,{year:2026,method:fd.get('method'),scores,priority:Number(fd.get('priority')||0),bonus:Number(fd.get('bonus')||0),aspirations:count,teacherProgram:fd.get('teacherProgram')==='on',combinations:rows,updatedAt:Date.now()});
  }
  form.addEventListener('submit',async e=>{e.preventDefault();dataset=await loadOfficial();setNotice(dataset.officialDataAvailable?'Đã tải dữ liệu 2026 từ nguồn cấu hình chính thức.':'Bộ quy tắc 2026 đã được nạp; dữ liệu trường/ngành cụ thể chưa được xác minh.','ad-warning');const fd=new FormData(form);const scores={};for(const [key] of subjects){const raw=fd.get(key);if(raw!=='')scores[key]=Number(raw);}try{const clean=core.validateSubjectScores(scores,10);const rawPriority=Number(fd.get('priority')||0), rawBonus=Number(fd.get('bonus')||0);if(rawPriority<0||rawPriority>3||rawBonus<0||rawBonus>3||!Number.isFinite(rawPriority)||!Number.isFinite(rawBonus))throw Object.assign(new Error('Điểm cộng/ưu tiên không hợp lệ'),{code:'INVALID_BONUS'});renderCalculations(clean,fd);}catch(err){resultBox.replaceChildren(el('div','ad-message ad-error',err.code==='INVALID_SCORE'?`Điểm môn ${err.subject} phải từ 0 đến 10.`:'Dữ liệu điểm chưa hợp lệ. Hãy kiểm tra NaN, ô trống và giới hạn 0–10.'));}});
  reset.onclick=()=>{form.reset();resultBox.replaceChildren();setNotice('Bộ lập kế hoạch chỉ dùng dữ liệu đã xác minh. Chưa có dữ liệu trường/ngành 2026 chính thức trong bản hiện tại.','ad-warning');};
  const previous=HL.storage.get(STORAGE);if(previous?.scores){for(const [k,v]of Object.entries(previous.scores))if(form.elements[k])form.elements[k].value=v;}
  loadOfficial().then(x=>{dataset=x;setNotice(x.officialDataAvailable?'Đã xác minh dataset 2026.':'Chưa có dữ liệu trường/ngành 2026 đã xác minh; hệ thống không hiển thị số liệu 2025 như 2026.','ad-warning');});
 }
 const observer=new MutationObserver(()=>{if(getHost()&&!doc.querySelector('.admissions-planner'))mount();});observer.observe(doc.body,{subtree:true,childList:true});
 document.addEventListener('DOMContentLoaded',mount);
 window.addEventListener('hl:role-ready',e=>{if(e.detail?.student)mount();else doc.querySelectorAll('.admissions-planner').forEach(x=>x.remove());});
})();
