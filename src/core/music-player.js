import { AppStore } from './store.js';
import { element, button } from './dom.js';
import { icon } from './icons.js';

export const DEFAULT_TRACK_URL = '/study-break-music.wav';
export const DEFAULT_TRACK_TITLE = 'Nhạc nền học tập';

const FAB_POS_KEY = 'htvvm_music_fab_pos';
const FAB_SIZE = 44;
const FAB_MARGIN = 10;

export function clampUnit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function clampMiniPosition(x, y, viewportWidth, viewportHeight, size = FAB_SIZE, margin = FAB_MARGIN) {
  const vw = Math.max(size + margin * 2, Number(viewportWidth) || 0);
  const vh = Math.max(size + margin * 2, Number(viewportHeight) || 0);
  const maxX = vw - size - margin;
  const maxY = vh - size - margin;
  return {
    x: Math.round(Math.max(margin, Math.min(maxX, Number(x) || margin))),
    y: Math.round(Math.max(margin, Math.min(maxY, Number(y) || margin)))
  };
}

export function formatAudioTime(seconds) {
  const total = Math.floor(Number(seconds));
  if (!Number.isFinite(total) || total <= 0) return '00:00';
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

let audioEl = null;
let objectUrl = '';
let currentTitle = DEFAULT_TRACK_TITLE;
let activated = false;
let errorMsg = '';
let lastTimeNotify = 0;
let mounted = false;
const listeners = new Set();

function releaseObjectUrl() {
  if (!objectUrl) return;
  URL.revokeObjectURL(objectUrl);
  objectUrl = '';
}

function getAudio() {
  if (audioEl || typeof document === 'undefined') return audioEl;
  audioEl = document.createElement('audio');
  audioEl.loop = true;
  audioEl.preload = 'metadata';
  audioEl.src = DEFAULT_TRACK_URL;
  audioEl.hidden = true;
  const emit = () => notify();
  audioEl.addEventListener('play', () => {
    activated = true;
    errorMsg = '';
    notify();
  });
  audioEl.addEventListener('pause', emit);
  audioEl.addEventListener('ended', emit);
  audioEl.addEventListener('loadedmetadata', emit);
  audioEl.addEventListener('durationchange', emit);
  audioEl.addEventListener('volumechange', emit);
  audioEl.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (now - lastTimeNotify < 250) return;
    lastTimeNotify = now;
    notify();
  });
  audioEl.addEventListener('error', () => {
    errorMsg = 'Không thể phát tệp âm thanh này.';
    notify();
  });
  return audioEl;
}

export function getMusicState() {
  const audio = getAudio();
  const duration = audio && Number.isFinite(audio.duration) ? audio.duration : 0;
  const currentTime = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  const playing = Boolean(audio && !audio.paused && !audio.ended);
  return {
    playing,
    paused: !playing,
    activated,
    title: currentTitle,
    isCustom: Boolean(objectUrl),
    currentTime,
    duration,
    volume: audio ? audio.volume : 1,
    errorMsg
  };
}

function notify() {
  const snapshot = getMusicState();
  for (const fn of [...listeners]) fn(snapshot);
}

export function subscribeMusic(callback) {
  listeners.add(callback);
  callback(getMusicState());
  return () => listeners.delete(callback);
}

function attemptPlay(audio) {
  if (!audio) return;
  activated = true;
  errorMsg = '';
  const result = audio.play();
  if (result && typeof result.catch === 'function') {
    result.catch(() => {
      errorMsg = 'Trình duyệt đang chặn tự phát. Bấm Phát để tiếp tục.';
      notify();
    });
  }
  notify();
}

export function playPresetMusic() {
  const audio = getAudio();
  if (!audio) return;
  if (objectUrl || !audio.getAttribute('src')?.includes(DEFAULT_TRACK_URL)) {
    releaseObjectUrl();
    audio.src = DEFAULT_TRACK_URL;
  }
  currentTitle = DEFAULT_TRACK_TITLE;
  attemptPlay(audio);
}

export function loadLocalMusicFile(file) {
  if (!file) return { ok: false, error: '' };
  if (!file.type || !file.type.startsWith('audio/')) {
    return { ok: false, error: 'Tệp đã chọn không phải tệp âm thanh.' };
  }
  const audio = getAudio();
  if (!audio) return { ok: false, error: 'Trình phát chưa sẵn sàng.' };
  releaseObjectUrl();
  objectUrl = URL.createObjectURL(file);
  currentTitle = file.name.replace(/\.[^.]+$/, '') || file.name;
  audio.src = objectUrl;
  attemptPlay(audio);
  return { ok: true, title: currentTitle };
}

export function toggleMusicPlay() {
  const audio = getAudio();
  if (!audio) return;
  if (audio.paused) {
    if (!audio.getAttribute('src')) audio.src = DEFAULT_TRACK_URL;
    attemptPlay(audio);
  } else {
    audio.pause();
    notify();
  }
}

export function seekMusic(ratio) {
  const audio = getAudio();
  if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  audio.currentTime = clampUnit(ratio) * audio.duration;
  notify();
}

export function setMusicVolume(volume) {
  const audio = getAudio();
  if (!audio) return;
  audio.volume = clampUnit(volume);
  notify();
}

export function stopAndResetMusic() {
  const audio = getAudio();
  if (audio) {
    audio.pause();
    try { audio.currentTime = 0; } catch {}
  }
  activated = false;
  errorMsg = '';
  notify();
}

// Gắn <audio> cố định ở root shell ngoài #main-content để đổi route SPA không ngắt nhạc.
export function mountPersistentMusicPlayer() {
  if (mounted || typeof document === 'undefined') return null;
  const audio = getAudio();
  if (!audio || document.getElementById('bg-music-host')) return null;
  mounted = true;

  const host = element('div', 'bg-music-host');
  host.id = 'bg-music-host';

  const mini = element('div', 'bg-music-mini');
  mini.setAttribute('role', 'region');
  mini.setAttribute('aria-label', 'Nút phát nhạc nền');
  mini.hidden = true;

  let suppressClickUntil = 0;
  const toggleBtn = button('', 'bg-music-mini-toggle', () => {
    if (Date.now() < suppressClickUntil) return;
    toggleMusicPlay();
  });
  toggleBtn.append(icon('play', 17));

  const stopBtn = button('', 'bg-music-mini-close', (e) => {
    e.stopPropagation();
    stopAndResetMusic();
  });
  stopBtn.setAttribute('aria-label', 'Tắt nhạc nền');
  stopBtn.title = 'Tắt nhạc nền';
  stopBtn.append(icon('close', 11));

  mini.append(toggleBtn, stopBtn);
  host.append(audio, mini);
  document.body.append(host);

  let savedPos = null;
  const applyMiniPos = (x, y) => {
    const pos = clampMiniPosition(x, y, window.innerWidth, window.innerHeight);
    savedPos = pos;
    mini.style.left = `${pos.x}px`;
    mini.style.top = `${pos.y}px`;
    mini.style.bottom = 'auto';
    mini.style.right = 'auto';
    return pos;
  };
  try {
    const raw = localStorage.getItem(FAB_POS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      applyMiniPos(parsed.x, parsed.y);
    }
  } catch {}

  let dragState = null;
  const finishDrag = (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const moved = dragState.moved;
    const pos = dragState.pos;
    dragState = null;
    mini.classList.remove('is-dragging');
    document.body.classList.remove('is-dragging-music-fab');
    try { mini.releasePointerCapture(e.pointerId); } catch {}
    if (moved) {
      suppressClickUntil = Date.now() + 250;
      if (pos) {
        try { localStorage.setItem(FAB_POS_KEY, JSON.stringify(pos)); } catch {}
      }
    }
  };
  mini.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('.bg-music-mini-close')) return;
    const rect = mini.getBoundingClientRect();
    dragState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      moved: false,
      pos: null
    };
    try { mini.setPointerCapture(e.pointerId); } catch {}
  });
  mini.addEventListener('pointermove', (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(dx, dy) <= 5) return;
    dragState.moved = true;
    mini.classList.add('is-dragging');
    document.body.classList.add('is-dragging-music-fab');
    dragState.pos = applyMiniPos(dragState.startLeft + dx, dragState.startTop + dy);
  });
  mini.addEventListener('pointerup', finishDrag);
  mini.addEventListener('pointercancel', finishDrag);
  window.addEventListener('resize', () => {
    if (savedPos) applyMiniPos(savedPos.x, savedPos.y);
  });

  let lastPlaying = null;
  const renderMini = () => {
    const state = getMusicState();
    const route = AppStore.get('route');
    const locked = Boolean(AppStore.get('examLockdown'));
    mini.hidden = !state.activated || route === '/focus' || locked;
    const statusText = state.playing
      ? (state.duration > 0
        ? `${formatAudioTime(state.currentTime)} / ${formatAudioTime(state.duration)}`
        : formatAudioTime(state.currentTime))
      : 'Đang tạm dừng';
    toggleBtn.title = `${state.title || DEFAULT_TRACK_TITLE} (${statusText}) • Kéo để di chuyển`;
    mini.classList.toggle('is-playing', state.playing);
    if (lastPlaying !== state.playing) {
      lastPlaying = state.playing;
      toggleBtn.replaceChildren(icon(state.playing ? 'pause' : 'play', 17));
      toggleBtn.setAttribute('aria-label', state.playing ? 'Tạm dừng nhạc nền' : 'Tiếp tục phát nhạc nền');
    }
  };

  subscribeMusic(renderMini);
  AppStore.subscribe('route', renderMini);
  AppStore.subscribe('examLockdown', renderMini);
  return host;
}
