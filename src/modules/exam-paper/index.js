import { element, button } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { navigate } from '../../core/router.js';
import { parseDocxExam, parseTextExam } from '../../lib/exam-import/docx-parser.js';
import { parsePdfExam } from '../../lib/exam-import/pdf-parser.js';
import { generateExamVariants } from '../../lib/exam-import/exam-shuffler.js';
import { buildShuffledExamZipBytes } from '../../lib/exam-import/docx-exporter.js';
import { generateOmrSvg } from '../../lib/exam-import/omr-svg.js';
import { renderExamText } from '../../lib/exam-import/math-render.js';

let stagedImportFile = null;
let preferImportTab = false;

export function stagePendingExamImportFile(file) {
  stagedImportFile = file || null;
  preferImportTab = true;
}

export function openSmartImportMode() {
  preferImportTab = true;
}

const SAMPLE_CHEM_EXAM = `ĐỀ THI THỬ TỐT NGHIỆP THPT 2025 — MÔN HÓA HỌC 12
PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn
Câu 1. Thủy phân hoàn toàn este $\\ce{CH3COOC2H5}$ trong dung dịch $\\ce{NaOH}$ đun nóng thu được muối và ancol nào sau đây?
A. $\\ce{CH3COOH}$ và $\\ce{C2H5OH}$
*B. $\\ce{CH3COONa}$ và $\\ce{C2H5OH}$
C. $\\ce{HCOONa}$ và $\\ce{CH3OH}$
D. $\\ce{C2H5COONa}$ và $\\ce{CH3OH}$
Lời giải: Phản ứng xà phòng hóa: $\\ce{CH3COOC2H5 + NaOH ->[t^o] CH3COONa + C2H5OH}$.

Câu 2. Chất béo tristearin có công thức phân tử thu gọn là:
A. $\\ce{(C17H33COO)3C3H5}$
B. $\\ce{(C15H31COO)3C3H5}$
*C. $\\ce{(C17H35COO)3C3H5}$
D. $\\ce{(C17H31COO)3C3H5}$

PHẦN II. Câu trắc nghiệm đúng sai
Câu 3. Cho phản ứng este hóa: $\\ce{CH3COOH + C2H5OH <=>[H2SO4 đặc, t°] CH3COOC2H5 + H2O}$.
*a) Phản ứng trên là phản ứng thuận nghịch.
b) Axit $\\ce{H2SO4}$ loãng có thể thay thế hoàn toàn $\\ce{H2SO4}$ đặc mà không giảm hiệu suất.
*c) Sản phẩm hữu cơ thu được có mùi thơm đặc trưng (etyl axetat).
d) Nguyên tử oxi trong phân tử $\\ce{H2O}$ tách ra từ nhóm $\\ce{-OH}$ của ancol.

PHẦN III. Câu trắc nghiệm trả lời ngắn
Câu 4. Đốt cháy hoàn toàn $0,1\\text{ mol}$ etyl axetat ($\\ce{C4H8O2}$) thu được bao nhiêu mol $\\ce{CO2}$?
Đáp án: 0,4
`;

function toExamRoomPayload(parsed) {
  return (parsed?.questions || []).map((q) => {
    const img = Array.isArray(q.images) && q.images[0] ? q.images[0] : (q.image || '');
    if (q.part === 'I') {
      return {
        part: 'I',
        prompt: q.prompt || '',
        image: img,
        options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['A', 'B', 'C', 'D'],
        answer: /^[ABCD]$/.test(String(q.answer || '').toUpperCase()) ? String(q.answer).toUpperCase() : 'A'
      };
    }
    if (q.part === 'II') {
      const rawAns = Array.isArray(q.answer) ? q.answer : [true, false, true, false];
      return {
        part: 'II',
        prompt: q.prompt || '',
        image: img,
        options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Ý a', 'Ý b', 'Ý c', 'Ý d'],
        answer: [0, 1, 2, 3].map((i) => rawAns[i] === true)
      };
    }
    return {
      part: 'III',
      prompt: q.prompt || '',
      image: img,
      answer: String(q.answer ?? '0').trim() || '0',
      tolerance: 0.01
    };
  });
}

function triggerDownload(bytesOrText, fileName, mimeType) {
  const blob = new Blob([bytesOrText], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function renderExamPaperApp() {
  const wrap = element('section', 'standalone-suite-wrap');
  const bar = element('div', 'standalone-suite-bar');
  const leftBar = element('div', 'standalone-suite-left');
  const info = element('span', 'standalone-suite-caption');
  info.append(icon('exam-paper', 15), document.createTextNode(' Soạn đề — Soạn thảo trang A4, tách công thức từ Word/PDF & trộn đa mã đề THPT 2025.'));

  const modeTabs = element('div', 'suite-mode-tabs');
  const btnEditor = button('Soạn thảo A4 trực tiếp', 'suite-mode-tab is-active', () => setMode('editor'));
  const btnImport = button('Tách & Trộn đề .DOCX / .PDF', 'suite-mode-tab', () => setMode('import'));
  modeTabs.append(btnEditor, btnImport);
  leftBar.append(info, modeTabs);

  const actions = element('div', 'standalone-suite-actions');

  const iframe = document.createElement('iframe');
  iframe.className = 'standalone-suite-iframe';
  iframe.src = '/focus-notes/index.html?app=exam';
  iframe.title = 'Trình soạn đề';
  iframe.allow = 'clipboard-read; clipboard-write; fullscreen';
  iframe.allowFullscreen = true;

  const fullBtn = button('', 'focus-btn is-sm', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await iframe.requestFullscreen();
    } catch {
      window.open('/focus-notes/index.html?app=exam', '_blank', 'noopener,noreferrer');
    }
  });
  fullBtn.append(icon('maximize', 14), document.createTextNode(' Toàn màn hình'));
  const tabBtn = button('', 'focus-btn is-sm', () => {
    window.open('/focus-notes/index.html?app=exam', '_blank', 'noopener,noreferrer');
  });
  tabBtn.append(icon('external', 14), document.createTextNode(' Mở tab riêng'));

  actions.append(fullBtn, tabBtn);
  bar.append(leftBar, actions);

  // --- PANEL TÁCH & TRỘN ĐỀ .DOCX / .PDF ---
  const importPane = element('div', 'smart-exam-studio');
  importPane.hidden = true;

  let currentExam = null;
  const topGrid = element('div', 'smart-exam-grid');

  const dropCard = element('div', 'smart-exam-card');
  const dropZone = element('label', 'smart-dropzone');
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  fileInput.hidden = true;

  const dropIcon = element('span', 'smart-drop-icon');
  dropIcon.append(icon('upload', 22));
  dropZone.append(
    fileInput,
    dropIcon,
    element('strong', '', 'Kéo thả hoặc chọn tệp đề .DOCX / .PDF từ máy'),
    element('span', 'focus-muted', 'Tự động nhận diện Phần I, II, III · Công thức Word Equation (OMML) & LaTeX · Chỉ số dưới Hóa học · Hình vẽ minh họa')
  );

  const sampleRow = element('div', 'smart-sample-row');
  const statusLine = element('span', 'smart-status-line', 'Sẵn sàng đọc tệp .docx hoặc .pdf trực tiếp trên trình duyệt.');
  const sampleBtn = button('Nạp đề mẫu Hóa 12 (2025)', 'focus-btn is-sm', () => {
    currentExam = parseTextExam(SAMPLE_CHEM_EXAM, 'Đề thi thử Hóa 12 — Este & Lipit');
    statusLine.textContent = `✓ Đã nạp đề mẫu (${currentExam.questions.length} câu).`;
    renderParsedPreview();
  });
  sampleRow.append(statusLine, sampleBtn);
  dropCard.append(dropZone, sampleRow);

  const toolsCard = element('div', 'smart-exam-card smart-tools-card');
  toolsCard.append(
    element('strong', '', 'Trộn mã đề, Xuất Word (.ZIP) & Phiếu OMR 2025'),
    element('p', 'focus-muted', 'Giữ nguyên cấu trúc 3 phần THPT 2025, tự khóa phương án "Cả A và B" và ánh xạ bảng đáp án.')
  );
  const shuffleControls = element('div', 'smart-shuffle-controls');
  const codeCountInput = document.createElement('input');
  codeCountInput.type = 'number';
  codeCountInput.className = 'exam-input';
  codeCountInput.min = '1';
  codeCountInput.max = '12';
  codeCountInput.value = '4';
  codeCountInput.style.width = '78px';
  const countField = element('label', 'smart-inline-label');
  countField.append(document.createTextNode('Số mã đề: '), codeCountInput);

  const downloadZipBtn = button('Trộn & Tải gói .ZIP (.docx + CSV)', 'focus-btn is-sm', () => {
    if (!currentExam?.questions?.length) {
      statusLine.textContent = 'Hãy tải lên tệp đề .docx/.pdf hoặc nạp đề mẫu trước khi trộn.';
      return;
    }
    const count = Math.max(1, Math.min(12, Number(codeCountInput.value) || 4));
    const { variants } = generateExamVariants(currentExam, { count, startCode: 101 });
    const zipBytes = buildShuffledExamZipBytes(variants, { includeTeacherDocs: true });
    triggerDownload(zipBytes, `tron-${count}-ma-de-htvvm.zip`, 'application/zip');
    statusLine.textContent = `✓ Đã trộn ${count} mã đề (${variants.map(v => v.code).join(', ')}) và tải xuống gói .ZIP.`;
  });

  const omrBtn = button('Phiếu tô OMR 2025 (SVG/In)', 'focus-btn is-sm', () => {
    const p1 = currentExam ? currentExam.questions.filter(q => q.part === 'I').length || 18 : 18;
    const p2 = currentExam ? currentExam.questions.filter(q => q.part === 'II').length || 4 : 4;
    const p3 = currentExam ? currentExam.questions.filter(q => q.part === 'III').length || 6 : 6;
    const svg = generateOmrSvg({
      title: currentExam?.title || 'PHIẾU TRẢ LỜI TRẮC NGHIỆM THPT 2025',
      subject: 'Hóa học — Toán',
      part1Count: p1,
      part2Count: p2,
      part3Count: p3
    });
    omrPreviewSlot.hidden = false;
    omrPreviewSlot.innerHTML = svg;
    omrPreviewSlot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  const pushRoomBtn = button('Đưa sang tạo Phòng thi OMR →', 'primary-btn', () => {
    if (!currentExam?.questions?.length) {
      statusLine.textContent = 'Chưa có câu hỏi nào để chuyển sang Phòng thi.';
      return;
    }
    try {
      localStorage.setItem('htvvm_pending_exam_paper', JSON.stringify({
        title: currentExam.title || 'Đề thi nhập từ tệp',
        questions: toExamRoomPayload(currentExam),
        exportedAt: Date.now()
      }));
    } catch {}
    navigate('/exam');
  });

  shuffleControls.append(countField, downloadZipBtn, omrBtn, pushRoomBtn);
  toolsCard.append(shuffleControls);
  topGrid.append(dropCard, toolsCard);

  const omrPreviewSlot = element('div', 'smart-omr-preview');
  omrPreviewSlot.hidden = true;
  const previewList = element('div', 'smart-question-list');

  importPane.append(topGrid, omrPreviewSlot, previewList);
  wrap.append(bar, iframe, importPane);

  async function handleExamFile(file) {
    if (!file) return;
    const lower = String(file.name || '').toLowerCase();
    statusLine.textContent = `Đang phân tích tệp "${file.name}"…`;
    omrPreviewSlot.hidden = true;
    try {
      const buf = await file.arrayBuffer();
      if (lower.endsWith('.docx')) {
        currentExam = await parseDocxExam(buf, file.name);
      } else if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
        currentExam = await parsePdfExam(buf, file.name);
      } else {
        throw new Error('Vui lòng chọn tệp định dạng .docx hoặc .pdf.');
      }
      statusLine.textContent = `✓ Đã tách ${currentExam.questions.length} câu hỏi (${currentExam.stats.partI} câu P.I · ${currentExam.stats.partII} câu P.II · ${currentExam.stats.partIII} câu P.III · ${currentExam.extractedMediaCount || 0} hình).`;
      renderParsedPreview();
    } catch (err) {
      statusLine.textContent = `Lỗi đọc tệp: ${err?.message || err}`;
    }
  }

  function renderParsedPreview() {
    previewList.replaceChildren();
    if (!currentExam) return;

    for (const note of currentExam.notices || []) {
      previewList.append(element('div', 'smart-notice-banner', note));
    }

    if (currentExam.isScannedPdf && Array.isArray(currentExam.scannedPages)) {
      const scanGrid = element('div', 'smart-scan-grid');
      currentExam.scannedPages.forEach((p) => {
        const img = document.createElement('img');
        img.src = p.dataUrl;
        img.alt = `Trang ${p.page}`;
        img.className = 'exam-markdown-uploaded-image';
        scanGrid.append(img);
      });
      previewList.append(scanGrid);
      return;
    }

    currentExam.questions.forEach((q, idx) => {
      const card = element('article', 'smart-q-card');
      const head = element('div', 'smart-q-head');
      head.append(
        element('strong', '', `Câu ${idx + 1} · Phần ${q.part}`),
        element('span', 'smart-q-ans-pill', q.part === 'II'
          ? `Đáp án: ${(q.answer || []).map(v => v === true ? 'Đ' : v === false ? 'S' : '?').join('-')}`
          : `Đáp án: ${q.answer || 'Chưa chọn'}`)
      );
      const promptEl = element('div', 'smart-q-prompt');
      promptEl.innerHTML = renderExamText(q.prompt);
      card.append(head, promptEl);

      for (const imgUrl of q.images || []) {
        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = `Hình minh họa câu ${idx + 1}`;
        img.className = 'exam-markdown-uploaded-image';
        card.append(img);
      }

      if (Array.isArray(q.options) && q.options.length) {
        const optsWrap = element('div', 'smart-q-opts');
        q.options.forEach((opt, oIdx) => {
          const prefix = q.part === 'II' ? `${'abcd'[oIdx]}) ` : `${'ABCD'[oIdx]}. `;
          const optItem = element('div', 'smart-q-opt');
          optItem.innerHTML = `<strong>${prefix}</strong>${renderExamText(opt)}`;
          optsWrap.append(optItem);
        });
        card.append(optsWrap);
      }
      previewList.append(card);
    });
  }

  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (f) void handleExamFile(f);
  });
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('is-dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('is-dragover');
    const f = e.dataTransfer?.files?.[0];
    if (f) void handleExamFile(f);
  });

  function setMode(nextMode) {
    const isImport = nextMode === 'import';
    btnEditor.classList.toggle('is-active', !isImport);
    btnImport.classList.toggle('is-active', isImport);
    iframe.hidden = isImport;
    actions.hidden = isImport;
    importPane.hidden = !isImport;
    wrap.classList.toggle('is-import-mode', isImport);
  }

  if (preferImportTab || stagedImportFile) {
    setMode('import');
    preferImportTab = false;
    if (stagedImportFile) {
      const f = stagedImportFile;
      stagedImportFile = null;
      void handleExamFile(f);
    }
  }

  const onMessage = event => {
    const payload = event?.data;
    if (!payload || payload.type !== 'HTVVM_EXAM_PAPER_EXPORT') return;
    try {
      localStorage.setItem('htvvm_pending_exam_paper', JSON.stringify({
        title: payload.title,
        questions: payload.questions,
        exportedAt: Date.now()
      }));
    } catch { /* ignore */ }
    navigate('/exam');
  };
  window.addEventListener('message', onMessage);

  const observer = new MutationObserver(() => {
    if (!wrap.isConnected) {
      window.removeEventListener('message', onMessage);
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('main-content') || document.body, { childList: true });

  return wrap;
}
