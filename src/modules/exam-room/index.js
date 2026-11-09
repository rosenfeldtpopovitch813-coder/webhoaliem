import { element, button } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { navigate } from '../../core/router.js';
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
let ticker = null, autosaveTicker = null, draftSaveTimer = null, lockdownCleanup = null;
let current = null, answers = {}, currentExamId = null;
function clearTimer() {
  if (ticker) clearInterval(ticker);
  if (autosaveTicker) clearInterval(autosaveTicker);
  if (draftSaveTimer) clearTimeout(draftSaveTimer);
  ticker = autosaveTicker = draftSaveTimer = null;
}
function exitExamLockdown() {
  if (lockdownCleanup) { try { lockdownCleanup(); } catch {} lockdownCleanup = null; }
  document.body.classList.remove('is-exam-lockdown');
  AppStore.set('examLockdown', false);
  AppStore.set('activeExamId', null);
  AppStore.set('notice', '');
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
function enterExamLockdown(id, { onLeaveScreen, onFullscreenChange } = {}) {
  if (lockdownCleanup) { try { lockdownCleanup(); } catch {} lockdownCleanup = null; }
  document.body.classList.add('is-exam-lockdown');
  AppStore.set('examLockdown', true);
  AppStore.set('activeExamId', id);
  AppStore.set('notice', '');
  try { history.pushState({ examLockdown: true, id }, '', '/exam'); } catch {}
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.documentElement.requestFullscreen?.().catch(() => {});

  const onBeforeUnload = (event) => {
    event.preventDefault();
    event.returnValue = '';
    return '';
  };
  const onVisibility = () => {
    if (document.hidden) onLeaveScreen?.();
  };
  const onFsChange = () => {
    onFullscreenChange?.(Boolean(document.fullscreenElement));
  };
  const onKeyDown = (event) => {
    const tag = (event.target?.tagName || '').toLowerCase();
    const isEditable = tag === 'input' || tag === 'textarea' || event.target?.isContentEditable;
    if ((event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) || (event.key === 'Backspace' && !isEditable)) {
      event.preventDefault();
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('fullscreenchange', onFsChange);
  window.addEventListener('keydown', onKeyDown, true);
  lockdownCleanup = () => {
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('fullscreenchange', onFsChange);
    window.removeEventListener('keydown', onKeyDown, true);
  };
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
// Render the exam PDF page by page into canvases (no links to click, readable on phones).
async function renderExamPdf(id, host) {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`/api/exam?${new URLSearchParams({ action: 'document', id })}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) throw Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`);
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await response.arrayBuffer()) }).promise;
  host.replaceChildren();
  const cssWidth = Math.max(300, host.clientWidth - 24);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: (cssWidth / page.getViewport({ scale: 1 }).width) * dpr });
    const canvas = document.createElement('canvas');
    canvas.className = 'exam-pdf-page';
    canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
    canvas.oncontextmenu = event => event.preventDefault();
    host.append(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  }
}
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
    ['Sổ tay câu sai', showMistakes],
    ['Tạo phòng thi', showCreator]
  ];
  for (const [name, action] of actions) {
    bar.append(button(name, 'exam-tab', () => {
      if (AppStore.get('examLockdown')) return;
      clearTimer();
      action(body);
      body.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }
  const openA4Top = button('', 'exam-tab', () => {
    if (AppStore.get('examLockdown')) return;
    navigate('/exam-paper');
  });
  openA4Top.append(icon('exam-paper', 15), document.createTextNode(' Khu Soạn đề A4 riêng →'));
  bar.append(openA4Top);
  wrap.append(showcase, bar, body);
  let hasPendingPaper = false;
  try { hasPendingPaper = Boolean(localStorage.getItem('htvvm_pending_exam_paper')); } catch { /* ignore */ }
  if (hasPendingPaper) showCreator(body);
  else showList(body);
  return wrap;
}
async function deleteExamById(host, examId, examTitle, onDeleted) {
  if (!confirm(`Xóa vĩnh viễn đề thi “${examTitle}” (Mã ${examId}) cùng toàn bộ dữ liệu lượt làm bài khỏi hệ thống?`)) return;
  try {
    await api('delete', { id: examId });
    removeLocalDraft(scopeUid(), examId);
    if (onDeleted) onDeleted();
    else showList(host);
  } catch (err) {
    alert(err.message || String(err));
  }
}
async function showList(host) {
  host.replaceChildren(E('p', 'exam-message', 'Đang tải danh sách đề...'));
  if (!requireLogin(host)) return;
  try {
    const data = await api('list', {}, 'GET');
    const section = panel('Đề thi đang mở'), grid = E('div', 'exam-grid');
    if (!data.exams.length) grid.append(E('p', 'exam-message', 'Chưa có đề thi. Hãy dùng mục “Tạo phòng thi” để tạo đề đầu tiên.'));
    for (const x of data.exams) {
      const card = E('article', 'exam-card');
      const badgeRow = E('div', 'exam-card-badges');
      badgeRow.append(
        E('span', `exam-card-pill ${x.hasSourceDocument ? 'is-doc' : ''}`, x.hasSourceDocument ? 'Đề Drive / PDF' : 'Đề trực tiếp')
      );
      if (x.isOwner) badgeRow.append(E('span', 'exam-card-pill is-owner', 'Của bạn'));
      const totalQ = (x.counts?.I || 0) + (x.counts?.II || 0) + (x.counts?.III || 0);
      const cardActions = E('div', 'exam-card-actions');
      const enterBtn = button('Vào phòng →', 'primary-btn', () => begin(host, x.id));
      const copyBtn = button('', 'exam-card-icon-btn', () => {
        navigator.clipboard?.writeText(x.id);
        copyBtn.title = 'Đã sao chép mã!';
      });
      copyBtn.title = `Sao chép mã ${x.id}`;
      copyBtn.append(icon('copy', 14));
      cardActions.append(enterBtn, copyBtn);
      if (x.isOwner) {
        const delBtn = button('', 'exam-card-delete-btn', () => {
          delBtn.disabled = true;
          deleteExamById(host, x.id, x.title, () => showList(host)).finally(() => { delBtn.disabled = false; });
        });
        delBtn.title = 'Xóa đề thi này khỏi cơ sở dữ liệu';
        delBtn.append(icon('trash', 14), document.createTextNode(' Xóa'));
        cardActions.append(delBtn);
      }
      card.append(
        badgeRow,
        E('strong', 'exam-card-title', x.title),
        E('span', '', `Mã ${x.id} • ${x.durationMinutes} phút • ${totalQ} câu`),
        cardActions
      );
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
    const questions = data.questions || [];
    const validQuestionIds = new Set(questions.map(q => q.id));
    const initialFlags = localIsNewer && Array.isArray(localDraft?.flaggedQuestions)
      ? localDraft.flaggedQuestions
      : (data.session.flaggedQuestions || localDraft?.flaggedQuestions || []);
    const flaggedQuestions = new Set((Array.isArray(initialFlags) ? initialFlags : []).filter(qid => validQuestionIds.has(qid)));

    const p = E('section', 'exam-runner-shell');
    let busy = false, draftSaveBusy = false, draftSaveQueued = false, omrFilter = 'all', leaveScreenCount = 0;
    const initialPerf = performance.now(), serverAt = data.serverNow;
    const remaining = () => Math.max(0, data.session.endsAt - (serverAt + performance.now() - initialPerf));

    const submit = async (automatic = false) => {
      if (busy) return; busy = true;
      if (ticker) clearInterval(ticker); ticker = null;
      if (autosaveTicker) clearInterval(autosaveTicker); autosaveTicker = null;
      if (draftSaveTimer) clearTimeout(draftSaveTimer); draftSaveTimer = null;
      timer.textContent = automatic ? 'Hết giờ · đang nộp…' : 'Đang nộp bài…';
      status.textContent = 'Đang gửi phiếu trả lời lên máy chủ…';
      try {
        const output = await api('submit', { id, answers: cloneAnswers(answers) });
        removeLocalDraft(uid, id);
        exitExamLockdown();
        showResult(host, output.result, id);
      } catch (err) {
        busy = false;
        status.textContent = `⚠ Chưa nộp được (${err.message || 'lỗi mạng'}). Bấm Nộp bài để gửi lại.`;
        status.classList.add('exam-save-warning');
        if (remaining() > 0 && !ticker) ticker = setInterval(update, 250);
      }
    };
    const confirmSubmit = () => {
      const done = questions.filter(questionIsAnswered).length;
      const msg = done < questions.length
        ? `Bạn mới khoanh ${done}/${questions.length} câu (còn ${questions.length - done} câu trống). Xác nhận nộp bài và mở khóa phòng thi?`
        : 'Xác nhận nộp phiếu trả lời, chấm điểm và mở khóa phòng thi?';
      if (confirm(msg)) submit(false);
    };

    // --- STICKY COMPACT TOP BAR ---
    const topBar = E('header', 'exam-run-topbar');
    const titleGroup = E('div', 'exam-run-title-group');
    const titleRow = E('div', 'exam-run-title-row');
    const lockBadge = E('span', 'exam-lock-pill');
    lockBadge.append(icon('lock', 12), document.createTextNode(' Khóa phòng thi · Đã tắt AI'));
    titleRow.append(E('strong', 'exam-run-title', data.exam.title), lockBadge);
    titleGroup.append(
      titleRow,
      E('span', 'exam-run-meta', `Mã phòng ${id} · ${data.exam.durationMinutes} phút · Chỉ mở khóa sau khi nộp bài`)
    );
    const controlsGroup = E('div', 'exam-run-controls');
    const violationBadge = E('span', 'exam-violation-pill', '');
    violationBadge.hidden = true;
    const answeredLabel = E('span', 'exam-run-progress-pill', `0/${questions.length} câu`);
    const timer = E('div', 'exam-run-clock', '--:--');
    const fullscreenButton = button('', 'exam-session-tool', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      } catch { status.textContent = 'Trình duyệt chặn toàn màn hình tự động; phòng thi vẫn đang được khóa.'; }
    });
    const setFsButtonLabel = (isFs) => {
      fullscreenButton.replaceChildren(icon('maximize', 14), document.createTextNode(isFs ? ' Thu nhỏ khung' : ' Toàn màn hình'));
    };
    setFsButtonLabel(Boolean(document.fullscreenElement));
    const topSubmitBtn = button('Nộp bài', 'primary-btn exam-run-submit-top', confirmSubmit);
    controlsGroup.append(violationBadge, answeredLabel, timer, fullscreenButton, topSubmitBtn);
    topBar.append(titleGroup, controlsGroup);

    const status = E('small', 'exam-save-status', answeredCount(answers) ? `Đã khôi phục ${answeredCount(answers)} câu đã lưu.` : 'Tự động lưu nháp mỗi lần khoanh.');
    const progressFill = E('div', 'exam-progress-fill');
    const progressTrack = E('div', 'exam-progress-track');
    progressTrack.append(progressFill);

    // --- SPLIT WORKSPACE: LEFT = ĐỀ THI, RIGHT = PHIẾU TRẢ LỜI OMR ---
    const splitLayout = E('div', 'exam-split-workspace');
    const leftPane = E('section', 'exam-left-paper-pane');
    const leftHead = E('div', 'exam-pane-head');
    leftHead.append(E('strong', '', 'ĐỀ THI'));

    const rightPane = E('aside', 'exam-right-omr-pane');
    const omrCard = E('section', 'exam-omr-sheet-card');
    const omrHead = E('div', 'exam-omr-card-head');
    const omrTitleRow = E('div', 'exam-omr-title-row');
    omrTitleRow.append(E('strong', '', 'PHIẾU TRẢ LỜI'), E('span', 'exam-omr-sub', 'Bấm chữ cái để khoanh tròn'));
    const filterBar = E('div', 'exam-omr-filter-bar');
    const filterBtns = new Map();
    for (const [fKey, fLabel] of [['all', 'Tất cả'], ['unanswered', 'Chưa làm'], ['flagged', '★ Xem lại']]) {
      const fb = button(fLabel, `exam-omr-filter-pill ${fKey === 'all' ? 'is-active' : ''}`, () => {
        omrFilter = fKey;
        for (const [k, btn] of filterBtns) btn.classList.toggle('is-active', k === fKey);
        applyOmrFilter();
      });
      filterBtns.set(fKey, fb);
      filterBar.append(fb);
    }
    omrHead.append(omrTitleRow, progressTrack, filterBar);

    const omrBody = E('div', 'exam-omr-sheet-body');
    const omrFooter = E('div', 'exam-omr-sheet-footer');
    const bottomSubmitBtn = button('Nộp bài & Chấm điểm', 'primary-btn exam-omr-submit-btn', confirmSubmit);
    omrFooter.append(status, bottomSubmitBtn);
    omrCard.append(omrHead, omrBody, omrFooter);
    rightPane.append(omrCard);

    const syncUIHooks = new Map();
    const omrRowMap = new Map();
    const paperItemMap = new Map();

    const questionIsAnswered = (q) => {
      const value = answers[q.id];
      if (q.part === 'II') return Array.isArray(value) && value.some(v => v === true || v === false);
      return typeof value === 'string' && value.trim() !== '';
    };

    const applyOmrFilter = () => {
      for (const q of questions) {
        const row = omrRowMap.get(q.id);
        if (!row) continue;
        const ans = questionIsAnswered(q), flg = flaggedQuestions.has(q.id);
        row.hidden = (omrFilter === 'unanswered' && ans) || (omrFilter === 'flagged' && !flg);
      }
    };

    const updateProgress = () => {
      const count = questions.filter(questionIsAnswered).length;
      const total = questions.length;
      answeredLabel.textContent = `Đã làm ${count}/${total}`;
      progressFill.style.width = `${total ? (count / total) * 100 : 0}%`;
      for (const q of questions) {
        const hook = syncUIHooks.get(q.id);
        if (hook) hook();
      }
      applyOmrFilter();
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
        status.textContent = `✓ Đã lưu nháp lúc ${new Date(saved.savedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        status.classList.remove('exam-save-warning');
      } catch {
        status.textContent = '✓ Đã lưu trên máy · chờ đồng bộ mạng';
        status.classList.add('exam-save-warning');
      } finally {
        draftSaveBusy = false;
        if (draftSaveQueued) { draftSaveQueued = false; syncDraft(); }
      }
    };
    const queueDraftSave = () => {
      writeLocalDraft(uid, id, answers, [...flaggedQuestions]);
      status.textContent = 'Đang lưu nháp…';
      status.classList.remove('exam-save-warning');
      if (draftSaveTimer) clearTimeout(draftSaveTimer);
      draftSaveTimer = setTimeout(() => { draftSaveTimer = null; syncDraft(); }, 600);
    };
    const toggleFlag = (qid) => {
      if (flaggedQuestions.has(qid)) flaggedQuestions.delete(qid); else flaggedQuestions.add(qid);
      updateProgress(); queueDraftSave();
    };
    const scrollToQuestionOnPaper = (qid) => {
      const target = paperItemMap.get(qid);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('is-highlighted');
      setTimeout(() => target.classList.remove('is-highlighted'), 1200);
    };

    // Build Left Paper (PDF/Drive embed OR authored paper) + Right OMR Sections
    let paperSheet = null;
    if (data.exam.sourceUrl) {
      const pages = E('div', 'exam-pdf-pages');
      pages.append(E('p', 'exam-message', 'Đang tải đề thi…'));
      const showIframeFallback = () => {
        const sourceFrame = document.createElement('iframe');
        sourceFrame.className = 'exam-source-document';
        sourceFrame.title = 'Tài liệu đề thi';
        // No allow-popups: blocks Drive's "open in new window" button so students stay in the room.
        sourceFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        sourceFrame.src = data.exam.sourceUrl;
        pages.replaceWith(sourceFrame);
      };
      const reloadDocBtn = button('', 'exam-session-tool exam-reload-doc-btn', () => {
        pages.replaceChildren(E('p', 'exam-message', 'Đang tải đề thi…'));
        renderExamPdf(id, pages).catch(showIframeFallback);
      });
      reloadDocBtn.append(icon('refresh', 13), document.createTextNode(' Tải lại đề'));
      leftHead.append(reloadDocBtn);
      leftPane.append(leftHead, pages);
      renderExamPdf(id, pages).catch(showIframeFallback);
    } else {
      const isPlaceholderOnlyPaper = questions.length > 0 && questions.every((q) => {
        const pText = String(q.prompt || '').trim();
        const genericPrompt = !pText || /^Câu\s+\d+$/i.test(pText);
        if (!genericPrompt || q.image || q.latex) return false;
        if (q.part === 'I') return Array.isArray(q.options) && q.options.every((opt, i) => !opt || opt === `Phương án ${'ABCD'[i]}`);
        if (q.part === 'II') return Array.isArray(q.options) && q.options.every((opt, i) => !opt || opt === `Nhận định ${'abcd'[i]}`);
        return true;
      });
      if (isPlaceholderOnlyPaper) {
        leftHead.append(E('span', 'exam-pane-note', 'Chế độ phát đề giấy (chưa gắn link file đề)'));
        const emptyPaperNotice = E('div', 'exam-creator-doc-placeholder exam-missing-doc-notice');
        emptyPaperNotice.append(
          icon('exam-paper', 38),
          E('strong', '', 'Phòng thi này chưa đính kèm link đề Google Drive / PDF'),
          E('p', '', 'Người tạo phòng chưa dán liên kết tài liệu đề thi nên khung bên trái không có trang đề điện tử. Hãy đọc bản đề giấy được phát và khoanh đáp án ở Phiếu trả lời bên phải.'),
          ...(data.exam.isOwner ? [E('p', 'exam-owner-recreate-tip', 'Mẹo cho người tạo đề: Bạn có thể bấm “Nộp bài” để mở khóa, xóa phòng này trong Kho đề, rồi dán link Google Drive công khai khi tạo phòng mới.')] : [])
        );
        leftPane.append(leftHead, emptyPaperNotice);
      } else {
        leftHead.append(E('span', 'exam-pane-note', 'Đọc đề bên trái · Khoanh trên phiếu bên phải (hoặc bấm trực tiếp vào phương án)'));
        paperSheet = E('div', 'exam-paper-sheet');
        leftPane.append(leftHead, paperSheet);
      }
    }

    const partMeta = [
      ['I', 'PHẦN I · Trắc nghiệm A – D', 'Chọn 1 đáp án đúng cho mỗi câu'],
      ['II', 'PHẦN II · Đúng / Sai', 'Chọn Đ hoặc S cho từng ý a, b, c, d'],
      ['III', 'PHẦN III · Trả lời ngắn', 'Điền đáp số vào ô trống']
    ];

    let globalIdx = 0;
    for (const [partCode, partTitle, partHint] of partMeta) {
      const partQuestions = questions.filter(q => q.part === partCode);
      if (!partQuestions.length) continue;

      // Section header on Left Paper (when !sourceUrl)
      if (paperSheet) {
        const secHead = E('div', 'exam-paper-sec-head');
        secHead.append(E('strong', '', partTitle), E('span', '', partHint));
        paperSheet.append(secHead);
      }

      // Section card on Right OMR Sheet
      const omrSec = E('div', 'exam-omr-run-section');
      const omrSecHead = E('div', 'exam-omr-run-sec-head');
      omrSecHead.append(E('strong', '', partTitle), E('span', '', `${partQuestions.length} câu`));
      const omrSecList = E('div', `exam-omr-run-list is-part-${partCode}`);
      omrSec.append(omrSecHead, omrSecList);
      omrBody.append(omrSec);

      for (const q of partQuestions) {
        globalIdx += 1;
        const qNum = globalIdx;
        const padNum = String(qNum).padStart(2, '0');
        const paperOptionNodes = [];
        const omrBubbleNodes = [];
        let paperShortInput = null;
        let omrShortInput = null;

        // 1) Left Paper Question Item (if !sourceUrl)
        if (paperSheet) {
          const pItem = E('article', 'exam-paper-q');
          paperItemMap.set(q.id, pItem);
          const pPromptRow = E('div', 'exam-paper-q-head');
          pPromptRow.append(E('span', 'exam-paper-q-num', `Câu ${qNum}.`));
          const pPrompt = E('div', 'exam-paper-q-prompt exam-markdown-body');
          setRichText(pPrompt, q.prompt);
          pPromptRow.append(pPrompt);
          pItem.append(pPromptRow);

          const imageUrl = imageDataURL(q.image);
          if (imageUrl) {
            const img = document.createElement('img');
            img.className = 'exam-markdown-uploaded-image';
            img.src = imageUrl;
            img.alt = `Hình câu ${qNum}`;
            pItem.append(img);
          }
          if (q.latex) {
            const fNode = E('div', 'exam-question-latex');
            fNode.innerHTML = renderDedicatedLatex(q.latex);
            pItem.append(fNode);
          }

          if (q.part === 'I') {
            const pOpts = E('div', 'exam-paper-opts');
            (q.options || []).forEach((opt, i) => {
              const choice = 'ABCD'[i];
              const optBtn = button('', 'exam-paper-opt-item', () => {
                answers[q.id] = answers[q.id] === choice ? '' : choice;
                if (!answers[q.id]) delete answers[q.id];
                queueDraftSave(); updateProgress();
              });
              const badge = E('span', 'exam-paper-opt-letter', choice);
              const txt = E('span', 'exam-paper-opt-text');
              setRichText(txt, opt);
              optBtn.append(badge, txt);
              paperOptionNodes.push({ choice, node: optBtn, badge });
              pOpts.append(optBtn);
            });
            pItem.append(pOpts);
          } else if (q.part === 'II') {
            const pTfList = E('div', 'exam-paper-tf-list');
            (q.options || []).forEach((opt, i) => {
              const line = E('div', 'exam-paper-tf-line');
              const txt = E('div', 'exam-paper-opt-text');
              setRichText(txt, `<strong>${'abcd'[i]})</strong> ${opt}`);
              line.append(txt);
              pTfList.append(line);
            });
            pItem.append(pTfList);
          } else {
            const inlineAns = E('div', 'exam-paper-short-inline');
            inlineAns.append(E('span', '', 'Đáp số:'));
            paperShortInput = field('text', 'Điền kết quả số (VD: 12,5)…', typeof answers[q.id] === 'string' ? answers[q.id] : '');
            paperShortInput.inputMode = 'decimal';
            paperShortInput.maxLength = 200;
            paperShortInput.oninput = () => {
              answers[q.id] = paperShortInput.value;
              if (omrShortInput && omrShortInput.value !== paperShortInput.value) omrShortInput.value = paperShortInput.value;
              queueDraftSave(); updateProgress();
            };
            inlineAns.append(paperShortInput);
            pItem.append(inlineAns);
          }
          paperSheet.append(pItem);
        }

        // 2) Right OMR Sheet Row / Card
        const flagBtn = button('☆', 'exam-omr-star', () => toggleFlag(q.id));
        flagBtn.title = 'Đánh dấu xem lại';
        const qJumpBtn = button(q.part === 'I' ? padNum : `Câu ${padNum}`, 'exam-omr-qjump', () => scrollToQuestionOnPaper(q.id));
        qJumpBtn.title = `Xem đề Câu ${qNum}`;

        if (q.part === 'I') {
          const row = E('div', 'exam-omr-row');
          omrRowMap.set(q.id, row);
          const bubbles = E('div', 'exam-omr-bubbles');
          for (const choice of 'ABCD') {
            const b = button(choice, 'exam-omr-bubble', () => {
              if (answers[q.id] === choice) delete answers[q.id];
              else answers[q.id] = choice;
              queueDraftSave(); updateProgress();
            });
            omrBubbleNodes.push({ choice, node: b });
            bubbles.append(b);
          }
          row.append(qJumpBtn, bubbles, flagBtn);
          omrSecList.append(row);

          syncUIHooks.set(q.id, () => {
            const cur = answers[q.id] || '';
            const flg = flaggedQuestions.has(q.id);
            row.classList.toggle('is-answered', Boolean(cur));
            row.classList.toggle('is-flagged', flg);
            flagBtn.textContent = flg ? '★' : '☆';
            flagBtn.classList.toggle('is-flagged', flg);
            for (const { choice, node } of omrBubbleNodes) node.classList.toggle('is-selected', cur === choice);
            for (const { choice, node, badge } of paperOptionNodes) {
              node.classList.toggle('is-selected', cur === choice);
              badge.classList.toggle('is-selected', cur === choice);
            }
          });
        } else if (q.part === 'II') {
          const card = E('div', 'exam-omr-tf-card');
          omrRowMap.set(q.id, card);
          const head = E('div', 'exam-omr-tf-head');
          head.append(qJumpBtn, flagBtn);
          const grid = E('div', 'exam-omr-tf-list');
          const tfButtons = [];
          for (let i = 0; i < 4; i++) {
            const subRow = E('div', 'exam-omr-tf-row');
            subRow.append(E('small', '', `${'abcd'[i]})`));
            const pair = E('div', 'exam-omr-tf-pair');
            const btnD = button('Đ', 'exam-omr-mini-tf', () => {
              if (!Array.isArray(answers[q.id])) answers[q.id] = [null, null, null, null];
              answers[q.id][i] = answers[q.id][i] === true ? null : true;
              queueDraftSave(); updateProgress();
            });
            const btnS = button('S', 'exam-omr-mini-tf', () => {
              if (!Array.isArray(answers[q.id])) answers[q.id] = [null, null, null, null];
              answers[q.id][i] = answers[q.id][i] === false ? null : false;
              queueDraftSave(); updateProgress();
            });
            pair.append(btnD, btnS);
            subRow.append(pair);
            grid.append(subRow);
            tfButtons.push({ i, btnD, btnS });
          }
          card.append(head, grid);
          omrSecList.append(card);

          syncUIHooks.set(q.id, () => {
            const arr = Array.isArray(answers[q.id]) ? answers[q.id] : [null, null, null, null];
            const flg = flaggedQuestions.has(q.id);
            card.classList.toggle('is-answered', arr.some(v => v === true || v === false));
            card.classList.toggle('is-flagged', flg);
            flagBtn.textContent = flg ? '★' : '☆';
            flagBtn.classList.toggle('is-flagged', flg);
            for (const { i, btnD, btnS } of tfButtons) {
              btnD.classList.toggle('is-true', arr[i] === true);
              btnS.classList.toggle('is-false', arr[i] === false);
            }
          });
        } else {
          const row = E('div', 'exam-omr-row is-short');
          omrRowMap.set(q.id, row);
          omrShortInput = field('text', 'Đáp số…', typeof answers[q.id] === 'string' ? answers[q.id] : '');
          omrShortInput.className = 'exam-input exam-omr-short-input';
          omrShortInput.inputMode = 'decimal';
          omrShortInput.maxLength = 200;
          omrShortInput.oninput = () => {
            answers[q.id] = omrShortInput.value;
            if (paperShortInput && paperShortInput.value !== omrShortInput.value) paperShortInput.value = omrShortInput.value;
            queueDraftSave(); updateProgress();
          };
          row.append(qJumpBtn, omrShortInput, flagBtn);
          omrSecList.append(row);

          syncUIHooks.set(q.id, () => {
            const val = typeof answers[q.id] === 'string' ? answers[q.id].trim() : '';
            const flg = flaggedQuestions.has(q.id);
            row.classList.toggle('is-answered', Boolean(val));
            row.classList.toggle('is-flagged', flg);
            flagBtn.textContent = flg ? '★' : '☆';
            flagBtn.classList.toggle('is-flagged', flg);
          });
        }
      }
    }

    const update = () => {
      if (!host.isConnected) { clearTimer(); return; }
      const ms = remaining(), seconds = Math.ceil(ms / 1000);
      timer.textContent = `⏱ ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
      timer.classList.toggle('exam-timer-urgent', ms <= 60000);
      if (ms <= 0) submit(true);
    };

    splitLayout.append(leftPane, rightPane);
    p.append(topBar, splitLayout);
    host.replaceChildren(p);
    enterExamLockdown(id, {
      onLeaveScreen: () => {
        leaveScreenCount += 1;
        violationBadge.hidden = false;
        violationBadge.textContent = `⚠ Rời màn hình: ${leaveScreenCount}`;
        status.textContent = `⚠ Cảnh báo: Hệ thống ghi nhận bạn vừa chuyển tab/rời màn hình (${leaveScreenCount} lần).`;
        status.classList.add('exam-save-warning');
      },
      onFullscreenChange: (isFs) => setFsButtonLabel(isFs)
    });
    updateProgress();
    if (localIsNewer || answeredCount(answers) > 0 || flaggedQuestions.size > 0) queueDraftSave();
    ticker = setInterval(update, 250); autosaveTicker = setInterval(syncDraft, 8000); update();
  } catch (e) { exitExamLockdown(); showError(host, e); }
}
function showResult(host, result, id) {
  clearTimer();
  exitExamLockdown();
  const p = panel('Kết quả bài thi'); if (!result) return showError(host, Error('Chưa nhận được kết quả.'));
  p.append(E('div', 'exam-score', `${Number(result.score || 0).toFixed(2)} / 10`), E('p', 'exam-message', `Đúng trọn vẹn ${result.fullyCorrect || 0}/${result.total || 0} câu`));
  for (const d of result.details || []) {
    const item = E('div', 'exam-result-line');
    item.append(E('strong', '', `${d.id} · Phần ${d.part} · ${d.earned / 100}/${d.possible / 100} điểm`), E('span', '', d.prompt), E('span', '', `Bạn chọn: ${JSON.stringify(d.response)} | Đáp án: ${JSON.stringify(d.answer)}`)); p.append(item);
  }
  const resultActions = E('div', 'exam-tabs');
  resultActions.append(
    button('Xem bảng vinh danh', 'primary-btn', () => showLeaderboard(host, id)),
    button('Lịch sử & thống kê', 'exam-tab', () => showHistory(host)),
    button('Quay lại kho đề', 'exam-tab', () => showList(host))
  );
  if (current?.exam?.id === id && current?.exam?.isOwner) {
    const delBtn = button('', 'exam-card-delete-btn', () => deleteExamById(host, id, current.exam.title, () => showList(host)));
    delBtn.append(icon('trash', 14), document.createTextNode(' Xóa đề này khỏi kho'));
    resultActions.append(delBtn);
  }
  p.append(resultActions);
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

  const p = panel('Tạo đề thi & Phòng thi trực tuyến');
  const title = field('text', 'Tên đề, ví dụ: Đề kiểm tra Hóa học 12 - Giữa kì 1', 'Đề kiểm tra định kỳ Hóa học 12');
  const duration = field('number', 'Thời gian (phút)', '50');
  duration.min = '5'; duration.max = '240'; duration.step = '1';

  const common = E('div', 'exam-creator-common exam-creator-header-bar');
  const titleWrap = E('div', 'exam-creator-field-col');
  titleWrap.append(label('Tên đề thi / Phòng thi'), title);
  const durationWrap = E('div', 'exam-creator-field-col is-compact');
  durationWrap.append(label('Thời gian (5–240 phút)'), duration);
  common.append(titleWrap, durationWrap);

  const tabs = E('div', 'exam-creator-tabs');
  const roomTab = button('1. Đề bên trái · Phiếu OMR bên phải (PDF / Drive)', 'exam-creator-tab is-active', () => switchMode('room'));
  const authorTab = button('2. Soạn từng câu / Đề chuyển từ Khu A4', 'exam-creator-tab', () => switchMode('author'));
  const openA4SuiteBtn = button('', 'exam-tab', () => navigate('/exam-paper'));
  openA4SuiteBtn.append(icon('exam-paper', 15), document.createTextNode(' Mở Khu Soạn đề A4 riêng →'));
  tabs.append(roomTab, authorTab, openA4SuiteBtn);

  const content = E('div', 'exam-creator-content');
  const message = E('p', 'exam-message');
  p.append(common, tabs, content, message);
  host.replaceChildren(p);

  let data = [];
  let mode = 'room';
  let sourceEmbedUrl = '';
  let sourceOpenUrl = '';

  // Nạp đề vừa chuyển từ Khu Soạn đề A4 riêng nếu có
  try {
    const pendingRaw = localStorage.getItem('htvvm_pending_exam_paper');
    if (pendingRaw) {
      const parsed = JSON.parse(pendingRaw);
      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length) {
        data = parsed.questions;
        if (parsed.title) title.value = parsed.title;
        message.textContent = `✅ Đã nhận ${data.length} câu hỏi từ Khu Soạn đề A4! Kiểm tra bên dưới rồi bấm "Lưu & mở phòng thi".`;
        localStorage.removeItem('htvvm_pending_exam_paper');
      }
    }
  } catch { /* ignore */ }

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
    result.append(
      E('h4', '', 'Đã tạo phòng thi thành công!'),
      E('p', '', `Mã phòng thi: ${response.exam.id}`),
      E('p', 'exam-message', sourceUrl ? '✓ Đã gắn file đề bên trái — thí sinh vào phòng sẽ thấy ngay đề Drive/PDF bên trái và Phiếu trả lời OMR bên phải (khóa thoát & khóa AI).' : 'Đề đã được lưu trong kho đề chung, sẵn sàng cho học sinh vào thi.')
    );
    const actRow = E('div', 'exam-tabs');
    const openNowBtn = button('Mở phòng thi ngay →', 'primary-btn', () => begin(host, response.exam.id));
    const copyCodeBtn = button('', 'exam-tab', () => {
      navigator.clipboard?.writeText(response.exam.id);
      message.textContent = `Đã sao chép mã phòng ${response.exam.id}`;
    });
    copyCodeBtn.append(icon('copy', 14), document.createTextNode(' Sao chép mã phòng'));
    const delCreatedBtn = button('', 'exam-card-delete-btn', () => deleteExamById(host, response.exam.id, examTitle, () => showList(host)));
    delCreatedBtn.append(icon('trash', 14), document.createTextNode(' Xóa đề vừa tạo'));
    actRow.append(
      openNowBtn,
      copyCodeBtn,
      button('Quay về kho đề', 'exam-tab', () => showList(host)),
      delCreatedBtn
    );
    result.append(actRow);
    content.replaceChildren(result);
  }
  const updateModeTabs = () => {
    roomTab.classList.toggle('is-active', mode === 'room');
    authorTab.classList.toggle('is-active', mode === 'author');
  };
  function switchMode(next) {
    mode = next; updateModeTabs();
    if (next === 'room') renderRoomCreator();
    else renderAuthor();
  }

  function renderAuthor() {
    content.replaceChildren();
    const intro = E('div', 'exam-creator-intro');
    intro.append(E('h4', '', 'Danh sách câu hỏi chi tiết & Nhập JSON'), E('p', '', 'Kiểm tra hoặc chỉnh sửa từng câu hỏi đã chuyển từ Khu Soạn đề A4, hoặc thêm câu hỏi thủ công / dán JSON.'));
    const help = E('div', 'exam-markdown-help');
    help.innerHTML = '<strong>Cú pháp nhanh:</strong> <code>**đậm**</code> · <code>*nghiêng*</code> · <code>$x^2$</code> · <code>\\ce{H2SO4}</code>. Muốn gõ đề trực quan trên giấy A4 nhiều trang như Word, hãy mở mục <strong>📝 Soạn đề A4</strong> ở thanh bên trái.';
    intro.append(help);
    const questions = E('div', 'exam-editor');
    const addButtons = E('div', 'exam-tabs');
    const addQuestion = part => {
      const base = { part, prompt: '', image: '', latex: '', ...(part === 'I' ? { options: ['', '', '', ''], answer: 'A' } : part === 'II' ? { options: ['', '', '', ''], answer: [true, false, true, false] } : { answer: '', tolerance: 0.0001 }) };
      data.push(base); renderQuestionEditors();
    };
    for (const [part, text] of [['I', '+ Trắc nghiệm A–D'], ['II', '+ Đúng / Sai'], ['III', '+ Trả lời ngắn']]) addButtons.append(button(text, 'exam-tab', () => addQuestion(part)));

    const includeKeyRow = E('label', 'exam-pdf-key-label');
    const includeAnswers = document.createElement('input'); includeAnswers.type = 'checkbox';
    includeKeyRow.append(includeAnswers, document.createTextNode(' Kèm đáp án ở trang cuối PDF'));

    function renderQuestionEditors() {
      questions.replaceChildren();
      if (!data.length) questions.append(E('p', 'exam-message', 'Chưa có câu hỏi nào. Hãy bấm nút thêm câu ở trên hoặc chuyển câu hỏi từ Khu Soạn đề A4 sang.'));
      data.forEach((q, idx) => {
        q.options = Array.isArray(q.options) ? q.options : ['', '', '', ''];
        const card = E('article', 'exam-question exam-author-question');
        const heading = E('div', 'exam-question-top');
        heading.append(E('h4', '', `Câu ${idx + 1} · ${q.part === 'I' ? 'Phần I (Trắc nghiệm)' : q.part === 'II' ? 'Phần II (Đúng / Sai)' : 'Phần III (Trả lời ngắn)'}`));
        heading.append(button('Xóa câu', 'exam-tab', () => { data.splice(idx, 1); renderQuestionEditors(); }));
        card.append(heading);

        const editing = E('div', 'exam-authoring-grid');
        const editPane = E('div', 'exam-authoring-edit');
        const prompt = field('textarea', 'Nhập nội dung câu hỏi…', q.prompt || '');
        prompt.rows = 4; prompt.classList.add('exam-markdown-input');
        const toolbar = E('div', 'exam-markdown-toolbar');
        const wrapSelection = (prefix, suffix = prefix) => {
          const start = prompt.selectionStart ?? prompt.value.length, end = prompt.selectionEnd ?? start;
          const selected = prompt.value.slice(start, end) || 'nội dung';
          prompt.setRangeText(`${prefix}${selected}${suffix}`, start, end, 'select');
          q.prompt = prompt.value; prompt.dispatchEvent(new Event('input', { bubbles: true }));
        };
        toolbar.append(
          button('Đậm', 'exam-mini-tool', () => wrapSelection('**')), button('Nghiêng', 'exam-mini-tool', () => wrapSelection('*')),
          button('Công thức $', 'exam-mini-tool', () => wrapSelection('$', '$'))
        );
        const imageInput = document.createElement('input'); imageInput.type = 'file'; imageInput.accept = 'image/png,image/jpeg,image/webp'; imageInput.hidden = true;
        const imageStatus = E('small', 'exam-message', q.image ? 'Đã đính kèm hình.' : '');
        toolbar.append(button('Chèn ảnh', 'exam-mini-tool', () => imageInput.click()));
        imageInput.addEventListener('change', async () => {
          const file = imageInput.files?.[0]; if (!file) return;
          imageStatus.textContent = 'Đang nén ảnh…';
          try { q.image = await compressImageFile(file); imageStatus.textContent = 'Đã chèn ảnh.'; updatePreview(); }
          catch (error) { imageStatus.textContent = error.message || String(error); }
          finally { imageInput.value = ''; }
        });
        const preview = E('div', 'exam-markdown-preview');
        const updatePreview = () => {
          preview.replaceChildren();
          const rendered = E('div', 'exam-markdown-body'); rendered.innerHTML = richMathHTML(prompt.value || 'Xem trước câu hỏi…'); preview.append(rendered);
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
            const optionField = field('textarea', q.part === 'I' ? `Phương án ${'ABCD'[i]}` : `Ý ${'abcd'[i]}`, q.options[i] || '');
            optionField.rows = 2;
            optionField.addEventListener('input', () => { q.options[i] = optionField.value; });
            optionsGrid.append(optionField);
          }
          card.append(label(q.part === 'I' ? '4 phương án A, B, C, D' : '4 nhận định a, b, c, d'), optionsGrid);
        }
        if (q.part === 'I') {
          const bubbleRow = E('div', 'exam-omr-inline-row');
          bubbleRow.append(E('span', 'exam-omr-inline-label', 'Đáp án đúng:'));
          for (const choice of 'ABCD') {
            const b = button(choice, `exam-omr-bubble ${q.answer === choice ? 'is-selected' : ''}`, () => {
              q.answer = choice;
              renderQuestionEditors();
            });
            bubbleRow.append(b);
          }
          card.append(bubbleRow);
        } else if (q.part === 'II') {
          const keyGrid = E('div', 'exam-author-options');
          for (let i = 0; i < 4; i++) {
            const tfBox = E('div', 'exam-omr-tf-inline');
            tfBox.append(E('strong', '', `Ý ${'abcd'[i]}:`));
            const btnT = button('Đúng', `exam-omr-tf-btn ${q.answer?.[i] === true ? 'is-true' : ''}`, () => {
              q.answer[i] = true; renderQuestionEditors();
            });
            const btnF = button('Sai', `exam-omr-tf-btn ${q.answer?.[i] === false ? 'is-false' : ''}`, () => {
              q.answer[i] = false; renderQuestionEditors();
            });
            tfBox.append(btnT, btnF);
            keyGrid.append(tfBox);
          }
          card.append(label('Đáp án Đúng / Sai'), keyGrid);
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
          try { const imported = JSON.parse(area.value); if (!Array.isArray(imported)) throw Error('Dữ liệu phải là một mảng JSON.'); data = imported.map(q => ({ ...q, image: imageDataURL(q.image), latex: typeof q.latex === 'string' ? q.latex : '', options: Array.isArray(q.options) ? q.options : ['', '', '', ''] })); renderQuestionEditors(); message.textContent = 'Đã nạp câu hỏi.'; }
          catch (error) { message.textContent = error.message || String(error); }
        }); details.append(summary, area, importBtn); content.insertBefore(details, questions);
      }
      details.open = !details.open;
    }));

    const actions = E('div', 'exam-tabs');
    actions.append(
      button('Lưu & Mở phòng thi ngay →', 'primary-btn', async () => {
        try { await publishExam(data, sourceEmbedUrl, sourceOpenUrl); }
        catch (error) { message.textContent = error.message || String(error); }
      }),
      button('Xuất PDF / In đề nhanh', 'exam-tab', () => {
        try {
          if (!data.length) throw Error('Thêm ít nhất một câu trước khi xuất PDF.');
          exportExamPDF({ title: getTitle(), durationMinutes: getDuration(), questions: data }, includeAnswers.checked);
          message.textContent = 'Bản in đã mở. Chọn “Lưu dưới dạng PDF” để tải đề.';
        } catch (error) { message.textContent = error.message || String(error); }
      })
    );
    content.append(intro, addButtons, questions, includeKeyRow, actions);
    renderQuestionEditors();
  }

  function renderRoomCreator() {
    content.replaceChildren();

    // Bố cục chia đôi chuẩn Phòng thi: ĐỀ BÊN TRÁI — PHIẾU ĐÁP ÁN OMR TINH GỌN BÊN PHẢI
    const splitWrap = E('div', 'exam-split-workspace is-creator');

    // === CỘT TRÁI: TÀI LIỆU ĐỀ THI (PDF / GOOGLE DRIVE) ===
    const leftDocPane = E('section', 'exam-left-paper-pane exam-creator-doc-pane');
    const docHead = E('div', 'exam-pane-head');
    docHead.append(E('strong', '', 'ĐỀ THI BÊN TRÁI (GOOGLE DRIVE / DOCS / PDF)'), E('span', 'exam-pane-note', 'Dán link là hiện đề ngay bên dưới'));
    const sourceRow = E('div', 'exam-source-input-row');
    const sourceInput = field('url', 'Dán link chia sẻ tệp Google Drive / Google Docs / PDF (https://...)…', sourceOpenUrl || '');
    const previewButton = button('Xem đề', 'primary-btn', () => syncSourceLink({ strict: false }));
    sourceRow.append(sourceInput, previewButton);
    const drivePermHint = E('small', 'exam-drive-tip', 'Quan trọng: Trên Google Drive, hãy chọn Chia sẻ → “Bất kỳ ai có liên kết (Người xem)” để mọi học sinh vào thi đều hiện đề.');

    const openDocument = E('a', 'exam-link', 'Mở kiểm tra tài liệu ở tab mới ↗');
    openDocument.hidden = !sourceOpenUrl; openDocument.target = '_blank'; openDocument.rel = 'noopener noreferrer';
    if (sourceOpenUrl) openDocument.href = sourceOpenUrl;
    const sourceMessage = E('p', 'exam-message', '');
    const emptyDocHint = E('div', 'exam-creator-doc-placeholder');
    emptyDocHint.append(
      icon('exam-paper', 34),
      E('strong', '', 'Dán liên kết Google Drive / PDF để hiện đề tại đây'),
      E('p', '', 'Chỉ cần dán liên kết chia sẻ của tệp PDF hoặc Google Docs trên Google Drive vào ô phía trên, trang đề sẽ tự động hiển thị ngay ở khung bên trái này giống hệt lúc học sinh làm bài.')
    );
    emptyDocHint.hidden = Boolean(sourceEmbedUrl);

    const previewFrame = document.createElement('iframe');
    previewFrame.className = 'exam-source-document'; previewFrame.title = 'Bản xem trước tài liệu đề thi';
    previewFrame.loading = 'eager'; previewFrame.referrerPolicy = 'strict-origin-when-cross-origin';
    previewFrame.allow = 'autoplay'; previewFrame.allowFullscreen = true;
    previewFrame.hidden = !sourceEmbedUrl;
    if (sourceEmbedUrl) previewFrame.src = sourceEmbedUrl;

    let previewDebounce = null;
    function syncSourceLink({ strict = false } = {}) {
      const raw = sourceInput.value.trim();
      if (!raw) {
        sourceEmbedUrl = ''; sourceOpenUrl = '';
        previewFrame.hidden = true; openDocument.hidden = true; emptyDocHint.hidden = false;
        sourceMessage.textContent = '';
        sourceMessage.classList.remove('exam-error');
        return { embedUrl: '', openUrl: '' };
      }
      try {
        const resource = resolveResourceLink(raw);
        if (resource.type !== 'drive' && resource.type !== 'pdf') {
          throw Error('Phòng thi chỉ nhận liên kết tệp Google Drive / Google Docs hoặc đường dẫn file .pdf (HTTPS).');
        }
        sourceEmbedUrl = resource.embedUrl;
        sourceOpenUrl = resource.openUrl;
        if (previewFrame.src !== resource.embedUrl) previewFrame.src = resource.embedUrl;
        previewFrame.hidden = false; emptyDocHint.hidden = true;
        openDocument.href = resource.openUrl; openDocument.hidden = false;
        sourceMessage.textContent = '✓ Đã kết nối đề thi bên trái — học sinh vào phòng sẽ thấy đúng tài liệu này.';
        sourceMessage.classList.remove('exam-error');
        return { embedUrl: resource.embedUrl, openUrl: resource.openUrl };
      } catch (error) {
        sourceEmbedUrl = ''; sourceOpenUrl = '';
        previewFrame.hidden = true; openDocument.hidden = true; emptyDocHint.hidden = false;
        sourceMessage.textContent = error.message || String(error);
        sourceMessage.classList.add('exam-error');
        if (strict) throw error;
        return { embedUrl: '', openUrl: '' };
      }
    }
    sourceInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); syncSourceLink({ strict: false }); }
    });
    sourceInput.addEventListener('paste', () => {
      if (previewDebounce) clearTimeout(previewDebounce);
      previewDebounce = setTimeout(() => syncSourceLink({ strict: false }), 40);
    });
    sourceInput.addEventListener('input', () => {
      if (previewDebounce) clearTimeout(previewDebounce);
      previewDebounce = setTimeout(() => syncSourceLink({ strict: false }), 280);
    });
    sourceInput.addEventListener('change', () => syncSourceLink({ strict: false }));
    const docControls = E('div', 'exam-creator-doc-controls');
    docControls.append(sourceRow, drivePermHint, openDocument, sourceMessage);
    leftDocPane.append(docHead, docControls, emptyDocHint, previewFrame);

    // === CỘT PHẢI: PHIẾU ĐÁP ÁN OMR TINH GỌN, DỄ KHOANH ===
    const rightOmrPane = E('aside', 'exam-right-omr-pane');
    const omrSheet = E('section', 'exam-omr-sheet-card');
    const omrTop = E('div', 'exam-omr-card-head');
    const omrTitleRow = E('div', 'exam-omr-title-row');
    const totalLabel = E('span', 'exam-omr-sub', '22 câu');
    omrTitleRow.append(E('strong', '', 'PHIẾU ĐÁP ÁN MẪU'), totalLabel);

    const maxPerSection = MAX_EXAM_QUESTIONS;
    const existingCounts = Object.fromEntries(['I', 'II', 'III'].map(part => [part, data.filter(q => q.part === part).length]));
    const hasExisting = data.length > 0;
    const defaultCounts = hasExisting ? existingCounts : { I: 12, II: 4, III: 6 };

    const sectionDefs = [
      {
        part: 'I',
        title: 'PHẦN I · Trắc nghiệm A – D',
        shortTitle: 'Phần I (A–D)',
        placeholder: 'Dán nhanh: ABCD... hoặc 1A 2B 3C...',
        makeKey: () => ({ value: 'A' })
      },
      {
        part: 'II',
        title: 'PHẦN II · Đúng / Sai (a–d)',
        shortTitle: 'Phần II (Đ/S)',
        placeholder: 'Dán nhanh: ĐSĐS, ĐĐSS...',
        makeKey: () => ({ values: ['true', 'false', 'true', 'false'] })
      },
      {
        part: 'III',
        title: 'PHẦN III · Trả lời ngắn',
        shortTitle: 'Phần III (Số)',
        placeholder: 'Dán nhanh: 12,5; 0,25; 48...',
        makeKey: () => ({ value: '0' })
      }
    ];

    const sectionState = {};
    const countInputsRow = E('div', 'exam-count-inputs-grid');
    for (const section of sectionDefs) {
      const box = E('div', 'exam-count-box');
      box.append(E('label', '', section.shortTitle));
      const count = field('number', '0', String(defaultCounts[section.part] ?? 0));
      count.min = '0'; count.max = String(maxPerSection); count.step = '1';
      box.append(count);
      countInputsRow.append(box);
      sectionState[section.part] = { ...section, count, state: { keys: [] } };
    }

    if (hasExisting) {
      sectionState.I.state.keys = data.filter(q => q.part === 'I').map(q => ({ value: q.answer || 'A' }));
      sectionState.II.state.keys = data.filter(q => q.part === 'II').map(q => ({
        values: Array.isArray(q.answer) ? q.answer.map(v => v === false ? 'false' : 'true') : ['true', 'false', 'true', 'false']
      }));
      sectionState.III.state.keys = data.filter(q => q.part === 'III').map(q => ({ value: String(q.answer ?? '0') }));
    }

    const presetBtns = E('div', 'exam-preset-pills');
    const applyPreset = (iCount, iiCount, iiiCount) => {
      sectionState.I.count.value = String(iCount);
      sectionState.II.count.value = String(iiCount);
      sectionState.III.count.value = String(iiiCount);
      for (const s of sectionDefs) sectionState[s.part].renderKeys();
    };
    presetBtns.append(
      button('Chuẩn 2025 (12-4-6)', 'exam-preset-pill', () => applyPreset(12, 4, 6)),
      button('40 câu A–D', 'exam-preset-pill', () => applyPreset(40, 0, 0)),
      button('15 phút (15 câu)', 'exam-preset-pill', () => applyPreset(15, 0, 0)),
      button('20 A–D + 4 Đ/S', 'exam-preset-pill', () => applyPreset(20, 4, 0))
    );

    const totalError = E('p', 'exam-error');
    omrTop.append(omrTitleRow, presetBtns, countInputsRow, totalError);

    const sectionPanels = E('div', 'exam-omr-sheet-body');

    for (const section of sectionDefs) {
      const panelEl = E('div', 'exam-omr-run-section');
      const headerRow = E('div', 'exam-omr-run-sec-head');
      const titleEl = E('strong', '', section.title);
      const badgeEl = E('span', '', '0 câu');
      headerRow.append(titleEl, badgeEl);

      const quickBar = E('div', 'exam-omr-quick-bar');
      const quickInput = field('text', section.placeholder, '');
      const applyQuickBtn = button('Điền', 'exam-tab', () => {
        const raw = quickInput.value.trim();
        if (!raw) return;
        const currentKeys = sectionState[section.part].state.keys;
        if (section.part === 'I') {
          const pairs = [...raw.toUpperCase().matchAll(/(\d+)\s*[:.-]?\s*([ABCD])/g)];
          if (pairs.length) {
            for (const m of pairs) {
              const idx = Number(m[1]) - 1;
              if (currentKeys[idx]) currentKeys[idx].value = m[2];
            }
          } else {
            const letters = raw.toUpperCase().replace(/[^ABCD]/g, '');
            for (let i = 0; i < Math.min(letters.length, currentKeys.length); i++) {
              currentKeys[i].value = letters[i];
            }
          }
        } else if (section.part === 'II') {
          const tokens = raw.toUpperCase().split(/[,;\s]+/).filter(Boolean);
          tokens.forEach((tok, idx) => {
            if (!currentKeys[idx]) return;
            const chars = [...tok].filter(ch => 'ĐDSSTF10'.includes(ch));
            if (chars.length >= 4) {
              currentKeys[idx].values = chars.slice(0, 4).map(ch => ('ĐDT1'.includes(ch) ? 'true' : 'false'));
            }
          });
        } else {
          const nums = raw.split(/[;\n]+/).map(s => s.trim()).filter(Boolean);
          nums.forEach((val, idx) => {
            if (currentKeys[idx]) currentKeys[idx].value = val;
          });
        }
        renderKeys();
        message.textContent = `✓ Đã điền nhanh đáp án cho ${section.shortTitle}.`;
      });
      quickBar.append(quickInput, applyQuickBtn);

      const keyList = E('div', `exam-omr-run-list is-part-${section.part}`);
      panelEl.append(headerRow, quickBar, keyList);

      const oldState = sectionState[section.part].state;
      const renderKeys = () => {
        const amount = Number(sectionState[section.part].count.value);
        if (!Number.isInteger(amount) || amount < 0 || amount > maxPerSection) {
          badgeEl.textContent = 'Lỗi';
          keyList.replaceChildren(E('p', 'exam-error', `Từ 0 đến ${maxPerSection} câu.`));
          refreshTotal(); return;
        }
        badgeEl.textContent = `${amount} câu`;
        panelEl.hidden = amount === 0;

        const previous = oldState.keys;
        oldState.keys = Array.from({ length: amount }, (_, i) => previous[i] || section.makeKey());
        keyList.replaceChildren();
        if (amount === 0) {
          refreshTotal();
          return;
        }

        const fragment = document.createDocumentFragment();
        oldState.keys.forEach((key, index) => {
          const qLabel = String(index + 1).padStart(2, '0');
          if (section.part === 'I') {
            const row = E('div', 'exam-omr-row is-answered');
            row.append(E('span', 'exam-omr-qjump is-static', qLabel));
            const bubbles = E('div', 'exam-omr-bubbles');
            for (const choice of 'ABCD') {
              const b = button(choice, `exam-omr-bubble ${key.value === choice ? 'is-selected' : ''}`, () => {
                key.value = choice;
                for (const child of bubbles.children) child.classList.toggle('is-selected', child.textContent === choice);
              });
              bubbles.append(b);
            }
            row.append(bubbles);
            fragment.append(row);
          } else if (section.part === 'II') {
            const card = E('div', 'exam-omr-tf-card is-answered');
            const head = E('div', 'exam-omr-tf-head');
            head.append(E('span', 'exam-omr-qjump is-static', `Câu ${qLabel}`));
            const tfList = E('div', 'exam-omr-tf-list');
            for (let i = 0; i < 4; i++) {
              const itemRow = E('div', 'exam-omr-tf-row');
              itemRow.append(E('small', '', `${'abcd'[i]})`));
              const pair = E('div', 'exam-omr-tf-pair');
              const isTrue = key.values?.[i] !== 'false';
              const btnD = button('Đ', `exam-omr-mini-tf ${isTrue ? 'is-true' : ''}`, () => {
                key.values[i] = 'true';
                btnD.classList.add('is-true');
                btnS.classList.remove('is-false');
              });
              const btnS = button('S', `exam-omr-mini-tf ${!isTrue ? 'is-false' : ''}`, () => {
                key.values[i] = 'false';
                btnS.classList.add('is-false');
                btnD.classList.remove('is-true');
              });
              pair.append(btnD, btnS);
              itemRow.append(pair);
              tfList.append(itemRow);
            }
            card.append(head, tfList);
            fragment.append(card);
          } else {
            const row = E('div', 'exam-omr-row is-short is-answered');
            row.append(E('span', 'exam-omr-qjump is-static', `Câu ${qLabel}`));
            const input = field('text', 'Đáp số…', key.value ?? '0');
            input.className = 'exam-input exam-omr-short-input';
            input.addEventListener('input', () => { key.value = input.value; });
            row.append(input);
            fragment.append(row);
          }
        });
        keyList.append(fragment);
        refreshTotal();
      };

      sectionState[section.part].renderKeys = renderKeys;
      sectionState[section.part].count.addEventListener('change', renderKeys);
      sectionState[section.part].count.addEventListener('input', renderKeys);
      sectionPanels.append(panelEl);
    }

    const footerActions = E('div', 'exam-omr-sheet-footer');
    const createRoomBtn = button('Tạo phòng thi ngay', 'primary-btn exam-omr-submit-btn', createRoomNow);
    footerActions.append(createRoomBtn);

    function selectedCounts() {
      return Object.fromEntries(sectionDefs.map(({ part }) => [part, Number(sectionState[part].count.value)]));
    }
    function refreshTotal() {
      const counts = selectedCounts();
      const validEach = Object.values(counts).every(value => Number.isInteger(value) && value >= 0 && value <= maxPerSection);
      const sum = validEach ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
      totalLabel.textContent = `Tổng ${sum} câu (${counts.I || 0} · ${counts.II || 0} · ${counts.III || 0})`;
      totalError.textContent = !validEach
        ? `Số câu mỗi phần từ 0 đến ${maxPerSection}.`
        : sum > maxPerSection
          ? `Tối đa ${maxPerSection} câu.`
          : sum < 1
            ? 'Chọn ít nhất 1 câu.'
            : '';
      createRoomBtn.disabled = Boolean(totalError.textContent);
    }

    for (const section of sectionDefs) sectionState[section.part].renderKeys();

    function collectRoomQuestions() {
      const counts = selectedCounts();
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (Object.values(counts).some(value => !Number.isInteger(value) || value < 0 || value > maxPerSection)) {
        throw Error(`Mỗi phần phải từ 0 đến ${maxPerSection} câu.`);
      }
      if (total < 1) throw Error('Hãy chọn ít nhất 1 câu cho đề thi.');
      if (total > maxPerSection) throw Error(`Tổng số câu tối đa là ${maxPerSection}.`);

      const questions = [];
      let ordinal = 1;
      const existingByPart = {
        I: data.filter(q => q.part === 'I'),
        II: data.filter(q => q.part === 'II'),
        III: data.filter(q => q.part === 'III'),
      };

      const partI = sectionState.I.state.keys.slice(0, counts.I);
      if (partI.some(key => !/^[ABCD]$/.test(key.value || ''))) throw Error('Phần I: hãy chọn đáp án A–D cho tất cả câu.');
      partI.forEach((key, idx) => {
        const srcQ = existingByPart.I[idx];
        questions.push({
          part: 'I',
          prompt: srcQ?.prompt || `Câu ${ordinal}`,
          image: srcQ?.image || '',
          options: Array.isArray(srcQ?.options) && srcQ.options.some(Boolean) ? srcQ.options : ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
          answer: key.value
        });
        ordinal++;
      });

      const partII = sectionState.II.state.keys.slice(0, counts.II);
      if (partII.some(key => !Array.isArray(key.values) || key.values.some(value => value !== 'true' && value !== 'false'))) {
        throw Error('Phần II: hãy chọn Đúng/Sai đủ 4 ý cho tất cả câu.');
      }
      partII.forEach((key, idx) => {
        const srcQ = existingByPart.II[idx];
        questions.push({
          part: 'II',
          prompt: srcQ?.prompt || `Câu ${ordinal}`,
          image: srcQ?.image || '',
          options: Array.isArray(srcQ?.options) && srcQ.options.some(Boolean) ? srcQ.options : ['Nhận định a', 'Nhận định b', 'Nhận định c', 'Nhận định d'],
          answer: key.values.map(value => value === 'true')
        });
        ordinal++;
      });

      const partIII = sectionState.III.state.keys.slice(0, counts.III);
      if (partIII.some(key => !String(key.value ?? '').trim())) throw Error('Phần III: hãy nhập đáp số cho tất cả câu.');
      partIII.forEach((key, idx) => {
        const srcQ = existingByPart.III[idx];
        questions.push({
          part: 'III',
          prompt: srcQ?.prompt || `Câu ${ordinal}`,
          image: srcQ?.image || '',
          answer: String(key.value).trim(),
          tolerance: srcQ?.tolerance ?? 0.01
        });
        ordinal++;
      });

      return questions;
    }

    async function createRoomNow() {
      try {
        totalError.textContent = '';
        const { embedUrl, openUrl } = syncSourceLink({ strict: true });
        if (!embedUrl) {
          const okWithoutDoc = confirm('Bạn chưa dán link đề Google Drive / PDF ở khung bên trái.\n\nNếu tiếp tục, học sinh vào phòng sẽ KHÔNG thấy tờ đề trên màn hình (chỉ có Phiếu OMR bên phải cho đề phát giấy).\n\nNhấn Cancel (Hủy) để dán link đề trước, hoặc OK nếu chỉ muốn phát Phiếu OMR.');
          if (!okWithoutDoc) {
            sourceInput.focus();
            return;
          }
        }
        const questions = collectRoomQuestions();
        await publishExam(questions, embedUrl, openUrl);
      } catch (error) {
        const errMsg = error.message || String(error);
        totalError.textContent = errMsg;
        message.textContent = errMsg;
      }
    }

    omrSheet.append(omrTop, sectionPanels, footerActions);
    rightOmrPane.append(omrSheet);
    splitWrap.append(leftDocPane, rightOmrPane);
    content.append(splitWrap);
    refreshTotal();
  }

  switchMode(data.length ? 'author' : 'room');
}
