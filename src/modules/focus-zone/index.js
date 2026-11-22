import { element, button } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import {
  subscribeMusic,
  playPresetMusic,
  loadLocalMusicFile,
  toggleMusicPlay,
  seekMusic,
  setMusicVolume,
  formatAudioTime
} from '../../core/music-player.js';
import { auth } from '../../core/firebase.js';
import { AppStore } from '../../core/store.js';
import { syncStudyStatsToStore } from '../../core/auth.js';
import {
  HEARTBEAT_MS,
  MAX_ALLOWLIST_ITEMS,
  MAX_FOCUS_AWAY_MS,
  normalizeFocusTarget,
  isUrlAllowedInFocus,
  getNextStreakMilestone,
  rankProgressFor,
  titleFor
} from '../../../shared/study-core.js';
import {
  DEFAULT_FOCUS_SECONDS,
  durationFromFields,
  normalizeRemaining,
  shouldCountStudy,
  studyStorageKeyForUid,
  validFocusDuration
} from '../../../shared/focus-timer.js';
import { resolveResourceLink } from '../../../shared/resource-links.js';
import { getVNDateString } from '../../../shared/time-utils.js';

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
    element('h2', 'hero-title', 'Góc tập trung'),
    element('p', 'hero-subtitle', 'Đồng hồ Pomodoro, chế độ tập trung chọn 2–3 trang web hoặc ứng dụng học song song, bảng viết tay và nhạc nền.')
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
    element('h3', '', 'Đồng hồ tập trung')
  );
  const customToggleBtn = button('Đổi thời lượng', 'focus-btn is-sm', () => {
    durationEditor.hidden = !durationEditor.hidden;
  });
  customToggleBtn.prepend(icon('sliders'));
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
  // Always open Focus Zone paused so study time never increments before user starts the timer.
  let running = false;
  let endTimeMs = 0;
  let seconds = restoredTimer && restoredTimer.running && Number.isFinite(restoredTimer.endTimeMs)
    ? normalizeRemaining(Math.ceil((restoredTimer.endTimeMs - Date.now()) / 1000) || duration, duration)
    : restoredTimer && Number.isFinite(restoredTimer.remaining)
      ? normalizeRemaining(restoredTimer.remaining, duration)
      : duration;
  if (seconds <= 0) seconds = duration;

  let modeButtons = [];
  const modes = element('div', 'focus-preset-pills');

  const clockDisplayWrap = element('div', 'focus-clock-face');
  const modeBadge = element('span', 'focus-clock-mode-pill', selectedMode === 'focus' ? 'Phiên tập trung' : 'Phiên nghỉ ngơi');
  const digits = element('div', 'focus-time', fmt(seconds));
  const progressTrack = element('div', 'focus-progress-track');
  const progressBar = element('div', 'focus-progress-bar');
  progressTrack.append(progressBar);
  const timerHint = element('p', 'focus-timer-subnote', 'Sẵn sàng bắt đầu phiên tập trung.');
  clockDisplayWrap.append(modeBadge, digits, progressTrack, timerHint);

  function updateProgressUI() {
    digits.textContent = fmt(seconds);
    const pct = duration > 0 ? Math.max(0, Math.min(100, ((duration - seconds) / duration) * 100)) : 0;
    progressBar.style.width = `${pct.toFixed(1)}%`;
    modeBadge.textContent = selectedMode === 'focus' ? 'Phiên tập trung' : 'Phiên nghỉ ngơi';
    modeBadge.classList.toggle('is-break', selectedMode === 'break');
    clockDisplayWrap.classList.toggle('is-running', running);
  }

  function saveTimerState() {
    try {
      localStorage.setItem('htvvm-focus-duration-v1', String(duration));
      localStorage.setItem('htvvm-focus-timer-mode-v1', selectedMode);
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
  saveTimerState();

  function updateControls() {
    toggle.textContent = running ? 'Tạm dừng' : 'Bắt đầu';
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

  function haltPomodoroCounting(msg) {
    sessionSeq += 1;
    if (!manualActive && (sessionOrigin === 'pomodoro' || sessionId || sessionStarting)) {
      void stopSession(msg);
    }
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
    haltPomodoroCounting('Đã chuyển mốc đồng hồ và lưu phiên học.');
  }

  for (const [label, s, mode] of [
    ['Tập trung · 25 phút', 1500, 'focus'],
    ['Nghỉ ngắn · 5 phút', 300, 'break'],
    ['Nghỉ dài · 15 phút', 900, 'break'],
    ['Luyện đề · 50 phút', 3000, 'focus']
  ]) {
    const b = button(label, 'focus-btn', () => selectPreset(s, mode));
    modes.append(b);
    modeButtons.push(b);
  }
  syncModeButtons();

  const controls = element('div', 'focus-actions focus-main-controls');
  const toggle = button(running ? 'Tạm dừng' : 'Bắt đầu', 'focus-btn primary focus-start-btn', async () => {
    if (running) {
      seconds = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
      running = false;
      endTimeMs = 0;
      timerHint.textContent = 'Đồng hồ đang tạm dừng. Bấm Bắt đầu để chạy tiếp.';
      saveTimerState();
      updateControls();
      haltPomodoroCounting('Đã tạm dừng đồng hồ; thời gian học đã được lưu.');
      return;
    }

    if (seconds <= 0) seconds = duration;
    running = true;
    endTimeMs = Date.now() + seconds * 1000;
    timerHint.textContent = 'Đồng hồ đang đếm ngược ổn định (vẫn chạy chính xác khi bạn chuyển tab xem tài liệu).';
    saveTimerState();
    updateControls();

    // Tự động kết nối ghi nhận giờ học ở chế độ nền (không chặn đồng hồ nếu chưa đăng nhập)
    if (selectedMode === 'focus' && !sessionId && auth?.currentUser) {
      void startSession('pomodoro');
    } else if (selectedMode === 'break' && !sessionId) {
      status.textContent = 'Đồng hồ nghỉ đang chạy; thời gian nghỉ không cộng vào giờ học.';
    }
  });

  const reset = button('Đặt lại', 'focus-btn', async () => {
    running = false;
    endTimeMs = 0;
    seconds = duration;
    timerHint.textContent = 'Đã đặt lại đồng hồ về ban đầu.';
    saveTimerState();
    updateControls();
    haltPomodoroCounting('Đã đặt lại đồng hồ và lưu phiên học.');
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
    haltPomodoroCounting('Đã thay thời lượng và lưu phiên học trước đó.');
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
  const rankRageBox = element('div', 'focus-rank-rage');
  const rankRageHead = element('div', 'focus-rank-rage-head');
  const rankRageTitle = element('strong', 'focus-rank-rage-title', 'Nước tinh khiết → Caffein');
  const rankRageRemain = element('span', 'focus-rank-rage-remain', 'Còn 01:00:00');
  rankRageHead.append(rankRageTitle, rankRageRemain);
  const rankRageTrack = element('div', 'focus-rank-rage-track');
  const rankRageFill = element('div', 'focus-rank-rage-fill');
  rankRageTrack.append(rankRageFill);
  rankRageBox.append(rankRageHead, rankRageTrack);

  const stateLine = element('p', 'focus-muted', 'Bắt đầu đồng hồ tập trung để tự động cộng giờ học khi đã đăng nhập.');
  const status = element('p', 'focus-status-banner', 'Sẵn sàng ghi nhận giờ học.');
  const actions = element('div', 'focus-actions');
  const begin = button('Ghi nhận giờ học', 'focus-btn primary', () => startSession('manual'));
  const end = button('Lưu & Kết thúc phiên', 'focus-btn', async () => {
    sessionSeq += 1;
    if (running) {
      seconds = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
      running = false;
      endTimeMs = 0;
      timerHint.textContent = 'Đã kết thúc phiên tập trung.';
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

  // --- FOCUS MODE: ALLOWLIST 2–3 WEB / ỨNG DỤNG ĐƯỢC PHÉP ---
  const FOCUS_MODE_KEY = 'htvvm-focus-mode-v1';
  const PRESET_FOCUS_TARGETS = [
    ['youtube.com', 'YouTube'],
    ['drive.google.com', 'Drive / Docs'],
    ['desmos.com', 'Desmos'],
    ['geogebra.org', 'GeoGebra'],
    ['Ứng dụng trên máy (Word/Anki)', 'App trên máy']
  ];
  const loadFocusConfig = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(FOCUS_MODE_KEY) || 'null');
      if (parsed && typeof parsed === 'object') {
        const items = Array.isArray(parsed.allowlist) ? parsed.allowlist.slice(0, MAX_ALLOWLIST_ITEMS) : [];
        return { enabled: Boolean(parsed.enabled), allowlist: items };
      }
    } catch {}
    return {
      enabled: false,
      allowlist: [normalizeFocusTarget('youtube.com'), normalizeFocusTarget('drive.google.com')]
    };
  };
  let focusConfig = loadFocusConfig();
  let pendingAwayMs = 0;
  let focusHiddenAt = 0;
  const saveFocusConfig = () => {
    try { localStorage.setItem(FOCUS_MODE_KEY, JSON.stringify(focusConfig)); } catch {}
  };

  const focusModeBox = element('div', 'focus-allowlist-box');
  const focusModeHead = element('div', 'focus-allowlist-head');
  const focusModeTitle = element('div', 'focus-allowlist-title');
  focusModeTitle.append(
    icon('lock', 15),
    element('strong', '', 'Focus Mode (tối đa 3 web / app học)')
  );
  const focusToggleBtn = button('', 'focus-btn is-sm', () => {
    if (!focusConfig.enabled && !focusConfig.allowlist.length) {
      status.textContent = 'Hãy chọn 1–3 trang web hoặc ứng dụng trước khi bật Focus Mode.';
      return;
    }
    focusConfig.enabled = !focusConfig.enabled;
    saveFocusConfig();
    renderFocusAllowlist();
    status.textContent = focusConfig.enabled
      ? `Đã bật Focus Mode (${focusConfig.allowlist.map(x => x.label).join(', ')}). Chặn liên kết ngoài danh sách.`
      : 'Đã tắt Focus Mode.';
  });
  focusModeHead.append(focusModeTitle, focusToggleBtn);

  const presetRow = element('div', 'focus-allowlist-presets');
  const selectedRow = element('div', 'focus-allowlist-selected');
  const addRow = element('div', 'focus-inline-input-row focus-allowlist-add');
  const customTargetInput = field('text', 'Thêm web (vd: khanacademy.org) hoặc app…');
  customTargetInput.maxLength = 80;
  const addTargetBtn = button('Thêm', 'focus-btn is-sm primary', () => addFocusTarget(customTargetInput.value));
  addRow.append(customTargetInput, addTargetBtn);
  customTargetInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addFocusTarget(customTargetInput.value); }
  });

  const focusReturnBanner = element('div', 'focus-return-banner');
  focusReturnBanner.hidden = true;
  const focusHonestyNote = element(
    'small',
    'focus-honesty-note',
    'Giới hạn trình duyệt: Web không khóa được phím Alt+Tab của hệ điều hành hay app khác trên điện thoại; HTVVM sẽ chặn link ngoài danh sách ngay trên trang học và giữ giờ khi bạn sang 2–3 web/app đã chọn.'
  );

  function addFocusTarget(raw) {
    try {
      const normalized = normalizeFocusTarget(raw);
      if (focusConfig.allowlist.some(x => x.id === normalized.id)) {
        status.textContent = `“${normalized.label}” đã nằm trong danh sách.`;
        return;
      }
      if (focusConfig.allowlist.length >= MAX_ALLOWLIST_ITEMS) {
        status.textContent = `Focus Mode chỉ cho phép tối đa ${MAX_ALLOWLIST_ITEMS} trang web hoặc ứng dụng.`;
        return;
      }
      focusConfig.allowlist = [...focusConfig.allowlist, normalized];
      customTargetInput.value = '';
      saveFocusConfig();
      renderFocusAllowlist();
      status.textContent = `Đã thêm “${normalized.label}” vào Focus Mode.`;
    } catch (err) {
      status.textContent = err.message || String(err);
    }
  }

  function renderFocusAllowlist() {
    focusModeBox.classList.toggle('is-active', focusConfig.enabled);
    focusToggleBtn.textContent = focusConfig.enabled ? 'Đang bật · Tắt' : 'Bật Focus Mode';
    focusToggleBtn.classList.toggle('primary', focusConfig.enabled);

    presetRow.replaceChildren();
    for (const [rawVal, shortLabel] of PRESET_FOCUS_TARGETS) {
      const normalized = normalizeFocusTarget(rawVal);
      const selected = focusConfig.allowlist.some(x => x.id === normalized.id);
      const chip = button(selected ? `✓ ${shortLabel}` : `+ ${shortLabel}`, `focus-preset-chip${selected ? ' is-picked' : ''}`, () => {
        if (selected) {
          focusConfig.allowlist = focusConfig.allowlist.filter(x => x.id !== normalized.id);
          if (!focusConfig.allowlist.length && focusConfig.enabled) focusConfig.enabled = false;
          saveFocusConfig();
          renderFocusAllowlist();
        } else {
          addFocusTarget(rawVal);
        }
      });
      presetRow.append(chip);
    }

    selectedRow.replaceChildren();
    if (!focusConfig.allowlist.length) {
      selectedRow.append(element('small', 'focus-muted', 'Chưa chọn mục nào (bấm gợi ý hoặc tự thêm tối đa 3 mục).'));
    } else {
      for (const item of focusConfig.allowlist) {
        const pill = element('span', 'focus-allowed-pill');
        pill.append(element('span', '', `${item.kind === 'web' ? 'Web' : 'App'}: ${item.label}`));
        if (item.kind === 'web' && item.openUrl) {
          const openAllowed = button('↗', 'focus-pill-action', () => {
            if (!isCountingStudy()) void startSession(running ? 'pomodoro' : 'manual');
            focusHiddenAt = Date.now();
            window.open(item.openUrl, '_blank', 'noopener,noreferrer');
          });
          openAllowed.title = `Mở ${item.label} (vẫn tính giờ khi bật Focus Mode)`;
          pill.append(openAllowed);
        }
        const rm = button('×', 'focus-pill-remove', () => {
          focusConfig.allowlist = focusConfig.allowlist.filter(x => x.id !== item.id);
          if (!focusConfig.allowlist.length && focusConfig.enabled) focusConfig.enabled = false;
          saveFocusConfig();
          renderFocusAllowlist();
        });
        rm.title = `Gỡ ${item.label}`;
        pill.append(rm);
        selectedRow.append(pill);
      }
    }
  }
  renderFocusAllowlist();
  focusModeBox.append(focusModeHead, presetRow, selectedRow, addRow, focusReturnBanner, focusHonestyNote);

  // Khung Nhạc nền giữ phát xuyên suốt khi đổi tab trong ứng dụng
  const musicBox = element('div', 'focus-music-compact');
  const musicHead = element('div', 'focus-music-head');
  const musicHeading = element('strong', 'focus-allowlist-title');
  musicHeading.append(icon('music', 15), document.createTextNode(' Nhạc nền tập trung'));
  musicHead.append(
    musicHeading,
    button('Phát nhạc có sẵn', 'focus-btn is-sm', () => {
      playPresetMusic();
      status.textContent = 'Đang phát nhạc nền tập trung.';
    }),
    button('Chọn nhạc từ máy', 'focus-btn is-sm', () => audioInput.click())
  );

  const audioBar = element('div', 'focus-audio-bar');
  const audioRow = element('div', 'focus-audio-row');
  const audioToggle = button('', 'focus-audio-toggle', () => toggleMusicPlay());
  const audioMeta = element('div', 'focus-audio-meta');
  const audioTitle = element('span', 'focus-audio-title', 'Nhạc nền tập trung');
  const audioTime = element('span', 'focus-audio-time', '00:00 / 00:00');
  audioMeta.append(audioTitle, audioTime);
  audioRow.append(audioToggle, audioMeta);

  const audioControls = element('div', 'focus-audio-controls');
  const seekInput = document.createElement('input');
  seekInput.type = 'range';
  seekInput.min = '0';
  seekInput.max = '1000';
  seekInput.value = '0';
  seekInput.className = 'focus-audio-seek';
  seekInput.setAttribute('aria-label', 'Tua nhạc nền');
  let isScrubbing = false;
  seekInput.addEventListener('pointerdown', () => { isScrubbing = true; });
  seekInput.addEventListener('pointerup', () => { isScrubbing = false; });
  seekInput.addEventListener('blur', () => { isScrubbing = false; });
  seekInput.addEventListener('input', () => {
    seekMusic(Number(seekInput.value) / 1000);
  });

  const volInput = document.createElement('input');
  volInput.type = 'range';
  volInput.min = '0';
  volInput.max = '100';
  volInput.value = '100';
  volInput.className = 'focus-audio-vol';
  volInput.setAttribute('aria-label', 'Âm lượng nhạc nền');
  volInput.addEventListener('input', () => {
    setMusicVolume(Number(volInput.value) / 100);
  });
  audioControls.append(seekInput, volInput);

  const audioErr = element('p', 'focus-audio-err');
  audioErr.hidden = true;
  audioBar.append(audioRow, audioControls, audioErr);

  const audioInput = document.createElement('input');
  audioInput.type = 'file';
  audioInput.accept = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.webm,.mp4';
  audioInput.hidden = true;
  audioInput.addEventListener('change', () => {
    const file = audioInput.files?.[0];
    audioInput.value = '';
    if (!file) return;
    const res = loadLocalMusicFile(file);
    if (!res.ok) {
      status.textContent = res.error || 'Tệp đã chọn không phải tệp âm thanh.';
      return;
    }
    status.textContent = `Đã chọn nhạc: ${res.title}`;
  });

  let lastMusicPlaying = null;
  const unsubMusic = subscribeMusic((mState) => {
    audioTitle.textContent = mState.title;
    audioTime.textContent = mState.durationUnknown
      ? `${formatAudioTime(mState.currentTime)} / Đang phát`
      : `${formatAudioTime(mState.currentTime)} / ${formatAudioTime(mState.duration)}`;
    if (!isScrubbing) {
      const ratio = mState.duration > 0 ? Math.round((mState.currentTime / mState.duration) * 1000) : 0;
      seekInput.value = String(Math.max(0, Math.min(1000, ratio)));
    }
    seekInput.disabled = !(mState.duration > 0);
    volInput.value = String(Math.round((mState.volume ?? 1) * 100));
    audioErr.hidden = !mState.errorMsg;
    audioErr.classList.toggle('is-hint', mState.errorKind === 'hint');
    audioErr.textContent = mState.errorMsg || '';
    if (lastMusicPlaying !== mState.playing) {
      lastMusicPlaying = mState.playing;
      audioToggle.replaceChildren(icon(mState.playing ? 'pause' : 'play', 14));
      audioToggle.setAttribute('aria-label', mState.playing ? 'Tạm dừng nhạc nền' : 'Phát nhạc nền');
    }
  });
  musicBox.append(musicHead, audioInput, audioBar);

  statsBox.append(stats, rankRageBox, stateLine, status, actions, shareLabel, focusModeBox, musicBox);

  // TẦNG 2: KHÔNG GIAN LÀM VIỆC TOÀN CHIỀU RỘNG (TAB CHUYỂN ĐỔI LINH HOẠT)
  const workspaceHub = element('section', 'focus-card focus-workspace-hub');
  const hubHeader = element('div', 'focus-workspace-header');
  const hubTitleCol = element('div', '');
  hubTitleCol.append(
    element('h3', '', 'Không gian học tập: Bảng viết · Video · Tài liệu')
  );

  const hubTabs = element('div', 'focus-workspace-tabs');
  let activeWorkspaceMode = 'split'; // 'board' | 'media' | 'split'
  const tabBoard = button('Bảng viết Lớp học Mực', 'focus-ws-tab', () => setWorkspaceMode('board'));
  tabBoard.prepend(icon('whiteboard'));
  const tabMedia = button('Video & Tài liệu PDF', 'focus-ws-tab', () => setWorkspaceMode('media'));
  tabMedia.prepend(icon('video'));
  const tabSplit = button('Kết hợp (Tài liệu + Bảng viết)', 'focus-ws-tab is-active', () => setWorkspaceMode('split'));
  tabSplit.prepend(icon('exam-paper'));
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
  youtubePane.append(element('h4', '', 'Video bài giảng (YouTube)'), element('p', 'focus-muted', 'Hỗ trợ link video lẻ hoặc danh sách phát (playlist).'));
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
      if (focusConfig.enabled && !isUrlAllowedInFocus(resource.openUrl, focusConfig.allowlist)) {
        throw Error('Focus Mode đang bật — hãy thêm YouTube vào danh sách tối đa 3 mục trước khi mở.');
      }
      youtubeFrame.src = resource.embedUrl;
      youtubeFrame.hidden = false;
      youtubeOpen.href = resource.openUrl;
      youtubeOpen.hidden = false;
      resourceStatus.textContent = 'Đã mở video YouTube.';
    } catch (error) {
      youtubeFrame.hidden = true;
      youtubeOpen.hidden = true;
      resourceStatus.textContent = error.message;
    }
  }
  youtubeOpen.addEventListener('click', (event) => {
    if (focusConfig.enabled && !isUrlAllowedInFocus(youtubeOpen.href, focusConfig.allowlist)) {
      event.preventDefault();
      resourceStatus.textContent = 'Focus Mode đang chặn mở tab YouTube ngoài danh sách cho phép.';
    }
  });
  youtubeInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); playYoutube(); }
  });
  youtubePane.append(ytInputRow, youtubeFrame, youtubeOpen);

  // Khung Tài liệu PDF / Google Drive
  const documentPane = element('section', 'focus-resource-pane');
  documentPane.append(element('h4', '', 'Tài liệu học tập (PDF / Google Drive)'), element('p', 'focus-muted', 'Dán link Google Drive/Docs hoặc mở tệp PDF trực tiếp từ máy.'));
  const docInputRow = element('div', 'focus-inline-input-row');
  const documentInput = document.createElement('input');
  documentInput.type = 'url';
  documentInput.className = 'exam-input';
  documentInput.placeholder = 'Dán link Google Drive/Docs…';
  documentInput.setAttribute('aria-label', 'Liên kết tài liệu');
  const previewDocument = button('Mở link', 'focus-btn primary', () => openDocumentLink());
  const pickPdfBtn = button('Chọn PDF', 'focus-btn', () => pdf.click());
  pickPdfBtn.prepend(icon('library'));
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
      if (focusConfig.enabled && !isUrlAllowedInFocus(resource.openUrl, focusConfig.allowlist)) {
        throw Error('Focus Mode đang bật — hãy thêm Drive / Docs vào danh sách tối đa 3 mục trước khi mở.');
      }
      if (pdfURL) { URL.revokeObjectURL(pdfURL); pdfURL = ''; }
      documentFrame.src = resource.embedUrl;
      documentFrame.hidden = false;
      documentOpen.href = resource.openUrl;
      documentOpen.hidden = false;
      resourceStatus.textContent = 'Đã mở bản xem trước tài liệu.';
    } catch (error) {
      documentFrame.hidden = true;
      documentOpen.hidden = true;
      resourceStatus.textContent = error.message;
    }
  }
  documentOpen.addEventListener('click', (event) => {
    if (focusConfig.enabled && documentOpen.href && !documentOpen.href.startsWith('blob:') && !isUrlAllowedInFocus(documentOpen.href, focusConfig.allowlist)) {
      event.preventDefault();
      resourceStatus.textContent = 'Focus Mode đang chặn mở liên kết tài liệu ngoài danh sách cho phép.';
    }
  });
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
    resourceStatus.textContent = `Đang xem PDF từ máy: ${file.name}`;
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

  const fullNotes = button('Toàn màn hình', 'focus-btn is-sm', async () => {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return; }
      await notesFrame.requestFullscreen();
    } catch {
      notesStatus.textContent = 'Trình duyệt không cho phép toàn màn hình tự động; hãy bấm Mở tab riêng.';
    }
  });
  fullNotes.prepend(icon('maximize'));
  const popNotes = button('Mở tab riêng', 'focus-btn is-sm', () => window.open('/focus-notes/index.html?app=board', '_blank', 'noopener,noreferrer'));
  popNotes.prepend(icon('external'));
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

  // --- ĐỒNG BỘ GIỜ HỌC VỚI MÁY CHỦ & BỘ ĐẾM ĐỊA PHƯƠNG THEO TÀI KHOẢN ---
  const SESSION_STORAGE_KEY = 'htvvm-study-session-v1';
  const todayKey = () => getVNDateString();
  const currentUid = () => auth?.currentUser?.uid || AppStore.get('user')?.uid || '';

  function readLocalStudy(uid = currentUid()) {
    try {
      const raw = JSON.parse(localStorage.getItem(studyStorageKeyForUid(uid)) || 'null');
      if (raw && typeof raw === 'object') {
        const isToday = raw.dayKey === todayKey();
        return {
          totalSeconds: Math.max(0, Math.floor(Number(raw.totalSeconds) || 0)),
          todaySeconds: isToday ? Math.max(0, Math.floor(Number(raw.todaySeconds) || 0)) : 0,
          streak: Math.max(0, Math.floor(Number(raw.streak) || 0)),
          loginStreak: Math.max(0, Math.floor(Number(raw.loginStreak) || 0)),
          bestLoginStreak: Math.max(0, Math.floor(Number(raw.bestLoginStreak) || 0)),
          sharing: !!raw.sharing
        };
      }
    } catch {}
    return { totalSeconds: 0, todaySeconds: 0, streak: 0, loginStreak: 0, bestLoginStreak: 0, sharing: false };
  }

  function writeLocalStudy(snap, uid = currentUid()) {
    try {
      localStorage.setItem(
        studyStorageKeyForUid(uid),
        JSON.stringify({
          dayKey: todayKey(),
          totalSeconds: snap.totalSeconds || 0,
          todaySeconds: snap.todaySeconds || 0,
          streak: snap.streak || 0,
          loginStreak: snap.loginStreak || 0,
          bestLoginStreak: snap.bestLoginStreak || 0,
          sharing: !!snap.sharing,
          updatedAt: Date.now()
        })
      );
    } catch {}
  }

  let sessionId = null, sessionOrigin = null, sessionSeq = 0, pingBusy = false, alive = true, sessionStopping = false, sessionStarting = false;
  let manualActive = false;
  let statsSnapshot = (() => {
    const uid = currentUid();
    const cached = readLocalStudy(uid);
    const storeStats = AppStore.get('studyStats');
    return uid && storeStats ? { ...cached, ...storeStats } : cached;
  })();
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

  const isCountingStudy = () => shouldCountStudy({ running, mode: selectedMode, manualActive });

  function flushPendingToSnapshot() {
    if (!isCountingStudy()) {
      pendingMs = 0;
      return;
    }
    const wholeSec = Math.floor(pendingMs / 1000);
    if (wholeSec > 0) {
      statsSnapshot = {
        ...statsSnapshot,
        totalSeconds: (statsSnapshot.totalSeconds || 0) + wholeSec,
        todaySeconds: (statsSnapshot.todaySeconds || 0) + wholeSec,
        streak: auth?.currentUser ? (statsSnapshot.streak || 0) : Math.max(1, statsSnapshot.streak || 0)
      };
      pendingMs -= wholeSec * 1000;
      writeLocalStudy(statsSnapshot);
    }
  }

  function drawStats() {
    const liveSeconds = isCountingStudy() ? Math.floor(pendingMs / 1000) : 0;
    const totalSeconds = (statsSnapshot.totalSeconds || 0) + liveSeconds;
    const todaySeconds = (statsSnapshot.todaySeconds || 0) + liveSeconds;
    const studyStreak = Math.max(statsSnapshot.streak || 0, !auth?.currentUser && todaySeconds > 0 ? 1 : 0);
    stats.replaceChildren();
    for (const [label, val] of [
      ['Hôm nay (1 ngày)', fmtFull(todaySeconds)],
      ['Chuỗi học', `${studyStreak} ngày · ${fmtFull(totalSeconds)}`],
      ['Mốc chuỗi kế', `${getNextStreakMilestone(studyStreak)} ngày`],
      ['Rank hôm nay', titleFor(todaySeconds)]
    ]) {
      const item = element('div', 'focus-stat');
      item.append(element('small', '', label), element('strong', '', val));
      stats.append(item);
    }
    const rp = rankProgressFor(todaySeconds);
    const pct = Math.round(rp.progressRatio * 100);
    rankRageBox.classList.toggle('is-charging', isCountingStudy());
    rankRageBox.classList.toggle('is-max', rp.isMax);
    if (rp.isMax) {
      rankRageTitle.textContent = `${rp.currentTitle} · Đạt đỉnh Rank ngày hôm nay`;
      rankRageRemain.textContent = '100% · Đã đạt mức tối đa trong ngày';
    } else {
      rankRageTitle.textContent = `Rank trong ngày: ${rp.currentTitle} → ${rp.nextTitle}`;
      rankRageRemain.textContent = `${pct}% · Còn ${fmtFull(rp.remainingSeconds)}`;
    }
    rankRageFill.style.width = `${pct}%`;
    shareInput.checked = !!statsSnapshot.sharing;
    if (todaySeconds >= 18000) {
      stateLine.textContent = 'Bạn đã hoàn thành 5 giờ học hôm nay. Hãy nghỉ ngơi và vận động nhẹ.';
    } else if (isCountingStudy()) {
      stateLine.textContent = focusConfig.enabled
        ? `Focus Mode đang chạy (${focusConfig.allowlist.map(x => x.label).join(', ')}).`
        : 'Đang đếm giờ học liên tục.';
    } else {
      stateLine.textContent = 'Bắt đầu đồng hồ tập trung hoặc bấm "Ghi nhận giờ học" để tính giờ.';
    }
  }

  function showStats(s, reconcile = true) {
    if (!s) return;
    if (reconcile) {
      // Server stats are authoritative whenever synced; keep only sub-second live tick if still running.
      pendingMs = isCountingStudy() ? (pendingMs % 1000) : 0;
      statsSnapshot = {
        totalSeconds: Math.max(0, Math.floor(Number(s.totalSeconds) || 0)),
        todaySeconds: Math.max(0, Math.floor(Number(s.todaySeconds) || 0)),
        streak: Math.max(0, Math.floor(Number(s.streak) || 0)),
        loginStreak: Math.max(0, Math.floor(Number(s.loginStreak) || 0)),
        bestLoginStreak: Math.max(0, Math.floor(Number(s.bestLoginStreak) || 0)),
        sharing: !!s.sharing
      };
      writeLocalStudy(statsSnapshot);
    } else {
      statsSnapshot = { ...statsSnapshot, sharing: !!s.sharing };
      writeLocalStudy(statsSnapshot);
    }
    syncStudyStatsToStore({ ...statsSnapshot, ...s });
    drawStats();
  }

  function updateSessionButtons() {
    const activeAny = isCountingStudy();
    begin.disabled = activeAny || sessionStopping || sessionStarting;
    end.disabled = !activeAny && !sessionStarting;
  }

  async function startSession(source = 'manual') {
    if (source === 'manual') {
      manualActive = true;
      updateSessionButtons();
      drawStats();
    }
    if (!auth?.currentUser) {
      status.textContent = 'Đang đếm giờ học trên thiết bị (đăng nhập Google để đồng bộ lên bảng xếp hạng).';
      return true;
    }
    if (sessionStarting || sessionId) return true;
    const mySeq = ++sessionSeq;
    sessionStarting = true;
    updateSessionButtons();
    try {
      const data = await request('/api/study-tracker', 'POST', { action: 'start' });
      const startedId = data?.sessionId;
      const desired = alive && mySeq === sessionSeq && (source === 'manual' ? manualActive : (running && selectedMode === 'focus'));
      if (!desired) {
        if (startedId) {
          request('/api/study-tracker', 'POST', { action: 'stop', sessionId: startedId }, { keepalive: true }).catch(() => {});
        }
        return false;
      }
      sessionId = startedId;
      sessionOrigin = source;
      pendingMs = 0;
      saveSession(sessionId, sessionOrigin);
      showStats(data.stats, true);
      status.textContent = source === 'pomodoro' ? 'Đồng hồ đang chạy và đồng bộ giờ học.' : 'Đang ghi nhận giờ học trực tuyến.';
      return true;
    } catch {
      status.textContent = 'Đang đếm giờ học liên tục trên thiết bị (tự động đồng bộ lại khi mạng ổn định).';
      return true;
    } finally {
      sessionStarting = false;
      updateSessionButtons();
    }
  }

  async function loadStatus() {
    statsSnapshot = readLocalStudy();
    drawStats();
    if (!auth?.currentUser) return;
    try {
      const saved = getSavedSession();
      if (saved?.id && !isCountingStudy()) {
        // Close abandoned session from an earlier visit instead of silently resuming counting.
        clearSavedSession();
        await request('/api/study-tracker', 'POST', { action: 'stop', sessionId: saved.id }, { keepalive: true }).catch(() => {});
      }
      const data = await request('/api/study-tracker');
      if (!alive) return;
      showStats(data.stats, true);
      updateSessionButtons();
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
        if (!sessionStarting && isCountingStudy()) {
          await startSession(running ? 'pomodoro' : 'manual');
        }
      } else {
        const id = sessionId;
        const data = await request('/api/study-tracker', 'POST', { action: 'ping', sessionId: id });
        if (alive && sessionId === id && isCountingStudy()) {
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
    sessionSeq += 1;
    manualActive = false;
    flushPendingToSnapshot();
    pendingMs = 0;
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
    } else if (pendingMs !== 0) {
      pendingMs = 0;
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
        timerHint.textContent = 'Đã hoàn thành phiên đồng hồ. Hãy nghỉ ngơi hoặc bắt đầu phiên tiếp theo.';
        if (sessionOrigin === 'pomodoro' || sessionId) {
          void stopSession('Hoàn thành phiên Pomodoro — giờ học đã được lưu.');
        } else {
          status.textContent = 'Đã hết giờ Pomodoro.';
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
    if (!alive) return;
    pendingMs = 0;
    statsSnapshot = readLocalStudy();
    if (auth?.currentUser) void loadStatus();
    else drawStats();
  });
  const unsubStudySync = AppStore.subscribe('studyStats', (stats) => {
    if (!alive || !stats) return;
    statsSnapshot = {
      ...statsSnapshot,
      loginStreak: Math.max(0, Number(stats.loginStreak) || 0),
      bestLoginStreak: Math.max(0, Number(stats.bestLoginStreak) || 0),
      ...(!isCountingStudy() ? {
        totalSeconds: Math.max(0, Number(stats.totalSeconds) || 0),
        todaySeconds: Math.max(0, Number(stats.todaySeconds) || 0),
        streak: Math.max(0, Number(stats.streak) || 0),
        sharing: Boolean(stats.sharing)
      } : {})
    };
    drawStats();
  });

  const showReturnConfirm = (awayMs) => {
    pendingAwayMs = awayMs;
    const mins = Math.floor(awayMs / 60000);
    const secs = Math.floor((awayMs % 60000) / 1000);
    const labelTime = mins > 0 ? `${mins} phút ${secs} giây` : `${secs} giây`;
    focusReturnBanner.hidden = false;
    focusReturnBanner.replaceChildren(
      element('p', '', `Bạn vừa rời tab ${labelTime} trong Focus Mode (${focusConfig.allowlist.map(x => x.label).join(', ')}). Bạn có đang học trên các web/ứng dụng đã chọn không?`)
    );
    const btnRow = element('div', 'focus-return-actions');
    const keepBtn = button(`Có, cộng +${labelTime}`, 'focus-btn is-sm primary', async () => {
      const claim = pendingAwayMs;
      pendingAwayMs = 0;
      focusReturnBanner.hidden = true;
      pendingMs += claim;
      flushPendingToSnapshot();
      drawStats();
      if (sessionId && auth?.currentUser) {
        try {
          const res = await request('/api/study-tracker', 'POST', {
            action: 'ping',
            sessionId,
            focusMode: true,
            focusAwayMs: claim
          });
          if (alive && res?.stats) showStats(res.stats, true);
        } catch {}
      }
      status.textContent = `Đã giữ ${labelTime} thời gian học trong Focus Mode.`;
    });
    const dropBtn = button('Không cộng khoảng này', 'focus-btn is-sm', () => {
      pendingAwayMs = 0;
      focusReturnBanner.hidden = true;
      status.textContent = 'Đã bỏ qua thời gian ngoài trang HTVVM.';
    });
    btnRow.append(keepBtn, dropBtn);
    focusReturnBanner.append(btnRow);
  };

  const onVisibility = () => {
    if (document.hidden) {
      if (focusConfig.enabled && isCountingStudy()) focusHiddenAt = Date.now();
      return;
    }
    if (running) {
      seconds = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
      updateProgressUI();
    }
    if (focusConfig.enabled && focusHiddenAt > 0 && isCountingStudy()) {
      const awayMs = Math.min(MAX_FOCUS_AWAY_MS, Math.max(0, Date.now() - focusHiddenAt));
      focusHiddenAt = 0;
      if (awayMs >= 15000) {
        showReturnConfirm(awayMs);
      } else if (awayMs > 2000) {
        pendingMs += awayMs;
        flushPendingToSnapshot();
        drawStats();
      }
    } else {
      focusHiddenAt = 0;
    }
  };
  const onSidebarGuard = (event) => {
    const link = event.target?.closest?.('.sidebar a');
    if (!link || !focusConfig.enabled || !isCountingStudy()) return;
    const allowContinue = confirm('Focus Mode đang bật trong Góc tập trung. Tắt Focus Mode để chuyển sang mục khác?');
    if (!allowContinue) {
      event.preventDefault();
      event.stopPropagation();
      status.textContent = 'Đã giữ bạn ở lại Focus Mode.';
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('click', onSidebarGuard, true);

  const watcher = new MutationObserver(() => {
    if (!root.isConnected) cleanup();
  });
  watcher.observe(document.getElementById('main-content') || document.body, { childList: true });

  cleanup = () => {
    if (!alive) return;
    alive = false;
    sessionSeq += 1;
    if (running && endTimeMs > 0) {
      seconds = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
    }
    running = false;
    manualActive = false;
    endTimeMs = 0;
    pendingMs = 0;
    clearSavedSession();
    saveTimerState();
    unsubUser();
    unsubStudySync();
    unsubMusic();
    clearInterval(timerInterval);
    clearInterval(heartbeat);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('click', onSidebarGuard, true);
    watcher.disconnect();
    if (pdfURL) URL.revokeObjectURL(pdfURL);
    if (sessionId && auth?.currentUser) {
      const id = sessionId;
      sessionId = null;
      request('/api/study-tracker', 'POST', { action: 'stop', sessionId: id }, { keepalive: true })
        .then((res) => { if (res?.stats) syncStudyStatsToStore(res.stats); })
        .catch(() => {});
    }
  };

  drawStats();
  void loadStatus();
  return root;
}
