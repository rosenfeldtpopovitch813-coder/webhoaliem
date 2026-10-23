import { element, button } from '../../core/dom.js';
import { AppStore } from '../../core/store.js';
import { auth } from '../../core/firebase.js';
import katex from 'katex';
const E = element;
function escapeHTML(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// Render only explicit math delimiters; every surrounding string is HTML-escaped.
function richMathHTML(value) {
  const source = String(value ?? '');
  const pattern = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g;
  let html = '', cursor = 0, match;
  while ((match = pattern.exec(source))) {
    html += escapeHTML(source.slice(cursor, match.index)).replace(/\n/g, '<br>');
    const tex = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
    const displayMode = match[1] !== undefined || match[2] !== undefined;
    try { html += katex.renderToString(tex, { displayMode, throwOnError: false, trust: false, strict: 'ignore' }); }
    catch { html += escapeHTML(match[0]); }
    cursor = match.index + match[0].length;
  }
  html += escapeHTML(source.slice(cursor)).replace(/\n/g, '<br>');
  return html;
}
function setRichText(node, value) { node.innerHTML = richMathHTML(value); }
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
    let extra = '';
    if (q.part === 'I' || q.part === 'II') extra = `<ol class="options" type="${q.part === 'I' ? 'A' : 'a'}">${(q.options || []).map(option => `<li>${richMathHTML(option)}</li>`).join('')}</ol>`;
    return `<article class="question"><h3>Câu ${index + 1}. <small>Phần ${escapeHTML(q.part)}</small></h3><div class="prompt">${prompt}</div>${formula}${extra}</article>`;
  }).join('');
  const answerKey = includeAnswers ? `<section class="answer-key"><h2>ĐÁP ÁN</h2><ol>${questions.map(q => `<li>${q.part === 'II' ? (q.answer || []).map(v => v ? 'Đ' : 'S').join(' – ') : escapeHTML(Array.isArray(q.answer) ? q.answer.join(', ') : q.answer)}</li>`).join('')}</ol></section>` : '';
  const win = window.open('', '_blank');
  if (!win) throw Error('Trình duyệt đang chặn cửa sổ xuất PDF. Hãy cho phép popup của website rồi thử lại.');
  win.document.open();
  win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<title>${pageTitle}</title><style>
    @page{size:A4;margin:17mm 16mm 18mm}*{box-sizing:border-box}body{font-family:Arial,"DejaVu Sans",sans-serif;color:#171b23;font-size:11pt;line-height:1.55;margin:0}.paper-head{text-align:center;margin:0 0 24px;padding-bottom:15px;border-bottom:1px solid #aab2bf}.paper-head .eyebrow{font-size:9pt;letter-spacing:.12em;color:#596579;font-weight:700}.paper-head h1{font-size:18pt;margin:8px 0}.paper-head p{margin:4px 0;color:#4d5867}.question{break-inside:avoid;page-break-inside:avoid;margin:0 0 19px}.question h3{font-size:11pt;margin:0 0 6px}.question h3 small{font-weight:400;color:#596579}.prompt{white-space:normal;overflow-wrap:anywhere}.question-latex{margin:8px 0 12px;overflow-x:auto}.options{margin:8px 0 0 28px;padding-left:10px}.options li{margin:4px 0;padding-left:4px}.answer-key{break-before:page;page-break-before:always;border-top:2px solid #536071;padding-top:14px}.answer-key h2{text-align:center}.answer-key li{margin:7px 0}.katex-display{overflow-x:auto;overflow-y:hidden}@media screen{body{max-width:800px;margin:30px auto;padding:24px;border:1px solid #dbe1e8;border-radius:12px}.print-tip{background:#eef5ff;padding:10px;border-radius:8px;margin:15px 0;color:#24496b}}@media print{.print-tip{display:none}}
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
  try { localStorage.setItem(draftKey(uid, id), JSON.stringify({ id, answers: cloneAnswers(draftAnswers), flaggedQuestions: Array.isArray(flaggedQuestions) ? [...new Set(flaggedQuestions.filter(x => typeof x === 'string'))].slice(0, 60) : [], savedAt: Date.now() })); return true; }
  catch { return false; }
}
function removeLocalDraft(uid, id) { try { localStorage.removeItem(draftKey(uid, id)); } catch {} }
function answeredCount(value) {
  return Object.values(value || {}).filter(answer => answer !== null && answer !== undefined && answer !== '' && !(Array.isArray(answer) && answer.every(x => x === null || x === undefined))).length;
}
export function renderExam() {
  clearTimer();
  const wrap = E('div', 'exam-root');

  // The donated 3D scene is mounted as decorative artwork inside this page.
  // All exam actions below continue through HTVVM's authenticated API/Firebase flow.
  const showcase = E('section', 'exam-showcase');
  const scene = document.createElement('iframe');
  scene.className = 'exam-showcase-scene';
  scene.src = '/exam-visual/scene.html?blades=60000';
  scene.title = 'Phông nền 3D trang trí của Phòng thi HTVVM';
  scene.setAttribute('aria-hidden', 'true');
  scene.tabIndex = -1;
  scene.loading = 'eager';
  scene.referrerPolicy = 'no-referrer';
  scene.setAttribute('scrolling', 'no');
  showcase.append(scene, E('div', 'exam-showcase-shade'));

  const copy = E('div', 'exam-showcase-copy');
  copy.append(
    E('div', 'exam-showcase-eyebrow', 'HTVVM STUDIO · HỆ THỐNG KHẢO THÍ'),
    E('h2', 'exam-showcase-title', 'Một phòng thi. Mọi kết quả được lưu tập trung.'),
    E('p', 'exam-showcase-subtitle', 'Giao diện không gian 3D từ source bạn tặng nay trở thành phần mở đầu của Phòng thi HTVVM. Đề thi, đồng hồ, tự lưu, chấm điểm và lịch sử đều dùng cùng một hệ thống.'),
  );
  const trust = E('div', 'exam-showcase-trust');
  for (const [symbol, text] of [
    ['↻', 'Tự lưu & khôi phục'],
    ['✓', 'Chấm điểm trên máy chủ'],
    ['◷', 'Lịch sử thi tập trung']
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
      const promptNode = E('p', 'exam-question-prompt'); setRichText(promptNode, q.prompt);
      item.append(top, promptNode);
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
          setRichText(b, `${choice}. ${opt}`); b.classList.toggle('selected', answers[q.id] === choice); options.append(b);
        });
        item.append(options);
      } else if (q.part === 'II') {
        q.options.forEach((opt, i) => {
          const row = E('div', 'exam-tf'); const statement = E('span', ''); setRichText(statement, `${'abcd'[i]}) ${opt}`); row.append(statement);
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
    p.append(description, timer, status, tools, progressTrack, mapHeading, questionMap, questionList, submitButton);
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
  if (!AppStore.get('user')) return showError(host, Error('Đăng nhập Google để lưu đề thi vào kho dùng chung.'));
  const p = panel('Creator Studio · Biên soạn đề bằng LaTeX');
  const title = field('text', 'Ví dụ: Đề luyện thi Hóa 12 - số 01');
  const duration = field('number', 'Thời gian (phút)', '50'); duration.min = '5'; duration.max = '240'; duration.step = '1';
  const questions = E('div', 'exam-editor'); let data = [];
  const keyLabel = E('label', 'exam-pdf-key-label'); const includeAnswers = document.createElement('input'); includeAnswers.type = 'checkbox';
  keyLabel.append(includeAnswers, document.createTextNode(' Kèm đáp án ở trang cuối của PDF'));
  const help = E('p', 'exam-message', 'Nhập LaTeX trực tiếp trong nội dung: $\\frac{a}{b}$, \\(x^2\\), hoặc $$\\int_a^b f(x)\\,dx$$. Có thể dùng ô LaTeX riêng để hiển thị công thức lớn.');
  const previewNote = E('p', 'exam-message', 'Xem trước được dựng bằng KaTeX. Xuất PDF sẽ mở hộp thoại in của trình duyệt; chọn “Lưu dưới dạng PDF”.');
  const renderEditors = () => {
    questions.replaceChildren();
    data.forEach((q, idx) => {
      q.options = Array.isArray(q.options) ? q.options : ['', '', '', ''];
      const card = E('div', 'exam-question');
      card.append(E('strong', '', `Câu ${idx + 1} · Phần ${q.part}`));
      const prompt = field('textarea', 'Nội dung câu hỏi — dùng $...$ hoặc \\(...\\) cho công thức', q.prompt || ''); prompt.classList.add('exam-latex-field');
      const promptPreview = E('div', 'exam-latex-preview');
      const formulaLabel = label('Công thức LaTeX riêng (không bắt buộc)');
      const formula = field('textarea', 'Ví dụ: \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', q.latex || ''); formula.classList.add('exam-latex-field');
      const formulaPreview = E('div', 'exam-latex-preview display');
      const updatePromptPreview = () => { promptPreview.innerHTML = richMathHTML(prompt.value || 'Nội dung xem trước sẽ hiện tại đây.'); };
      const updateFormulaPreview = () => { formulaPreview.innerHTML = formula.value.trim() ? renderDedicatedLatex(formula.value) : '<span class="exam-message">Công thức lớn sẽ hiện tại đây.</span>'; };
      prompt.oninput = () => { q.prompt = prompt.value; updatePromptPreview(); };
      formula.oninput = () => { q.latex = formula.value; updateFormulaPreview(); };
      updatePromptPreview(); updateFormulaPreview();
      card.append(label('Nội dung câu hỏi'), prompt, promptPreview, formulaLabel, formula, formulaPreview);
      if (q.part === 'I' || q.part === 'II') {
        for (let i = 0; i < 4; i++) {
          const text = field('text', `${q.part === 'I' ? 'Lựa chọn' : 'Nhận định'} ${'ABCD'[i]} (có thể dùng $...$)`, q.options[i] || '');
          text.oninput = () => q.options[i] = text.value;
          card.append(text);
        }
      }
      if (q.part === 'I') {
        const answer = E('select', 'exam-input');
        for (const c of 'ABCD') { const op = E('option', '', `Đáp án ${c}`); op.value = c; answer.append(op); }
        answer.value = q.answer || 'A'; answer.onchange = () => q.answer = answer.value; card.append(label('Đáp án đúng'), answer);
      } else if (q.part === 'II') {
        for (let i = 0; i < 4; i++) {
          const row = E('div', 'exam-tf'); row.append(E('span', '', `Ý ${'abcd'[i]}`));
          const sel = E('select', 'exam-input');
          for (const [v, name] of [['true', 'Đúng'], ['false', 'Sai']]) { const op = E('option', '', name); op.value = v; sel.append(op); }
          sel.value = String(Array.isArray(q.answer) ? q.answer[i] : true); sel.onchange = () => { q.answer[i] = sel.value === 'true'; }; row.append(sel); card.append(row);
        }
      } else {
        const answer = field('text', 'Đáp án số', q.answer ?? ''); answer.oninput = () => q.answer = answer.value; card.append(label('Đáp án số'), answer);
        const tolerance = field('number', 'Sai số cho phép (mặc định 0,0001)', String(q.tolerance ?? 0.0001)); tolerance.step = 'any'; tolerance.min = '0'; tolerance.max = '1'; tolerance.oninput = () => q.tolerance = Number(tolerance.value); card.append(label('Sai số cho phép'), tolerance);
      }
      const deleteButton = button('Xóa câu', 'exam-tab', () => { data.splice(idx, 1); renderEditors(); });
      card.append(deleteButton); questions.append(card);
    });
  };
  const buttons = E('div', 'exam-tabs');
  for (const part of ['I', 'II', 'III']) buttons.append(button(`+ Câu phần ${part}`, 'exam-tab', () => {
    data.push({ part, prompt: '', latex: '', ...(part === 'III' ? { answer: '', tolerance: 0.0001 } : { options: ['', '', '', ''], answer: part === 'I' ? 'A' : [true, true, true, true] }) }); renderEditors();
  }));
  const importArea = field('textarea', 'Dán JSON: [{"part":"I","prompt":"Cho $x^2=4$...","latex":"\\frac{a}{b}","options":["..."],"answer":"A"}]');
  const importButton = button('Nạp JSON', 'exam-tab', () => {
    try {
      const imported = JSON.parse(importArea.value);
      if (!Array.isArray(imported)) throw Error('Cần mảng JSON.');
      data = imported.map(q => ({ ...q, latex: typeof q.latex === 'string' ? q.latex : '', options: Array.isArray(q.options) ? q.options : ['', '', '', ''] })); renderEditors();
    } catch (e) { alert(e.message); }
  });
  p.append(label('Tên đề thi'), title, label('Thời gian làm bài (5–240 phút)'), duration, help, buttons, questions,
    E('h4', '', 'Nhập nhanh câu hỏi bằng JSON'), importArea, importButton, keyLabel, previewNote);
  const message = E('p', 'exam-message');
  const bottomActions = E('div', 'exam-tabs');
  bottomActions.append(button('Xuất PDF / In đề', 'exam-tab', () => {
    try {
      if (data.length < 1) throw Error('Thêm ít nhất một câu trước khi xuất PDF.');
      if (!title.value.trim()) throw Error('Nhập tên đề trước khi xuất PDF.');
      const minutes = Number(duration.value);
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240) throw Error('Thời gian phải từ 5 đến 240 phút.');
      exportExamPDF({ title: title.value.trim(), durationMinutes: minutes, questions: data }, includeAnswers.checked);
      message.textContent = 'Đã mở bản in. Trong hộp thoại, chọn “Lưu dưới dạng PDF”.';
    } catch (e) { message.textContent = e.message || String(e); }
  }));
  bottomActions.append(button('Xuất bản đề thi', 'primary-btn', async () => {
    message.textContent = 'Đang lưu đề...';
    try {
      const response = await api('create', { title: title.value, durationMinutes: Number(duration.value), questions: data });
      message.textContent = `Đã tạo đề! Mã phòng: ${response.exam.id}`;
      const link = E('a', 'exam-link', `Vào phòng thi: ${response.exam.id}`); link.href = '/exam';
      link.onclick = event => { event.preventDefault(); begin(host, response.exam.id); }; p.append(link);
    } catch (e) { message.textContent = e.message; }
  }));
  p.append(bottomActions, message); host.replaceChildren(p);
}
