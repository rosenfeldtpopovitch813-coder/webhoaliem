import { AppStore } from './store.js';
import { element, button } from './dom.js';
import { icon } from './icons.js';
import { navigate } from './router.js';
import { resolveResourceLink } from '../../shared/resource-links.js';
import { isUrlAllowedInFocus } from '../../shared/study-core.js';

const YT_STATE_KEY = 'htvvm-persistent-yt-v1';

let hostEl = null;
let frameEl = null;
let slotRef = null;
let rafId = 0;
let resizeObs = null;
let mounted = false;

let activeState = {
  active: false,
  embedUrl: '',
  openUrl: '',
  rawInput: '',
  minimizedAudioOnly: false,
  stoppedReason: ''
};

const listeners = new Set();

function notify() {
  const snap = getYouTubeState();
  for (const fn of [...listeners]) {
    try { fn(snap); } catch {}
  }
}

export function getYouTubeState() {
  return { ...activeState };
}

export function subscribeYouTube(callback) {
  listeners.add(callback);
  callback(getYouTubeState());
  return () => listeners.delete(callback);
}

function saveMeta() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(YT_STATE_KEY, JSON.stringify({
      rawInput: activeState.rawInput,
      openUrl: activeState.openUrl
    }));
  } catch {}
}

export function readLastYouTubeInput() {
  if (activeState.rawInput) return activeState.rawInput;
  if (typeof sessionStorage === 'undefined') return '';
  try {
    const raw = JSON.parse(sessionStorage.getItem(YT_STATE_KEY) || 'null');
    return typeof raw?.rawInput === 'string' ? raw.rawInput : '';
  } catch {
    return '';
  }
}

function buildEmbedUrlWithJsApi(embedUrl) {
  try {
    const u = new URL(embedUrl);
    u.searchParams.set('enablejsapi', '1');
    u.searchParams.set('rel', '0');
    if (typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')) {
      u.searchParams.set('origin', location.origin);
    }
    return u.toString();
  } catch {
    return embedUrl;
  }
}

function syncDockGeometry() {
  rafId = 0;
  if (!hostEl || !frameEl) return;

  if (!activeState.active || !activeState.embedUrl || AppStore.get('examLockdown')) {
    hostEl.hidden = true;
    hostEl.classList.remove('is-slot-docked', 'is-mini-dock', 'is-audio-pill');
    return;
  }

  hostEl.hidden = false;

  const slotConnected = Boolean(slotRef && slotRef.isConnected);
  if (slotConnected) {
    const rect = slotRef.getBoundingClientRect();
    const visibleSlot = rect.width >= 80 && rect.height >= 60 && rect.bottom > 56 && rect.top < window.innerHeight;
    if (visibleSlot) {
      hostEl.classList.add('is-slot-docked');
      hostEl.classList.remove('is-mini-dock', 'is-audio-pill');
      hostEl.style.top = `${Math.round(rect.top)}px`;
      hostEl.style.left = `${Math.round(rect.left)}px`;
      hostEl.style.width = `${Math.round(rect.width)}px`;
      hostEl.style.height = `${Math.round(rect.height)}px`;
      hostEl.style.right = 'auto';
      hostEl.style.bottom = 'auto';
      return;
    }
    if (rect.width >= 80 && rect.height >= 60) {
      // Slot exists on /focus but scrolled off-screen: park cleanly as mini-dock so audio/video stays accessible
      hostEl.classList.remove('is-slot-docked');
      hostEl.classList.add('is-mini-dock');
      hostEl.classList.toggle('is-audio-pill', activeState.minimizedAudioOnly);
      hostEl.style.top = '';
      hostEl.style.left = '';
      hostEl.style.width = '';
      hostEl.style.height = '';
      hostEl.style.right = '';
      hostEl.style.bottom = '';
      return;
    }
  }

  // User navigated to another route (/ , /exam-paper, /handbook, /whiteboard, etc.) -> keep playing in persistent mini-dock!
  hostEl.classList.remove('is-slot-docked');
  hostEl.classList.add('is-mini-dock');
  hostEl.classList.toggle('is-audio-pill', activeState.minimizedAudioOnly);
  hostEl.style.top = '';
  hostEl.style.left = '';
  hostEl.style.width = '';
  hostEl.style.height = '';
  hostEl.style.right = '';
  hostEl.style.bottom = '';
}

export function requestYouTubeGeometrySync() {
  if (typeof window === 'undefined') return;
  if (!rafId) rafId = window.requestAnimationFrame(syncDockGeometry);
}

export function attachYouTubeFocusSlot(elementNode) {
  slotRef = elementNode || null;
  if (resizeObs) {
    resizeObs.disconnect();
    if (slotRef) resizeObs.observe(slotRef);
  }
  if (slotRef) {
    slotRef.classList.toggle('has-active-yt', activeState.active);
  }
  requestYouTubeGeometrySync();
  return () => {
    if (slotRef === elementNode) {
      slotRef = null;
      if (resizeObs) resizeObs.disconnect();
      requestYouTubeGeometrySync();
    }
  };
}

export function startYouTubePlayer(rawUrl, focusConfig = null) {
  if (AppStore.get('examLockdown')) {
    throw new Error('Không thể phát YouTube khi đang trong phòng thi khóa bảo mật.');
  }
  const resource = resolveResourceLink(rawUrl);
  if (resource.type !== 'youtube') {
    throw new Error('Khung này chỉ nhận link YouTube (video hoặc danh sách phát).');
  }
  if (focusConfig?.enabled && !isUrlAllowedInFocus(resource.openUrl, focusConfig.allowlist)) {
    throw new Error('Focus Mode đang bật — hãy thêm YouTube vào danh sách tối đa 3 mục trước khi mở.');
  }

  mountPersistentYouTubePlayer();
  const nextEmbed = buildEmbedUrlWithJsApi(resource.embedUrl);
  const changed = activeState.embedUrl !== nextEmbed || !activeState.active;

  activeState = {
    active: true,
    embedUrl: nextEmbed,
    openUrl: resource.openUrl,
    rawInput: String(rawUrl || '').trim(),
    minimizedAudioOnly: false,
    stoppedReason: ''
  };
  saveMeta();

  if (frameEl && changed) {
    frameEl.src = nextEmbed;
  }
  if (slotRef) slotRef.classList.add('has-active-yt');
  requestYouTubeGeometrySync();
  notify();
  return getYouTubeState();
}

export function toggleYouTubeMiniMode() {
  if (!activeState.active) return;
  activeState = {
    ...activeState,
    minimizedAudioOnly: !activeState.minimizedAudioOnly
  };
  requestYouTubeGeometrySync();
  notify();
}

export function stopYouTubePlayer(reason = 'user') {
  const wasActive = activeState.active;
  activeState = {
    active: false,
    embedUrl: '',
    openUrl: '',
    rawInput: reason === 'user' ? '' : activeState.rawInput,
    minimizedAudioOnly: false,
    stoppedReason: reason
  };
  if (reason === 'user') saveMeta();
  if (frameEl) {
    try {
      frameEl.contentWindow?.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
    } catch {}
    frameEl.src = 'about:blank';
  }
  if (slotRef) slotRef.classList.remove('has-active-yt');
  if (hostEl) {
    hostEl.hidden = true;
    hostEl.classList.remove('is-slot-docked', 'is-mini-dock', 'is-audio-pill');
  }
  if (wasActive || reason) notify();
}

export function mountPersistentYouTubePlayer() {
  if (mounted || typeof document === 'undefined') return;
  mounted = true;

  hostEl = element('aside', 'yt-persistent-host');
  hostEl.id = 'persistent-youtube-host';
  hostEl.hidden = true;
  hostEl.setAttribute('aria-label', 'Trình phát YouTube chạy nền');

  const dockBar = element('div', 'yt-dock-bar');
  const titleWrap = element('div', 'yt-dock-title');
  const dot = element('span', 'yt-dock-live-dot');
  const label = element('span', 'yt-dock-label', 'YouTube đang phát nền');
  titleWrap.append(dot, label);

  const actions = element('div', 'yt-dock-actions');
  const modeBtn = button('', 'yt-dock-btn', () => {
    toggleYouTubeMiniMode();
    modeBtn.title = activeState.minimizedAudioOnly ? 'Hiện khung hình video' : 'Thu gọn chỉ nghe nhạc';
    modeBtn.textContent = activeState.minimizedAudioOnly ? '▢ Hiện video' : '— Nghe nền';
  });
  modeBtn.textContent = '— Nghe nền';
  modeBtn.title = 'Thu gọn chỉ nghe nhạc';

  const focusJumpBtn = button('', 'yt-dock-btn', () => navigate('/focus'));
  focusJumpBtn.append(icon('focus', 12), document.createTextNode(' Góc tập trung'));
  focusJumpBtn.title = 'Mở lại Góc tập trung';

  const closeBtn = button('✕', 'yt-dock-btn is-close', () => stopYouTubePlayer('user'));
  closeBtn.title = 'Tắt hẳn nhạc / video YouTube';
  closeBtn.setAttribute('aria-label', 'Tắt YouTube');

  actions.append(modeBtn, focusJumpBtn, closeBtn);
  dockBar.append(titleWrap, actions);

  const frameWrap = element('div', 'yt-dock-frame-wrap');
  frameEl = document.createElement('iframe');
  frameEl.className = 'yt-persistent-frame';
  frameEl.title = 'Trình phát YouTube chạy nền';
  frameEl.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  frameEl.allowFullscreen = true;
  frameEl.referrerPolicy = 'strict-origin-when-cross-origin';
  frameWrap.append(frameEl);

  hostEl.append(dockBar, frameWrap);
  document.body.append(hostEl);

  subscribeYouTube((st) => {
    modeBtn.textContent = st.minimizedAudioOnly ? '▢ Hiện video' : '— Nghe nền';
  });

  // Tự động tắt NGAY LẬP TỨC khi vào phòng thi khóa bảo mật (examLockdown)
  AppStore.subscribe('examLockdown', (locked) => {
    if (locked && activeState.active) {
      stopYouTubePlayer('exam-lockdown');
    } else {
      requestYouTubeGeometrySync();
    }
  });

  AppStore.subscribe('route', () => {
    window.setTimeout(requestYouTubeGeometrySync, 30);
  });

  if (typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(() => requestYouTubeGeometrySync());
  }
  window.addEventListener('scroll', requestYouTubeGeometrySync, { passive: true, capture: true });
  window.addEventListener('resize', requestYouTubeGeometrySync, { passive: true });
}
