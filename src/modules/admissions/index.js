import { element, button } from '../../core/dom.js';
import { SUBJECTS, COMBINATIONS, calculateCombinations, normalizeScore } from '../../../shared/admissions-math.js';

const fieldsFor = Object.fromEntries(COMBINATIONS.map((combo) => [combo.code, combo.fields]));
export function renderAdmissions() {
  const root = element('section', 'admissions-root');
  const hero = element('section', 'hero admissions-hero');
  hero.append(element('div', 'eyebrow', 'HTVVM STUDIO • TUYỂN SINH'), element('h2', 'hero-title', 'Bản đồ nguyện vọng của bạn.'), element('p', 'hero-subtitle', 'Nhập điểm các môn để ghép tổ hợp hợp lệ, tính điểm ưu tiên theo công thức giảm tuyến tính bạn đang cấu hình và xem nhóm ngành tham khảo.'));
  root.append(hero);
  const layout = element('div', 'admissions-layout');
  const inputPanel = element('section', 'exam-panel admissions-panel');
  inputPanel.append(element('h3', 'exam-heading', '1. Điểm các môn'), element('p', 'exam-message', 'Bỏ trống môn chưa có điểm. Mỗi điểm nằm trong khoảng 0–10.'));
  const scoreGrid = element('div', 'admissions-score-grid');
  const inputs = {};
  for (const subject of SUBJECTS) {
    const label = element('label', 'exam-label admissions-field', subject.label);
    const input = document.createElement('input'); input.type = 'text'; input.inputMode = 'decimal'; input.autocomplete = 'off'; input.placeholder = '—'; input.className = 'exam-input'; input.inputMode = 'decimal'; input.setAttribute('aria-label', `Điểm ${subject.label}`); input.dataset.subject = subject.key;
    label.append(input); inputs[subject.key] = input; scoreGrid.append(label);
  }
  inputPanel.append(scoreGrid);
  const priorityLabel = element('label', 'exam-label admissions-field', 'Điểm ưu tiên gốc (0–3)');
  const priorityInput = document.createElement('input'); priorityInput.type = 'text'; priorityInput.inputMode = 'decimal'; priorityInput.autocomplete = 'off'; priorityInput.value = '0'; priorityInput.className = 'exam-input'; priorityInput.setAttribute('aria-label', 'Điểm ưu tiên gốc'); priorityLabel.append(priorityInput); inputPanel.append(priorityLabel);
  const controls = element('div', 'maker-actions');
  const calculateBtn = button('Ghép tổ hợp', 'primary-btn', calculate);
  const clearBtn = button('Xóa điểm', 'focus-btn', () => { Object.values(inputs).forEach((input) => input.value = ''); priorityInput.value = '0'; latestResults = []; results.replaceChildren(element('p','exam-message','Nhập điểm rồi chọn “Ghép tổ hợp”.')); status.textContent = ''; status.classList.remove('exam-error'); renderPreferences(); });
  controls.append(calculateBtn, clearBtn); inputPanel.append(controls);
  const status = element('p', 'exam-message admissions-status', 'Điểm được xử lý trong trình duyệt; không tự động lưu hoặc gửi lên tài khoản.'); inputPanel.append(status);
  const resultPanel = element('section', 'exam-panel admissions-panel');
  resultPanel.append(element('h3', 'exam-heading', '2. Tổ hợp phù hợp'));
  const results = element('div', 'admissions-results'); results.append(element('p', 'exam-message', 'Kết quả sẽ xuất hiện ở đây.')); resultPanel.append(results);
  layout.append(inputPanel, resultPanel); root.append(layout);
  const planner = element('section', 'exam-panel admissions-panel admissions-planner');
  planner.append(element('h3','exam-heading','3. Theo dõi danh sách nguyện vọng'),element('p','exam-message','Thêm trường/ngành và tự nhập điểm chuẩn tham khảo từ đề án chính thức. Công cụ không tự bịa điểm chuẩn; danh sách được lưu trên thiết bị này.'));
  const prefForm = element('div','admissions-pref-form');
  const schoolInput = document.createElement('input'); schoolInput.className='exam-input'; schoolInput.placeholder='Tên trường'; schoolInput.maxLength=120; schoolInput.setAttribute('aria-label','Tên trường');
  const majorInput = document.createElement('input'); majorInput.className='exam-input'; majorInput.placeholder='Ngành / chương trình'; majorInput.maxLength=120; majorInput.setAttribute('aria-label','Ngành hoặc chương trình');
  const comboSelect = document.createElement('select'); comboSelect.className='exam-input'; comboSelect.setAttribute('aria-label','Tổ hợp xét tuyển');
  const comboDefault=document.createElement('option');comboDefault.value='';comboDefault.textContent='Chọn tổ hợp';comboSelect.append(comboDefault);for(const c of COMBINATIONS){const o=document.createElement('option');o.value=c.code;o.textContent=`${c.code} · ${c.name}`;comboSelect.append(o);}
  const cutoffInput=document.createElement('input');cutoffInput.type='text';cutoffInput.inputMode='decimal';cutoffInput.autocomplete='off';cutoffInput.className='exam-input';cutoffInput.placeholder='Điểm chuẩn tham khảo /30';cutoffInput.setAttribute('aria-label','Điểm chuẩn tham khảo');
  const addPref=button('Thêm nguyện vọng','primary-btn',addPreference); prefForm.append(schoolInput,majorInput,comboSelect,cutoffInput,addPref);planner.append(prefForm);
  const prefStatus=element('p','exam-message','Điểm chuẩn cần do bạn nhập từ nguồn chính thức; mỗi dòng sẽ được so sánh với điểm tổ hợp ở trên.');planner.append(prefStatus);
  const prefs=element('div','admissions-pref-list');planner.append(prefs);root.append(planner);
  const note = element('p', 'exam-message admissions-disclaimer', 'Lưu ý: đây là công cụ tính toán tổ hợp và tham khảo nhóm ngành, không phải hệ thống dự báo trúng tuyển. Danh mục điểm chuẩn chính thức chưa được tích hợp. Điểm ưu tiên thực tế, tổ hợp được dùng và phương thức xét tuyển phải đối chiếu đề án/quy chế tuyển sinh của từng năm và từng trường.'); root.append(note);

  let latestResults = [];
  function calculate() {
    try {
      const scores = {};
      for (const [key, input] of Object.entries(inputs)) {
        if (!input.value.trim()) continue;
        const score = normalizeScore(input.value);
        if (score === null) throw new Error(`Điểm ${SUBJECTS.find((item) => item.key === key).label} phải từ 0 đến 10.`);
        scores[key] = score;
      }
      const priority = Number(String(priorityInput.value || '0').trim().replace(',', '.'));
      if (!Number.isFinite(priority) || priority < 0 || priority > 3) throw new Error('Điểm ưu tiên gốc phải từ 0 đến 3.');
      status.classList.remove('exam-error');
      const combos = calculateCombinations(scores, priority);
      latestResults = combos;
      results.replaceChildren();
      if (!combos.length) { results.append(element('p','exam-message','Chưa đủ điểm cho một trong các tổ hợp mẫu. Hãy nhập điểm cho ít nhất ba môn có trong danh mục.')); status.textContent = ''; renderPreferences(); return; }
      const summary = element('div','admissions-summary'); summary.append(element('strong','',`${combos.length} tổ hợp có thể tính`),element('span','',`Ưu tiên gốc: ${priority.toFixed(2)} điểm`)); results.append(summary);
      for (const combo of combos) {
        const card = element('article','admissions-result-card');
        const top = element('div','admissions-result-top'); top.append(element('strong','admissions-code',combo.code),element('strong','admissions-total',combo.total.toFixed(2).replace('.',','))); card.append(top);
        card.append(element('div','admissions-combo-name',combo.name));
        const metrics = element('div','admissions-metrics'); metrics.append(element('span','',`Điểm tổ hợp: ${combo.score.toFixed(2).replace('.',',')}`),element('span','',`Ưu tiên thực: ${combo.priority.toFixed(2).replace('.',',')}`)); card.append(metrics);
        const tagRow = element('div','admissions-tags'); for (const field of (fieldsFor[combo.code] || [])) tagRow.append(element('span','admissions-tag',field)); card.append(tagRow);
        results.append(card);
      }
      status.textContent = 'Đã tính xong trên thiết bị. Gợi ý ngành chỉ mang tính định hướng; hãy kiểm tra điều kiện của từng trường.';
      renderPreferences();
    } catch (error) { status.textContent = error.message; status.classList.add('exam-error'); }
  }
  const STORAGE_KEY='htvvm.admissions.preferences.v1';
  function readPreferences(){try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(value)?value.filter((p)=>p&&typeof p.id==='string'&&typeof p.school==='string'&&typeof p.major==='string'&&COMBINATIONS.some((c)=>c.code===p.code)&&Number.isFinite(Number(p.cutoff))):[];}catch{return[];}}
  function savePreferences(items){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(items));return true;}catch{return false;}}
  function addPreference(){
    const school=schoolInput.value.trim(),major=majorInput.value.trim(),code=comboSelect.value,cutoff=Number(String(cutoffInput.value).trim().replace(',', '.'));
    if(!school||!major||!code||cutoffInput.value===''||!Number.isFinite(cutoff)||cutoff<0||cutoff>30){prefStatus.textContent='Điền tên trường, ngành, tổ hợp và điểm chuẩn từ 0 đến 30.';return;}
    const items=readPreferences();items.push({id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`,school,major,code,cutoff:Math.round(cutoff*100)/100,createdAt:Date.now()});
    if(!savePreferences(items)){prefStatus.textContent='Trình duyệt không cho phép lưu cục bộ. Kiểm tra chế độ riêng tư hoặc dung lượng lưu trữ.';return;}
    schoolInput.value='';majorInput.value='';comboSelect.value='';cutoffInput.value='';prefStatus.textContent='Đã lưu nguyện vọng trên thiết bị này.';renderPreferences();
  }
  function renderPreferences(){
    const items=readPreferences();prefs.replaceChildren();
    if(!items.length){prefs.append(element('p','exam-message','Chưa có nguyện vọng nào được thêm.'));return;}
    const scoreByCode=new Map(latestResults.map((r)=>[r.code,r.total]));
    for(const item of items){const card=element('article','admissions-pref-card');const top=element('div','admissions-result-top');top.append(element('strong','',item.school),element('span','admissions-code',item.code));card.append(top,element('div','admissions-combo-name',item.major));
      const myScore=scoreByCode.get(item.code);const line=element('div','admissions-metrics');line.append(element('span','',`Điểm chuẩn nhập: ${Number(item.cutoff).toFixed(2).replace('.',',')}`));
      if(myScore===undefined)line.append(element('span','','Chưa đủ điểm để tính tổ hợp này'));else{const margin=Math.round((myScore-Number(item.cutoff))*100)/100;line.append(element('span','',`Điểm của bạn: ${myScore.toFixed(2).replace('.',',')}`),element('strong',`admissions-margin ${margin>=0?'positive':'negative'}`,`${margin>=0?'+':''}${margin.toFixed(2).replace('.',',')} điểm`));}
      card.append(line);const remove=button('Xóa khỏi danh sách','focus-btn',()=>{savePreferences(readPreferences().filter((p)=>p.id!==item.id));renderPreferences();});card.append(remove);prefs.append(card);}
  }
  renderPreferences();
  return root;
}
