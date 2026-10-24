import { element, button } from '../../core/dom.js';
import { AppStore } from '../../core/store.js';
import { auth } from '../../core/firebase.js';
import katex from 'katex';
import { resolveResourceLink } from '../../../shared/resource-links.js';
import { MAX_EXAM_QUESTIONS } from '../../../shared/exam-grading.js';
const E = element;
function escapeHTML(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// Render safe Markdown plus KaTeX. Ordinary teachers can type like a document:
// **bold**, *italic*, lists, headings, links, images and $math$ without learning LaTeX commands.
function richMathHTML(value) {
  let source = String(value ?? '');
  const tokens = [];
  const stash = html => {
    const token = `HTVVMHTMLTOKEN${tokens.length}END`;
    tokens.push([token, html]);
    return token;
  };

  // Only HTTPS links are clickable. Uploaded image data is restricted to raster formats.
  source = source.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (all, alt, rawUrl) => {
    const url = String(rawUrl).trim();
    const isDataImage = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(url);
    const isHttps = /^https:\/\//i.test(url);
    if (!isDataImage && !isHttps) return all;
    return stash(`<img class="exam-markdown-image" src="${escapeHTML(url)}" alt="${escapeHTML(alt)}" loading="lazy">`);
  });
  source = source.replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, (_all, labelText, url) =>
    stash(`<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(labelText)}</a>`));

  const mathPattern = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g;
  source = source.replace(mathPattern, (all, block, bracket, inline, paren) => {
    const tex = block ?? bracket ?? inline ?? paren ?? '';
    const displayMode = block !== undefined || bracket !== undefined;
    try {
      return stash(katex.renderToString(tex, { displayMode, throwOnError: false, trust: false, strict: 'ignore' }));
    } catch { return all; }
  });

  const inline = text => {
    let html = escapeHTML(text);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    html = html.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
    return html;
  };
  const lines = source.split(/\r?\n/);
  const out = [];
  let paragraph = [], listType = '';
  const flushParagraph = () => {
    if (paragraph.length) { out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`); paragraph = []; }
  };
  const flushList = () => { if (listType) { out.push(`</${listType}>`); listType = ''; } };
  for (const line of lines) {
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (heading) { flushParagraph(); flushList(); const level = heading[1].length; out.push(`<h${level + 2}>${inline(heading[2])}</h${level + 2}>`); }
    else if (unordered || ordered) {
      flushParagraph(); const nextType = unordered ? 'ul' : 'ol';
      if (listType && listType !== nextType) flushList();
      if (!listType) { listType = nextType; out.push(`<${listType}>`); }
      out.push(`<li>${inline((unordered || ordered)[1])}</li>`);
    } else if (quote) { flushParagraph(); flushList(); out.push(`<blockquote>${inline(quote[1])}</blockquote>`); }
    else { flushList(); paragraph.push(line); }
  }
  flushParagraph(); flushList();
  let html = out.join('');
  for (const [token, replacement] of tokens) html = html.split(token).join(replacement);
  return html;
}
function setRichText(node, value) { node.innerHTML = richMathHTML(value); }
function imageDataURL(value) {
  return typeof value === 'string' && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(value) && value.length <= 300000 ? value : '';
}
async function compressImageFile(file) {
  if (!file || !file.type.startsWith('image/')) throw Error('Hãy chọn một tệp ảnh.');
  if (file.size > 12 * 1024 * 1024) throw Error('Ảnh gốc tối đa 12 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw Error('Không thể xử lý ảnh trên trình duyệt này.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.78, 0.66, 0.54, 0.42]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.length <= 285000) return result;
    }
    throw Error('Ảnh vẫn quá lớn sau khi nén. Hãy chọn ảnh nhỏ hơn.');
  } finally { bitmap.close?.(); }
}
function renderDedicatedLatex(value) {
  if (!String(value || '').trim()) return '';
  try { return katex.renderToString(String(value), { displayMode: true, throwOnError: false, trust: false, strict: 'ignore' }); }
  catch { return escapeHTML(value); }
}
function exportExamPDF({ title, durationMinutes, questions }, includeAnswers) {
  if (!questions.length) throw Error('Thêm ít nhất một câu trước khi xuất PDF.');
  const pageTitle = escapeHTML(title || 'Đề thi');
  const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => `<link rel="stylesheet" href="${escapeHTML(link.href)}">`).join('');
  const blocks = questions.map((q, index) => {
    const prompt = richMathHTML(q.prompt);
    const formula = q.latex ? `<div class="question-latex">${renderDedicatedLatex(q.latex)}</div>` : '';
    const image = imageDataURL(q.image) ? `<figure class="question-image-wrap"><img class="question-image" src="${imageDataURL(q.image)}" alt="Hình minh họa câu ${index + 1}"></figure>` : '';
    let extra = '';
    if (q.part === 'I' || q.part === 'II') extra = `<ol class="options" type="${q.part === 'I' ? 'A' : 'a'}">${(q.options || []).map(option => `<li>${richMathHTML(option)}</li>`).join('')}</ol>`;
    return `<article class="question"><h3>Câu ${index + 1}. <small>Phần ${escapeHTML(q.part)}</small></h3><div class="prompt">${prompt}</div>${image}${formula}${extra}</article>`;
  }).join('');
  const answerKey = includeAnswers ? `<section class="answer-key"><h2>ĐÁP ÁN</h2><ol>${questions.map(q => `<li>${q.part === 'II' ? (q.answer || []).map(v => v ? 'Đ' : 'S').join(' – ') : escapeHTML(Array.isArray(q.answer) ? q.answer.join(', ') : q.answer)}</li>`).join('')}</ol></section>` : '';
  const win = window.open('', '_blank');
  if (!win) throw Error('Trình duyệt đang chặn cửa sổ xuất PDF. Hãy cho phép popup của website rồi thử lại.');
  win.document.open();
  win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<title>${pageTitle}</title><style>
    @page{size:A4;margin:17mm 16mm 18mm}*{box-sizing:border-box}body{font-family:Arial,"DejaVu Sans",sans-serif;color:#171b23;font-size:11pt;line-height:1.55;margin:0}.paper-head{text-align:center;margin:0 0 24px;padding-bottom:15px;border-bottom:1px solid #aab2bf}.paper-head .eyebrow{font-size:9pt;letter-spacing:.12em;color:#596579;font-weight:700}.paper-head h1{font-size:18pt;margin:8px 0}.paper-head p{margin:4px 0;color:#4d5867}.question{break-inside:avoid;page-break-inside:avoid;margin:0 0 19px}.question-image{max-width:100%;max-height:360px;object-fit:contain}.question h3{font-size:11pt;margin:0 0 6px}.question h3 small{font-weight:400;color:#596579}.prompt{white-space:normal;overflow-wrap:anywhere}.question-latex{margin:8px 0 12px;overflow-x:auto}.options{margin:8px 0 0 28px;padding-left:10px}.options li{margin:4px 0;padding-left:4px}.answer-key{break-before:page;page-break-before:always;border-top:2px solid #536071;padding-top:14px}.answer-key h2{text-align:center}.answer-key li{margin:7px 0}.katex-display{overflow-x:auto;overflow-y:hidden}@media screen{body{max-width:800px;margin:30px auto;padding:24px;border:1px solid #dbe1e8;border-radius:12px}.print-tip{background:#eef5ff;padding:10px;border-radius:8px;margin:15px 0;color:#24496b}}@media print{.print-tip{display:none}}
  </style></head><body><header class="paper-head"><div class="eyebrow">HTVVM STUDIO · PHÒNG THI</div><h1>${pageTitle}</h1><p>Thời gian làm bài: ${escapeHTML(durationMinutes)} phút</p><p>Họ và tên: ............................................................. Lớp: ....................</p></header><div class="print-tip">Chọn “Save as PDF / Lưu dưới dạng PDF” trong hộp thoại in để tải file PDF.</div>${blocks}${answerKey}<script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print()},650));</script></body></html>`);
  win.document.close();
}
let ticker = null, autosaveTicker = null, draftSaveTimer = null;
let current = null, answers = {}, currentExamId = null;
function clearTimer() {
  if (ticker) clearInterval(ticker);
  if (autosaveTicker) clearInterval(autosaveTicker);
  if (draftSaveTimer) clearTimeout(draftSaveTimer);
  ticker = autosaveTicker = draftSaveTimer = null;
}
async function api(action, payload = {}, method = 'POST') {
  if (!auth?.currentUser) throw Error('Bạn cần đăng nhập Google để sử dụng phòng thi.');
  const token = await auth.currentUser.getIdToken();
  const url = method === 'GET' ? `/api/exam?${new URLSearchParams({ action, ...payload })}` : '/api/exam';
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) }, body: method === 'POST' ? JSON.stringify({ action, ...payload }) : undefined, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || `HTTP ${response.status}`);
  return data;
}
function label(text) { return E('label', 'exam-label', text); }
function field(type, placeholder, value = '') { const el = E(type === 'textarea' ? 'textarea' : 'input', 'exam-input'); if (type !== 'textarea') el.type = type; el.placeholder = placeholder; el.value = value; return el; }
function panel(title) { const d = E('section', 'exam-panel'); d.append(E('h3', 'exam-heading', title)); return d; }
function showError(host, error) { host.replaceChildren(E('p', 'exam-error', error.message || String(error))); }
function requireLogin(host) { if (!AppStore.get('user')) { host.replaceChildren(E('p', 'exam-message', 'Đăng nhập Google để vào phòng thi, lưu bài và xem lịch sử.')); return false; } return true; }
function scopeUid() { return auth?.currentUser?.uid || AppStore.get('user')?.uid || 'guest'; }
function draftKey(uid, id) { return `htvvm-exam-draft-v1:${encodeURIComponent(uid)}:${encodeURIComponent(id)}`; }
function cloneAnswers(value) { try { return JSON.parse(JSON.stringify(value || {})); } catch { return {}; } }
function readLocalDraft(uid, id) {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey(uid, id)) || 'null');
    if (!value || value.id !== id || !value.answers || typeof value.answers !== 'object' || Array.isArray(value.answers)) return null;
    return value;
  } catch { return null; }
}
function writeLocalDraft(uid, id, draftAnswers, flaggedQuestions = []) {
  try { localStorage.setItem(draftKey(uid, id), JSON.stringify({ id, answers: cloneAnswers(draftAnswers), flaggedQuestions: Array.isArray(flaggedQuestions) ? [...new Set(flaggedQuestions.filter(x => typeof x === 'string'))].slice(0, MAX_EXAM_QUESTIONS) : [], savedAt: Date.now() })); return true; }
  catch { return false; }
}
function removeLocalDraft(uid, id) { try { localStorage.removeItem(draftKey(uid, id)); } catch {} }
function answeredCount(value) {
  return Object.values(value || {}).filter(answer => answer !== null && answer !== undefined && answer !== '' && !(Array.isArray(answer) && answer.every(x => x === null || x === undefined))).length;
}
export function renderExam() {
  clearTimer();
  const wrap = E('div', 'exam-root');

  // Keep the landing area lightweight and self-contained: no external/legacy iframe.
  const showcase = E('section', 'exam-showcase');
  const copy = E('div', 'exam-showcase-copy');
  copy.append(
    E('div', 'exam-showcase-eyebrow', 'HTVVM STUDIO · PHÒNG THI'),
    E('h2', 'exam-showcase-title', 'Một phòng thi. Mọi kết quả tập trung.'),
    E('p', 'exam-showcase-subtitle', 'Soạn đề bằng Markdown, thêm hình ảnh, tạo phòng thi từ tài liệu Drive và quản lý kết quả tại một nơi.'),
  );
  const trust = E('div', 'exam-showcase-trust');
  for (const [symbol, text] of [
    ['↻', 'Tự lưu bài làm'],
    ['✓', 'Chấm điểm tự động'],
    ['◷', 'Lịch sử kết quả']
  ]) {
    const item = E('span', 'exam-showcase-trust-item');
    item.append(E('b', '', symbol), E('span', '', text));
    trust.append(item);
  }
  copy.append(trust);
  const bar = E('div', 'exam-tabs');
  const body = E('div', 'exam-body');
  const openList = () => {
    clearTimer();
    showList(body);
    body.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const openHistory = () => {
    clearTimer();
    showHistory(body);
    body.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const ctas = E('div', 'exam-showcase-actions');
  ctas.append(
    button('Mở kho đề thi →', 'primary-btn', openList),
    button('Xem lịch sử & thống kê', 'exam-showcase-secondary', openHistory)
  );
  copy.append(ctas);
  showcase.append(copy);

  const actions = [
    ['Kho đề', showList],
    ['Vào bằng mã', showJoin],
    ['Lịch sử & thống kê', showHistory],
    ['Sổ tay câu sai', showMistakes]
  ];
  actions.push(['Tạo đề thi', showCreator]);
  for (const [name, action] of actions) {
    bar.append(button(name, 'exam-tab', () => {
      clearTimer();
      action(body);
      body.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }
  wrap.append(showcase, bar, body);
  showList(body);
  return wrap;
}
async function showList(host) {
  host.replaceChildren(E('p', 'exam-message', 'Đang tải danh sách đề...'));
  if (!requireLogin(host)) return;
  try {
    const data = await api('list', {}, 'GET');
    const section = panel('Đề thi đang mở'), grid = E('div', 'exam-grid');
    if (!data.exams.length) grid.append(E('p', 'exam-message', 'Chưa có đề thi. Hãy dùng mục “Tạo đề thi” để tạo đề đầu tiên.'));
    for (const x of data.exams) {
      const card = E('article', 'exam-card');
      card.append(E('strong', '', x.title), E('span', '', `Mã ${x.id} • ${x.durationMinutes} phút • ${x.counts.I + x.counts.II + x.counts.III} câu`), button('Vào phòng →', 'primary-btn', () => begin(host, x.id)));
      grid.append(card);
    }
    section.append(grid); host.replaceChildren(section);
  } catch (e) { showError(host, e); }
}
function showJoin(host) {
  const p = panel('Nhập mã phòng thi'), input = field('text', 'Mã gồm 12 ký tự'); input.maxLength = 12;
  p.append(label('Mã đề thi'), input, button('Vào phòng thi', 'primary-btn', () => begin(host, input.value.trim().toUpperCase()))); host.replaceChildren(p);
}
async function begin(host, id) {
  clearTimer();
  host.replaceChildren(E('p', 'exam-message', 'Đang kết nối phòng thi...'));
  try {
    const data = await api('start', { id }); current = data; currentExamId = id;
    const uid = scopeUid();
    if (data.session.status === 'submitted') { removeLocalDraft(uid, id); return showResult(host, data.result, id); }

    const serverAnswers = data.session.draftAnswers && typeof data.session.draftAnswers === 'object' ? data.session.draftAnswers : {};
    const localDraft = readLocalDraft(uid, id);
    const localIsNewer = !!localDraft && Number(localDraft.savedAt || 0) > Number(data.session.draftUpdatedAt || 0);
    answers = cloneAnswers(localIsNewer ? localDraft.answers : serverAnswers);
    if (!answeredCount(answers) && localDraft && answeredCount(localDraft.answers)) answers = cloneAnswers(localDraft.answers);
    const validQuestionIds = new Set((data.questions || []).map(q => q.id));
    const initialFlags = localIsNewer && Array.isArray(localDraft?.flaggedQuestions)
      ? localDraft.flaggedQuestions
      : (data.session.flaggedQuestions || localDraft?.flaggedQuestions || []);
    const flaggedQuestions = new Set((Array.isArray(initialFlags) ? initialFlags : []).filter(qid => validQuestionIds.has(qid)));

    const p = panel(data.exam.title);
    const timer = E('div', 'exam-timer');
    const status = E('small', 'exam-save-status', 'Bản nháp được lưu tự động.');
    const description = E('p', 'exam-message', `Mã đề: ${id} • ${data.exam.durationMinutes} phút. Bài làm tự lưu trên thiết bị và đồng bộ lên máy chủ khi kết nối được.`);
    if (answeredCount(answers)) description.textContent += ` Đã khôi phục ${answeredCount(answers)} câu đã trả lời.`;

    const tools = E('div', 'exam-session-tools');
    const answeredLabel = E('strong', 'exam-progress-label', 'Đã trả lời 0 câu');
    const fullscreenButton = button('⛶ Toàn màn hình', 'exam-session-tool', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (p.requestFullscreen) await p.requestFullscreen();
      } catch { status.textContent = 'Trình duyệt không cho phép toàn màn hình; bài thi vẫn hoạt động bình thường.'; }
    });
    tools.append(answeredLabel, fullscreenButton);

    const progressTrack = E('div', 'exam-progress-track');
    const progressFill = E('div', 'exam-progress-fill');
    progressTrack.append(progressFill);
    const mapHeading = E('div', 'exam-question-map-heading');
    mapHeading.append(E('strong', '', 'Sơ đồ câu hỏi'), E('small', '', 'Chọn số câu để di chuyển · ☆ để đánh dấu câu cần xem lại'));
    const questionMap = E('div', 'exam-question-map');
    const questionList = E('div', 'exam-question-list');
    const navButtons = new Map(), flagButtons = new Map(), questionItems = new Map();
    let busy = false, draftSaveBusy = false, draftSaveQueued = false;
    const initialPerf = performance.now(), serverAt = data.serverNow;
    const remaining = () => Math.max(0, data.session.endsAt - (serverAt + performance.now() - initialPerf));

    const questionIsAnswered = (q) => {
      const value = answers[q.id];
      if (q.part === 'II') return Array.isArray(value) && value.some(v => v === true || v === false);
      if (q.part === 'III') return typeof value === 'string' && value.trim() !== '';
      return typeof value === 'string' && value.trim() !== '';
    };
    const updateProgress = () => {
      const count = (data.questions || []).filter(questionIsAnswered).length;
      const total = (data.questions || []).length;
      answeredLabel.textContent = `Đã trả lời ${count}/${total} câu`;
      progressFill.style.width = `${total ? (count / total) * 100 : 0}%`;
      for (const q of data.questions || []) {
        const answered = questionIsAnswered(q), flagged = flaggedQuestions.has(q.id);
        const jump = navButtons.get(q.id), flag = flagButtons.get(q.id);
        if (jump) {
          jump.classList.toggle('answered', answered);
          jump.classList.toggle('flagged', flagged);
          jump.setAttribute('aria-label', `Câu ${q.id.slice(1)}${answered ? ', đã trả lời' : ', chưa trả lời'}${flagged ? ', đã đánh dấu' : ''}`);
        }
        if (flag) {
          flag.classList.toggle('is-flagged', flagged);
          flag.textContent = flagged ? '★ Đã đánh dấu' : '☆ Đánh dấu';
          flag.setAttribute('aria-pressed', String(flagged));
        }
      }
    };
    const syncDraft = async () => {
      if (busy || !host.isConnected || data.session.status !== 'active') return;
      if (draftSaveBusy) { draftSaveQueued = true; return; }
      draftSaveBusy = true;
      const snapshot = cloneAnswers(answers), snapshotFlags = [...flaggedQuestions], snapshotUid = uid;
      try {
        if (scopeUid() !== snapshotUid) return;
        const saved = await api('save-draft', { id, answers: snapshot, flaggedQuestions: snapshotFlags });
        writeLocalDraft(uid, id, snapshot, snapshotFlags);
        status.textContent = `Đã đồng bộ bản nháp lúc ${new Date(saved.savedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`;
        status.classList.remove('exam-save-warning');
      } catch {
        status.textContent = 'Đã lưu trên thiết bị; đang chờ đồng bộ máy chủ.';
        status.classList.add('exam-save-warning');
      } finally {
        draftSaveBusy = false;
        if (draftSaveQueued) { draftSaveQueued = false; syncDraft(); }
      }
    };
    const queueDraftSave = () => {
      writeLocalDraft(uid, id, answers, [...flaggedQuestions]);
      status.textContent = 'Đã lưu trên thiết bị · đang đồng bộ…';
      status.classList.remove('exam-save-warning');
      if (draftSaveTimer) clearTimeout(draftSaveTimer);
      draftSaveTimer = setTimeout(() => { draftSaveTimer = null; syncDraft(); }, 650);
    };
    const toggleFlag = (qid) => {
      if (flaggedQuestions.has(qid)) flaggedQuestions.delete(qid); else flaggedQuestions.add(qid);
      updateProgress(); queueDraftSave();
    };

    for (const [index, q] of (data.questions || []).entries()) {
      const item = E('section', 'exam-question');
      item.id = `htvvm-${id}-${q.id}`;
      questionItems.set(q.id, item);
      const top = E('div', 'exam-question-top');
      top.append(E('h4', '', `Câu ${index + 1} · Phần ${q.part}`));
      const flagButton = button(flaggedQuestions.has(q.id) ? '★ Đã đánh dấu' : '☆ Đánh dấu', 'exam-flag-btn', () => toggleFlag(q.id));
      flagButtons.set(q.id, flagButton);
      top.append(flagButton);
      const promptNode = E('div', 'exam-question-prompt exam-markdown-body'); setRichText(promptNode, q.prompt);
      item.append(top, promptNode);
      const imageUrl = imageDataURL(q.image);
      if (imageUrl) { const image = document.createElement('img'); image.className = 'exam-markdown-uploaded-image'; image.src = imageUrl; image.alt = `Hình minh họa câu ${index + 1}`; item.append(image); }
      if (q.latex) { const formulaNode = E('div', 'exam-question-latex'); formulaNode.innerHTML = renderDedicatedLatex(q.latex); item.append(formulaNode); }

      const jump = button(String(index + 1), 'exam-question-jump', () => item.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      jump.title = `Đi đến câu ${index + 1}`;
      navButtons.set(q.id, jump); questionMap.append(jump);

      if (q.part === 'I') {
        const options = E('div', 'exam-options');
        q.options.forEach((opt, i) => {
          const choice = 'ABCD'[i], b = button('', 'exam-option', () => {
            answers[q.id] = choice;
            for (const child of options.children) child.classList.toggle('selected', child === b);
            queueDraftSave(); updateProgress();
          });
          setRichText(b, data.exam.sourceUrl ? choice : `${choice}. ${opt}`); b.classList.toggle('selected', answers[q.id] === choice); options.append(b);
        });
        item.append(options);
      } else if (q.part === 'II') {
        q.options.forEach((opt, i) => {
          const row = E('div', 'exam-tf'); const statement = E('span', ''); setRichText(statement, data.exam.sourceUrl ? `Ý ${'abcd'[i]}` : `${'abcd'[i]}) ${opt}`); row.append(statement);
          const select = E('select', 'exam-input');
          for (const [val, text] of [['', 'Chưa chọn'], ['true', 'Đúng'], ['false', 'Sai']]) { const option = E('option', '', text); option.value = val; select.append(option); }
          const previous = Array.isArray(answers[q.id]) ? answers[q.id][i] : null;
          select.value = previous === true ? 'true' : previous === false ? 'false' : '';
          select.onchange = () => {
            if (!Array.isArray(answers[q.id])) answers[q.id] = [null, null, null, null];
            answers[q.id][i] = select.value === '' ? null : select.value === 'true'; queueDraftSave(); updateProgress();
          };
          row.append(select); item.append(row);
        });
      } else {
        const input = field('text', 'Nhập đáp án số (ví dụ 12,5)', typeof answers[q.id] === 'string' ? answers[q.id] : '');
        input.inputMode = 'decimal'; input.maxLength = 200; input.oninput = () => { answers[q.id] = input.value; queueDraftSave(); updateProgress(); }; item.append(input);
      }
      questionList.append(item);
    }

    const submit = async (automatic = false) => {
      if (busy) return; busy = true;
      if (ticker) clearInterval(ticker); ticker = null;
      if (autosaveTicker) clearInterval(autosaveTicker); autosaveTicker = null;
      if (draftSaveTimer) clearTimeout(draftSaveTimer); draftSaveTimer = null;
      timer.textContent = automatic ? 'Hết giờ · đang tự nộp bài…' : 'Đang nộp bài…';
      status.textContent = 'Đang gửi bài làm lên máy chủ…';
      try {
        const output = await api('submit', { id, answers: cloneAnswers(answers) });
        removeLocalDraft(uid, id); showResult(host, output.result, id);
      } catch (err) {
        busy = false; showError(host, err);
        host.append(button('Thử nộp lại', 'primary-btn', () => submit(automatic)));
      }
    };
    const update = () => {
      if (!host.isConnected) { clearTimer(); return; }
      const ms = remaining(), seconds = Math.ceil(ms / 1000);
      timer.textContent = `Còn ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
      timer.classList.toggle('exam-timer-urgent', ms <= 60000);
      if (ms <= 0) submit(true);
    };

    const submitButton = button('Nộp bài & xem kết quả', 'primary-btn', () => { if (confirm('Xác nhận nộp bài? Sau khi nộp, bạn không thể sửa đáp án.')) submit(false); });
    if (data.exam.sourceUrl) {
      const sessionLayout = E('div', 'exam-source-session-layout');
      const sourcePanel = panel('Đề thi');
      const sourceFrame = document.createElement('iframe');
      sourceFrame.className = 'exam-source-document';
      sourceFrame.title = 'Tài liệu đề thi do giáo viên cung cấp';
      sourceFrame.src = data.exam.sourceUrl;
      sourceFrame.loading = 'eager';
      sourceFrame.referrerPolicy = 'strict-origin-when-cross-origin';
      sourceFrame.allowFullscreen = true;
      const openSource = E('a', 'exam-link', 'Mở đề ở tab mới ↗');
      openSource.href = data.exam.sourceOpenUrl || data.exam.sourceUrl;
      openSource.target = '_blank'; openSource.rel = 'noopener noreferrer';
      sourcePanel.append(sourceFrame, openSource);
      const answerPanel = panel('Phiếu trả lời');
      answerPanel.append(mapHeading, questionMap, questionList);
      sessionLayout.append(sourcePanel, answerPanel);
      p.append(description, timer, status, tools, progressTrack, sessionLayout, submitButton);
    } else {
      p.append(description, timer, status, tools, progressTrack, mapHeading, questionMap, questionList, submitButton);
    }
    host.replaceChildren(p);
    updateProgress();
    // Restore both answers and locally/server-saved question flags when returning to an attempt.
    if (localIsNewer || answeredCount(answers) > 0 || flaggedQuestions.size > 0) queueDraftSave();
    ticker = setInterval(update, 250); autosaveTicker = setInterval(syncDraft, 8000); update();
  } catch (e) { showError(host, e); }
}
function showResult(host, result, id) {
  clearTimer();
  const p = panel('Kết quả bài thi'); if (!result) return showError(host, Error('Chưa nhận được kết quả.'));
  p.append(E('div', 'exam-score', `${Number(result.score || 0).toFixed(2)} / 10`), E('p', 'exam-message', `Đúng trọn vẹn ${result.fullyCorrect || 0}/${result.total || 0} câu`));
  for (const d of result.details || []) {
    const item = E('div', 'exam-result-line');
    item.append(E('strong', '', `${d.id} · Phần ${d.part} · ${d.earned / 100}/${d.possible / 100} điểm`), E('span', '', d.prompt), E('span', '', `Bạn chọn: ${JSON.stringify(d.response)} | Đáp án: ${JSON.stringify(d.answer)}`)); p.append(item);
  }
  p.append(button('Xem bảng vinh danh', 'primary-btn', () => showLeaderboard(host, id)), button('Lịch sử & thống kê', 'exam-tab', () => showHistory(host)), button('Quay lại kho đề', 'exam-tab', () => showList(host)));
  host.replaceChildren(p);
}
async function showLeaderboard(host, id) {
  const p = panel('Bảng vinh danh'); host.replaceChildren(p);
  try { const data = await api('leaderboard', { id }, 'GET'); for (const [i, r] of data.ranking.entries()) p.append(E('div', 'exam-result-line', `${i + 1}. ${r.name} — ${r.score.toFixed(2)} điểm`)); }
  catch (e) { showError(host, e); }
}
async function showHistory(host) {
  const p = panel('Lịch sử & thống kê luyện thi'); host.replaceChildren(p);
  if (!requireLogin(host)) return;
  try {
    const data = await api('history', {}, 'GET'), summary = data.summary || {}, history = data.history || [];
    const stats = E('div', 'exam-history-stats');
    for (const [name, value, note] of [
      ['Lượt thi đã nộp', summary.total ?? history.length, 'Từ dữ liệu trên máy chủ'],
      ['Điểm trung bình', `${Number(summary.averageScore || 0).toFixed(2)}/10`, 'Trên 100 lượt gần nhất'],
      ['Điểm cao nhất', `${Number(summary.bestScore || 0).toFixed(2)}/10`, 'Kết quả tốt nhất']
    ]) { const card = E('article', 'exam-history-stat'); card.append(E('small', '', name), E('strong', '', String(value)), E('span', '', note)); stats.append(card); }
    p.append(stats);
    const actions = E('div', 'exam-tabs');
    actions.append(button('Xuất bản sao lưu JSON', 'exam-tab', () => {
      const backup = { exportedAt: new Date().toISOString(), platform: 'HTVVM Studio', summary, history };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
      const href = URL.createObjectURL(blob), link = E('a', 'exam-link', 'Tải tệp sao lưu'); link.href = href; link.download = `htvvm-lich-su-thi-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
    }));
    p.append(actions);
    if (!history.length) p.append(E('p', 'exam-message', 'Bạn chưa có lượt thi nào được nộp trên máy chủ. Kết quả chỉ xuất hiện tại đây sau khi nộp bài thành công.'));
    for (const record of history) {
      const card = E('article', 'exam-history-row'), top = E('div', 'exam-history-row-top');
      const info = E('div', 'exam-history-info'); info.append(E('strong', '', record.examTitle || record.examId), E('small', '', `${record.examId} · ${record.submittedAt ? new Date(record.submittedAt).toLocaleString('vi-VN') : 'Không rõ thời điểm'}`));
      top.append(info, E('strong', 'exam-history-score', `${Number(record.score || 0).toFixed(2)}/10`));
      card.append(top, E('p', 'exam-message', `${record.fullyCorrect || 0}/${record.total || 0} câu đúng trọn vẹn · ${Math.round((record.elapsedMs || 0) / 60000)} phút thực làm`), button('Xem lại kết quả', 'exam-tab', () => reviewHistory(host, record.examId)));
      p.append(card);
    }
    p.append(button('Quay lại kho đề', 'exam-tab', () => showList(host)));
  } catch (e) { showError(host, e); }
}
async function reviewHistory(host, id) {
  host.replaceChildren(E('p', 'exam-message', 'Đang tải chi tiết kết quả…'));
  try { const data = await api('review', { id }, 'GET'); showResult(host, data.result, id); }
  catch (error) { showError(host, error); }
}
async function showMistakes(host) {
  const p = panel('Sổ tay câu sai'); host.replaceChildren(p); if (!requireLogin(host)) return;
  try {
    const data = await api('mistakes', {}, 'GET');
    if (!data.mistakes.length) p.append(E('p', 'exam-message', 'Bạn chưa có câu trả lời sai được lưu.'));
    for (const d of data.mistakes) { const item = E('div', 'exam-result-line'); item.append(E('strong', '', `${d.examId} • ${d.id} • Phần ${d.part}`), E('span', '', d.prompt), E('span', '', `Đã trả lời: ${JSON.stringify(d.response)} | Đáp án đúng: ${JSON.stringify(d.answer)}`)); p.append(item); }
    p.append(button('Lịch sử & thống kê', 'exam-tab', () => showHistory(host)));
  } catch (e) { showError(host, e); }
}

function showCreator(host) {
  if (!AppStore.get('user')) return showError(host, Error('Đăng nhập Google để tạo và lưu đề thi vào kho dùng chung.'));

  const p = panel('Tạo đề thi');
  const title = field('text', 'Tên đề, ví dụ: Ôn tập Hóa học 12');
  const duration = field('number', 'Thời gian (phút)', '50');
  duration.min = '5'; duration.max = '240'; duration.step = '1';
  const common = E('div', 'exam-creator-common');
  common.append(label('Tên đề thi'), title, label('Thời gian làm bài (5–240 phút)'), duration);
  const tabs = E('div', 'exam-creator-tabs');
  const authorTab = button('1. Biên soạn đề', 'exam-creator-tab is-active', () => switchMode('author'));
  const roomTab = button('2. Tạo phòng thi', 'exam-creator-tab', () => switchMode('room'));
  tabs.append(authorTab, roomTab);
  const content = E('div', 'exam-creator-content');
  const message = E('p', 'exam-message');
  p.append(common, tabs, content, message);
  host.replaceChildren(p);

  let data = [];
  let mode = 'author';
  let roomKeys = [];
  let answerMode = 'single';
  let sourceEmbedUrl = '';
  let sourceOpenUrl = '';

  const getDuration = () => {
    const minutes = Number(duration.value);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240) throw Error('Thời gian làm bài phải từ 5 đến 240 phút.');
    return minutes;
  };
  const getTitle = () => {
    const value = title.value.trim();
    if (value.length < 3 || value.length > 140) throw Error('Tên đề phải từ 3 đến 140 ký tự.');
    return value;
  };
  async function publishExam(questions, sourceUrl = '', sourceOpenUrl = '') {
    const examTitle = getTitle(), minutes = getDuration();
    if (!Array.isArray(questions) || !questions.length) throw Error('Hãy thêm ít nhất một câu hỏi và đáp án.');
    message.textContent = 'Đang lưu đề và tạo phòng thi…';
    const response = await api('create', { title: examTitle, durationMinutes: minutes, questions, ...(sourceUrl ? { sourceUrl, sourceOpenUrl } : {}) });
    message.textContent = `Đã tạo phòng thi ${response.exam.id}.`;
    const result = E('div', 'exam-created-result');
    result.append(E('p', '', `Mã phòng: ${response.exam.id}`), E('p', 'exam-message', sourceUrl ? 'Thí sinh sẽ xem tài liệu ở bên trái và làm bài trên phiếu trả lời bên phải.' : 'Đề đã được lưu trong kho đề chung.'));
    result.append(button('Mở phòng thi', 'primary-btn', () => begin(host, response.exam.id)), button('Quay về kho đề', 'exam-tab', () => showList(host)));
    content.replaceChildren(result);
  }
  const updateModeTabs = () => {
    authorTab.classList.toggle('is-active', mode === 'author');
    roomTab.classList.toggle('is-active', mode === 'room');
  };
  function switchMode(next) {
    mode = next; updateModeTabs(); message.textContent = '';
    if (next === 'author') renderAuthor(); else renderRoomCreator();
  }

  function renderAuthor() {
    content.replaceChildren();
    const intro = E('div', 'exam-creator-intro');
    intro.append(E('h4', '', 'Biên soạn đề'), E('p', '', 'Viết câu hỏi như tài liệu thông thường. Bản xem trước tự cập nhật; công thức chỉ cần đặt trong $...$ hoặc $$...$$ khi cần.'));
    const help = E('div', 'exam-markdown-help');
    help.innerHTML = '<strong>Cú pháp nhanh:</strong> <code>**đậm**</code> · <code>*nghiêng*</code> · <code># Tiêu đề</code> · <code>- Danh sách</code> · <code>$x^2$</code> · <code>![ảnh](https://...)</code>. Có thể chèn ảnh trực tiếp bằng nút Chèn ảnh.';
    intro.append(help);
    const questions = E('div', 'exam-editor');
    const addButtons = E('div', 'exam-tabs');
    const addQuestion = part => {
      const base = { part, prompt: '', image: '', latex: '', ...(part === 'I' ? { options: ['', '', '', ''], answer: '' } : part === 'II' ? { options: ['', '', '', ''], answer: [null, null, null, null] } : { answer: '', tolerance: 0.0001 }) };
      data.push(base); renderQuestionEditors();
    };
    for (const [part, text] of [['I', '+ Trắc nghiệm A–D'], ['II', '+ Đúng / Sai'], ['III', '+ Trả lời ngắn']]) addButtons.append(button(text, 'exam-tab', () => addQuestion(part)));

    const includeKeyRow = E('label', 'exam-pdf-key-label');
    const includeAnswers = document.createElement('input'); includeAnswers.type = 'checkbox';
    includeKeyRow.append(includeAnswers, document.createTextNode(' Kèm đáp án ở trang cuối PDF'));

    function renderQuestionEditors() {
      questions.replaceChildren();
      if (!data.length) questions.append(E('p', 'exam-message', 'Bắt đầu bằng cách thêm câu hỏi ở phía trên.'));
      data.forEach((q, idx) => {
        q.options = Array.isArray(q.options) ? q.options : ['', '', '', ''];
        const card = E('article', 'exam-question exam-author-question');
        const heading = E('div', 'exam-question-top');
        heading.append(E('h4', '', `Câu ${idx + 1} · ${q.part === 'I' ? 'Trắc nghiệm' : q.part === 'II' ? 'Đúng / Sai' : 'Trả lời ngắn'}`));
        heading.append(button('Xóa câu', 'exam-tab', () => { data.splice(idx, 1); renderQuestionEditors(); }));
        card.append(heading);

        const editing = E('div', 'exam-authoring-grid');
        const editPane = E('div', 'exam-authoring-edit');
        const prompt = field('textarea', 'Nhập nội dung câu hỏi… dùng Markdown khi cần.', q.prompt || '');
        prompt.rows = 6; prompt.classList.add('exam-markdown-input');
        const toolbar = E('div', 'exam-markdown-toolbar');
        const wrapSelection = (prefix, suffix = prefix) => {
          const start = prompt.selectionStart ?? prompt.value.length, end = prompt.selectionEnd ?? start;
          const selected = prompt.value.slice(start, end) || 'nội dung';
          prompt.setRangeText(`${prefix}${selected}${suffix}`, start, end, 'select');
          q.prompt = prompt.value; prompt.dispatchEvent(new Event('input', { bubbles: true }));
        };
        toolbar.append(
          button('Đậm', 'exam-mini-tool', () => wrapSelection('**')), button('Nghiêng', 'exam-mini-tool', () => wrapSelection('*')),
          button('Tiêu đề', 'exam-mini-tool', () => wrapSelection('### ', '')),
          button('Danh sách', 'exam-mini-tool', () => wrapSelection('- ', '')),
          button('Công thức', 'exam-mini-tool', () => wrapSelection('$', '$'))
        );
        const imageInput = document.createElement('input'); imageInput.type = 'file'; imageInput.accept = 'image/png,image/jpeg,image/webp'; imageInput.hidden = true;
        const imageStatus = E('small', 'exam-message', q.image ? 'Đã chèn ảnh.' : '');
        toolbar.append(button('Chèn ảnh', 'exam-mini-tool', () => imageInput.click()));
        imageInput.addEventListener('change', async () => {
          const file = imageInput.files?.[0]; if (!file) return;
          imageStatus.textContent = 'Đang nén ảnh…';
          try { q.image = await compressImageFile(file); imageStatus.textContent = 'Đã chèn và nén ảnh để tải nhanh hơn.'; updatePreview(); }
          catch (error) { imageStatus.textContent = error.message || String(error); }
          finally { imageInput.value = ''; }
        });
        const preview = E('div', 'exam-markdown-preview');
        const updatePreview = () => {
          preview.replaceChildren();
          const rendered = E('div', 'exam-markdown-body'); rendered.innerHTML = richMathHTML(prompt.value || 'Bản xem trước câu hỏi sẽ hiện tại đây.'); preview.append(rendered);
          const imgUrl = imageDataURL(q.image);
          if (imgUrl) { const img = document.createElement('img'); img.src = imgUrl; img.alt = `Ảnh minh họa câu ${idx + 1}`; img.className = 'exam-markdown-uploaded-image'; preview.append(img); }
        };
        prompt.addEventListener('input', () => { q.prompt = prompt.value; updatePreview(); });
        editPane.append(label('Nội dung câu hỏi'), toolbar, prompt, imageInput, imageStatus);
        const previewPane = E('div', 'exam-authoring-preview'); previewPane.append(label('Xem trước'), preview);
        editing.append(editPane, previewPane); card.append(editing);

        if (q.part === 'I' || q.part === 'II') {
          const optionsGrid = E('div', 'exam-author-options');
          for (let i = 0; i < 4; i++) {
            const optionField = field('textarea', q.part === 'I' ? `Lựa chọn ${'ABCD'[i]}` : `Nhận định ${'abcd'[i]}`, q.options[i] || '');
            optionField.rows = 2;
            optionField.addEventListener('input', () => { q.options[i] = optionField.value; });
            optionsGrid.append(optionField);
          }
          card.append(label(q.part === 'I' ? 'Các lựa chọn' : 'Bốn nhận định'), optionsGrid);
        }
        if (q.part === 'I') {
          const answer = E('select', 'exam-input');
          const blank = E('option', '', 'Chọn đáp án đúng…'); blank.value = ''; answer.append(blank);
          for (const choice of 'ABCD') { const opt = E('option', '', choice); opt.value = choice; answer.append(opt); }
          answer.value = q.answer || ''; answer.addEventListener('change', () => q.answer = answer.value); card.append(label('Đáp án đúng'), answer);
        } else if (q.part === 'II') {
          const keyGrid = E('div', 'exam-author-options');
          for (let i = 0; i < 4; i++) {
            const sel = E('select', 'exam-input');
            for (const [value, text] of [['', `Ý ${'abcd'[i]} · Chọn`], ['true', 'Đúng'], ['false', 'Sai']]) { const opt = E('option', '', text); opt.value = value; sel.append(opt); }
            sel.value = q.answer[i] === true ? 'true' : q.answer[i] === false ? 'false' : '';
            sel.addEventListener('change', () => q.answer[i] = sel.value === '' ? null : sel.value === 'true'); keyGrid.append(sel);
          }
          card.append(label('Đáp án đúng / sai'), keyGrid);
        } else {
          const answer = field('text', 'Đáp án số, ví dụ 12,5', q.answer ?? ''); answer.addEventListener('input', () => q.answer = answer.value);
          const tolerance = field('number', 'Sai số cho phép', String(q.tolerance ?? 0.0001)); tolerance.step = 'any'; tolerance.min = '0'; tolerance.max = '1'; tolerance.addEventListener('input', () => q.tolerance = Number(tolerance.value));
          const shortRow = E('div', 'exam-author-options'); shortRow.append(answer, tolerance); card.append(label('Đáp án và sai số cho phép'), shortRow);
        }
        updatePreview(); questions.append(card);
      });
    }

    addButtons.append(button('Nhập nhanh (JSON)', 'exam-tab', () => {
      let details = content.querySelector('.exam-import-advanced');
      if (!details) {
        details = E('details', 'exam-import-advanced');
        const summary = E('summary', '', 'Nhập nâng cao từ JSON');
        const area = field('textarea', 'Dán mảng câu hỏi JSON…'); area.rows = 6;
        const importBtn = button('Nạp JSON', 'exam-tab', () => {
          try { const imported = JSON.parse(area.value); if (!Array.isArray(imported)) throw Error('Dữ liệu phải là một mảng JSON.'); data = imported.map(q => ({ ...q, image: imageDataURL(q.image), latex: typeof q.latex === 'string' ? q.latex : '', options: Array.isArray(q.options) ? q.options : ['', '', '', ''] })); renderQuestionEditors(); message.textContent = 'Đã nạp câu hỏi. Hãy kiểm tra đáp án và bản xem trước.'; }
          catch (error) { message.textContent = error.message || String(error); }
        }); details.append(summary, area, importBtn); content.insertBefore(details, questions);
      }
      details.open = !details.open;
    }));

    const actions = E('div', 'exam-tabs');
    actions.append(
      button('Xuất PDF / In đề', 'exam-tab', () => {
        try {
          if (!data.length) throw Error('Thêm ít nhất một câu trước khi xuất PDF.');
          exportExamPDF({ title: getTitle(), durationMinutes: getDuration(), questions: data }, includeAnswers.checked);
          message.textContent = 'Bản in đã mở. Chọn “Lưu dưới dạng PDF” để tải đề.';
        } catch (error) { message.textContent = error.message || String(error); }
      }),
      button('Lưu đề vào kho', 'primary-btn', async () => {
        try { await publishExam(data, ''); }
        catch (error) { message.textContent = error.message || String(error); }
      }),
      button('Tiếp theo: Tạo phòng thi →', 'exam-tab', () => switchMode('room'))
    );
    content.append(intro, addButtons, questions, includeKeyRow, actions);
    renderQuestionEditors();
  }

  function renderRoomCreator() {
    content.replaceChildren();
    const intro = E('div', 'exam-creator-intro');
    intro.append(
      E('h4', '', 'Tạo phòng thi từ tài liệu'),
      E('p', '', 'Dán liên kết Google Drive/Docs/Slides/Sheets. Xem trước tài liệu, thiết lập đủ ba phần của phiếu trả lời. Thí sinh sẽ thấy đề ở bên trái và phiếu trả lời ở bên phải.')
    );
    const sourceInput = field('url', 'Dán liên kết Google Drive được chia sẻ…');
    const previewButton = button('Xem trước tài liệu', 'exam-tab', showDocumentPreview);
    const openDocument = E('a', 'exam-link', 'Mở tài liệu ở tab mới ↗');
    openDocument.hidden = true; openDocument.target = '_blank'; openDocument.rel = 'noopener noreferrer';
    const sourceMessage = E('p', 'exam-message', 'Tài liệu phải được chia sẻ quyền xem cho người có liên kết.');
    const previewFrame = document.createElement('iframe');
    previewFrame.className = 'exam-teacher-document-preview'; previewFrame.title = 'Bản xem trước tài liệu đề thi';
    previewFrame.loading = 'lazy'; previewFrame.referrerPolicy = 'strict-origin-when-cross-origin'; previewFrame.hidden = true;
    function showDocumentPreview() {
      try {
        const resource = resolveResourceLink(sourceInput.value);
        if (resource.type !== 'drive') throw Error('Hãy dán liên kết tệp Google Drive/Docs/Slides/Sheets, không phải YouTube hoặc thư mục.');
        sourceEmbedUrl = resource.embedUrl; sourceOpenUrl = resource.openUrl;
        previewFrame.src = resource.embedUrl; previewFrame.hidden = false;
        openDocument.href = resource.openUrl; openDocument.hidden = false;
        sourceMessage.textContent = 'Đã nạp đường dẫn xem trước. Hãy kiểm tra tài liệu và điền đáp án cho từng phần bên dưới.';
      } catch (error) {
        sourceEmbedUrl = ''; sourceOpenUrl = ''; previewFrame.hidden = true; openDocument.hidden = true;
        sourceMessage.textContent = error.message || String(error);
      }
    }
    sourceInput.addEventListener('input', () => { sourceEmbedUrl = ''; sourceOpenUrl = ''; previewFrame.hidden = true; openDocument.hidden = true; });
    sourceInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); showDocumentPreview(); } });
    const sourceActions = E('div', 'exam-tabs'); sourceActions.append(previewButton, openDocument);
    const previewPanel = E('section', 'exam-panel exam-teacher-source-panel');
    previewPanel.append(label('Liên kết tài liệu đề thi'), sourceInput, sourceActions, sourceMessage, previewFrame);

    const setup = E('section', 'exam-panel exam-answer-setup');
    setup.append(
      E('h4', '', 'Phiếu trả lời gồm ba phần'),
      E('p', 'exam-message', 'Tùy chỉnh số câu ở từng phần. Hỗ trợ đề ĐGNL 120 câu và đề dài hơn; giới hạn kỹ thuật hiện tại là 1.000 câu cho toàn đề.')
    );
    const maxPerSection = MAX_EXAM_QUESTIONS;
    const existingCounts = Object.fromEntries(['I', 'II', 'III'].map(part => [part, data.filter(q => q.part === part).length]));
    const hasExistingQuestions = data.length > 0;
    const sectionDefs = [
      { part: 'I', title: 'Phần I · Trắc nghiệm A–D', description: 'Mỗi câu có một đáp án đúng trong A, B, C, D.', makeKey: () => ({ value: '' }) },
      { part: 'II', title: 'Phần II · Đúng / Sai', description: 'Mỗi câu gồm bốn ý a, b, c, d.', makeKey: () => ({ values: ['', '', '', ''] }) },
      { part: 'III', title: 'Phần III · Trả lời ngắn', description: 'Nhập đáp án số; chấm tự động theo sai số 0,0001.', makeKey: () => ({ value: '' }) }
    ];
    const sectionState = {};
    const sectionPanels = E('div', 'exam-answer-sections');
    const totalLabel = E('p', 'exam-answer-total', 'Tổng số câu: 120 / 1.000');
    const totalError = E('p', 'exam-error');
    const createFromDrive = button('Tạo phòng thi từ tài liệu', 'primary-btn', createDriveRoom);
    const createFromDraft = button('Tạo phòng từ đề đã biên soạn', 'exam-tab', createFromAuthorQuestions);

    for (const section of sectionDefs) {
      const panel = E('section', 'exam-answer-section');
      panel.append(E('h5', '', section.title), E('p', 'exam-message', section.description));
      const count = field('number', `Số câu Phần ${section.part}`, String(hasExistingQuestions ? Math.max(1, existingCounts[section.part]) : 40));
      count.min = '1'; count.max = String(maxPerSection); count.step = '1';
      const keyList = E('div', 'exam-room-key-list');
      panel.append(label('Số câu'), count, keyList);
      const oldState = { keys: [] };
      sectionState[section.part] = { ...section, panel, count, keyList, state: oldState };
      const renderKeys = () => {
        const amount = Number(count.value);
        if (!Number.isInteger(amount) || amount < 1 || amount > maxPerSection) {
          keyList.replaceChildren(E('p', 'exam-error', `Mỗi phần phải có từ 1 đến ${maxPerSection} câu.`));
          refreshTotal(); return;
        }
        const previous = oldState.keys;
        oldState.keys = Array.from({ length: amount }, (_, i) => previous[i] || section.makeKey());
        keyList.replaceChildren();
        const fragment = document.createDocumentFragment();
        oldState.keys.forEach((key, index) => {
          const row = E('div', 'exam-room-key-row');
          row.append(E('strong', '', `${section.part}.${index + 1}`));
          if (section.part === 'I') {
            const select = E('select', 'exam-input');
            for (const [value, text] of [['', 'Chọn đáp án…'], ...[...'ABCD'].map(choice => [choice, choice])]) {
              const option = E('option', '', text); option.value = value; select.append(option);
            }
            select.value = key.value || ''; select.addEventListener('change', () => { key.value = select.value; }); row.append(select);
          } else if (section.part === 'II') {
            const grid = E('div', 'exam-room-tf-keys');
            for (let i = 0; i < 4; i++) {
              const select = E('select', 'exam-input');
              for (const [value, text] of [['', `${'abcd'[i]}: Chọn`], ['true', 'Đúng'], ['false', 'Sai']]) {
                const option = E('option', '', text); option.value = value; select.append(option);
              }
              select.value = key.values?.[i] ?? '';
              select.addEventListener('change', () => { key.values[i] = select.value; }); grid.append(select);
            }
            row.append(grid);
          } else {
            const input = field('text', 'Đáp án số', key.value || '');
            input.addEventListener('input', () => { key.value = input.value; }); row.append(input);
          }
          fragment.append(row);
        });
        keyList.append(fragment); refreshTotal();
      };
      sectionState[section.part].renderKeys = renderKeys;
      count.addEventListener('change', renderKeys);
      count.addEventListener('input', refreshTotal);
      sectionPanels.append(panel);
    }
    for (const section of sectionDefs) sectionState[section.part].renderKeys();
    function selectedCounts() {
      return Object.fromEntries(sectionDefs.map(({ part }) => [part, Number(sectionState[part].count.value)]));
    }
    function refreshTotal() {
      const counts = selectedCounts();
      const validEach = Object.values(counts).every(value => Number.isInteger(value) && value >= 1 && value <= maxPerSection);
      const sum = validEach ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
      totalLabel.textContent = `Tổng số câu: ${sum.toLocaleString('vi-VN')} / ${maxPerSection.toLocaleString('vi-VN')}`;
      totalError.textContent = !validEach ? `Mỗi phần phải là số nguyên từ 1 đến ${maxPerSection}.` : sum > maxPerSection ? `Tổng số câu không được vượt quá ${maxPerSection}.` : sum < 1 ? 'Hãy chọn ít nhất một câu ở một trong ba phần.' : '';
      createFromDrive.disabled = Boolean(totalError.textContent);
      createFromDraft.disabled = Boolean(totalError.textContent);
    }
    function collectDriveQuestions() {
      const counts = selectedCounts();
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (Object.values(counts).some(value => !Number.isInteger(value) || value < 1 || value > maxPerSection)) throw Error(`Mỗi phần phải từ 1 đến ${maxPerSection} câu.`);
      if (total < 1) throw Error('Hãy chọn ít nhất một câu.');
      if (total > maxPerSection) throw Error(`Tổng số câu tối đa là ${maxPerSection}.`);
      const questions = []; let ordinal = 1;
      const partI = sectionState.I.state.keys.slice(0, counts.I);
      if (partI.some(key => !/^[ABCD]$/.test(key.value || ''))) throw Error('Phần I: hãy chọn đáp án A–D cho tất cả câu.');
      for (const key of partI) questions.push({ part: 'I', prompt: `Câu ${ordinal++}`, options: ['A', 'B', 'C', 'D'], answer: key.value });
      const partII = sectionState.II.state.keys.slice(0, counts.II);
      if (partII.some(key => !Array.isArray(key.values) || key.values.some(value => value !== 'true' && value !== 'false'))) throw Error('Phần II: hãy chọn Đúng/Sai đủ bốn ý của tất cả câu.');
      for (const key of partII) questions.push({ part: 'II', prompt: `Câu ${ordinal++}`, options: ['a', 'b', 'c', 'd'], answer: key.values.map(value => value === 'true') });
      const partIII = sectionState.III.state.keys.slice(0, counts.III);
      if (partIII.some(key => !String(key.value || '').trim())) throw Error('Phần III: hãy nhập đáp án cho tất cả câu.');
      for (const key of partIII) questions.push({ part: 'III', prompt: `Câu ${ordinal++}`, answer: String(key.value).trim(), tolerance: 0.0001 });
      return questions;
    }
    async function createDriveRoom() {
      try {
        if (!sourceEmbedUrl) showDocumentPreview();
        if (!sourceEmbedUrl) throw Error('Hãy nhập và xem trước tài liệu Drive trước khi tạo phòng.');
        await publishExam(collectDriveQuestions(), sourceEmbedUrl, sourceOpenUrl);
      } catch (error) { message.textContent = error.message || String(error); }
    }
    async function createFromAuthorQuestions() {
      try {
        const counts = selectedCounts();
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        if (!data.length) throw Error('Hãy biên soạn câu hỏi trước.');
        const actualCounts = Object.fromEntries(['I', 'II', 'III'].map(part => [part, data.filter(question => question.part === part).length]));
        if (total !== data.length || ['I', 'II', 'III'].some(part => actualCounts[part] !== counts[part])) throw Error(`Phiếu đang chọn ${counts.I}/${counts.II}/${counts.III} câu nhưng đề biên soạn có ${actualCounts.I}/${actualCounts.II}/${actualCounts.III}. Hãy chỉnh số lượng cho khớp hoặc quay lại Biên soạn đề.`);
        await publishExam(data, '');
      } catch (error) { message.textContent = error.message || String(error); }
    }
    setup.append(sectionPanels, totalLabel, totalError, createFromDrive, createFromDraft);
    content.append(intro, previewPanel, setup);
    refreshTotal();
  }
  switchMode('author');
}
