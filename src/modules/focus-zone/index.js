import { element, button } from '../../core/dom.js';
import { auth } from '../../core/firebase.js';
import { AppStore } from '../../core/store.js';
import { HEARTBEAT_MS, titleFor } from '../../../shared/study-core.js';
import { DEFAULT_FOCUS_SECONDS, durationFromFields, normalizeRemaining, validFocusDuration } from '../../../shared/focus-timer.js';
import { resolveResourceLink } from '../../../shared/resource-links.js';

const fmt = s => {
  const safe = Math.max(0, Math.floor(Number(s) || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hrs > 0
    ? `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const fmtFull = s => {
  const safe = Math.max(0, Math.floor(Number(s) || 0));
  return `${String(Math.floor(safe / 3600)).padStart(2, '0')}:${String(Math.floor((safe % 3600) / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

function field(type, placeholder, value = '') {
  const el = element(type === 'textarea' ? 'textarea' : 'input', 'exam-input');
  if (type !== 'textarea') el.type = type;
  el.placeholder = placeholder;
  el.value = value;
  return el;
}

function playBellChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.14);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.14 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.14 + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.14);
      osc.stop(ctx.currentTime + i * 0.14 + 0.7);
    });
  } catch { /* ignore audio errors */ }
}

let cleanup = () => {};

export function renderFocus() {
  cleanup();
  const root = element('div', 'focus-page');

  const heading = element('section', 'focus-hero');
  heading.append(
    element('h2', 'hero-title', '◷ Góc tập trung'),
    element('p', 'hero-subtitle', 'Đồng hồ Pomodoro chuẩn thời gian thực, thống kê giờ học, nhạc nền tập trung và không gian học tập đa năng.')
  );
  root.append(heading);

  // TẦNG 1: BẢNG ĐIỀU KHIỂN ĐỒNG HỒ & TIẾN ĐỘ (2 CỘT CÂN ĐỐI)
  const topDashboard = element('div', 'focus-dashboard-top');
  const timerBox = element('section', 'focus-card focus-timer-station');
  const statsBox = element('section', 'focus-card focus-stats-station');
  topDashboard.append(timerBox, statsBox);
  root.append(topDashboard);

  // --- CỘT TRÁI: ĐỒNG HỒ POMODORO ỔN ĐỊNH TUYỆT ĐỐI ---
  const timerHead = element('div', 'focus-card-header-row');
  const timerTitleWrap = element('div', '');
  timerTitleWrap.append(
    element('span', 'focus-kicker-badge', '⏱ POMODORO THỜI GIAN THỰC'),
    element('h3', '', 'Đồng hồ tập trung')
  );
  const customToggleBtn = button('⚙ Đổi thời lượng', 'focus-btn is-sm', () => {
    durationEditor.hidden = !durationEditor.hidden;
  });
  timerHead.append(timerTitleWrap, customToggleBtn);
  timerBox.append(timerHead);

  const readDuration = () => {
    try {
      const n = Number(localStorage.getItem('htvvm-focus-duration-v1'));
      return validFocusDuration(n) ? n : DEFAULT_FOCUS_SECONDS;
    } catch {
      return DEFAULT_FOCUS_SECONDS;
    }
  };
  const initialDuration = readDuration();
  const restoredTimer = (() => {
    try {
      const s = JSON.parse(localStorage.getItem('htvvm-focus-timer-state-v3') || localStorage.getItem('htvvm-focus-timer-state-v2') || 'null');
      if (s && validFocusDuration(s.duration)) return s;
    } catch {}
    return null;
  })();

  let duration = restoredTimer?.duration || initialDuration;
  let selectedMode = restoredTimer?.mode === 'break' ? 'break' : 'focus';
  let running = Boolean(restoredTimer?.running && Number.isFinite(restoredTimer?.endTimeMs));
  let endTimeMs = running ? Number(restoredTimer.endTimeMs) : 0;
  let seconds = running
    ? Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000))
    : restoredTimer && Number.isFinite(restoredTimer.remaining)
      ? normalizeRemaining(restoredTimer.remaining, duration)
      : duration;

  if (running && seconds <= 0) {
    running = false;
    seconds = duration;
    endTimeMs = 0;
  }

  let modeButtons = [];
  const modes = element('div', 'focus-preset-pills');

  const clockDisplayWrap = element('div', 'focus-clock-face');
  const modeBadge = element('span', 'focus-clock-mode-pill', selectedMode === 'focus' ? '🎯 Phiên Tập Trung' : '☕ Phiên Nghỉ Ngơi');
  const digits = element('div', 'focus-time', fmt(seconds));
  const progressTrack = element('div', 'focus-progress-track');
  const progressBar = element('div', 'focus-progress-bar');
  progressTrack.append(progressBar);
  const timerHint = element('p', 'focus-timer-subnote', running ? '● Đồng hồ đang đếm ngược ổn định (không bị ngắt khi chuyển tab).' : 'Sẵn sàng bắt đầu phiên tập trung.');
  clockDisplayWrap.append(modeBadge, digits, progressTrack, timerHint);

  function updateProgressUI() {
    digits.textContent = fmt(seconds);
    const pct = duration > 0 ? Math.max(0, Math.min(100, ((duration - seconds) / duration) * 100)) : 0;
    progressBar.style.width = `${pct.toFixed(1)}%`;
    modeBadge.textContent = selectedMode === 'focus' ? '🎯 Phiên Tập Trung' : '☕ Phiên Nghỉ Ngơi';
    modeBadge.classList.toggle('is-break', selectedMode === 'break');
    clockDisplayWrap.classList.toggle('is-running', running);
  }

  function saveTimerState() {
    try {
      localStorage.setItem('htvvm-focus-duration-v1', String(duration));
      localStorage.setItem('htvvm-focus-mode-v1', selectedMode);
      localStorage.setItem(
        'htvvm-focus-timer-state-v3',
        JSON.stringify({
          duration,
          remaining: seconds,
          running,
          endTimeMs: running ? endTimeMs : null,
          mode: selectedMode,
          savedAt: Date.now()
        })
      );
    } catch {}
  }

  function updateControls() {
    toggle.textContent = running ? '⏸ Tạm dừng' : '▶ Bắt đầu';
    toggle.setAttribute('aria-pressed', String(running));
    updateProgressUI();
  }

  function syncModeButtons() {
    const presets = [
      [1500, 'focus'],
      [300, 'break'],
      [900, 'break'],
      [3000, 'focus']
    ];
    modeButtons.forEach((b, i) => {
      const [pSec, pMode] = presets[i] || [];
      b.classList.toggle('selected', duration === pSec && selectedMode === pMode);
    });
  }

  async function selectPreset(s, mode) {
    running = false;
    endTimeMs = 0;
    duration = s;
    seconds = s;
    selectedMode = mode;
    if (minutesInput) minutesInput.value = String(Math.floor(s / 60));
    if (secondsInput) secondsInput.value = String(s % 60);
    if (customStatus) customStatus.textContent = `Đang chọn ${Math.floor(s / 60)} phút ${s % 60} giây.`;
    timerHint.textContent = mode === 'focus' ? 'Đã chọn mốc tập trung. Bấm Bắt đầu để chạy.' : 'Đã chọn mốc giải lao. Bấm Bắt đầu để chạy.';
    syncModeButtons();
    saveTimerState();
    updateControls();
    if (sessionOrigin === 'pomodoro' && sessionId) {
      void stopSession('Đã chuyển mốc đồng hồ và lưu phiên học.');
    }
  }

  for (const [label, s, mode] of [
    ['🎯 Tập trung · 25′', 1500, 'focus'],
    ['☕ Nghỉ ngắn · 5′', 300, 'break'],
    ['🌿 Nghỉ dài · 15′', 900, 'break'],
    ['⚡ Luyện đề · 50′', 3000, 'focus']
  ]) {
    const b = button(label, 'focus-btn', () => selectPreset(s, mode));
    modes.append(b);
    modeButtons.push(b);
  }
  syncModeButtons();

  const controls = element('div', 'focus-actions focus-main-controls');
  const toggle = button(running ? '⏸ Tạm dừng' : '▶ Bắt đầu', 'focus-btn primary focus-start-btn', async () => {
    if (running) {
      seconds = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
      running = false;
      endTimeMs = 0;
      timerHint.textContent = '⏸ Đồng hồ đang tạm dừng. Bấm Bắt đầu để chạy tiếp.';
      saveTimerState();
      updateControls();
      if (sessionOrigin === 'pomodoro' && sessionId) {
        void stopSession('Đã tạm dừng đồng hồ; thời gian học đã được lưu.');
      }
      return;
    }

    if (seconds <= 0) seconds = duration;
    running = true;
    endTimeMs = Date.now() + seconds * 1000;
    timerHint.textContent = '● Đồng hồ đang đếm ngược ổn định (vẫn chạy chính xác khi bạn chuyển tab xem tài liệu).';
    saveTimerState();
    updateControls();

    // Tự động kết nối ghi nhận giờ học ở chế độ nền (không chặn đồng hồ nếu chưa đăng nhập)
    if (selectedMode === 'focus' && !sessionId && auth?.currentUser) {
      void startSession('pomodoro');
    } else if (selectedMode === 'break' && !sessionId) {
      status.textContent = '☕ Đồng hồ nghỉ đang chạy; thời gian nghỉ không cộng vào giờ học.';
    }
  });

  const reset = button('↺ Đặt lại', 'focus-btn', async () => {
    running = false;
    endTimeMs = 0;
    seconds = duration;
    timerHint.textContent = 'Đã đặt lại đồng hồ về ban đầu.';
    saveTimerState();
    updateControls();
    if (sessionOrigin === 'pomodoro' && sessionId) {
      void stopSession('Đã đặt lại đồng hồ và lưu phiên học.');
    }
  });
  controls.append(toggle, reset);

  // Hộp tùy chỉnh thời lượng (ẩn/hiện gọn gàng)
  const durationEditor = element('div', 'focus-duration-editor');
  durationEditor.hidden = true;
  durationEditor.append(element('label', 'focus-duration-label', 'Tùy chỉnh thời lượng (1 giây – 240 phút)'));
  const minutesInput = field('number', 'Phút', String(Math.floor(duration / 60)));
  minutesInput.min = '0'; minutesInput.max = '240'; minutesInput.step = '1'; minutesInput.setAttribute('aria-label', 'Số phút');
  const secondsInput = field('number', 'Giây', String(duration % 60));
  secondsInput.min = '0'; secondsInput.max = '59'; secondsInput.step = '1'; secondsInput.setAttribute('aria-label', 'Số giây');
  const durationFields = element('div', 'focus-duration-fields');
  const applyDuration = button('Áp dụng', 'focus-btn primary', async () => {
    const next = durationFromFields(Number(minutesInput.value), Number(secondsInput.value));
    if (next === null) {
      customStatus.textContent = 'Nhập thời lượng hợp lệ từ 1 giây đến 240 phút.';
      return;
    }
    running = false;
    endTimeMs = 0;
    duration = next;
    seconds = next;
    selectedMode = 'focus';
    modeButtons.forEach(x => x.classList.remove('selected'));
    customStatus.textContent = `Đã đặt ${Math.floor(next / 60)} phút ${next % 60} giây.`;
    timerHint.textContent = `Thời lượng mới: ${Math.floor(next / 60)} phút ${next % 60} giây.`;
    durationEditor.hidden = true;
    saveTimerState();
    updateControls();
    if (sessionOrigin === 'pomodoro' && sessionId) {
      void stopSession('Đã thay thời lượng và lưu phiên học trước đó.');
    }
  });
  durationFields.append(minutesInput, element('span', 'focus-duration-unit', 'phút'), secondsInput, element('span', 'focus-duration-unit', 'giây'), applyDuration);
  const customStatus = element('p', 'focus-muted', `Đang dùng ${Math.floor(duration / 60)} phút ${duration % 60} giây.`);
  durationEditor.append(durationFields, customStatus);

  timerBox.append(modes, durationEditor, clockDisplayWrap, controls);
  updateControls();

  // --- CỘT PHẢI: TIẾN ĐỘ HỌC TẬP & NHẠC TẬP TRUNG ---
  const statsHead = element('div', 'focus-card-header-row');
  const statsTitleWrap = element('div', '');
  statsTitleWrap.append(
    element('span', 'focus-kicker-badge', '📊 THỐNG KÊ & ÂM THANH NỀN'),
    element('h3', '', 'Tiến độ học tập & Nhạc tập trung')
  );
  statsHead.append(statsTitleWrap);
  statsBox.append(statsHead);

  const stats = element('div', 'focus-stats');
  for (const [label, val] of [['Hôm nay', '00:00:00'], ['Tổng giờ', '00:00:00'], ['Streak', '0 ngày'], ['Danh hiệu', 'Tân binh']]) {
    const item = element('div', 'focus-stat');
    item.append(element('small', '', label), element('strong', '', val));
    stats.append(item);
  }
  const stateLine = element('p', 'focus-muted', 'Bắt đầu đồng hồ tập trung để tự động cộng giờ học khi đã đăng nhập.');
  const status = element('p', 'focus-status-banner', 'Sẵn sàng ghi nhận giờ học.');
  const actions = element('div', 'focus-actions');
  const begin = button('● Ghi nhận giờ học', 'focus-btn primary', () => startSession('manual'));
  const end = button('Lưu & Kết thúc phiên', 'focus-btn', async () => {
    if (running) {
      seconds = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
      running = false;
      endTimeMs = 0;
      saveTimerState();
      updateControls();
    }
    await stopSession('Đã lưu và kết thúc phiên học.');
  });
  end.disabled = true;
  actions.append(begin, end);

  const shareLabel = element('label', 'focus-share');
  const shareInput = document.createElement('input');
  shareInput.type = 'checkbox';
  shareLabel.append(shareInput, document.createTextNode(' Hiện tôi trên bảng xếp hạng Chăm chỉ'));

  // Khung Nhạc học tích hợp gọn gàng ngay trong trạm phải
  const musicBox = element('div', 'focus-music-compact');
  const musicHead = element('div', 'focus-music-head');
  musicHead.append(
    element('strong', '', '🎵 Nhạc nền tập trung'),
    button('▶ Phát nhạc nền có sẵn', 'focus-btn is-sm', () => {
      music.src = '/study-break-music.wav';
      music.play().catch(() => {});
    }),
    button('📂 Chọn nhạc từ máy', 'focus-btn is-sm', () => audioInput.click())
  );
  const music = document.createElement('audio');
  music.controls = true;
  music.loop = true;
  music.src = '/study-break-music.wav';
  music.className = 'focus-audio';
  const audioInput = document.createElement('input');
  audioInput.type = 'file';
  audioInput.accept = 'audio/*';
  audioInput.hidden = true;
  let audioURL = '';
  audioInput.addEventListener('change', () => {
    if (audioURL) { URL.revokeObjectURL(audioURL); audioURL = ''; }
    const file = audioInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      status.textContent = 'Tệp đã chọn không phải tệp âm thanh.';
      audioInput.value = '';
      return;
    }
    audioURL = URL.createObjectURL(file);
    music.src = audioURL;
    music.play().catch(() => {});
    status.textContent = `🎵 Đang phát nhạc: ${file.name}`;
  });
  musicBox.append(musicHead, audioInput, music);

  statsBox.append(stats, stateLine, status, actions, shareLabel, musicBox);

  // TẦNG 2: KHÔNG GIAN LÀM VIỆC TOÀN CHIỀU RỘNG (TAB CHUYỂN ĐỔI LINH HOẠT)
  const workspaceHub = element('section', 'focus-card focus-workspace-hub');
  const hubHeader = element('div', 'focus-workspace-header');
  const hubTitleCol = element('div', '');
  hubTitleCol.append(
    element('span', 'focus-kicker-badge', '🖥 KHÔNG GIAN HỌC TẬP RỘNG TOÀN MÀN HÌNH'),
    element('h3', '', 'Bảng viết Lớp học Mực · Video bài giảng · Tài liệu PDF/Drive')
  );

  const hubTabs = element('div', 'focus-workspace-tabs');
  let activeWorkspaceMode = 'split'; // 'board' | 'media' | 'split'
  const tabBoard = button('📝 Bảng viết Lớp học Mực', 'focus-ws-tab', () => setWorkspaceMode('board'));
  const tabMedia = button('🎬 Video & Tài liệu PDF', 'focus-ws-tab', () => setWorkspaceMode('media'));
  const tabSplit = button('⊞ Kết hợp (Tài liệu + Bảng viết)', 'focus-ws-tab is-active', () => setWorkspaceMode('split'));
  hubTabs.append(tabSplit, tabBoard, tabMedia);
  hubHeader.append(hubTitleCol, hubTabs);
  workspaceHub.append(hubHeader);

  const workspaceBody = element('div', 'focus-workspace-body mode-split');

  // --- KHỐI A: TÀI LIỆU & YOUTUBE ---
  const resourcesPane = element('div', 'focus-workspace-pane focus-media-pane');
  const resourceStatus = element('p', 'focus-muted', 'Mở video bài giảng YouTube hoặc tài liệu PDF / Google Drive để học song song.');
  const resourceSplit = element('div', 'focus-resource-split');

  // Khung YouTube
  const youtubePane = element('section', 'focus-resource-pane');
  youtubePane.append(element('h4', '', '🎬 Video bài giảng (YouTube)'), element('p', 'focus-muted', 'Hỗ trợ link video lẻ hoặc danh sách phát (playlist).'));
  const ytInputRow = element('div', 'focus-inline-input-row');
  const youtubeInput = document.createElement('input');
  youtubeInput.type = 'url';
  youtubeInput.className = 'exam-input';
  youtubeInput.placeholder = 'Dán link YouTube rồi nhấn Enter…';
  youtubeInput.setAttribute('aria-label', 'Liên kết YouTube');
  const openYoutube = button('Phát video', 'focus-btn primary', () => playYoutube());
  const clearYoutube = button('Xóa', 'focus-btn', () => {
    youtubeInput.value = '';
    youtubeFrame.removeAttribute('src');
    youtubeFrame.hidden = true;
    youtubeOpen.hidden = true;
  });
  ytInputRow.append(youtubeInput, openYoutube, clearYoutube);
  const youtubeFrame = document.createElement('iframe');
  youtubeFrame.className = 'focus-youtube-frame';
  youtubeFrame.title = 'Trình phát YouTube';
  youtubeFrame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  youtubeFrame.allowFullscreen = true;
  youtubeFrame.referrerPolicy = 'strict-origin-when-cross-origin';
  youtubeFrame.hidden = true;
  const youtubeOpen = document.createElement('a');
  youtubeOpen.className = 'focus-resource-open';
  youtubeOpen.target = '_blank';
  youtubeOpen.rel = 'noopener noreferrer';
  youtubeOpen.textContent = 'Mở YouTube trong tab mới ↗';
  youtubeOpen.hidden = true;
  function playYoutube() {
    try {
      const resource = resolveResourceLink(youtubeInput.value);
      if (resource.type !== 'youtube') throw Error('Khung này chỉ nhận link YouTube.');
      youtubeFrame.src = resource.embedUrl;
      youtubeFrame.hidden = false;
      youtubeOpen.href = resource.openUrl;
      youtubeOpen.hidden = false;
      resourceStatus.textContent = '✅ Đã mở video YouTube.';
    } catch (error) {
      youtubeFrame.hidden = true;
      youtubeOpen.hidden = true;
      resourceStatus.textContent = error.message;
    }
  }
  youtubeInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); playYoutube(); }
  });
  youtubePane.append(ytInputRow, youtubeFrame, youtubeOpen);

  // Khung Tài liệu PDF / Google Drive
  const documentPane = element('section', 'focus-resource-pane');
  documentPane.append(element('h4', '', '📄 Tài liệu học tập (PDF / Google Drive)'), element('p', 'focus-muted', 'Dán link Google Drive/Docs hoặc mở tệp PDF trực tiếp từ máy.'));
  const docInputRow = element('div', 'focus-inline-input-row');
  const documentInput = document.createElement('input');
  documentInput.type = 'url';
  documentInput.className = 'exam-input';
  documentInput.placeholder = 'Dán link Google Drive/Docs…';
  documentInput.setAttribute('aria-label', 'Liên kết tài liệu');
  const previewDocument = button('Mở link', 'focus-btn primary', () => openDocumentLink());
  const pickPdfBtn = button('📂 Chọn PDF', 'focus-btn', () => pdf.click());
  const clearDocument = button('Xóa', 'focus-btn', () => {
    documentInput.value = '';
    documentFrame.removeAttribute('src');
    documentFrame.hidden = true;
    documentOpen.hidden = true;
    if (pdfURL) { URL.revokeObjectURL(pdfURL); pdfURL = ''; }
    pdf.value = '';
  });
  docInputRow.append(documentInput, previewDocument, pickPdfBtn, clearDocument);

  const pdf = document.createElement('input');
  pdf.type = 'file';
  pdf.accept = 'application/pdf';
  pdf.hidden = true;
  let pdfURL = '';
  const documentFrame = document.createElement('iframe');
  documentFrame.className = 'focus-document-frame';
  documentFrame.title = 'Màn hình xem trước tài liệu';
  documentFrame.referrerPolicy = 'strict-origin-when-cross-origin';
  documentFrame.hidden = true;
  const documentOpen = document.createElement('a');
  documentOpen.className = 'focus-resource-open';
  documentOpen.target = '_blank';
  documentOpen.rel = 'noopener noreferrer';
  documentOpen.textContent = 'Mở tài liệu trong tab mới ↗';
  documentOpen.hidden = true;
  function openDocumentLink() {
    try {
      const resource = resolveResourceLink(documentInput.value);
      if (resource.type !== 'drive') throw Error('Hãy dán liên kết Google Drive/Docs/Sheets/Slides.');
      if (pdfURL) { URL.revokeObjectURL(pdfURL); pdfURL = ''; }
      documentFrame.src = resource.embedUrl;
      documentFrame.hidden = false;
      documentOpen.href = resource.openUrl;
      documentOpen.hidden = false;
      resourceStatus.textContent = '✅ Đã mở bản xem trước tài liệu.';
    } catch (error) {
      documentFrame.hidden = true;
      documentOpen.hidden = true;
      resourceStatus.textContent = error.message;
    }
  }
  documentInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); openDocumentLink(); }
  });
  pdf.addEventListener('change', () => {
    if (pdfURL) { URL.revokeObjectURL(pdfURL); pdfURL = ''; }
    const file = pdf.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' || file.size > 30 * 1024 * 1024) {
      resourceStatus.textContent = 'Chỉ hỗ trợ PDF tối đa 30 MB.';
      pdf.value = '';
      return;
    }
    pdfURL = URL.createObjectURL(file);
    documentFrame.src = pdfURL;
    documentFrame.hidden = false;
    documentOpen.href = pdfURL;
    documentOpen.hidden = false;
    documentOpen.textContent = 'Mở PDF trong tab mới ↗';
    resourceStatus.textContent = `📄 Đang xem PDF từ máy: ${file.name}`;
  });
  documentPane.append(docInputRow, pdf, documentFrame, documentOpen);

  resourceSplit.append(youtubePane, documentPane);
  resourcesPane.append(resourceStatus, resourceSplit);

  // --- KHỐI B: BẢNG VIẾT LỚP HỌC MỰC ---
  const notesPane = element('div', 'focus-workspace-pane focus-notes-pane');
  const notesTopBar = element('div', 'focus-notes-topbar');
  const notesStatus = element('span', 'focus-muted', 'Bảng nháp viết tay, vẽ hình 3D & đồ thị ngay trong Góc tập trung.');
  const notesActions = element('div', 'focus-actions');
  const notesFrame = document.createElement('iframe');
  notesFrame.className = 'focus-notes-frame';
  notesFrame.title = 'Ứng dụng bảng vẽ Lớp học Mực';
  notesFrame.src = '/focus-notes/index.html?app=board&embed=1';
  notesFrame.loading = 'lazy';
  notesFrame.referrerPolicy = 'strict-origin-when-cross-origin';
  notesFrame.allow = 'clipboard-read; clipboard-write; fullscreen';
  notesFrame.allowFullscreen = true;

  const fullNotes = button('⛶ Toàn màn hình', 'focus-btn is-sm', async () => {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return; }
      await notesFrame.requestFullscreen();
    } catch {
      notesStatus.textContent = 'Trình duyệt không cho phép toàn màn hình tự động; hãy bấm Mở tab riêng.';
    }
  });
  const popNotes = button('↗ Mở tab riêng', 'focus-btn is-sm', () => window.open('/focus-notes/index.html?app=board', '_blank', 'noopener,noreferrer'));
  notesActions.append(fullNotes, popNotes);
  notesTopBar.append(notesStatus, notesActions);
  notesPane.append(notesTopBar, notesFrame);

  workspaceBody.append(resourcesPane, notesPane);
  workspaceHub.append(workspaceBody);
  root.append(workspaceHub);

  function setWorkspaceMode(mode) {
    activeWorkspaceMode = mode;
    tabBoard.classList.toggle('is-active', mode === 'board');
    tabMedia.classList.toggle('is-active', mode === 'media');
    tabSplit.classList.toggle('is-active', mode === 'split');
    workspaceBody.className = `focus-workspace-body mode-${mode}`;
    resourcesPane.hidden = mode === 'board';
    notesPane.hidden = mode === 'media';
  }
  setWorkspaceMode('split');

  // --- ĐỒNG BỘ GIỜ HỌC VỚI MÁY CHỦ & BỘ ĐẾM ĐỊA PHƯƠNG KHÔNG BAO GIỜ NGẮT ---
  const SESSION_STORAGE_KEY = 'htvvm-study-session-v1';
  const LOCAL_STUDY_KEY = 'htvvm-local-study-stats-v2';
  const todayKey = () => new Date().toLocaleDateString('en-CA');

  function readLocalStudy() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_STUDY_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        const isToday = raw.dayKey === todayKey();
        return {
          totalSeconds: Math.max(0, Math.floor(Number(raw.totalSeconds) || 0)),
          todaySeconds: isToday ? Math.max(0, Math.floor(Number(raw.todaySeconds) || 0)) : 0,
          streak: Math.max(0, Math.floor(Number(raw.streak) || 0)),
          sharing: !!raw.sharing
        };
      }
    } catch {}
    return { totalSeconds: 0, todaySeconds: 0, streak: 0, sharing: false };
  }

  function writeLocalStudy(snap) {
    try {
      localStorage.setItem(
        LOCAL_STUDY_KEY,
        JSON.stringify({
          dayKey: todayKey(),
          totalSeconds: snap.totalSeconds || 0,
          todaySeconds: snap.todaySeconds || 0,
          streak: snap.streak || 0,
          sharing: !!snap.sharing,
          updatedAt: Date.now()
        })
      );
    } catch {}
  }

  let sessionId = null, sessionOrigin = null, pingBusy = false, alive = true, sessionStopping = false, sessionStarting = false;
  let manualActive = false;
  let statsSnapshot = readLocalStudy();
  let pendingMs = 0, lastStatsRenderPerf = performance.now(), lastTimerPersist = 0;

  async function request(path, method = 'GET', body, options = {}) {
    const user = auth?.currentUser;
    if (!user) throw Error('Hãy đăng nhập Google để đồng bộ giờ học lên Bảng xếp hạng.');
    const token = await user.getIdToken();
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 7000);
    try {
      const res = await fetch(path, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
        keepalive: !!options.keepalive,
        signal: ctrl.signal
      });
      let json = {};
      try { json = await res.json(); } catch {}
      if (!res.ok) {
        const error = Error(json.error || `Lỗi máy chủ ${res.status}`);
        error.status = res.status;
        throw error;
      }
      return json;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function saveSession(id, origin) {
    try { sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ id, origin, savedAt: Date.now() })); } catch {}
  }
  function touchSavedSession() {
    if (sessionId) saveSession(sessionId, sessionOrigin || 'manual');
  }
  function clearSavedSession() {
    try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch {}
  }
  function getSavedSession() {
    try {
      const v = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) || 'null');
      return v && typeof v.id === 'string' && ['manual', 'pomodoro', 'stopping'].includes(v.origin) ? v : null;
    } catch { return null; }
  }

  const isCountingStudy = () => (running && selectedMode === 'focus') || manualActive || Boolean(sessionId);

  function flushPendingToSnapshot() {
    const wholeSec = Math.floor(pendingMs / 1000);
    if (wholeSec > 0) {
      statsSnapshot = {
        ...statsSnapshot,
        totalSeconds: (statsSnapshot.totalSeconds || 0) + wholeSec,
        todaySeconds: (statsSnapshot.todaySeconds || 0) + wholeSec,
        streak: Math.max(1, statsSnapshot.streak || 0)
      };
      pendingMs -= wholeSec * 1000;
      writeLocalStudy(statsSnapshot);
    }
  }

  function drawStats() {
    const liveSeconds = isCountingStudy() ? Math.floor(pendingMs / 1000) : 0;
    const totalSeconds = (statsSnapshot.totalSeconds || 0) + liveSeconds;
    const todaySeconds = (statsSnapshot.todaySeconds || 0) + liveSeconds;
    stats.replaceChildren();
    for (const [label, val] of [
      ['Hôm nay', fmtFull(todaySeconds)],
      ['Tổng giờ', fmtFull(totalSeconds)],
      ['Streak', `${statsSnapshot.streak || (todaySeconds > 0 ? 1 : 0)} ngày`],
      ['Danh hiệu', titleFor(totalSeconds)]
    ]) {
      const item = element('div', 'focus-stat');
      item.append(element('small', '', label), element('strong', '', val));
      stats.append(item);
    }
    shareInput.checked = !!statsSnapshot.sharing;
    if (todaySeconds >= 18000) {
      stateLine.textContent = '🌟 Bạn đã học 5 giờ hôm nay. Hãy nghỉ ngơi và vận động nhẹ nhàng nhé!';
    } else if (isCountingStudy()) {
      stateLine.textContent = '● Đang đếm giờ học liên tục theo thời gian thực.';
    } else {
      stateLine.textContent = 'Bắt đầu đồng hồ tập trung hoặc bấm "Ghi nhận giờ học" để tính giờ.';
    }
  }

  function showStats(s, reconcile = true) {
    if (!s) return;
    if (reconcile) {
      flushPendingToSnapshot();
      statsSnapshot = {
        totalSeconds: Math.max(statsSnapshot.totalSeconds || 0, s.totalSeconds || 0),
        todaySeconds: Math.max(statsSnapshot.todaySeconds || 0, s.todaySeconds || 0),
        streak: Math.max(statsSnapshot.streak || 0, s.streak || 0),
        sharing: !!s.sharing
      };
      writeLocalStudy(statsSnapshot);
    } else {
      statsSnapshot = { ...statsSnapshot, sharing: !!s.sharing };
      writeLocalStudy(statsSnapshot);
    }
    drawStats();
  }

  function updateSessionButtons() {
    const activeAny = Boolean(sessionId) || manualActive;
    begin.disabled = activeAny || sessionStopping || sessionStarting;
    end.disabled = !activeAny;
  }

  async function startSession(source = 'manual') {
    if (source === 'manual') {
      manualActive = true;
      updateSessionButtons();
      drawStats();
    }
    if (!auth?.currentUser) {
      status.textContent = '● Đang đếm giờ học trên thiết bị (đăng nhập Google để đồng bộ lên bảng xếp hạng).';
      return true;
    }
    if (sessionStopping || sessionStarting || sessionId) return true;
    sessionStarting = true;
    updateSessionButtons();
    try {
      const data = await request('/api/study-tracker', 'POST', { action: 'start' });
      if (!alive) return false;
      sessionId = data.sessionId;
      sessionOrigin = source;
      saveSession(sessionId, sessionOrigin);
      showStats(data.stats, true);
      status.textContent = source === 'pomodoro' ? '● Đồng hồ đang chạy & đồng bộ giờ học.' : '● Đang ghi nhận giờ học trực tuyến.';
      return true;
    } catch {
      status.textContent = '● Đang đếm giờ học liên tục trên thiết bị (tự động đồng bộ lại khi mạng ổn định).';
      return true;
    } finally {
      sessionStarting = false;
      updateSessionButtons();
    }
  }

  async function loadStatus() {
    drawStats();
    if (!auth?.currentUser) return;
    try {
      const data = await request('/api/study-tracker');
      if (!alive) return;
      showStats(data.stats, true);
      const saved = getSavedSession();
      if (saved && saved.origin !== 'stopping' && Date.now() - (saved.savedAt || 0) < 80000) {
        const resumed = await request('/api/study-tracker', 'POST', { action: 'resume', sessionId: saved.id }).catch(() => null);
        if (resumed && alive) {
          sessionId = saved.id;
          sessionOrigin = saved.origin || 'manual';
          saveSession(sessionId, sessionOrigin);
          updateSessionButtons();
          showStats(resumed.stats, true);
        }
      }
    } catch {
      // Giữ nguyên bộ đếm địa phương mượt mà
    }
  }

  async function ping() {
    if (!alive || pingBusy || !isCountingStudy()) return;
    flushPendingToSnapshot();
    if (!auth?.currentUser) return;
    pingBusy = true;
    try {
      if (!sessionId) {
        const started = await request('/api/study-tracker', 'POST', { action: 'start' });
        if (alive && started?.sessionId) {
          sessionId = started.sessionId;
          sessionOrigin = running ? 'pomodoro' : 'manual';
          saveSession(sessionId, sessionOrigin);
          showStats(started.stats, true);
        }
      } else {
        const id = sessionId;
        const data = await request('/api/study-tracker', 'POST', { action: 'ping', sessionId: id });
        if (alive && sessionId === id) {
          showStats(data.stats, true);
          touchSavedSession();
        }
      }
    } catch (e) {
      if (e.status === 409) {
        sessionId = null;
        clearSavedSession();
      }
      // Không bao giờ ngắt bộ đếm giờ học khi mạng chập chờn
    } finally {
      pingBusy = false;
      updateSessionButtons();
    }
  }

  async function stopSession(msg = 'Đã lưu phiên học.') {
    manualActive = false;
    flushPendingToSnapshot();
    const id = sessionId;
    sessionId = null;
    sessionOrigin = null;
    clearSavedSession();
    updateSessionButtons();
    drawStats();
    if (!id || sessionStopping || !auth?.currentUser) {
      status.textContent = msg;
      return true;
    }
    sessionStopping = true;
    updateSessionButtons();
    try {
      const data = await request('/api/study-tracker', 'POST', { action: 'stop', sessionId: id }, { keepalive: true });
      if (alive) { showStats(data.stats, true); status.textContent = msg; }
      return true;
    } catch {
      if (alive) status.textContent = msg;
      return true;
    } finally {
      sessionStopping = false;
      updateSessionButtons();
    }
  }

  shareInput.addEventListener('change', async () => {
    statsSnapshot = { ...statsSnapshot, sharing: shareInput.checked };
    writeLocalStudy(statsSnapshot);
    try {
      const data = await request('/api/study-tracker', 'POST', { action: 'sharing', enabled: shareInput.checked });
      showStats(data.stats, false);
      status.textContent = shareInput.checked ? 'Đã bật hiển thị trên bảng xếp hạng.' : 'Đã ẩn khỏi bảng xếp hạng.';
    } catch (e) {
      status.textContent = e.message;
    }
  });

  // Bộ đếm thời gian thực mượt từng giây — không bao giờ khựng ở mốc 10s!
  let lastUiTick = performance.now();
  const timerInterval = setInterval(() => {
    const nowPerf = performance.now();
    const delta = Math.max(0, Math.min(2000, nowPerf - lastUiTick));
    lastUiTick = nowPerf;

    if (isCountingStudy()) {
      pendingMs += delta;
      if (pendingMs >= 5000) {
        flushPendingToSnapshot();
      }
    }

    if (running) {
      const nextSeconds = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
      if (nextSeconds !== seconds) {
        seconds = nextSeconds;
        updateProgressUI();
      }
      if (nowPerf - lastTimerPersist >= 2000) {
        saveTimerState();
        lastTimerPersist = nowPerf;
      }
      if (seconds <= 0) {
        seconds = 0;
        running = false;
        endTimeMs = 0;
        saveTimerState();
        updateControls();
        playBellChime();
        timerHint.textContent = '🎉 Đã hoàn thành phiên đồng hồ! Hãy nghỉ ngơi hoặc bắt đầu phiên tiếp theo.';
        if (sessionOrigin === 'pomodoro' || sessionId) {
          void stopSession('🎉 Hoàn thành phiên Pomodoro! Giờ học đã được lưu.');
        } else {
          status.textContent = '🎉 Đã hết giờ Pomodoro!';
        }
      }
    }

    if (nowPerf - lastStatsRenderPerf >= 1000) {
      drawStats();
      lastStatsRenderPerf = nowPerf;
    }
  }, 200);

  const heartbeat = setInterval(ping, HEARTBEAT_MS);
  const unsubUser = AppStore.subscribe('user', () => {
    if (alive && auth?.currentUser) void loadStatus();
  });

  const onVisibility = () => {
    if (!document.hidden && running) {
      seconds = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
      updateProgressUI();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  const watcher = new MutationObserver(() => {
    if (!root.isConnected) cleanup();
  });
  watcher.observe(document.getElementById('main-content') || document.body, { childList: true });

  cleanup = () => {
    if (!alive) return;
    alive = false;
    flushPendingToSnapshot();
    saveTimerState();
    unsubUser();
    clearInterval(timerInterval);
    clearInterval(heartbeat);
    document.removeEventListener('visibilitychange', onVisibility);
    watcher.disconnect();
    if (pdfURL) URL.revokeObjectURL(pdfURL);
    if (audioURL) URL.revokeObjectURL(audioURL);
    if (sessionId && auth?.currentUser) {
      const id = sessionId;
      sessionId = null;
      request('/api/study-tracker', 'POST', { action: 'stop', sessionId: id }, { keepalive: true }).catch(() => {});
    }
  };

  drawStats();
  void loadStatus();
  return root;
}
