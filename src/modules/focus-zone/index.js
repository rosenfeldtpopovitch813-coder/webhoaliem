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
import {
  formatTimerClock,
  formatFullDuration,
  getFocusState,
  subscribeFocus,
  togglePomodoro,
  resetPomodoro,
  selectPomodoroPreset,
  applyCustomDuration,
  startStudySession,
  stopAllStudySessions,
  setLeaderboardSharing,
  toggleFocusMode,
  addFocusTarget,
  removeFocusTarget,
  markFocusHiddenNow,
  claimPendingAway,
  dropPendingAway,
  refreshStudyStatus,
  toggleFocusPopupDisplay
} from '../../core/focus-session.js';
import {
  MAX_ALLOWLIST_ITEMS,
  normalizeFocusTarget,
  isUrlAllowedInFocus,
  getNextStreakMilestone,
  rankProgressFor,
  titleFor
} from '../../../shared/study-core.js';
import { resolveResourceLink } from '../../../shared/resource-links.js';
import {
  startYouTubePlayer,
  stopYouTubePlayer,
  subscribeYouTube,
  attachYouTubeFocusSlot,
  readLastYouTubeInput,
  requestYouTubeGeometrySync
} from '../../core/youtube-player.js';

const fmt = formatTimerClock;
const fmtFull = formatFullDuration;

function field(type, placeholder, value = '') {
  const el = element(type === 'textarea' ? 'textarea' : 'input', 'exam-input');
  if (type !== 'textarea') el.type = type;
  el.placeholder = placeholder;
  el.value = value;
  return el;
}

let cleanup = () => {};

export function renderFocus() {
  cleanup();
  const root = element('div', 'focus-page');

  const heading = element('section', 'focus-hero');
  heading.append(
    element('h2', 'hero-title', 'Góc tập trung'),
    element('p', 'hero-subtitle', 'Đồng hồ Pomodoro chạy nền xuyên suốt các mục trong web, Màn hình nổi (Popup) khi học online, Focus Mode, bảng viết tay và nhạc nền.')
  );
  root.append(heading);

  // TẦNG 1: BẢNG ĐIỀU KHIỂN ĐỒNG HỒ & TIẾN ĐỘ (2 CỘT CÂN ĐỐI)
  const topDashboard = element('div', 'focus-dashboard-top');
  const timerBox = element('section', 'focus-card focus-timer-station');
  const statsBox = element('section', 'focus-card focus-stats-station');
  topDashboard.append(timerBox, statsBox);
  root.append(topDashboard);

  const initialState = getFocusState();
  let focusConfig = initialState.focusConfig;

  // --- CỘT TRÁI: ĐỒNG HỒ POMODORO CHẠY NỀN + MÀN HÌNH NỔI (POPUP DISPLAY) ---
  const timerHead = element('div', 'focus-card-header-row');
  const timerTitleWrap = element('div', '');
  timerTitleWrap.append(
    element('h3', '', 'Đồng hồ tập trung')
  );
  const timerHeadActions = element('div', 'focus-card-header-actions');
  const popupDisplayBtn = button(' Màn hình nổi', 'focus-btn is-sm focus-popup-btn', () => {
    void toggleFocusPopupDisplay();
  });
  popupDisplayBtn.prepend(icon('pip', 14));
  popupDisplayBtn.title = 'Mở cửa sổ nổi (Always-on-Top / Picture-in-Picture) để xem giờ tập trung khi học online trên ứng dụng hoặc tab khác';

  const customToggleBtn = button('Đổi thời lượng', 'focus-btn is-sm', () => {
    durationEditor.hidden = !durationEditor.hidden;
  });
  customToggleBtn.prepend(icon('sliders'));
  timerHeadActions.append(popupDisplayBtn, customToggleBtn);
  timerHead.append(timerTitleWrap, timerHeadActions);
  timerBox.append(timerHead);

  let modeButtons = [];
  const modes = element('div', 'focus-preset-pills');

  const clockDisplayWrap = element('div', 'focus-clock-face');
  const modeBadge = element('span', 'focus-clock-mode-pill', initialState.selectedMode === 'focus' ? 'Phiên tập trung' : 'Phiên nghỉ ngơi');
  const digits = element('div', 'focus-time', fmt(initialState.seconds));
  const progressTrack = element('div', 'focus-progress-track');
  const progressBar = element('div', 'focus-progress-bar');
  progressTrack.append(progressBar);
  const timerHint = element('p', 'focus-timer-subnote', initialState.timerHint);
  clockDisplayWrap.append(modeBadge, digits, progressTrack, timerHint);

  const PRESETS = [
    ['Tập trung · 25 phút', 1500, 'focus'],
    ['Nghỉ ngắn · 5 phút', 300, 'break'],
    ['Nghỉ dài · 15 phút', 900, 'break'],
    ['Luyện đề · 50 phút', 3000, 'focus']
  ];
  for (const [label, s, mode] of PRESETS) {
    const b = button(label, 'focus-btn', () => {
      selectPomodoroPreset(s, mode);
      minutesInput.value = String(Math.floor(s / 60));
      secondsInput.value = String(s % 60);
      customStatus.textContent = `Đang chọn ${Math.floor(s / 60)} phút ${s % 60} giây.`;
    });
    modes.append(b);
    modeButtons.push(b);
  }

  const controls = element('div', 'focus-actions focus-main-controls');
  const toggle = button(initialState.running ? 'Tạm dừng' : 'Bắt đầu', 'focus-btn primary focus-start-btn', () => {
    togglePomodoro();
  });
  const reset = button('Đặt lại', 'focus-btn', () => {
    resetPomodoro();
  });
  const popupMainBtn = button(' Bật Popup chạy nền', 'focus-btn focus-popup-btn', () => {
    void toggleFocusPopupDisplay();
  });
  popupMainBtn.prepend(icon('pip', 15));
  popupMainBtn.title = 'Ghim đồng hồ tập trung nổi trên Zoom / YouTube / Meet khi học online';
  controls.append(toggle, reset, popupMainBtn);

  // Hộp tùy chỉnh thời lượng (ẩn/hiện gọn gàng)
  const durationEditor = element('div', 'focus-duration-editor');
  durationEditor.hidden = true;
  durationEditor.append(element('label', 'focus-duration-label', 'Tùy chỉnh thời lượng (1 giây – 240 phút)'));
  const minutesInput = field('number', 'Phút', String(Math.floor(initialState.duration / 60)));
  minutesInput.min = '0'; minutesInput.max = '240'; minutesInput.step = '1'; minutesInput.setAttribute('aria-label', 'Số phút');
  const secondsInput = field('number', 'Giây', String(initialState.duration % 60));
  secondsInput.min = '0'; secondsInput.max = '59'; secondsInput.step = '1'; secondsInput.setAttribute('aria-label', 'Số giây');
  const durationFields = element('div', 'focus-duration-fields');
  const applyDuration = button('Áp dụng', 'focus-btn primary', () => {
    const res = applyCustomDuration(Number(minutesInput.value), Number(secondsInput.value));
    if (!res.ok) {
      customStatus.textContent = res.error;
      return;
    }
    customStatus.textContent = `Đã đặt ${Math.floor(res.duration / 60)} phút ${res.duration % 60} giây.`;
    durationEditor.hidden = true;
  });
  durationFields.append(minutesInput, element('span', 'focus-duration-unit', 'phút'), secondsInput, element('span', 'focus-duration-unit', 'giây'), applyDuration);
  const customStatus = element('p', 'focus-muted', `Đang dùng ${Math.floor(initialState.duration / 60)} phút ${initialState.duration % 60} giây.`);
  durationEditor.append(durationFields, customStatus);

  timerBox.append(modes, durationEditor, clockDisplayWrap, controls);

  // --- CỘT PHẢI: TIẾN ĐỘ HỌC TẬP & NHẠC TẬP TRUNG ---
  const statsHead = element('div', 'focus-card-header-row');
  const statsTitleWrap = element('div', '');
  statsTitleWrap.append(
    element('h3', '', 'Tiến độ học tập & Nhạc tập trung')
  );
  statsHead.append(statsTitleWrap);
  statsBox.append(statsHead);

  const stats = element('div', 'focus-stats');
  for (const [label, val] of [['Hôm nay (1 ngày)', '00:00:00'], ['Chuỗi học', '0 ngày · 00:00:00'], ['Mốc chuỗi kế', '3 ngày'], ['Rank hôm nay', 'Nước tinh khiết']]) {
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
  const status = element('p', 'focus-status-banner', initialState.statusMsg);
  const actions = element('div', 'focus-actions');
  const begin = button('Ghi nhận giờ học', 'focus-btn primary', () => startStudySession('manual'));
  const end = button('Lưu & Kết thúc phiên', 'focus-btn', () => stopAllStudySessions('Đã lưu và kết thúc phiên học.'));
  end.disabled = true;
  actions.append(begin, end);

  const shareLabel = element('label', 'focus-share');
  const shareInput = document.createElement('input');
  shareInput.type = 'checkbox';
  shareInput.addEventListener('change', () => {
    void setLeaderboardSharing(shareInput.checked);
  });
  shareLabel.append(shareInput, document.createTextNode(' Hiện tôi trên bảng xếp hạng Chăm chỉ'));

  // --- FOCUS MODE: ALLOWLIST 2–3 WEB / ỨNG DỤNG ĐƯỢC PHÉP ---
  const PRESET_FOCUS_TARGETS = [
    ['youtube.com', 'YouTube'],
    ['drive.google.com', 'Drive / Docs'],
    ['desmos.com', 'Desmos'],
    ['geogebra.org', 'GeoGebra'],
    ['Ứng dụng trên máy (Word/Anki)', 'App trên máy']
  ];

  const focusModeBox = element('div', 'focus-allowlist-box');
  const focusModeHead = element('div', 'focus-allowlist-head');
  const focusModeTitle = element('div', 'focus-allowlist-title');
  focusModeTitle.append(
    icon('lock', 15),
    element('strong', '', 'Focus Mode (tối đa 3 web / app học)')
  );
  const focusToggleBtn = button('', 'focus-btn is-sm', () => {
    toggleFocusMode();
  });
  focusModeHead.append(focusModeTitle, focusToggleBtn);

  const presetRow = element('div', 'focus-allowlist-presets');
  const selectedRow = element('div', 'focus-allowlist-selected');
  const addRow = element('div', 'focus-inline-input-row focus-allowlist-add');
  const customTargetInput = field('text', 'Thêm web (vd: khanacademy.org) hoặc app…');
  customTargetInput.maxLength = 80;
  const handleAddTarget = () => {
    const res = addFocusTarget(customTargetInput.value);
    if (res.ok) customTargetInput.value = '';
  };
  const addTargetBtn = button('Thêm', 'focus-btn is-sm primary', handleAddTarget);
  addRow.append(customTargetInput, addTargetBtn);
  customTargetInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddTarget(); }
  });

  const focusReturnBanner = element('div', 'focus-return-banner');
  focusReturnBanner.hidden = true;
  const focusHonestyNote = element(
    'small',
    'focus-honesty-note',
    'Mẹo học online: Khi chuyển sang mục khác trong HTVVM Studio giờ học vẫn tính nền tự động. Nếu học trên Zoom/YouTube/Meet, hãy bấm "Bật Popup chạy nền" để ghim đồng hồ nổi trên mọi ứng dụng.'
  );

  let lastAllowlistSignature = '';
  function renderFocusAllowlist(cfg) {
    const sig = JSON.stringify(cfg);
    if (sig === lastAllowlistSignature) return;
    lastAllowlistSignature = sig;
    focusModeBox.classList.toggle('is-active', cfg.enabled);
    focusToggleBtn.textContent = cfg.enabled ? 'Đang bật · Tắt' : 'Bật Focus Mode';
    focusToggleBtn.classList.toggle('primary', cfg.enabled);

    presetRow.replaceChildren();
    for (const [rawVal, shortLabel] of PRESET_FOCUS_TARGETS) {
      const normalized = normalizeFocusTarget(rawVal);
      const selected = cfg.allowlist.some(x => x.id === normalized.id);
      const chip = button(selected ? `✓ ${shortLabel}` : `+ ${shortLabel}`, `focus-preset-chip${selected ? ' is-picked' : ''}`, () => {
        if (selected) removeFocusTarget(normalized.id);
        else addFocusTarget(rawVal);
      });
      presetRow.append(chip);
    }

    selectedRow.replaceChildren();
    if (!cfg.allowlist.length) {
      selectedRow.append(element('small', 'focus-muted', 'Chưa chọn mục nào (bấm gợi ý hoặc tự thêm tối đa 3 mục).'));
    } else {
      for (const item of cfg.allowlist) {
        const pill = element('span', 'focus-allowed-pill');
        pill.append(element('span', '', `${item.kind === 'web' ? 'Web' : 'App'}: ${item.label}`));
        if (item.kind === 'web' && item.openUrl) {
          const openAllowed = button('↗', 'focus-pill-action', () => {
            const cur = getFocusState();
            if (!cur.counting) void startStudySession(cur.running ? 'pomodoro' : 'manual');
            markFocusHiddenNow();
            window.open(item.openUrl, '_blank', 'noopener,noreferrer');
          });
          openAllowed.title = `Mở ${item.label} (vẫn tính giờ khi bật Focus Mode)`;
          pill.append(openAllowed);
        }
        const rm = button('×', 'focus-pill-remove', () => removeFocusTarget(item.id));
        rm.title = `Gỡ ${item.label}`;
        pill.append(rm);
        selectedRow.append(pill);
      }
    }
  }
  renderFocusAllowlist(focusConfig);
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

  // Khung YouTube (Chạy nền xuyên tác vụ — chỉ dừng khi vào phòng thi hoặc bấm Tắt)
  const youtubePane = element('section', 'focus-resource-pane');
  youtubePane.append(
    element('h4', '', 'Video & Nhạc bài giảng (YouTube chạy nền)'),
    element('p', 'focus-muted', 'Hỗ trợ video lẻ hoặc danh sách phát — vẫn phát tiếp khi chuyển sang mục khác, chỉ tự dừng khi làm bài thi hoặc tắt.')
  );
  const ytInputRow = element('div', 'focus-inline-input-row');
  const youtubeInput = document.createElement('input');
  youtubeInput.type = 'url';
  youtubeInput.className = 'exam-input';
  youtubeInput.placeholder = 'Dán link YouTube rồi nhấn Enter…';
  youtubeInput.setAttribute('aria-label', 'Liên kết YouTube');
  youtubeInput.value = readLastYouTubeInput();
  const openYoutube = button('Phát YouTube', 'focus-btn primary', () => playYoutube());
  const clearYoutube = button('Tắt YouTube', 'focus-btn', () => {
    youtubeInput.value = '';
    stopYouTubePlayer('user');
    resourceStatus.textContent = 'Đã tắt trình phát YouTube.';
  });
  ytInputRow.append(youtubeInput, openYoutube, clearYoutube);

  const youtubeSlot = element('div', 'focus-youtube-slot');
  youtubeSlot.id = 'focus-youtube-slot';
  youtubeSlot.hidden = true;

  const youtubeOpen = document.createElement('a');
  youtubeOpen.className = 'focus-resource-open';
  youtubeOpen.target = '_blank';
  youtubeOpen.rel = 'noopener noreferrer';
  youtubeOpen.textContent = 'Mở YouTube trong tab mới ↗';
  youtubeOpen.hidden = true;
  function playYoutube() {
    try {
      const st = startYouTubePlayer(youtubeInput.value, focusConfig);
      youtubeOpen.href = st.openUrl;
      youtubeOpen.hidden = !st.openUrl;
      resourceStatus.textContent = 'Đang phát YouTube chạy nền (chuyển sang mục khác không bị mất nhạc).';
    } catch (error) {
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
  youtubePane.append(ytInputRow, youtubeSlot, youtubeOpen);
  const detachYouTubeSlot = attachYouTubeFocusSlot(youtubeSlot);
  const unsubYouTube = subscribeYouTube((ytState) => {
    youtubeSlot.hidden = !ytState.active;
    youtubeSlot.classList.toggle('has-active-yt', ytState.active);
    if (ytState.active && ytState.openUrl) {
      youtubeOpen.href = ytState.openUrl;
      youtubeOpen.hidden = false;
      if (!youtubeInput.value && ytState.rawInput) youtubeInput.value = ytState.rawInput;
    } else {
      youtubeOpen.hidden = true;
    }
    requestYouTubeGeometrySync();
  });

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
    requestYouTubeGeometrySync();
  }
  setWorkspaceMode('split');

  // --- KẾT NỐI GIAO DIỆN VỚI BỘ ĐẾM CHẠY NỀN (KHÔNG DỪNG KHI ĐỔI MỤC TRONG WEB) ---
  let alive = true;
  let lastPendingAwayRendered = -1;
  let lastStatusMsg = null;

  function renderReturnConfirm(awayMs, cfg) {
    if (awayMs === lastPendingAwayRendered) return;
    lastPendingAwayRendered = awayMs;
    if (!awayMs || awayMs <= 0) {
      focusReturnBanner.hidden = true;
      focusReturnBanner.replaceChildren();
      return;
    }
    const mins = Math.floor(awayMs / 60000);
    const secs = Math.floor((awayMs % 60000) / 1000);
    const labelTime = mins > 0 ? `${mins} phút ${secs} giây` : `${secs} giây`;
    focusReturnBanner.hidden = false;
    focusReturnBanner.replaceChildren(
      element('p', '', `Bạn vừa rời tab ${labelTime} trong Focus Mode (${cfg.allowlist.map(x => x.label).join(', ')}). Bạn có đang học trên các web/ứng dụng đã chọn không?`)
    );
    const btnRow = element('div', 'focus-return-actions');
    const keepBtn = button(`Có, cộng +${labelTime}`, 'focus-btn is-sm primary', () => {
      void claimPendingAway();
    });
    const dropBtn = button('Không cộng khoảng này', 'focus-btn is-sm', () => {
      dropPendingAway();
    });
    btnRow.append(keepBtn, dropBtn);
    focusReturnBanner.append(btnRow);
  }

  function paintFocusState(state) {
    if (!alive || !state) return;
    focusConfig = state.focusConfig;

    // 1. Timer face, progress & preset selection
    digits.textContent = fmt(state.seconds);
    const pct = state.duration > 0 ? Math.max(0, Math.min(100, ((state.duration - state.seconds) / state.duration) * 100)) : 0;
    progressBar.style.width = `${pct.toFixed(1)}%`;
    modeBadge.textContent = state.selectedMode === 'focus' ? 'Phiên tập trung' : 'Phiên nghỉ ngơi';
    modeBadge.classList.toggle('is-break', state.selectedMode === 'break');
    clockDisplayWrap.classList.toggle('is-running', state.running);
    timerHint.textContent = state.timerHint;
    toggle.textContent = state.running ? 'Tạm dừng' : 'Bắt đầu';
    toggle.setAttribute('aria-pressed', String(state.running));

    modeButtons.forEach((b, i) => {
      const [, pSec, pMode] = PRESETS[i] || [];
      b.classList.toggle('selected', state.duration === pSec && state.selectedMode === pMode);
    });

    // 2. Popup Display buttons
    popupDisplayBtn.classList.toggle('is-active', state.popupOpen);
    popupDisplayBtn.replaceChildren(icon('pip', 14), document.createTextNode(state.popupOpen ? ' Đóng Popup' : ' Màn hình nổi'));
    popupMainBtn.classList.toggle('is-active', state.popupOpen);
    popupMainBtn.replaceChildren(icon('pip', 15), document.createTextNode(state.popupOpen ? ' Đóng Popup nổi' : ' Bật Popup chạy nền'));

    // 3. Stats & Rank Rage bar
    const todaySeconds = state.liveTodaySeconds;
    const totalSeconds = state.liveTotalSeconds;
    const studyStreak = state.liveStreak;
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
    const rankPct = Math.round(rp.progressRatio * 100);
    rankRageBox.classList.toggle('is-charging', state.counting);
    rankRageBox.classList.toggle('is-max', rp.isMax);
    if (rp.isMax) {
      rankRageTitle.textContent = `${rp.currentTitle} · Đạt đỉnh Rank ngày hôm nay`;
      rankRageRemain.textContent = '100% · Đã đạt mức tối đa trong ngày';
    } else {
      rankRageTitle.textContent = `Rank trong ngày: ${rp.currentTitle} → ${rp.nextTitle}`;
      rankRageRemain.textContent = `${rankPct}% · Còn ${fmtFull(rp.remainingSeconds)}`;
    }
    rankRageFill.style.width = `${rankPct}%`;
    shareInput.checked = !!state.statsSnapshot.sharing;

    if (todaySeconds >= 18000) {
      stateLine.textContent = 'Bạn đã hoàn thành 5 giờ học hôm nay. Hãy nghỉ ngơi và vận động nhẹ.';
    } else if (state.counting) {
      stateLine.textContent = state.popupOpen
        ? 'Đang chạy nền cùng Màn hình nổi (Popup Display) — tự động giữ giờ khi học online.'
        : state.focusConfig.enabled
          ? `Focus Mode đang chạy nền (${state.focusConfig.allowlist.map(x => x.label).join(', ')}).`
          : 'Đang đếm giờ học liên tục (vẫn tiếp tục khi chuyển sang mục khác trong web).';
    } else {
      stateLine.textContent = 'Bắt đầu đồng hồ tập trung hoặc bấm "Ghi nhận giờ học" để tính giờ.';
    }
    if (state.statusMsg !== lastStatusMsg) {
      lastStatusMsg = state.statusMsg;
      status.textContent = state.statusMsg;
    }

    begin.disabled = state.counting || state.sessionStopping || state.sessionStarting;
    end.disabled = !state.counting && !state.running && !state.sessionStarting;

    // 4. Focus Mode allowlist & away confirmation banner
    renderFocusAllowlist(state.focusConfig);
    renderReturnConfirm(state.pendingAwayMs, state.focusConfig);
  }

  const unsubFocus = subscribeFocus(paintFocusState);

  const watcher = new MutationObserver(() => {
    if (!root.isConnected) cleanup();
  });
  watcher.observe(document.getElementById('main-content') || document.body, { childList: true });

  // Chỉ gỡ listener giao diện khi rời /focus — tuyệt đối không tắt đồng hồ, YouTube hay phiên tính giờ nền!
  cleanup = () => {
    if (!alive) return;
    alive = false;
    unsubFocus();
    unsubMusic();
    unsubYouTube();
    detachYouTubeSlot();
    watcher.disconnect();
    if (pdfURL) URL.revokeObjectURL(pdfURL);
  };

  void refreshStudyStatus();
  return root;
}
