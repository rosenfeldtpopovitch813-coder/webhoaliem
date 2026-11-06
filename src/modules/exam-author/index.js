import 'katex/dist/katex.min.css';
import { element, button } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import katex from 'katex';
import { exportExamDocx } from './docx-export.js';

const DRAFT_KEY = 'htvvm.exam-author-draft.v1';
const DRAFTS_KEY = 'htvvm.exam-author-drafts.v1';
const BOARD_LINKS_KEY = 'htvvm.exam-board-links.v1';
const E = element;
const MAX_IMAGE_BYTES = 290000;
const ALLOWED_TAGS = new Set(['P','DIV','BR','SPAN','STRONG','B','EM','I','U','S','UL','OL','LI','H1','H2','H3','H4','BLOCKQUOTE','FIGURE','FIGCAPTION','IMG','TABLE','TBODY','TR','TD','TH','ARTICLE','BUTTON','LABEL','INPUT','SMALL','CODE','A']);

function escapeHTML(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function renderMath(tex, displayMode = false) {
  try { return katex.renderToString(String(tex || ''), { displayMode, throwOnError: false, trust: false, strict: 'ignore' }); }
  catch { return escapeHTML(tex); }
}
function safeImageData(value) {
  return typeof value === 'string' && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(value) && value.length <= 1200000 ? value : '';
}
function sanitizeHTML(source) {
  const template = document.createElement('template');
  template.innerHTML = String(source || '');
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const remove = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!ALLOWED_TAGS.has(node.tagName)) { remove.push(node); continue; }
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc') { node.removeAttribute(attr.name); continue; }
      if (name === 'contenteditable' && !['true','false','plaintext-only'].includes(attr.value)) { node.removeAttribute(attr.name); continue; }
      if (name === 'href' && !/^https:\/\//i.test(attr.value)) node.removeAttribute(attr.name);
      if (name === 'src' && !safeImageData(attr.value)) node.removeAttribute(attr.name);
      if (name === 'style' && !/^(text-align\s*:\s*(left|center|right|justify)\s*;?\s*)?(width\s*:\s*\d{1,3}%\s*;?\s*)?$/i.test(attr.value)) node.removeAttribute(attr.name);
      if (!['class','style','src','alt','title','href','target','rel','value','type','width','height','disabled','checked','contenteditable'].includes(name) && !name.startsWith('aria-') && !name.startsWith('data-')) node.removeAttribute(attr.name);
    }
  }
  for (const node of remove) {
    const text = document.createTextNode(node.textContent || '');
    node.replaceWith(text);
  }
  return template.innerHTML;
}
function compressDataUrl(dataUrl, maxLength = MAX_IMAGE_BYTES) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxSide = 1400;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return reject(Error('Không thể xử lý hình ảnh.'));
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.84, 0.74, 0.64, 0.54, 0.44, 0.34]) {
        const result = canvas.toDataURL('image/jpeg', quality);
        if (result.length <= maxLength) return resolve(result);
      }
      resolve(canvas.toDataURL('image/jpeg', 0.28));
    };
    image.onerror = () => reject(Error('Không đọc được ảnh từ bảng vẽ.'));
    image.src = dataUrl;
  });
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(Error('Không đọc được tệp ảnh.'));
    reader.readAsDataURL(file);
  });
}
function createFigureHTML(dataUrl, alt = 'Hình minh họa', boardProjectId = '') {
  return `<figure class="exam-doc-figure" contenteditable="false" data-figure="1" data-board-project-id="${escapeHTML(boardProjectId)}"><img class="exam-doc-image" data-width="70" src="${escapeHTML(dataUrl)}" alt="${escapeHTML(alt)}"><figcaption contenteditable="true">${escapeHTML(alt)}</figcaption><div class="exam-figure-tools" contenteditable="false"><button type="button" data-figure-action="left">⇤ Trái</button><button type="button" data-figure-action="center">↔ Giữa</button><button type="button" data-figure-action="right">Phải ⇥</button><button type="button" data-figure-action="small">−</button><button type="button" data-figure-action="large">＋</button><button type="button" data-figure-action="edit">✏️ Sửa hình</button><button type="button" data-figure-action="delete">🗑</button></div><span class="exam-figure-resize" contenteditable="false" title="Kéo để đổi kích thước"></span></figure>`;
}
function createQuestionHTML(part = 'I', prompt = '', options = ['', '', '', ''], answer = '', tolerance = 0.0001) {
  const typeName = part === 'I' ? 'TRẮC NGHIỆM A–D' : part === 'II' ? 'ĐÚNG / SAI' : 'TRẢ LỜI NGẮN';
  const promptHTML = prompt || '';
  let body = '';
  if (part === 'I') {
    body = `<div class="exam-doc-options" data-layout="2">${['A','B','C','D'].map((letter, i) => `<div class="exam-doc-option"><button type="button" class="exam-option-letter ${answer === letter ? 'is-correct' : ''}" data-option-answer="${letter}" aria-label="Đánh dấu đáp án ${letter}">${letter}.</button><span class="exam-option-text" contenteditable="true">${escapeHTML(options[i] || '')}</span></div>`).join('')}</div>`;
  } else if (part === 'II') {
    const answers = Array.isArray(answer) ? answer : [null,null,null,null];
    body = `<div class="exam-doc-statements">${['a','b','c','d'].map((letter, i) => `<div class="exam-doc-statement"><b>${letter})</b><span class="exam-statement-text" contenteditable="true">${escapeHTML(options[i] || '')}</span><span class="exam-statement-key"><button type="button" data-tf-answer="${i}" data-value="true" class="${answers[i] === true ? 'is-correct' : ''}">Đ</button><button type="button" data-tf-answer="${i}" data-value="false" class="${answers[i] === false ? 'is-wrong' : ''}">S</button></span></div>`).join('')}</div>`;
  } else {
    body = `<div class="exam-short-answer-row"><span>Đáp án:</span><span class="exam-short-answer" contenteditable="true">${escapeHTML(Array.isArray(answer) ? answer[0] : answer || '')}</span><label>Sai số <input class="exam-tolerance" type="number" min="0" max="1" step="0.0001" value="${Number(tolerance) || 0.0001}" /></label></div><div class="exam-solution-row"><b>Lời giải:</b><div class="exam-solution" contenteditable="true" data-placeholder="Lời giải cho giáo viên (không in ở bản học sinh)…"></div></div>`;
  }
  return `<article class="exam-doc-question exam-doc-block" data-question="1" data-part="${part}" data-points="" data-answer="${escapeHTML(Array.isArray(answer) ? '' : answer || '')}" data-tolerance="${Number(tolerance) || 0.0001}"><div class="exam-question-topline" contenteditable="false"><span class="exam-question-label">Câu 1.</span><span class="exam-question-type">${typeName}</span><span class="exam-question-spacer"></span><button type="button" data-question-action="up" title="Đưa câu lên">↑</button><button type="button" data-question-action="down" title="Đưa câu xuống">↓</button><button type="button" data-question-action="delete" title="Xóa câu">×</button></div><div class="exam-doc-prompt" contenteditable="true" data-placeholder="Nhập nội dung câu hỏi…">${promptHTML}</div>${body}<div class="exam-question-foot" contenteditable="false"><button type="button" data-question-action="insert-image">＋ Hình</button><button type="button" data-question-action="duplicate">Nhân đôi câu</button><span class="exam-option-layout-tools" contenteditable="false">Phương án: <button type="button" data-option-layout="4">1 dòng</button><button type="button" data-option-layout="2">2 dòng</button><button type="button" data-option-layout="1">4 dòng</button></span><span class="exam-correct-caption">Bấm chữ cái hoặc Đ/S để đặt đáp án.</span></div></article>`;
}
function questionNodes(root) { return [...root.querySelectorAll('.exam-doc-question')]; }
function renumber(root) {
  questionNodes(root).forEach((node, index) => { const label = node.querySelector('.exam-question-label'); if (label) label.textContent = `Câu ${index + 1}${node.dataset.points ? ` (${node.dataset.points})` : ''}.`; node.dataset.number = String(index + 1); });
}
function latestPart(root) {
  const blocks = [...root.querySelectorAll('.exam-a4-flow > *')];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const part = blocks[i].dataset?.sectionPart;
    if (part) return part;
    if (blocks[i].matches?.('.exam-doc-question')) return blocks[i].dataset.part;
  }
  return 'I';
}
function markdownFromNode(node) {
  const out = [];
  const walk = current => {
    if (current.nodeType === Node.TEXT_NODE) { out.push(current.nodeValue || ''); return; }
    if (current.nodeType !== Node.ELEMENT_NODE) return;
    const el = current;
    if (el.classList?.contains('exam-math-token')) { out.push(`$${el.dataset.latex || el.textContent || ''}$`); return; }
    if (el.classList?.contains('exam-doc-figure')) { const img = el.querySelector('img'); if (img?.src) out.push(`\n![${img.alt || 'Hình minh họa'}](${img.src})\n`); return; }
    if (el.tagName === 'BR') { out.push('\n'); return; }
    const before = out.length; [...el.childNodes].forEach(walk);
    const text = out.slice(before).join('');
    if (el.tagName === 'STRONG' || el.tagName === 'B') { out.splice(before, out.length - before, `**${text}**`); }
    else if (el.tagName === 'EM' || el.tagName === 'I') { out.splice(before, out.length - before, `*${text}*`); }
    else if (['P','DIV','H1','H2','H3','H4','LI'].includes(el.tagName)) out.push('\n');
  };
  [...node.childNodes].forEach(walk);
  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}
function collectQuestions(root) {
  return questionNodes(root).map(node => {
    const part = ['I','II','III'].includes(node.dataset.part) ? node.dataset.part : 'I';
    const promptNode = node.querySelector('.exam-doc-prompt');
    const prompt = markdownFromNode(promptNode || node);
    const figure = node.querySelector('.exam-doc-figure img');
    const options = part === 'III'
      ? []
      : part === 'I'
        ? [...node.querySelectorAll('.exam-option-text')].map(item => markdownFromNode(item))
        : [...node.querySelectorAll('.exam-statement-text')].map(item => markdownFromNode(item));
    const answer = part === 'I'
      ? (node.querySelector('.exam-option-letter.is-correct')?.dataset.optionAnswer || '')
      : part === 'II'
        ? [...node.querySelectorAll('.exam-doc-statement')].map(item => item.querySelector('[data-tf-answer].is-correct, [data-tf-answer].is-wrong')?.dataset.value === 'true' ? true : item.querySelector('[data-tf-answer].is-correct, [data-tf-answer].is-wrong')?.dataset.value === 'false' ? false : null)
        : (node.querySelector('.exam-short-answer')?.textContent || '').trim();
    const solution = markdownFromNode(node.querySelector('.exam-solution') || document.createElement('div'));
    const tolerance = Number(node.querySelector('.exam-tolerance')?.value || node.dataset.tolerance || 0.0001);
    return {
      part, prompt: prompt || ' ', options: part === 'III' ? [] : Array.from({length:4},(_,i)=>options[i] || ''),
      answer: part === 'II' ? Array.from({length:4},(_,i)=>answer[i] ?? null) : answer,
      tolerance: Number.isFinite(tolerance) ? Math.max(0, Math.min(1, tolerance)) : 0.0001,
      // Figures are already preserved inline in the prompt Markdown; avoid duplicating them in the room preview.
      image: '',
      solution
    };
  });
}
function makeHeaderHTML(meta) {
  const subjectText = meta.subjectText || `Môn: ${meta.subject || '…'} – Lớp ${meta.grade || '…'}`;
  return `<header class="exam-a4-heading"><div class="exam-a4-institution"><div class="exam-a4-school"><span contenteditable="true" data-meta="department">${escapeHTML(meta.department || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO …')}</span><strong contenteditable="true" data-meta="school">${escapeHTML(meta.school || 'TRƯỜNG …')}</strong><span class="exam-underline"></span></div><div class="exam-a4-examname"><strong contenteditable="true" data-meta="examName">${escapeHTML(meta.examName || 'ĐỀ KIỂM TRA …')}</strong><span contenteditable="true" data-meta="subject">${escapeHTML(subjectText)}</span><span>Thời gian làm bài: <span contenteditable="true" data-meta="durationText">${escapeHTML(meta.durationText || '…')}</span> phút</span><span contenteditable="true" data-meta="extra">(Không kể thời gian phát đề)</span></div></div><div class="exam-a4-studentline"><span>Họ và tên: ........................................................................</span><span>Lớp: ............</span><span>Số báo danh: ................</span></div></header>`;
}
function makeDraftId() {
  return globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function readDraftCollection() {
  try {
    const value = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
    return Array.isArray(value) ? value.filter(item => item && typeof item.id === 'string' && typeof item.documentHtml === 'string') : [];
  } catch { return []; }
}
function persistDraftCollection(entries, activeId) {
  const sorted = [...entries].sort((a,b) => (Number(b.updatedAt)||0) - (Number(a.updatedAt)||0));
  const kept = sorted.slice(0, 12);
  const size = list => new Blob([JSON.stringify(list)]).size;
  while (kept.length > 1 && size(kept) > 4.45 * 1024 * 1024) kept.pop();
  if (size(kept) > 4.45 * 1024 * 1024) throw Error('Đề có quá nhiều hình để lưu vào trình duyệt. Hãy giảm kích thước hình hoặc tải file Word để sao lưu.');
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(kept));
  const active = kept.find(item => item.id === activeId);
  if (!active) throw Error('Không lưu được bản đề hiện tại vào danh sách.');
  // Compatibility pointer: the exam-room module resolves the full draft from DRAFTS_KEY.
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ draftId: activeId, title: active.title, durationMinutes: active.durationMinutes, updatedAt: active.updatedAt }));
  localStorage.setItem('htvvm.exam-author-active-draft.v1', activeId);
  return kept;
}
function readDraft() {
  try {
    const entries = readDraftCollection();
    const params = new URLSearchParams(location.search);
    const forceNew = params.get('new') === '1';
    const requestedId = params.get('draftId');
    const activeId = localStorage.getItem('htvvm.exam-author-active-draft.v1');
    const selected = forceNew ? null : requestedId ? entries.find(item => item.id === requestedId) : entries.find(item => item.id === activeId) || entries.sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0))[0];
    const requestedDraftMissing = Boolean(requestedId) && !selected;
    let saved = forceNew || requestedDraftMissing ? null : selected || JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (saved?.draftId && !selected) saved = null;
    const metadata = saved?.metadata && typeof saved.metadata === 'object' ? saved.metadata : {};
    if (saved?.documentHtml && typeof saved.documentHtml === 'string') return {
      id: saved.id || makeDraftId(), title: String(saved.title || 'Đề thi mới').slice(0,140), durationMinutes: Number(saved.durationMinutes) || 50,
      metadata, documentHtml: sanitizeHTML(saved.documentHtml), questions: Array.isArray(saved.questions) ? saved.questions : [], savedAt: saved.updatedAt || 0
    };
    // Migrate the previous question-only draft without discarding prompts or answer keys.
    if (saved && Array.isArray(saved.questions)) {
      const parts = ['I','II','III'];
      let html = '';
      for (const part of parts) {
        const group = saved.questions.filter(question => question.part === part);
        if (group.length) html += `<div class="exam-doc-section" data-section-part="${part}">${part==='I'?'PHẦN I. TRẮC NGHIỆM':part==='II'?'PHẦN II. ĐÚNG / SAI':'PHẦN III. TRẢ LỜI NGẮN'}</div>` + group.map(question => createQuestionHTML(part, escapeHTML(String(question.prompt || '')).replace(/\n/g,'<br>'), Array.isArray(question.options) ? question.options : ['', '', '', ''], question.answer ?? '', question.tolerance)).join('');
      }
      return { id: saved.id || makeDraftId(), title: String(saved.title || 'Đề thi mới'), durationMinutes: Number(saved.durationMinutes) || 50, metadata, documentHtml: html, questions: saved.questions, savedAt: 0 };
    }
  } catch { /* fall through to a fresh document */ }
  return { id: makeDraftId(), title: 'Đề kiểm tra mới', durationMinutes: 50, metadata: {}, documentHtml: '', questions: [], savedAt: 0 };
}

function addA4Page(pages, { first = false, title = '', meta = {} } = {}) {
  const page = E('article', 'exam-a4-page');
  page.dataset.page = String(pages.children.length + 1);
  const inner = E('div', 'exam-a4-inner');
  if (first) {
    inner.innerHTML = makeHeaderHTML(meta);
  } else {
    const running = E('div', 'exam-a4-running-head', title || 'ĐỀ KIỂM TRA');
    inner.append(running);
  }
  const flow = E('div', 'exam-a4-flow');
  flow.contentEditable = 'true'; flow.spellcheck = true; flow.setAttribute('role','textbox'); flow.setAttribute('aria-label', `Nội dung đề thi, trang ${pages.children.length + 1}`);
  if (first) flow.classList.add('is-first-page-flow');
  inner.append(flow); page.append(inner);
  const pageNumber = E('span','exam-page-number',String(pages.children.length + 1)); pageNumber.setAttribute('aria-hidden','true'); page.append(pageNumber);
  pages.append(page);
  return { page, flow };
}

export function renderExamAuthor() {
  const root = E('div', 'exam-author-studio');
  const initial = readDraft();
  const routeParams = new URLSearchParams(location.search);
  let linkedBoardId = routeParams.get('boardId') || initial.metadata?.boardProjectId || '';
  let linkedBoardTitle = routeParams.get('boardTitle') || initial.metadata?.boardTitle || '';
  const titleInput = document.createElement('input'); titleInput.className='exam-studio-title-input'; titleInput.value=linkedBoardTitle&&(!routeParams.get('draftId')||initial.title==='Đề kiểm tra mới')?`${linkedBoardTitle} – Đề thi`:initial.title; titleInput.placeholder='Tên đề thi'; titleInput.setAttribute('aria-label','Tên đề thi');
  const durationInput = document.createElement('input'); durationInput.className='exam-studio-duration-input'; durationInput.type='number'; durationInput.min='5'; durationInput.max='240'; durationInput.value=String(initial.durationMinutes); durationInput.setAttribute('aria-label','Thời gian làm bài (phút)');
  const subjectInput = document.createElement('input'); subjectInput.className='exam-studio-meta-input'; subjectInput.placeholder='Môn học'; subjectInput.value=initial.metadata.subject || '';
  const gradeInput = document.createElement('input'); gradeInput.className='exam-studio-meta-input'; gradeInput.placeholder='Lớp'; gradeInput.value=initial.metadata.grade || '';
  const toolbarTop = E('div','exam-studio-topbar');
  const brand = E('div','exam-studio-brand'); brand.append(E('span','exam-studio-eyebrow','HTVVM STUDIO · SOẠN THẢO A4'),E('strong','','Trình biên soạn đề thi'));
  const actions = E('div','exam-studio-actions');
  const saveStatus = E('span','exam-studio-save-status','Bản nháp chưa lưu');
  let activeDraftId = initial.id || makeDraftId();
  const saveButton = button('💾 Lưu nháp','exam-studio-btn primary',()=>saveDraft(true));
  const newDraftButton = button('＋ Đề mới','exam-studio-btn',createNewDraft);
  const openDraftButton = button('Mở đề cũ','exam-studio-btn',openDraftPicker);
  const downloadButton = button('⬇ Tải về','exam-studio-btn primary',toggleExportMenu);
  const roomButton = button('Tạo phòng thi →','exam-studio-btn accent',goToRoom);
  actions.append(saveStatus,newDraftButton,openDraftButton,saveButton,downloadButton,roomButton);
  toolbarTop.append(brand,actions);

  const metaBar = E('div','exam-studio-meta-bar');
  const titleWrap=E('label','exam-studio-meta-field');titleWrap.append(E('span','','Tên đề'),titleInput);
  const subjectWrap=E('label','exam-studio-meta-field');subjectWrap.append(E('span','','Môn'),subjectInput);
  const gradeWrap=E('label','exam-studio-meta-field');gradeWrap.append(E('span','','Lớp'),gradeInput);
  const durationWrap=E('label','exam-studio-meta-field');durationWrap.append(E('span','','Thời gian (phút)'),durationInput);
  metaBar.append(titleWrap,subjectWrap,gradeWrap,durationWrap);

  const formatBar = E('div','exam-a4-toolbar');
  const fontSelect=document.createElement('select');fontSelect.className='exam-studio-select';fontSelect.setAttribute('aria-label','Phông chữ');
  for(const [value,text] of [['Times New Roman','Times New Roman'],['Arial','Arial'],['Cambria','Cambria'],['Calibri','Calibri']]){const option=document.createElement('option');option.value=value;option.textContent=text;fontSelect.append(option)}
  const sizeSelect=document.createElement('select');sizeSelect.className='exam-studio-select';sizeSelect.setAttribute('aria-label','Cỡ chữ');
  for(const size of [10,11,12,13,14,16,18,20,24,28,32]){const option=document.createElement('option');option.value=String(size);option.textContent=`${size} pt`;if(size===12)option.selected=true;sizeSelect.append(option)}
  const tool = (label, command, value='') => button(label,'exam-format-tool',()=>execFormat(command,value));
  const insertTextBtn=button('＋ Đoạn văn','exam-format-tool',()=>insertParagraph());
  const insertFormulaBtn=button('ƒ Công thức','exam-format-tool formula',()=>openFormulaDialog());
  const insertImageBtn=button('🖼 Chèn ảnh','exam-format-tool',()=>imageInput.click());
  const drawBtn=button('🖼 Vẽ hình','exam-format-tool draw',openBoard);
  const addSectionBtn=button('＋ Phần thi','exam-format-tool',openSectionMenu);
  const addQuestionBtn=button('＋ Câu hỏi','exam-format-tool question',openQuestionMenu);
  const pageBreakBtn=button('＋ Trang mới','exam-format-tool',insertPageBreak);
  formatBar.append(fontSelect,sizeSelect,tool('B','bold'),tool('I','italic'),tool('U','underline'),tool('x²','superscript'),tool('x₂','subscript'),tool('≡','justifyLeft'),tool('☷','justifyCenter'),tool('☰','justifyRight'),tool('• Danh sách','insertUnorderedList'),insertFormulaBtn,insertImageBtn,drawBtn,addSectionBtn,addQuestionBtn,pageBreakBtn);
  const imageInput=document.createElement('input');imageInput.type='file';imageInput.accept='image/png,image/jpeg,image/webp';imageInput.hidden=true;

  const workspace=E('div','exam-studio-workspace');
  const side=E('aside','exam-studio-sidebar');
  const outline=E('section','exam-studio-outline');outline.append(E('h3','','Cấu trúc đề'),E('p','exam-studio-hint','Các phần và câu hỏi được đánh số tự động.'));
  const outlineList=E('div','exam-studio-outline-list');outline.append(outlineList);
  const quickActions=E('section','exam-studio-quick-actions');quickActions.append(E('h3','','Chèn nhanh'));
  for(const [labelText,fn] of [['Phần I · Trắc nghiệm',()=>insertSection('I')],['Phần II · Đúng / Sai',()=>insertSection('II')],['Phần III · Trả lời ngắn',()=>insertSection('III')],['Câu trắc nghiệm A–D',()=>insertQuestion('I')],['Câu đúng / sai',()=>insertQuestion('II')],['Câu trả lời ngắn',()=>insertQuestion('III')]]) quickActions.append(button(labelText,'exam-outline-action',fn));
  side.append(outline,quickActions);
  const pageStack=E('div','exam-a4-stack');
  const pageScroller=E('main','exam-a4-scroll');pageScroller.append(pageStack);
  workspace.append(side,pageScroller);
  const status=E('p','exam-studio-status','');
  const exportMenu=E('div','exam-export-menu');exportMenu.hidden=true;
  exportMenu.append(E('strong','','Tải đề thi'),button('File Word (.docx) · bản giáo viên','exam-export-choice',()=>exportDocx(false)),button('File Word (.docx) · bản học sinh','exam-export-choice',()=>exportDocx(true)),button('PDF · bản học sinh','exam-export-choice',()=>exportPdf(false)),button('PDF · kèm đáp án','exam-export-choice',()=>exportPdf(true)));
  const floating=E('div','exam-studio-popups');floating.append(exportMenu);
  root.append(toolbarTop,metaBar,formatBar,workspace,status,floating,imageInput);

  const startupMeta={...(initial.metadata||{})};
  if(!startupMeta.examName&&linkedBoardTitle)startupMeta.examName=`ĐỀ KIỂM TRA ${linkedBoardTitle.toLocaleUpperCase('vi-VN')}`;
  const first = addA4Page(pageStack,{first:true,title:titleInput.value,meta:startupMeta});
  let activeFlow=first.flow, selectedFigure=null, draftTimer=null, resizeObserver=null, currentBoardOverlay=null, savedInsertRange=null;
  if(initial.documentHtml){
    const template=document.createElement('template');template.innerHTML=sanitizeHTML(initial.documentHtml);
    let destination=activeFlow;
    for(const child of [...template.content.childNodes]){
      if(child.nodeType===Node.ELEMENT_NODE&&child.classList?.contains('exam-doc-page-break')){
        destination=addA4Page(pageStack,{first:false,title:titleInput.value}).flow;
      }else destination.append(child.cloneNode(true));
    }
  }
  if(!activeFlow.children.length){
    activeFlow.innerHTML='<p class="exam-doc-paragraph">Bắt đầu nhập nội dung đề thi tại đây…</p>';
    const p=activeFlow.firstElementChild;p.dataset.placeholder='1';
  }
  const flows=()=>[...pageStack.querySelectorAll('.exam-a4-flow')];
  const activeQuestion=()=>document.getSelection()?.anchorNode?.parentElement?.closest('.exam-doc-question') || null;
  const getMeta=()=>({department:pageStack.querySelector('[data-meta="department"]')?.textContent||'SỞ GIÁO DỤC VÀ ĐÀO TẠO …',school:pageStack.querySelector('[data-meta="school"]')?.textContent||'TRƯỜNG …',examName:pageStack.querySelector('[data-meta="examName"]')?.textContent||`ĐỀ KIỂM TRA ${titleInput.value}`,subject:subjectInput.value,grade:gradeInput.value,subjectText:pageStack.querySelector('[data-meta="subject"]')?.textContent||'',durationText:pageStack.querySelector('[data-meta="durationText"]')?.textContent||durationInput.value,extra:pageStack.querySelector('[data-meta="extra"]')?.textContent||'(Không kể thời gian phát đề)',boardProjectId:linkedBoardId,boardTitle:linkedBoardTitle});
  const metaInputs=()=>[...pageStack.querySelectorAll('[data-meta]')];
  function setStatus(text,kind='') { status.textContent=text;status.className=`exam-studio-status ${kind}`;saveStatus.textContent=kind==='error'?'Lỗi lưu':text; }
  function documentHTML() { return flows().map(flow=>flow.innerHTML).join('<div class="exam-doc-page-break" data-page-break="1"></div>'); }
  function draftPayload(){return {title:titleInput.value.trim()||'Đề thi mới',durationMinutes:Number(durationInput.value)||50,metadata:getMeta(),documentHtml:documentHTML(),questions:collectQuestions(pageStack),updatedAt:Date.now(),version:2};}
  function saveDraft(manual=false){
    clearTimeout(draftTimer);
    try{
      const draft={...draftPayload(),id:activeDraftId};
      const entries=readDraftCollection().filter(item=>item.id!==activeDraftId);
      entries.unshift(draft);
      persistDraftCollection(entries,activeDraftId);
      if(linkedBoardId){
        let links={};
        try{links=JSON.parse(localStorage.getItem(BOARD_LINKS_KEY)||'{}')||{};}catch{links={};}
        const plainText=draft.documentHtml
          .replace(/<[^>]*>/g,' ')
          .replace(/&nbsp;/g,' ')
          .replace(/Bắt đầu nhập nội dung đề thi tại đây…/g,' ')
          .trim();
        const hasFigures=/data:image\//i.test(draft.documentHtml);
        const hasExamContent=(draft.questions?.length||0)>0||plainText.length>0||hasFigures;
        if(hasExamContent){
          links[linkedBoardId]={draftId:activeDraftId,title:draft.title,updatedAt:draft.updatedAt,boardTitle:linkedBoardTitle};
        }else if(links[linkedBoardId]?.draftId===activeDraftId){
          delete links[linkedBoardId];
        }
        localStorage.setItem(BOARD_LINKS_KEY,JSON.stringify(links));
      }
      setStatus(manual?'Đã lưu bản nháp trên thiết bị.':'Tự lưu lúc '+new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}),'saved');
      return true;
    }catch(error){setStatus(error.message||'Không thể lưu nháp.','error');return false;}
  }
  function queueSave(){clearTimeout(draftTimer);setStatus('Đang lưu…');draftTimer=setTimeout(()=>saveDraft(false),360);}
  function execFormat(command,value=''){
    const selection=document.getSelection();if(!selection?.rangeCount)return;
    const target=selection.anchorNode?.parentElement?.closest('.exam-a4-flow');
    if(!target){setStatus('Đặt con trỏ vào trang đề trước khi định dạng.');return;}
    target.focus();document.execCommand(command,false,value);queueSave();
  }
  function currentFlow(){
    const selection=document.getSelection();const flow=selection?.anchorNode?.parentElement?.closest('.exam-a4-flow');
    if(flow)return flow;
    return flows().at(-1)||activeFlow;
  }
  function insertHTMLAtCaret(html){
    const selection=document.getSelection();
    let range=selection?.rangeCount&&selection.anchorNode?.parentElement?.closest('.exam-a4-flow')?selection.getRangeAt(0):null;
    if(!range&&savedInsertRange?.startContainer?.isConnected)range=savedInsertRange;
    if(range){
      range.deleteContents();const template=document.createElement('template');template.innerHTML=html;const fragment=template.content;const last=fragment.lastChild;range.insertNode(fragment);if(last){range.setStartAfter(last);range.collapse(true);selection?.removeAllRanges();selection?.addRange(range);}savedInsertRange=null;return;
    }
    const flow=currentFlow();flow.focus();
    const placeholder=flow.querySelector('[data-placeholder="1"]');if(placeholder)placeholder.remove();
    flow.insertAdjacentHTML('beforeend',html);
  }
  function insertParagraph(){insertHTMLAtCaret('<p class="exam-doc-paragraph"><br></p>');queueSave();}
  function insertSection(part){
    const names={I:'PHẦN I. TRẮC NGHIỆM',II:'PHẦN II. TRẮC NGHIỆM ĐÚNG SAI',III:'PHẦN III. TRẢ LỜI NGẮN'};
    insertHTMLAtCaret(`<div class="exam-doc-section exam-doc-block" data-section-part="${part}" contenteditable="true">${names[part]}</div><p><br></p>`);refreshOutline();queueSave();
  }
  function insertQuestion(part){
    insertHTMLAtCaret(createQuestionHTML(part));
    renumber(pageStack);refreshOutline();paginate();queueSave();
    const question=activeQuestion()||questionNodes(pageStack).at(-1);question?.querySelector('.exam-doc-prompt')?.focus();
  }
  function openQuestionMenu(){
    const menu=E('div','exam-insert-menu');menu.append(E('strong','','Chọn dạng câu hỏi'));
    for(const [part,name] of [['I','Trắc nghiệm A–D'],['II','Đúng / Sai'],['III','Trả lời ngắn']])menu.append(button(name,'exam-insert-choice',()=>{insertQuestion(part);menu.remove()}));
    showFloating(menu,addQuestionBtn);
  }
  function openSectionMenu(){
    const menu=E('div','exam-insert-menu');menu.append(E('strong','','Chia phần đề thi'));
    for(const [part,name] of [['I','Phần I · Trắc nghiệm'],['II','Phần II · Đúng / Sai'],['III','Phần III · Trả lời ngắn']])menu.append(button(name,'exam-insert-choice',()=>{insertSection(part);menu.remove()}));
    showFloating(menu,addSectionBtn);
  }
  function showFloating(menu,anchor){
    root.querySelector('.exam-insert-menu')?.remove();menu.style.position='absolute';menu.style.zIndex='30';menu.style.left='12px';menu.style.top=`${anchor.offsetTop+anchor.offsetHeight+8}px`;floating.append(menu);
  }
  function insertPageBreak(){
    const page=addA4Page(pageStack,{first:false,title:titleInput.value});resizeObserver?.observe(page.flow);activeFlow=page.flow;activeFlow.innerHTML='<p><br></p>';activeFlow.focus();queueSave();
  }
  function paginate(){
    let index=0, guard=0;
    while(index<flows().length && guard++<160){
      const list=flows();const flow=list[index];
      if(!flow)break;
      if(flow.scrollHeight<=flow.clientHeight+8 || flow.children.length<=1){index++;continue;}
      let next=list[index+1];
      if(!next){next=addA4Page(pageStack,{first:false,title:titleInput.value}).flow;resizeObserver?.observe(next);}
      const move=flow.lastElementChild;
      if(move?.classList.contains('exam-doc-page-break')){move.remove();index++;continue;}
      next.insertBefore(move,next.firstChild);
    }
    [...pageStack.querySelectorAll('.exam-a4-page')].forEach((page,index)=>{
      page.dataset.page=String(index+1);
      const number=page.querySelector('.exam-page-number');if(number)number.textContent=String(index+1);
      const flow=page.querySelector('.exam-a4-flow');if(flow)flow.setAttribute('aria-label',`Nội dung đề thi, trang ${index+1}`);
    });
  }
  function refreshOutline(){
    outlineList.replaceChildren();
    const blocks=[...pageStack.querySelectorAll('.exam-doc-section,.exam-doc-question')];
    if(!blocks.length)outlineList.append(E('p','exam-studio-hint','Chưa có phần hoặc câu hỏi.'));
    blocks.forEach((node,index)=>{
      const item=button(node.matches('.exam-doc-question')?`${node.querySelector('.exam-question-label')?.textContent||`Câu ${index+1}`} · ${node.dataset.part==='I'?'Trắc nghiệm':node.dataset.part==='II'?'Đúng/Sai':'Trả lời ngắn'}`:node.textContent.trim(),'exam-outline-link',()=>{node.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});});
      outlineList.append(item);
    });
  }
  function normalizeTypedQuestion(event){
    const selection=document.getSelection();const node=selection?.anchorNode;
    if(!node||node.nodeType!==Node.TEXT_NODE)return;
    const parent=node.parentElement;
    if(!parent||parent.closest('.exam-doc-question,.exam-doc-section,.exam-doc-figure'))return;
    let block=parent.closest('p,div');
    if(block?.classList.contains('exam-a4-flow'))block=null;
    const raw=block?(block.textContent||''):(node.nodeValue||'');
    const sectionMatch=raw.trim().match(/^PHẦN\s*(I{1,3}|[1-3])\s*[.:：-]?\s*(.*)$/i);
    if(sectionMatch){
      const part=({1:'I',2:'II',3:'III',I:'I',II:'II',III:'III'})[sectionMatch[1].toUpperCase()];
      const heading=document.createElement('div');heading.className='exam-doc-section exam-doc-block';heading.dataset.sectionPart=part;heading.contentEditable='true';
      const standard={I:'PHẦN I. TRẮC NGHIỆM',II:'PHẦN II. ĐÚNG / SAI',III:'PHẦN III. TRẢ LỜI NGẮN'}[part];heading.textContent=raw.trim()||standard;
      if(block)block.replaceWith(heading);else node.replaceWith(heading);
      renumber(pageStack);refreshOutline();queueSave();return;
    }
    const match=raw.match(/^\s*Câu\s*\d+\s*(?:\(([^)]*(?:điểm|đ)\s*[^)]*)\)\s*)?[.:：]\s*(.*)$/i);
    if(!match)return;
    const part=latestPart(pageStack);
    const template=document.createElement('template');template.innerHTML=createQuestionHTML(part);
    const question=template.content.firstElementChild;
    if(match[1])question.dataset.points=match[1].trim();
    const prompt=question.querySelector('.exam-doc-prompt');prompt.textContent=match[2]||'';
    if(block)block.replaceWith(question);else node.replaceWith(question);
    const target=question.querySelector('.exam-doc-prompt');target.focus();
    if(target.firstChild){const range=document.createRange();range.selectNodeContents(target);range.collapse(false);selection.removeAllRanges();selection.addRange(range);}
    renumber(pageStack);refreshOutline();queueSave();
  }
  function normalizeTypedOptions(event){
    const node=document.getSelection()?.anchorNode;
    if(!node||node.nodeType!==Node.TEXT_NODE)return;
    const prompt=node.parentElement?.closest('.exam-doc-prompt');
    const question=prompt?.closest('.exam-doc-question');
    if(!prompt||!question||question.dataset.part!=='I')return;
    const raw=prompt.textContent||'';
    const match=raw.match(/^([\s\S]*?)\s+A[.)]\s*([\s\S]*?)\s+B[.)]\s*([\s\S]*?)\s+C[.)]\s*([\s\S]*?)\s+D[.)]\s*([\s\S]*)$/i);
    if(!match)return;
    prompt.textContent=match[1].trim();
    const values=match.slice(2,6);
    question.querySelectorAll('.exam-option-text').forEach((field,index)=>{field.textContent=values[index].trim();});
    const target=question.querySelectorAll('.exam-option-text')[3];
    if(target){target.focus();const range=document.createRange();range.selectNodeContents(target);range.collapse(false);const selection=document.getSelection();selection?.removeAllRanges();selection?.addRange(range);}
    queueSave();setStatus('Đã nhận diện bốn phương án A–D.','saved');
  }
  function handleEditorInput(event){
    const flow=event.target.closest?.('.exam-a4-flow');if(!flow)return;
    activeFlow=flow;
    const target=event.target;
    if(target.matches?.('.exam-doc-section')){
      const text=target.textContent.toUpperCase();if(text.includes('PHẦN II'))target.dataset.sectionPart='II';else if(text.includes('PHẦN III'))target.dataset.sectionPart='III';else if(text.includes('PHẦN I'))target.dataset.sectionPart='I';
    }
    normalizeTypedQuestion(event);
    normalizeTypedOptions(event);
    renumber(pageStack);refreshOutline();paginate();queueSave();
  }
  function onEditorClick(event){
    const action=event.target.closest?.('[data-question-action],[data-option-answer],[data-tf-answer],[data-option-layout],[data-figure-action],.exam-math-token');if(!action)return;
    if(action.classList?.contains('exam-math-token')){openFormulaDialog(action);return;}
    const question=action.closest('.exam-doc-question');
    if(action.dataset.optionAnswer&&question){
      question.dataset.answer=action.dataset.optionAnswer;
      question.querySelectorAll('.exam-option-letter').forEach(item=>item.classList.toggle('is-correct',item===action));
      question.querySelector('.exam-correct-caption').textContent=`Đáp án đúng: ${action.dataset.optionAnswer}`;queueSave();return;
    }
    if(action.dataset.tfAnswer!==undefined&&question){
      const row=action.closest('.exam-doc-statement');row.querySelectorAll('[data-tf-answer]').forEach(item=>item.classList.remove('is-correct','is-wrong'));
      action.classList.add(action.dataset.value==='true'?'is-correct':'is-wrong');queueSave();return;
    }
    if(action.dataset.optionLayout&&question){const grid=question.querySelector('.exam-doc-options');if(grid){grid.dataset.layout=action.dataset.optionLayout;queueSave();}return;}
    if(action.dataset.questionAction&&question){
      const kind=action.dataset.questionAction;
      if(kind==='delete')question.remove();
      if(kind==='duplicate')question.after(question.cloneNode(true));
      if(kind==='up'&&question.previousElementSibling)question.parentElement.insertBefore(question,question.previousElementSibling);
      if(kind==='down'&&question.nextElementSibling)question.parentElement.insertBefore(question.nextElementSibling,question);
      if(kind==='insert-image'){pendingImageTarget=question.querySelector('.exam-doc-prompt');imageInput.click();}
      renumber(pageStack);refreshOutline();paginate();queueSave();return;
    }
    if(action.dataset.figureAction){
      const figure=action.closest('.exam-doc-figure');if(!figure)return;
      const kind=action.dataset.figureAction;const img=figure.querySelector('img');
      if(kind==='delete')figure.remove();
      if(kind==='left'||kind==='center'||kind==='right')figure.style.textAlign=kind;
      if(kind==='small')img.style.width=`${Math.max(25,(Number(img.dataset.width||100)-10))}%`,img.dataset.width=String(Math.max(25,Number(img.dataset.width||100)-10));
      if(kind==='large')img.style.width=`${Math.min(100,Number(img.dataset.width||70)+10)}%`,img.dataset.width=String(Math.min(100,Number(img.dataset.width||70)+10));
      if(kind==='edit'){selectedFigure=figure;openBoard();}
      queueSave();
    }
  }
  let pendingImageTarget=null;
  imageInput.addEventListener('change',async()=>{
    const file=imageInput.files?.[0];if(!file)return;
    if(file.size>12*1024*1024){setStatus('Ảnh gốc tối đa 12 MB.','error');imageInput.value='';return;}
    try{
      const url=await compressDataUrl(await fileToDataUrl(file));
      if(pendingImageTarget){pendingImageTarget.insertAdjacentHTML('beforeend',createFigureHTML(url,file.name));pendingImageTarget=null;}
      else insertHTMLAtCaret(createFigureHTML(url,file.name));
      queueSave();setStatus('Đã chèn hình minh họa.','saved');
    }catch(error){setStatus(error.message||'Không chèn được ảnh.','error');}
    finally{imageInput.value='';}
  });
  function openFormulaDialog(existing=null){
    const overlay=E('div','exam-formula-overlay');const dialog=E('section','exam-formula-dialog');
    dialog.append(E('h3','','Công thức toán học / hóa học'),E('p','exam-studio-hint','Nhập LaTeX. Ví dụ: \\frac{1}{2}mv^2, \\sqrt{x}, \\int_0^1 x^2 dx, \\ce{H2SO4}'));
    const input=document.createElement('textarea');input.className='exam-formula-input';input.value=existing?.dataset.latex||'';input.placeholder='\\frac{a}{b}';
    const preview=E('div','exam-formula-preview');const refresh=()=>{preview.innerHTML=renderMath(input.value,true)};input.addEventListener('input',refresh);refresh();
    const actions=E('div','exam-formula-actions');actions.append(button('Hủy','exam-studio-btn',()=>overlay.remove()),button(existing?'Cập nhật công thức':'Chèn công thức','exam-studio-btn primary',()=>{
      const tex=input.value.trim();if(!tex){setStatus('Hãy nhập biểu thức.');return;}
      if(existing){existing.dataset.latex=tex;existing.innerHTML=renderMath(tex,false);}
      else insertHTMLAtCaret(`<span class="exam-math-token" contenteditable="false" data-latex="${escapeHTML(tex)}">${renderMath(tex,false)}</span>`);
      overlay.remove();queueSave();
    }));
    dialog.append(input,preview,actions);overlay.append(dialog);root.append(overlay);input.focus();
  }
  function openBoard(){
    const selection=document.getSelection();
    if(selection?.rangeCount&&selection.anchorNode?.parentElement?.closest('.exam-a4-flow'))savedInsertRange=selection.getRangeAt(0).cloneRange();
    if(currentBoardOverlay){currentBoardOverlay.remove();currentBoardOverlay=null;}
    const overlay=E('div','exam-board-overlay');const modal=E('section','exam-board-modal');
    const header=E('div','exam-board-header');header.append(E('strong','','Vẽ hình và đưa thẳng vào đề'),button('✕ Đóng bảng vẽ','exam-studio-btn',()=>{overlay.remove();currentBoardOverlay=null;queueSave()}));
    const split=E('div','exam-board-split');const previewPane=E('div','exam-board-doc-preview');previewPane.append(E('span','exam-studio-eyebrow','TRANG ĐỀ THI'),pageStack.querySelector('.exam-a4-page').cloneNode(true));
    const boardPane=E('div','exam-board-canvas-pane');const note=E('p','exam-studio-hint','Trên bảng, chọn một hình hoặc nhóm hình. Bấm “Tạo ảnh kéo sang đề”, sau đó kéo ảnh xem trước vào vị trí muốn chèn.');
    const boardToOpen=selectedFigure?.dataset.boardProjectId||linkedBoardId;
    const iframe=document.createElement('iframe');iframe.src=`/focus-notes/index.html?embed=1&examMode=1${boardToOpen ? `&projectId=${encodeURIComponent(boardToOpen)}` : ''}`;iframe.title='Bảng vẽ Lớp học Mực';iframe.allow='clipboard-read; clipboard-write; fullscreen';iframe.allowFullscreen=true;iframe.className='exam-board-iframe';
    boardPane.append(note,iframe);split.append(previewPane,boardPane);modal.append(header,split);overlay.append(modal);root.append(overlay);currentBoardOverlay=overlay;
  }
  function receiveBoardFigure(dataUrl, boardProjectId='', boardTitle=''){
    if(!safeImageData(dataUrl)){setStatus('Ảnh từ bảng vẽ không hợp lệ hoặc quá lớn.','error');return;}
    if(boardProjectId){linkedBoardId=boardProjectId;linkedBoardTitle=boardTitle||linkedBoardTitle;}
    if(selectedFigure?.isConnected){const img=selectedFigure.querySelector('img');img.src=dataUrl;selectedFigure.dataset.boardProjectId=boardProjectId||selectedFigure.dataset.boardProjectId||linkedBoardId;selectedFigure=null;setStatus('Đã cập nhật hình. Có thể mở lại đúng bảng vẽ để chỉnh sửa tiếp.','saved');}
    else insertHTMLAtCaret(createFigureHTML(dataUrl,'Hình vẽ từ Lớp học Mực',boardProjectId||linkedBoardId));
    queueSave();
  }
  function onBoardMessage(event){
    if(event.origin!==location.origin||event.data?.type!=='HTVVM_EXAM_FIGURE')return;
    const raw=String(event.data.dataUrl||'');
    if(!/^data:image\/(png|jpeg|webp);base64,/i.test(raw)){setStatus('Dữ liệu hình từ bảng vẽ không hợp lệ.','error');return;}
    void compressDataUrl(raw).then(data=>receiveBoardFigure(data,String(event.data.projectId||''),String(event.data.title||''))).catch(error=>setStatus(error.message||'Không xử lý được hình từ bảng vẽ.','error'));
  }
  function handleDrop(event){
    const data=event.dataTransfer?.getData('application/x-htvvm-exam-figure')||event.dataTransfer?.getData('text/plain');
    if(!data||!data.startsWith('data:image/'))return;
    event.preventDefault();
    let caret=document.caretRangeFromPoint?.(event.clientX,event.clientY)||null;
    if(!caret&&document.caretPositionFromPoint){
      const position=document.caretPositionFromPoint(event.clientX,event.clientY);
      if(position){caret=document.createRange();caret.setStart(position.offsetNode,position.offset);caret.collapse(true);}
    }
    if(caret){const selection=document.getSelection();selection?.removeAllRanges();selection?.addRange(caret);savedInsertRange=caret.cloneRange();}
    void compressDataUrl(data).then(url=>receiveBoardFigure(url)).catch(error=>setStatus(error.message,'error'));
  }
  function handlePaste(event){
    const image=[...(event.clipboardData?.items||[])].find(item=>item.type.startsWith('image/'));
    if(!image)return;const file=image.getAsFile();if(!file)return;event.preventDefault();
    void fileToDataUrl(file).then(compressDataUrl).then(url=>{insertHTMLAtCaret(createFigureHTML(url,'Ảnh được dán vào đề'));queueSave();setStatus('Đã dán ảnh vào đề.','saved');}).catch(error=>setStatus(error.message,'error'));
  }
  let resizeDrag=null;
  function resizePointerDown(event){const handle=event.target.closest?.('.exam-figure-resize');if(!handle)return;const figure=handle.closest('.exam-doc-figure'),img=figure?.querySelector('img');if(!figure||!img)return;event.preventDefault();resizeDrag={img,startX:event.clientX,startWidth:img.getBoundingClientRect().width};handle.setPointerCapture?.(event.pointerId);}
  function resizePointerMove(event){if(!resizeDrag)return;const available=resizeDrag.img.closest('.exam-a4-flow')?.clientWidth||600;const width=Math.min(available,Math.max(90,resizeDrag.startWidth+event.clientX-resizeDrag.startX));resizeDrag.img.style.width=`${Math.round(width/available*100)}%`;resizeDrag.img.dataset.width=String(Math.round(width/available*100));}
  function resizePointerUp(){if(resizeDrag){resizeDrag=null;queueSave();}}
  root.addEventListener('input',handleEditorInput);
  root.addEventListener('click',onEditorClick);
  root.addEventListener('dragover',event=>{if(event.dataTransfer?.types.includes('application/x-htvvm-exam-figure')||event.dataTransfer?.types.includes('text/plain'))event.preventDefault();});
  root.addEventListener('drop',handleDrop);
  root.addEventListener('paste',handlePaste);
  root.addEventListener('pointerdown',resizePointerDown);
  root.addEventListener('pointermove',resizePointerMove);
  root.addEventListener('pointerup',resizePointerUp);
  window.addEventListener('message',onBoardMessage);
  root.addEventListener('click',event=>{const meta=event.target.closest?.('[data-meta]');if(meta)queueSave();});
  titleInput.addEventListener('input',()=>{const heading=pageStack.querySelector('[data-meta="examName"]');if(heading&&!heading.dataset.userEdited)heading.textContent=titleInput.value.toUpperCase()||'ĐỀ KIỂM TRA …';queueSave()});
  root.addEventListener('input',event=>{
    const meta=event.target.closest?.('[data-meta]');if(!meta)return;
    meta.dataset.userEdited='1';
    if(meta.dataset.meta==='subject'){
      const match=meta.textContent.match(/^Môn:\s*(.*?)\s*[–-]\s*Lớp\s*(.*)$/i);
      if(match){subjectInput.value=match[1].trim();gradeInput.value=match[2].trim();}
    }
    queueSave();
  });
  for(const input of [durationInput,subjectInput,gradeInput])input.addEventListener('input',()=>{const duration=pageStack.querySelector('[data-meta="durationText"]');if(duration&&!duration.dataset.userEdited)duration.textContent=durationInput.value;const subject=pageStack.querySelector('[data-meta="subject"]');if(subject&&!subject.dataset.userEdited)subject.textContent=`Môn: ${subjectInput.value||'…'} – Lớp ${gradeInput.value||'…'}`;queueSave()});
  fontSelect.addEventListener('change',()=>{execFormat('fontName',fontSelect.value)});
  sizeSelect.addEventListener('change',()=>{execFormat('fontSize',sizeSelect.value==='10'?'2':sizeSelect.value==='11'?'2':sizeSelect.value==='12'?'3':sizeSelect.value==='13'?'3':sizeSelect.value==='14'?'4':sizeSelect.value==='16'?'4':sizeSelect.value==='18'?'5':sizeSelect.value==='20'?'5':sizeSelect.value==='24'?'6':'7')});
  const onBeforeUnload=()=>saveDraft(false);window.addEventListener('beforeunload',onBeforeUnload);
  function goToRoom(){
    const questions=collectQuestions(pageStack);
    if(!questions.length){setStatus('Thêm ít nhất một câu hỏi trước khi tạo phòng.','error');return;}
    if(questions.some(q=>q.part==='I'&&!/^[ABCD]$/.test(q.answer||''))){setStatus('Có câu trắc nghiệm chưa được đánh dấu đáp án đúng.','error');return;}
    if(questions.some(q=>q.part==='II'&&q.answer.some(value=>typeof value!=='boolean'))){setStatus('Có ý đúng/sai chưa được chọn Đ hoặc S.','error');return;}
    if(questions.some(q=>q.part==='III'&&!String(q.answer||'').trim())){setStatus('Có câu trả lời ngắn chưa có đáp án.','error');return;}
    if(!saveDraft(true))return;
    navigate('/exam-room');
  }
  async function exportDocx(studentVersion=false){
    try{const result=await exportExamDocx({title:titleInput.value||'Đề thi',durationMinutes:Number(durationInput.value)||50,metadata:getMeta(),pages:[...pageStack.querySelectorAll('.exam-a4-page')],studentVersion});setStatus(`Đã tạo ${result}.`,'saved');exportMenu.hidden=true;}
    catch(error){setStatus(error.message||'Không xuất được file Word.','error');}
  }
  function exportPdf(includeAnswers=false){
    const cloneStack=pageStack.cloneNode(true);cloneStack.querySelectorAll('.exam-question-topline button,.exam-question-foot,.exam-figure-tools,.exam-figure-resize').forEach(node=>node.remove());
    cloneStack.querySelectorAll('[contenteditable="true"]').forEach(node=>node.removeAttribute('contenteditable'));
    if(!includeAnswers){
      cloneStack.querySelectorAll('.exam-option-letter').forEach(node=>{const label=document.createElement('span');label.className='exam-option-letter';label.textContent=`${node.dataset.optionAnswer||''}.`;node.replaceWith(label);});
      cloneStack.querySelectorAll('.exam-statement-key').forEach(node=>{node.innerHTML='<span class="exam-student-tf-box">□ Đúng　□ Sai</span>';});
      cloneStack.querySelectorAll('.exam-correct-caption,.exam-solution-row').forEach(node=>node.remove());
      cloneStack.querySelectorAll('.exam-short-answer').forEach(node=>{node.textContent='................................';node.removeAttribute('contenteditable');});
      cloneStack.querySelectorAll('.is-correct,.is-wrong').forEach(node=>node.classList.remove('is-correct','is-wrong'));
    } else cloneStack.querySelectorAll('.exam-question-type').forEach(node=>node.textContent+=' · ĐỀ GIÁO VIÊN');
    const styles=[...document.querySelectorAll('link[rel="stylesheet"]')].map(link=>`<link rel="stylesheet" href="${escapeHTML(link.href)}">`).join('');
    const win=window.open('','_blank');if(!win)throw Error('Trình duyệt đang chặn cửa sổ in. Hãy cho phép popup rồi thử lại.');
    win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHTML(titleInput.value)}</title>${styles}<style>@page{size:A4;margin:0}body{margin:0;background:#fff;color:#111}.exam-a4-page{width:210mm;min-height:297mm;height:auto;box-shadow:none;margin:0;padding:14mm 16mm;break-after:page}.exam-a4-page:last-child{break-after:auto}.exam-a4-flow{height:auto!important;min-height:0!important;overflow:visible!important}.exam-question-topline button,.exam-question-foot,.exam-figure-tools,.exam-figure-resize{display:none!important}.exam-a4-heading{color:#111!important}.exam-doc-question{break-inside:avoid}.exam-doc-figure{break-inside:avoid} @media screen{body{background:#e8eaf0}.exam-a4-page{margin:20px auto;box-shadow:0 3px 20px #0002}}</style></head><body>${cloneStack.innerHTML}<script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print()},650))</script></body></html>`);win.document.close();setStatus('Đã mở bản PDF để in hoặc Lưu dưới dạng PDF.','saved');exportMenu.hidden=true;
  }
  function toggleExportMenu(){exportMenu.hidden=!exportMenu.hidden;}
  function restoreDraft(saved){
    const oldPages=[...pageStack.querySelectorAll('.exam-a4-page')];oldPages.forEach(page=>page.remove());
    const firstPage=addA4Page(pageStack,{first:true,title:saved.title,meta:saved.metadata||{}});
    let destination=firstPage.flow;
    const template=document.createElement('template');template.innerHTML=sanitizeHTML(saved.documentHtml||'');
    for(const child of [...template.content.childNodes]){
      if(child.nodeType===Node.ELEMENT_NODE&&child.classList?.contains('exam-doc-page-break')){destination=addA4Page(pageStack,{first:false,title:saved.title}).flow;resizeObserver?.observe(destination);}
      else destination.append(child.cloneNode(true));
    }
    if(!firstPage.flow.children.length)firstPage.flow.innerHTML='<p><br></p>';
    titleInput.value=saved.title||'Đề thi mới';durationInput.value=String(saved.durationMinutes||50);
    subjectInput.value=saved.metadata?.subject||'';gradeInput.value=saved.metadata?.grade||'';
    linkedBoardId=saved.metadata?.boardProjectId||'';linkedBoardTitle=saved.metadata?.boardTitle||'';
    for(const [key,value] of Object.entries(saved.metadata||{})){
      const metaKey=key==='subjectText'?'subject':key;
      if(['subject','grade'].includes(key))continue;
      const field=pageStack.querySelector(`[data-meta="${metaKey}"]`);if(field&&value!==undefined){field.textContent=String(value);if(['examName','subject','durationText'].includes(metaKey))field.dataset.userEdited='1';}
    }
    const subject=pageStack.querySelector('[data-meta="subject"]');if(subject&&!saved.metadata?.subjectText)subject.textContent=`Môn: ${subjectInput.value||'…'} – Lớp ${gradeInput.value||'…'}`;
    const duration=pageStack.querySelector('[data-meta="durationText"]');if(duration&&!duration.dataset.userEdited)duration.textContent=durationInput.value;
    activeFlow=destination;activeDraftId=saved.id||makeDraftId();
    localStorage.setItem('htvvm.exam-author-active-draft.v1',activeDraftId);
    renumber(pageStack);refreshOutline();paginate();queueSave();
  }
  function openDraftPicker(){
    saveDraft(false);
    const entries=readDraftCollection().sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0));
    const overlay=E('div','exam-draft-picker-overlay');const dialog=E('section','exam-draft-picker');
    const header=E('div','exam-draft-picker-head');header.append(E('div','','Đề đã lưu'),button('✕','exam-studio-btn',()=>overlay.remove()));dialog.append(header);
    if(!entries.length)dialog.append(E('p','exam-studio-hint','Chưa có đề cũ. Hãy lưu một bản nháp để xuất hiện tại đây.'));
    for(const item of entries){
      const row=E('div','exam-draft-picker-row');const info=E('div','exam-draft-picker-info');
      info.append(E('strong','',item.title||'Đề không tên'),E('small','',`${item.questions?.length||0} câu · ${new Date(item.updatedAt||Date.now()).toLocaleString('vi-VN')}`));
      row.append(info,button('Mở đề','exam-studio-btn primary',()=>{restoreDraft(item);overlay.remove();setStatus('Đã mở đề đã lưu.','saved');}),button('Xóa','exam-studio-btn danger',()=>{const remaining=readDraftCollection().filter(entry=>entry.id!==item.id);localStorage.setItem(DRAFTS_KEY,JSON.stringify(remaining));if(item.metadata?.boardProjectId){try{const links=JSON.parse(localStorage.getItem(BOARD_LINKS_KEY)||'{}')||{};if(links[item.metadata.boardProjectId]?.draftId===item.id){delete links[item.metadata.boardProjectId];localStorage.setItem(BOARD_LINKS_KEY,JSON.stringify(links));}}catch{}}if(activeDraftId===item.id){localStorage.removeItem('htvvm.exam-author-active-draft.v1');}row.remove();setStatus('Đã xóa bản nháp.','saved');}));dialog.append(row);
    }
    overlay.append(dialog);root.append(overlay);
  }
  function createNewDraft(){
    if(!saveDraft(false))return;
    activeDraftId=makeDraftId();titleInput.value='Đề kiểm tra mới';durationInput.value='50';subjectInput.value='';gradeInput.value='';
    const meta={department:'SỞ GIÁO DỤC VÀ ĐÀO TẠO …',school:'TRƯỜNG …',examName:linkedBoardTitle?`ĐỀ KIỂM TRA ${linkedBoardTitle.toLocaleUpperCase('vi-VN')}`:'ĐỀ KIỂM TRA …',subject:'',grade:'',durationText:'50',extra:'(Không kể thời gian phát đề)',boardProjectId:linkedBoardId,boardTitle:linkedBoardTitle};
    pageStack.replaceChildren();const firstPage=addA4Page(pageStack,{first:true,title:titleInput.value,meta});resizeObserver?.observe(firstPage.flow);firstPage.flow.innerHTML='<p class="exam-doc-paragraph" data-placeholder="1">Bắt đầu nhập nội dung đề thi tại đây…</p>';activeFlow=firstPage.flow;
    localStorage.setItem('htvvm.exam-author-active-draft.v1',activeDraftId);renumber(pageStack);refreshOutline();queueSave();setStatus('Đã tạo đề mới.','saved');
  }
  // Legacy drafts are converted above. Metadata and existing content are restored independently.
  if(initial.metadata){const meta=initial.metadata;for(const [key,value] of Object.entries(meta)){if(['subject','grade'].includes(key))continue;const metaKey=key==='subjectText'?'subject':key;const field=pageStack.querySelector(`[data-meta="${metaKey}"]`);if(field&&value!==undefined){field.textContent=String(value);if(['examName','subject','durationText'].includes(metaKey))field.dataset.userEdited='1';}}}
  renumber(pageStack);refreshOutline();
  if(resizeObserver)resizeObserver.disconnect();
  if('ResizeObserver' in window){resizeObserver=new ResizeObserver(()=>paginate());pageStack.querySelectorAll('.exam-a4-flow').forEach(flow=>resizeObserver.observe(flow));}
  const cleanup=()=>{clearTimeout(draftTimer);resizeObserver?.disconnect();window.removeEventListener('message',onBoardMessage);window.removeEventListener('beforeunload',onBeforeUnload);currentBoardOverlay?.remove();};
  root.addEventListener('DOMNodeRemoved',event=>{if(event.target===root)cleanup()},{once:true});
  saveDraft(false);
  return root;
}
