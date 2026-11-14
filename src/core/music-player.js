import { AppStore } from './store.js';
import { element, button } from './dom.js';
import { icon } from './icons.js';
import { navigate } from './router.js';

export const DEFAULT_TRACK_URL = '/study-break-music.wav';
export const DEFAULT_TRACK_TITLE = 'Nhạc nền học tập';

export function clampUnit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
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

  const mini = element('aside', 'bg-music-mini');
  mini.setAttribute('aria-label', 'Trình phát nhạc nền');
  mini.hidden = true;

  const toggleBtn = button('', 'bg-music-mini-toggle', () => toggleMusicPlay());
  const metaBtn = button('', 'bg-music-mini-meta', () => {
    if (!AppStore.get('examLockdown')) navigate('/focus');
  });
  metaBtn.title = 'Mở Góc tập trung';
  const titleEl = element('strong', 'bg-music-mini-title', currentTitle);
  const timeEl = element('span', 'bg-music-mini-time', '00:00');
  metaBtn.append(icon('music', 14), titleEl, timeEl);

  const stopBtn = button('', 'bg-music-mini-close', () => stopAndResetMusic());
  stopBtn.setAttribute('aria-label', 'Tắt nhạc nền');
  stopBtn.title = 'Tắt nhạc nền';
  stopBtn.append(icon('close', 14));

  mini.append(toggleBtn, metaBtn, stopBtn);
  host.append(audio, mini);
  document.body.append(host);

  let lastPlaying = null;
  const renderMini = () => {
    const state = getMusicState();
    const route = AppStore.get('route');
    const locked = Boolean(AppStore.get('examLockdown'));
    mini.hidden = !state.activated || route === '/focus' || locked;
    titleEl.textContent = state.title || DEFAULT_TRACK_TITLE;
    const statusText = state.playing
      ? (state.duration > 0
        ? `${formatAudioTime(state.currentTime)} / ${formatAudioTime(state.duration)}`
        : formatAudioTime(state.currentTime))
      : 'Đang tạm dừng';
    timeEl.textContent = statusText;
    mini.classList.toggle('is-playing', state.playing);
    if (lastPlaying !== state.playing) {
      lastPlaying = state.playing;
      toggleBtn.replaceChildren(icon(state.playing ? 'pause' : 'play', 14));
      toggleBtn.setAttribute('aria-label', state.playing ? 'Tạm dừng nhạc' : 'Tiếp tục phát nhạc');
    }
  };

  subscribeMusic(renderMini);
  AppStore.subscribe('route', renderMini);
  AppStore.subscribe('examLockdown', renderMini);
  return host;
}
