import { auth } from './firebase.js';
import { AppStore } from './store.js';
import { syncStudyStatsToStore } from './auth.js';
import { element, button } from './dom.js';
import { icon } from './icons.js';
import { navigate } from './router.js';
import { clampMiniPosition } from './music-player.js';
import {
  HEARTBEAT_MS,
  MAX_ALLOWLIST_ITEMS,
  MAX_FOCUS_AWAY_MS,
  normalizeFocusTarget,
  getNextStreakMilestone,
  rankProgressFor,
  titleFor
} from '../../shared/study-core.js';
import {
  DEFAULT_FOCUS_SECONDS,
  durationFromFields,
  formatTimerClock,
  formatFullDuration,
  formatTabTitle,
  normalizeRemaining,
  selectPopupDisplayStrategy,
  shouldCountStudy,
  studyStorageKeyForUid,
  validFocusDuration
} from '../../shared/focus-timer.js';
import { getVNDateString } from '../../shared/time-utils.js';

export { formatTimerClock, formatFullDuration, formatTabTitle, selectPopupDisplayStrategy };

const TIMER_DURATION_KEY = 'htvvm-focus-duration-v1';
const TIMER_MODE_KEY = 'htvvm-focus-timer-mode-v1';
const TIMER_STATE_KEY = 'htvvm-focus-timer-state-v3';
const TIMER_STATE_LEGACY_KEY = 'htvvm-focus-timer-state-v2';
const SESSION_STORAGE_KEY = 'htvvm-study-session-v1';
const FOCUS_MODE_KEY = 'htvvm-focus-mode-v1';
const MINI_POS_KEY = 'htvvm_focus_mini_pos_v1';
const BASE_DOC_TITLE = 'HTVVM Studio — Học tập và luyện thi';

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

const todayKey = () => getVNDateString();
const currentUid = () => auth?.currentUser?.uid || AppStore.get('user')?.uid || '';

function readInitialDuration() {
  if (typeof localStorage === 'undefined') return DEFAULT_FOCUS_SECONDS;
  try {
    const n = Number(localStorage.getItem(TIMER_DURATION_KEY));
    return validFocusDuration(n) ? n : DEFAULT_FOCUS_SECONDS;
  } catch {
    return DEFAULT_FOCUS_SECONDS;
  }
}

function readRestoredTimer() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem(TIMER_STATE_KEY) || localStorage.getItem(TIMER_STATE_LEGACY_KEY) || 'null');
    if (s && validFocusDuration(s.duration)) return s;
  } catch {}
  return null;
}

function loadFocusConfig() {
  if (typeof localStorage !== 'undefined') {
    try {
      const parsed = JSON.parse(localStorage.getItem(FOCUS_MODE_KEY) || 'null');
      if (parsed && typeof parsed === 'object') {
        const items = Array.isArray(parsed.allowlist) ? parsed.allowlist.slice(0, MAX_ALLOWLIST_ITEMS) : [];
        return { enabled: Boolean(parsed.enabled), allowlist: items };
      }
    } catch {}
  }
  return {
    enabled: false,
    allowlist: [normalizeFocusTarget('youtube.com'), normalizeFocusTarget('drive.google.com')]
  };
}

function readLocalStudy(uid = currentUid()) {
  if (typeof localStorage !== 'undefined') {
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
  }
  return { totalSeconds: 0, todaySeconds: 0, streak: 0, loginStreak: 0, bestLoginStreak: 0, sharing: false };
}

function writeLocalStudy(snap, uid = currentUid()) {
  if (typeof localStorage === 'undefined') return;
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

// Persistent singleton state (always boots paused so study time never increments before user starts)
const restoredTimer = readRestoredTimer();
let duration = restoredTimer?.duration || readInitialDuration();
let selectedMode = restoredTimer?.mode === 'break' ? 'break' : 'focus';
let running = false;
let endTimeMs = 0;
let seconds = restoredTimer && restoredTimer.running && Number.isFinite(restoredTimer.endTimeMs)
  ? normalizeRemaining(Math.ceil((restoredTimer.endTimeMs - Date.now()) / 1000) || duration, duration)
  : restoredTimer && Number.isFinite(restoredTimer.remaining)
    ? normalizeRemaining(restoredTimer.remaining, duration)
    : duration;
if (seconds <= 0) seconds = duration;

let manualActive = false;
let sessionId = null;
let sessionOrigin = null;
let sessionSeq = 0;
let pingBusy = false;
let sessionStopping = false;
let sessionStarting = false;
let statsSnapshot = (() => {
  const uid = currentUid();
  const cached = readLocalStudy(uid);
  const storeStats = AppStore.get('studyStats');
  return uid && storeStats ? { ...cached, ...storeStats } : cached;
})();
let pendingMs = 0;
let focusConfig = loadFocusConfig();
let focusHiddenAt = 0;
let pendingAwayMs = 0;
let timerHint = 'Sẵn sàng bắt đầu phiên tập trung.';
let statusMsg = 'Sẵn sàng ghi nhận giờ học.';
let lastUiTick = typeof performance !== 'undefined' ? performance.now() : Date.now();
let lastStatsNotifyPerf = lastUiTick;
let lastTimerPersist = 0;
let lastPingAt = 0;
let mounted = false;
let originalDocTitle = typeof document !== 'undefined' ? (document.title || BASE_DOC_TITLE) : BASE_DOC_TITLE;

// Popup Display runtime handles
let popupMode = 'none';
let popupWindowRef = null;
let popupUpdateUi = null;
let popupIntervalId = null;
let pipVideoEl = null;
let pipCanvasEl = null;
let pipStream = null;
let pipDrawTimer = null;

const listeners = new Set();

function isCountingStudy() {
  return shouldCountStudy({ running, mode: selectedMode, manualActive });
}

function saveTimerState() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TIMER_DURATION_KEY, String(duration));
    localStorage.setItem(TIMER_MODE_KEY, selectedMode);
    localStorage.setItem(
      TIMER_STATE_KEY,
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

function saveFocusConfig() {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(FOCUS_MODE_KEY, JSON.stringify(focusConfig)); } catch {}
}

function saveSession(id, origin) {
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ id, origin, savedAt: Date.now() })); } catch {}
}
function touchSavedSession() {
  if (sessionId) saveSession(sessionId, sessionOrigin || 'manual');
}
function clearSavedSession() {
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch {}
}
function getSavedSession() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const v = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) || 'null');
    return v && typeof v.id === 'string' && ['manual', 'pomodoro', 'stopping'].includes(v.origin) ? v : null;
  } catch { return null; }
}

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

export function getFocusState() {
  const counting = isCountingStudy();
  const liveSeconds = counting ? Math.floor(pendingMs / 1000) : 0;
  const liveTotalSeconds = (statsSnapshot.totalSeconds || 0) + liveSeconds;
  const liveTodaySeconds = (statsSnapshot.todaySeconds || 0) + liveSeconds;
  const liveStreak = Math.max(statsSnapshot.streak || 0, !auth?.currentUser && liveTodaySeconds > 0 ? 1 : 0);
  return {
    duration,
    selectedMode,
    running,
    seconds,
    manualActive,
    counting,
    sessionStarting,
    sessionStopping,
    statsSnapshot: { ...statsSnapshot },
    liveTodaySeconds,
    liveTotalSeconds,
    liveStreak,
    timerHint,
    statusMsg,
    focusConfig: {
      enabled: focusConfig.enabled,
      allowlist: [...focusConfig.allowlist]
    },
    pendingAwayMs,
    popupOpen: popupMode !== 'none',
    popupMode
  };
}

function syncDocumentTitle(state) {
  if (typeof document === 'undefined') return;
  const nextTitle = formatTabTitle(state, originalDocTitle);
  if (document.title !== nextTitle) document.title = nextTitle;
}

function notify() {
  const snap = getFocusState();
  syncDocumentTitle(snap);
  AppStore.set('focusActive', snap.counting || snap.running);
  if (popupUpdateUi) {
    try { popupUpdateUi(snap); } catch {}
  }
  if (popupMode === 'video-pip' && pipCanvasEl) {
    drawPipCanvas(snap);
  }
  for (const fn of [...listeners]) {
    try { fn(snap); } catch {}
  }
}

export function subscribeFocus(callback) {
  listeners.add(callback);
  callback(getFocusState());
  return () => listeners.delete(callback);
}

let applyingFromServer = false;
function applyServerStats(s, reconcile = true) {
  if (!s) return;
  if (reconcile) {
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
  applyingFromServer = true;
  try {
    syncStudyStatsToStore({ ...statsSnapshot, ...s });
  } finally {
    applyingFromServer = false;
  }
  notify();
}

export async function startStudySession(source = 'manual') {
  if (source === 'manual') {
    manualActive = true;
    notify();
  }
  if (!auth?.currentUser) {
    statusMsg = 'Đang đếm giờ học trên thiết bị (đăng nhập Google để đồng bộ lên bảng xếp hạng).';
    notify();
    return true;
  }
  if (sessionStarting || sessionId) return true;
  const mySeq = ++sessionSeq;
  sessionStarting = true;
  notify();
  try {
    const data = await request('/api/study-tracker', 'POST', { action: 'start' });
    const startedId = data?.sessionId;
    const desired = mySeq === sessionSeq && (source === 'manual' ? manualActive : (running && selectedMode === 'focus'));
    if (!desired) {
      if (startedId) {
        request('/api/study-tracker', 'POST', { action: 'stop', sessionId: startedId }, { keepalive: true }).catch(() => {});
      }
      return false;
    }
    sessionId = startedId;
    sessionOrigin = source;
    pendingMs = 0;
    lastPingAt = Date.now();
    saveSession(sessionId, sessionOrigin);
    applyServerStats(data.stats, true);
    statusMsg = source === 'pomodoro'
      ? 'Đồng hồ đang chạy nền và đồng bộ giờ học liên tục.'
      : 'Đang ghi nhận giờ học trực tuyến (vẫn tính khi chuyển mục khác).';
    notify();
    return true;
  } catch {
    statusMsg = 'Đang đếm giờ học liên tục trên thiết bị (tự động đồng bộ lại khi mạng ổn định).';
    notify();
    return true;
  } finally {
    sessionStarting = false;
    notify();
  }
}

export async function stopStudySession(msg = 'Đã lưu phiên học.') {
  sessionSeq += 1;
  manualActive = false;
  flushPendingToSnapshot();
  pendingMs = 0;
  const id = sessionId;
  sessionId = null;
  sessionOrigin = null;
  clearSavedSession();
  statusMsg = msg;
  notify();
  if (!id || sessionStopping || !auth?.currentUser) {
    return true;
  }
  sessionStopping = true;
  notify();
  try {
    const data = await request('/api/study-tracker', 'POST', { action: 'stop', sessionId: id }, { keepalive: true });
    applyServerStats(data.stats, true);
    statusMsg = msg;
    return true;
  } catch {
    statusMsg = msg;
    return true;
  } finally {
    sessionStopping = false;
    notify();
  }
}

function haltPomodoroCounting(msg) {
  sessionSeq += 1;
  if (!manualActive && (sessionOrigin === 'pomodoro' || sessionId || sessionStarting)) {
    void stopStudySession(msg);
  }
}

export async function stopAllStudySessions(msg = 'Đã lưu và kết thúc phiên học.') {
  sessionSeq += 1;
  if (running) {
    seconds = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
    running = false;
    endTimeMs = 0;
    timerHint = 'Đã kết thúc phiên tập trung.';
    saveTimerState();
  }
  await stopStudySession(msg);
}

export function togglePomodoro() {
  if (running) {
    seconds = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
    running = false;
    endTimeMs = 0;
    timerHint = 'Đồng hồ đang tạm dừng. Bấm Bắt đầu để chạy tiếp.';
    saveTimerState();
    notify();
    haltPomodoroCounting('Đã tạm dừng đồng hồ; thời gian học đã được lưu.');
    return;
  }
  if (seconds <= 0) seconds = duration;
  running = true;
  endTimeMs = Date.now() + seconds * 1000;
  timerHint = 'Đồng hồ đang chạy nền — giữ tính giờ khi chuyển mục trong web hoặc bật Màn hình nổi (Popup).';
  saveTimerState();
  notify();
  if (selectedMode === 'focus' && !sessionId && auth?.currentUser) {
    void startStudySession('pomodoro');
  } else if (selectedMode === 'break' && !sessionId) {
    statusMsg = 'Đồng hồ nghỉ đang chạy; thời gian nghỉ không cộng vào giờ học.';
    notify();
  }
}

export function resetPomodoro() {
  running = false;
  endTimeMs = 0;
  seconds = duration;
  timerHint = 'Đã đặt lại đồng hồ về ban đầu.';
  saveTimerState();
  notify();
  haltPomodoroCounting('Đã đặt lại đồng hồ và lưu phiên học.');
}

export function selectPomodoroPreset(s, mode) {
  running = false;
  endTimeMs = 0;
  duration = s;
  seconds = s;
  selectedMode = mode === 'break' ? 'break' : 'focus';
  timerHint = selectedMode === 'focus'
    ? 'Đã chọn mốc tập trung. Bấm Bắt đầu để chạy.'
    : 'Đã chọn mốc giải lao. Bấm Bắt đầu để chạy.';
  saveTimerState();
  notify();
  haltPomodoroCounting('Đã chuyển mốc đồng hồ và lưu phiên học.');
}

export function applyCustomDuration(minutes, secs) {
  const next = durationFromFields(Number(minutes), Number(secs));
  if (next === null) return { ok: false, error: 'Nhập thời lượng hợp lệ từ 1 giây đến 240 phút.' };
  running = false;
  endTimeMs = 0;
  duration = next;
  seconds = next;
  selectedMode = 'focus';
  timerHint = `Thời lượng mới: ${Math.floor(next / 60)} phút ${next % 60} giây.`;
  saveTimerState();
  notify();
  haltPomodoroCounting('Đã thay thời lượng và lưu phiên học trước đó.');
  return { ok: true, duration: next };
}

export async function setLeaderboardSharing(enabled) {
  statsSnapshot = { ...statsSnapshot, sharing: Boolean(enabled) };
  writeLocalStudy(statsSnapshot);
  notify();
  try {
    const data = await request('/api/study-tracker', 'POST', { action: 'sharing', enabled: Boolean(enabled) });
    applyServerStats(data.stats, false);
    statusMsg = enabled ? 'Đã bật hiển thị trên bảng xếp hạng.' : 'Đã ẩn khỏi bảng xếp hạng.';
    notify();
  } catch (e) {
    statusMsg = e.message;
    notify();
  }
}

export function toggleFocusMode() {
  if (!focusConfig.enabled && !focusConfig.allowlist.length) {
    statusMsg = 'Hãy chọn 1–3 trang web hoặc ứng dụng trước khi bật Focus Mode.';
    notify();
    return false;
  }
  focusConfig = { ...focusConfig, enabled: !focusConfig.enabled };
  saveFocusConfig();
  statusMsg = focusConfig.enabled
    ? `Đã bật Focus Mode (${focusConfig.allowlist.map(x => x.label).join(', ')}). Chặn liên kết ngoài danh sách.`
    : 'Đã tắt Focus Mode.';
  notify();
  return true;
}

export function addFocusTarget(raw) {
  try {
    const normalized = normalizeFocusTarget(raw);
    if (focusConfig.allowlist.some(x => x.id === normalized.id)) {
      statusMsg = `“${normalized.label}” đã nằm trong danh sách.`;
      notify();
      return { ok: false };
    }
    if (focusConfig.allowlist.length >= MAX_ALLOWLIST_ITEMS) {
      statusMsg = `Focus Mode chỉ cho phép tối đa ${MAX_ALLOWLIST_ITEMS} trang web hoặc ứng dụng.`;
      notify();
      return { ok: false };
    }
    focusConfig = { ...focusConfig, allowlist: [...focusConfig.allowlist, normalized] };
    saveFocusConfig();
    statusMsg = `Đã thêm “${normalized.label}” vào Focus Mode.`;
    notify();
    return { ok: true, item: normalized };
  } catch (err) {
    statusMsg = err.message || String(err);
    notify();
    return { ok: false };
  }
}

export function removeFocusTarget(id) {
  const nextList = focusConfig.allowlist.filter(x => x.id !== id);
  focusConfig = {
    enabled: nextList.length ? focusConfig.enabled : false,
    allowlist: nextList
  };
  saveFocusConfig();
  notify();
}

export function markFocusHiddenNow() {
  focusHiddenAt = Date.now();
}

export async function claimPendingAway() {
  const claim = pendingAwayMs;
  if (claim <= 0) return;
  pendingAwayMs = 0;
  pendingMs += claim;
  flushPendingToSnapshot();
  const mins = Math.floor(claim / 60000);
  const secs = Math.floor((claim % 60000) / 1000);
  const labelTime = mins > 0 ? `${mins} phút ${secs} giây` : `${secs} giây`;
  notify();
  if (sessionId && auth?.currentUser) {
    try {
      const res = await request('/api/study-tracker', 'POST', {
        action: 'ping',
        sessionId,
        focusMode: true,
        focusAwayMs: claim
      });
      if (res?.stats) applyServerStats(res.stats, true);
    } catch {}
  }
  statusMsg = `Đã giữ ${labelTime} thời gian học trong Focus Mode.`;
  notify();
}

export function dropPendingAway() {
  pendingAwayMs = 0;
  statusMsg = 'Đã bỏ qua thời gian ngoài trang HTVVM.';
  notify();
}

export function setFocusStatusMessage(msg) {
  statusMsg = String(msg || '');
  notify();
}

export async function refreshStudyStatus() {
  if (!isCountingStudy()) {
    statsSnapshot = readLocalStudy();
    notify();
  }
  if (!auth?.currentUser) return;
  try {
    const saved = getSavedSession();
    if (saved?.id && !isCountingStudy()) {
      // Close abandoned session from an earlier visit instead of silently resuming counting.
      clearSavedSession();
      await request('/api/study-tracker', 'POST', { action: 'stop', sessionId: saved.id }, { keepalive: true }).catch(() => {});
    }
    const data = await request('/api/study-tracker');
    applyServerStats(data.stats, true);
  } catch {
    // Giữ nguyên bộ đếm địa phương mượt mà
  }
}

async function ping(extraPayload = null) {
  if (pingBusy || !isCountingStudy()) return;
  flushPendingToSnapshot();
  if (!auth?.currentUser) return;
  pingBusy = true;
  lastPingAt = Date.now();
  try {
    if (!sessionId) {
      if (!sessionStarting && isCountingStudy()) {
        await startStudySession(running ? 'pomodoro' : 'manual');
      }
    } else {
      const id = sessionId;
      const payload = extraPayload
        ? { action: 'ping', sessionId: id, ...extraPayload }
        : { action: 'ping', sessionId: id };
      const data = await request('/api/study-tracker', 'POST', payload);
      if (sessionId === id && isCountingStudy()) {
        applyServerStats(data.stats, true);
        touchSavedSession();
      }
    }
  } catch (e) {
    if (e.status === 409) {
      sessionId = null;
      clearSavedSession();
    }
  } finally {
    pingBusy = false;
    notify();
  }
}

function tickFocusClock() {
  const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const maxStep = popupMode !== 'none' ? 5000 : 2000;
  const delta = Math.max(0, Math.min(maxStep, nowPerf - lastUiTick));
  lastUiTick = nowPerf;
  let needsNotify = false;

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
      needsNotify = true;
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
      playBellChime();
      timerHint = 'Đã hoàn thành phiên đồng hồ. Hãy nghỉ ngơi hoặc bắt đầu phiên tiếp theo.';
      needsNotify = true;
      if (sessionOrigin === 'pomodoro' || sessionId) {
        void stopStudySession('Hoàn thành phiên Pomodoro — giờ học đã được lưu.');
      } else {
        statusMsg = 'Đã hết giờ Pomodoro.';
      }
    }
  }

  if (isCountingStudy() && Date.now() - lastPingAt >= HEARTBEAT_MS) {
    void ping();
  }

  if (needsNotify || nowPerf - lastStatsNotifyPerf >= 1000) {
    lastStatsNotifyPerf = nowPerf;
    notify();
  }
}

// ============================================================================
// POPUP DISPLAY (MÀN HÌNH NỔI CHẠY NỀN): Document PiP -> Video PiP -> Popup
// ============================================================================
function readActiveThemePalette() {
  const fallback = {
    bg: '#080d1a',
    panel: '#0f172a',
    panel2: '#162038',
    text: '#f1f5ff',
    muted: '#94a3b8',
    stroke: '#23314b',
    accent: '#5eead4',
    accentText: '#042f2e',
    scheme: 'dark'
  };
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  try {
    const cs = getComputedStyle(document.documentElement);
    const get = (k, d) => cs.getPropertyValue(k).trim() || d;
    return {
      bg: get('--bg', fallback.bg),
      panel: get('--panel', fallback.panel),
      panel2: get('--panel-2', fallback.panel2),
      text: get('--text', fallback.text),
      muted: get('--muted', fallback.muted),
      stroke: get('--stroke', fallback.stroke),
      accent: get('--accent', fallback.accent),
      accentText: get('--accent-text', fallback.accentText),
      scheme: get('color-scheme', fallback.scheme) || 'dark'
    };
  } catch {
    return fallback;
  }
}

function buildPopupDocument(win) {
  const doc = win.document;
  doc.title = 'Đồng hồ tập trung — HTVVM Studio';
  const styleEl = doc.createElement('style');
  const applyThemeVars = () => {
    const p = readActiveThemePalette();
    styleEl.textContent = `
      :root{--bg:${p.bg};--panel:${p.panel};--panel-2:${p.panel2};--text:${p.text};--muted:${p.muted};--stroke:${p.stroke};--accent:${p.accent};--accent-text:${p.accentText};color-scheme:${p.scheme}}
      *{box-sizing:border-box}
      body{margin:0;padding:12px 14px;background:var(--bg);color:var(--text);font-family:'Be Vietnam Pro','IBM Plex Sans',system-ui,sans-serif;display:flex;flex-direction:column;gap:9px;min-height:100vh;justify-content:space-between;user-select:none}
      .pip-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .pip-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;background:var(--panel-2);border:1px solid var(--stroke);font-size:11px;font-weight:700;color:var(--accent)}
      .pip-dot{width:7px;height:7px;border-radius:50%;background:var(--accent)}
      .pip-dot.is-idle{opacity:.4}
      .pip-brand{font-size:10px;font-weight:800;letter-spacing:.12em;color:var(--muted)}
      .pip-clock-box{padding:10px 12px;border-radius:14px;background:var(--panel);border:1px solid var(--stroke);display:grid;gap:6px;text-align:center}
      .pip-digits{font-size:clamp(32px,11vw,46px);font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:.04em;color:var(--accent);line-height:1.05}
      .pip-track{height:6px;border-radius:999px;background:var(--panel-2);overflow:hidden}
      .pip-fill{height:100%;background:var(--accent);border-radius:999px;transition:width .25s ease;width:0%}
      .pip-meta{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11.5px;color:var(--muted);padding:0 2px}
      .pip-meta strong{color:var(--text);font-variant-numeric:tabular-nums}
      .pip-actions{display:flex;gap:7px}
      .pip-btn{flex:1;padding:8px 10px;border-radius:10px;border:1px solid var(--stroke);background:var(--panel-2);color:var(--text);font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
      .pip-btn:hover{border-color:var(--accent)}
      .pip-btn.primary{background:var(--accent);color:var(--accent-text);border-color:var(--accent);font-weight:800}
      .pip-btn.compact{flex:0 0 auto;padding:8px 10px}
    `;
  };
  applyThemeVars();
  doc.head.replaceChildren(styleEl);
  doc.body.replaceChildren();

  const top = doc.createElement('div');
  top.className = 'pip-top';
  const badge = doc.createElement('span');
  badge.className = 'pip-badge';
  const dot = doc.createElement('span');
  dot.className = 'pip-dot';
  const modeLabel = doc.createElement('span');
  badge.append(dot, modeLabel);
  const brand = doc.createElement('span');
  brand.className = 'pip-brand';
  brand.textContent = 'HTVVM STUDIO';
  top.append(badge, brand);

  const clockBox = doc.createElement('div');
  clockBox.className = 'pip-clock-box';
  const digits = doc.createElement('div');
  digits.className = 'pip-digits';
  const track = doc.createElement('div');
  track.className = 'pip-track';
  const fill = doc.createElement('div');
  fill.className = 'pip-fill';
  track.append(fill);
  clockBox.append(digits, track);

  const meta = doc.createElement('div');
  meta.className = 'pip-meta';
  const todayWrap = doc.createElement('span');
  const todayStrong = doc.createElement('strong');
  todayWrap.append('Hôm nay: ', todayStrong);
  const rankSpan = doc.createElement('span');
  meta.append(todayWrap, rankSpan);

  const actions = doc.createElement('div');
  actions.className = 'pip-actions';
  const toggleBtn = doc.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'pip-btn primary';
  toggleBtn.addEventListener('click', () => {
    const st = getFocusState();
    if (!st.running && st.manualActive) {
      void stopAllStudySessions('Đã dừng phiên tính giờ từ màn hình nổi.');
    } else {
      togglePomodoro();
    }
  });
  const stopBtn = doc.createElement('button');
  stopBtn.type = 'button';
  stopBtn.className = 'pip-btn compact';
  stopBtn.textContent = 'Lưu & Dừng';
  stopBtn.addEventListener('click', () => {
    void stopAllStudySessions('Đã lưu và kết thúc phiên học từ màn hình nổi.');
  });
  const focusTabBtn = doc.createElement('button');
  focusTabBtn.type = 'button';
  focusTabBtn.className = 'pip-btn compact';
  focusTabBtn.textContent = 'Về web ↗';
  focusTabBtn.addEventListener('click', () => {
    try { window.focus(); } catch {}
    navigate('/focus');
  });
  actions.append(toggleBtn, stopBtn, focusTabBtn);

  doc.body.append(top, clockBox, meta, actions);

  return (state, refreshTheme = false) => {
    if (refreshTheme) applyThemeVars();
    const isBreak = state.selectedMode === 'break';
    const showManualOnly = !state.running && state.manualActive;
    dot.classList.toggle('is-idle', !state.running && !state.manualActive);
    modeLabel.textContent = state.running
      ? (isBreak ? 'Nghỉ ngơi' : 'Đang tập trung')
      : state.manualActive
        ? 'Đang ghi giờ học'
        : 'Đang tạm dừng';
    digits.textContent = showManualOnly
      ? formatFullDuration(state.liveTodaySeconds)
      : formatTimerClock(state.seconds);
    const pct = showManualOnly
      ? Math.round(rankProgressFor(state.liveTodaySeconds).progressRatio * 100)
      : state.duration > 0
        ? Math.max(0, Math.min(100, ((state.duration - state.seconds) / state.duration) * 100))
        : 0;
    fill.style.width = `${pct.toFixed(1)}%`;
    todayStrong.textContent = formatFullDuration(state.liveTodaySeconds);
    rankSpan.textContent = `Rank: ${titleFor(state.liveTodaySeconds)}`;
    toggleBtn.textContent = state.running
      ? 'Tạm dừng'
      : state.manualActive
        ? 'Dừng ghi giờ'
        : 'Bắt đầu';
    stopBtn.hidden = !state.running && !state.manualActive;
  };
}

function drawPipCanvas(state) {
  if (!pipCanvasEl) return;
  const ctx = pipCanvasEl.getContext('2d');
  if (!ctx) return;
  const w = pipCanvasEl.width;
  const h = pipCanvasEl.height;
  const p = readActiveThemePalette();

  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = p.panel;
  ctx.strokeStyle = p.stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(22, 22, w - 44, h - 44, 24);
  ctx.fill();
  ctx.stroke();

  const isBreak = state.selectedMode === 'break';
  const modeText = state.running
    ? (isBreak ? 'PHIÊN NGHỈ NGƠI' : 'ĐANG TẬP TRUNG')
    : state.manualActive
      ? 'ĐANG GHI GIỜ HỌC'
      : 'ĐANG TẠM DỪNG';

  ctx.fillStyle = p.accent;
  ctx.font = '700 20px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(modeText, 48, 68);

  ctx.fillStyle = p.muted;
  ctx.font = '700 16px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('HTVVM STUDIO', w - 48, 68);

  const mainClock = !state.running && state.manualActive
    ? formatFullDuration(state.liveTodaySeconds)
    : formatTimerClock(state.seconds);
  ctx.fillStyle = p.text;
  ctx.font = '800 96px "IBM Plex Mono", "Be Vietnam Pro", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(mainClock, w / 2, 196);

  const pct = !state.running && state.manualActive
    ? rankProgressFor(state.liveTodaySeconds).progressRatio
    : state.duration > 0
      ? Math.max(0, Math.min(1, (state.duration - state.seconds) / state.duration))
      : 0;
  ctx.fillStyle = p.panel2;
  ctx.beginPath();
  ctx.roundRect(48, 232, w - 96, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.roundRect(48, 232, Math.max(12, (w - 96) * pct), 12, 6);
  ctx.fill();

  ctx.fillStyle = p.muted;
  ctx.font = '600 22px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Hôm nay: ${formatFullDuration(state.liveTodaySeconds)}`, 48, 298);
  ctx.fillStyle = p.accent;
  ctx.textAlign = 'right';
  ctx.fillText(`Rank: ${titleFor(state.liveTodaySeconds)}`, w - 48, 298);
}

export function closeFocusPopupDisplay() {
  if (popupIntervalId) {
    try { (popupWindowRef?.clearInterval || clearInterval)(popupIntervalId); } catch {}
    popupIntervalId = null;
  }
  if (pipDrawTimer) {
    clearInterval(pipDrawTimer);
    pipDrawTimer = null;
  }
  if (popupWindowRef) {
    const ref = popupWindowRef;
    popupWindowRef = null;
    try { if (!ref.closed) ref.close(); } catch {}
  }
  popupUpdateUi = null;
  if (typeof document !== 'undefined' && document.pictureInPictureElement && document.pictureInPictureElement === pipVideoEl) {
    document.exitPictureInPicture().catch(() => {});
  }
  if (pipStream) {
    try { pipStream.getTracks().forEach(t => t.stop()); } catch {}
    pipStream = null;
  }
  if (pipVideoEl) {
    try { pipVideoEl.pause(); pipVideoEl.srcObject = null; pipVideoEl.remove(); } catch {}
    pipVideoEl = null;
  }
  pipCanvasEl = null;
  if (popupMode !== 'none') {
    popupMode = 'none';
    notify();
  }
}

export async function openFocusPopupDisplay() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ok: false, error: 'Môi trường không hỗ trợ màn hình nổi.' };
  }
  if (popupMode !== 'none') {
    try { popupWindowRef?.focus?.(); } catch {}
    return { ok: true, mode: popupMode };
  }

  const strategy = selectPopupDisplayStrategy(window);

  // Tier 1: Document Picture-in-Picture (Always-on-top interactive mini window on Chrome/Edge 116+)
  if (strategy === 'doc-pip') {
    try {
      const pipWin = await window.documentPictureInPicture.requestWindow({ width: 350, height: 220 });
      popupMode = 'doc-pip';
      popupWindowRef = pipWin;
      popupUpdateUi = buildPopupDocument(pipWin);
      popupUpdateUi(getFocusState(), true);
      popupIntervalId = pipWin.setInterval(() => tickFocusClock(), 250);
      pipWin.addEventListener('pagehide', () => {
        if (popupWindowRef === pipWin) closeFocusPopupDisplay();
      }, { once: true });
      statusMsg = 'Đã bật Màn hình nổi (Always-on-Top). Bạn có thể mở Zoom/YouTube học song song và vẫn tính giờ liên tục.';
      notify();
      return { ok: true, mode: 'doc-pip' };
    } catch {
      // Fallback smoothly to Tier 2 / Tier 3 if blocked or unsupported on platform
    }
  }

  // Tier 2: Canvas-streamed Video Picture-in-Picture (Safari / older Chromium)
  if (
    document.pictureInPictureEnabled &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype?.captureStream === 'function' &&
    typeof HTMLVideoElement !== 'undefined' &&
    typeof HTMLVideoElement.prototype?.requestPictureInPicture === 'function'
  ) {
    try {
      pipCanvasEl = document.createElement('canvas');
      pipCanvasEl.width = 640;
      pipCanvasEl.height = 360;
      drawPipCanvas(getFocusState());
      pipStream = pipCanvasEl.captureStream(2);
      pipVideoEl = document.createElement('video');
      pipVideoEl.muted = true;
      pipVideoEl.playsInline = true;
      pipVideoEl.srcObject = pipStream;
      pipVideoEl.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px';
      document.body.append(pipVideoEl);
      await pipVideoEl.play();
      await pipVideoEl.requestPictureInPicture();
      popupMode = 'video-pip';
      pipDrawTimer = setInterval(() => {
        tickFocusClock();
        drawPipCanvas(getFocusState());
      }, 500);
      pipVideoEl.addEventListener('leavepictureinpicture', () => {
        closeFocusPopupDisplay();
      }, { once: true });
      statusMsg = 'Đã bật Màn hình nổi (Picture-in-Picture). Thời gian tập trung vẫn chạy nền khi bạn học ứng dụng khác.';
      notify();
      return { ok: true, mode: 'video-pip' };
    } catch {
      closeFocusPopupDisplay();
    }
  }

  // Tier 3: Compact Standalone Popup Window (Firefox / fallback)
  try {
    const win = window.open('', 'htvvm-focus-popup', 'popup=yes,width=360,height=240,resizable=yes');
    if (!win) {
      statusMsg = 'Trình duyệt đang chặn cửa sổ bật lên (Popup). Hãy cho phép Popup cho trang này rồi bấm lại.';
      notify();
      return { ok: false, error: statusMsg };
    }
    popupMode = 'window';
    popupWindowRef = win;
    popupUpdateUi = buildPopupDocument(win);
    popupUpdateUi(getFocusState(), true);
    popupIntervalId = win.setInterval(() => {
      if (win.closed) {
        closeFocusPopupDisplay();
        return;
      }
      tickFocusClock();
    }, 250);
    win.addEventListener('beforeunload', () => {
      if (popupWindowRef === win) closeFocusPopupDisplay();
    }, { once: true });
    statusMsg = 'Đã mở cửa sổ Popup chạy nền. Thời gian tập trung vẫn tiếp tục tính liên tục.';
    notify();
    return { ok: true, mode: 'window' };
  } catch {
    statusMsg = 'Không thể mở màn hình nổi trên trình duyệt hiện tại.';
    notify();
    return { ok: false, error: statusMsg };
  }
}

export async function toggleFocusPopupDisplay() {
  if (popupMode !== 'none') {
    closeFocusPopupDisplay();
    statusMsg = 'Đã đóng màn hình nổi; đồng hồ vẫn giữ nguyên trạng thái.';
    notify();
    return { ok: true, open: false };
  }
  const res = await openFocusPopupDisplay();
  return { ...res, open: popupMode !== 'none' };
}

// ============================================================================
// PERSISTENT SHELL ENGINE + IN-APP FLOATING MINI TIMER WIDGET
// ============================================================================
export function mountPersistentFocusWidget() {
  if (mounted || typeof document === 'undefined') return null;
  if (document.getElementById('focus-mini-host')) return null;
  mounted = true;
  originalDocTitle = document.title || BASE_DOC_TITLE;

  const host = element('div', 'focus-mini-host');
  host.id = 'focus-mini-host';

  const pill = element('div', 'focus-mini-pill');
  pill.setAttribute('role', 'region');
  pill.setAttribute('aria-label', 'Đồng hồ tập trung đang chạy nền');
  pill.hidden = true;

  let suppressClickUntil = 0;
  const infoBtn = button('', 'focus-mini-info', () => {
    if (Date.now() < suppressClickUntil) return;
    navigate('/focus');
  });
  infoBtn.title = 'Mở lại Góc tập trung (kéo để di chuyển)';

  const liveDot = element('span', 'focus-mini-dot');
  const textCol = element('span', 'focus-mini-texts');
  const mainDigits = element('strong', 'focus-mini-digits', '25:00');
  const subLabel = element('small', 'focus-mini-sub', 'Đang tập trung');
  textCol.append(mainDigits, subLabel);
  infoBtn.append(liveDot, textCol);

  const toggleBtn = button('', 'focus-mini-action', (e) => {
    e.stopPropagation();
    const st = getFocusState();
    if (!st.running && st.manualActive) {
      void stopAllStudySessions('Đã dừng ghi nhận giờ học.');
    } else {
      togglePomodoro();
    }
  });
  toggleBtn.append(icon('pause', 13));

  const pipBtn = button('', 'focus-mini-action', (e) => {
    e.stopPropagation();
    void toggleFocusPopupDisplay();
  });
  pipBtn.append(icon('pip', 14));
  pipBtn.title = 'Mở Màn hình nổi (Popup Display chạy nền khi học online)';
  pipBtn.setAttribute('aria-label', 'Mở màn hình nổi tập trung');

  pill.append(infoBtn, toggleBtn, pipBtn);
  host.append(pill);
  document.body.append(host);

  let savedPos = null;
  const applyMiniPos = (x, y) => {
    const rect = pill.getBoundingClientRect();
    const w = Math.max(180, Math.round(rect.width) || 210);
    const h = Math.max(44, Math.round(rect.height) || 46);
    const maxX = Math.max(10, window.innerWidth - w - 10);
    const maxY = Math.max(10, window.innerHeight - h - 10);
    const clampedX = Math.round(Math.max(10, Math.min(maxX, Number(x) || 72)));
    const clampedY = Math.round(Math.max(10, Math.min(maxY, Number(y) || maxY - 8)));
    savedPos = { x: clampedX, y: clampedY };
    pill.style.left = `${clampedX}px`;
    pill.style.top = `${clampedY}px`;
    pill.style.bottom = 'auto';
    pill.style.right = 'auto';
    return savedPos;
  };
  try {
    const raw = localStorage.getItem(MINI_POS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      const clamped = clampMiniPosition(parsed.x, parsed.y, window.innerWidth, window.innerHeight, 210, 10);
      savedPos = clamped;
      pill.style.left = `${clamped.x}px`;
      pill.style.top = `${clamped.y}px`;
      pill.style.bottom = 'auto';
      pill.style.right = 'auto';
    }
  } catch {}

  let dragState = null;
  const finishDrag = (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const moved = dragState.moved;
    const pos = dragState.pos;
    dragState = null;
    pill.classList.remove('is-dragging');
    document.body.classList.remove('is-dragging-music-fab');
    try { pill.releasePointerCapture(e.pointerId); } catch {}
    if (moved) {
      suppressClickUntil = Date.now() + 250;
      if (pos) {
        try { localStorage.setItem(MINI_POS_KEY, JSON.stringify(pos)); } catch {}
      }
    }
  };
  pill.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('.focus-mini-action')) return;
    const rect = pill.getBoundingClientRect();
    dragState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      moved: false,
      pos: null
    };
    try { pill.setPointerCapture(e.pointerId); } catch {}
  });
  pill.addEventListener('pointermove', (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(dx, dy) <= 5) return;
    dragState.moved = true;
    pill.classList.add('is-dragging');
    document.body.classList.add('is-dragging-music-fab');
    dragState.pos = applyMiniPos(dragState.startLeft + dx, dragState.startTop + dy);
  });
  pill.addEventListener('pointerup', finishDrag);
  pill.addEventListener('pointercancel', finishDrag);
  window.addEventListener('resize', () => {
    if (savedPos) applyMiniPos(savedPos.x, savedPos.y);
  });

  let lastIconState = null;
  const renderMini = () => {
    const state = getFocusState();
    const route = AppStore.get('route');
    const locked = Boolean(AppStore.get('examLockdown'));
    const active = state.running || state.manualActive;
    pill.hidden = !active || route === '/focus' || locked;
    if (pill.hidden) return;
    const showManualOnly = !state.running && state.manualActive;
    mainDigits.textContent = showManualOnly
      ? formatFullDuration(state.liveTodaySeconds)
      : formatTimerClock(state.seconds);
    subLabel.textContent = state.running
      ? (state.selectedMode === 'break' ? 'Đang nghỉ' : `Hôm nay ${formatFullDuration(state.liveTodaySeconds)}`)
      : 'Đang ghi giờ';
    pill.classList.toggle('is-break', state.selectedMode === 'break' && state.running);
    pipBtn.classList.toggle('is-active', state.popupOpen);
    pipBtn.title = state.popupOpen ? 'Đóng Màn hình nổi' : 'Mở Màn hình nổi (Popup chạy nền)';
    const iconMode = state.running || state.manualActive ? 'pause' : 'play';
    if (lastIconState !== iconMode) {
      lastIconState = iconMode;
      toggleBtn.replaceChildren(icon(iconMode, 13));
      toggleBtn.title = state.running ? 'Tạm dừng đồng hồ' : (state.manualActive ? 'Dừng ghi giờ' : 'Bắt đầu');
      toggleBtn.setAttribute('aria-label', toggleBtn.title);
    }
  };

  subscribeFocus(renderMini);
  AppStore.subscribe('route', renderMini);
  AppStore.subscribe('examLockdown', renderMini);
  AppStore.subscribe('theme', () => {
    const snap = getFocusState();
    if (popupUpdateUi) {
      try { popupUpdateUi(snap, true); } catch {}
    }
    if (popupMode === 'video-pip' && pipCanvasEl) drawPipCanvas(snap);
  });
  AppStore.subscribe('user', () => {
    pendingMs = 0;
    statsSnapshot = readLocalStudy();
    if (auth?.currentUser) void refreshStudyStatus();
    else notify();
  });
  AppStore.subscribe('studyStats', (stats) => {
    if (applyingFromServer || !stats) return;
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
    notify();
  });

  // Global persistent intervals (survive SPA route navigation!)
  setInterval(tickFocusClock, 200);
  setInterval(() => { void ping(); }, HEARTBEAT_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if ((focusConfig.enabled || popupMode !== 'none') && isCountingStudy()) {
        focusHiddenAt = Date.now();
      }
      return;
    }
    if (running) {
      seconds = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
    }
    if (focusHiddenAt > 0 && isCountingStudy()) {
      const awayMs = Math.min(MAX_FOCUS_AWAY_MS, Math.max(0, Date.now() - focusHiddenAt));
      focusHiddenAt = 0;
      if (popupMode !== 'none') {
        // Popup Display was actively open on screen: silently reconcile any throttled gap.
        const sinceLastPing = Date.now() - lastPingAt;
        if (sinceLastPing > 40000 && awayMs > 5000) {
          void ping({ focusMode: true, focusAwayMs: awayMs });
        }
      } else if (focusConfig.enabled) {
        if (awayMs >= 15000) {
          pendingAwayMs = awayMs;
        } else if (awayMs > 2000) {
          pendingMs += awayMs;
          flushPendingToSnapshot();
        }
      }
    } else {
      focusHiddenAt = 0;
    }
    notify();
  });

  // Only stop active server session when the actual browser tab closes/reloads (NEVER on SPA navigation)
  window.addEventListener('pagehide', () => {
    if (running && endTimeMs > 0) {
      seconds = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
    }
    saveTimerState();
    closeFocusPopupDisplay();
    if (sessionId && auth?.currentUser) {
      const id = sessionId;
      sessionId = null;
      clearSavedSession();
      request('/api/study-tracker', 'POST', { action: 'stop', sessionId: id }, { keepalive: true }).catch(() => {});
    }
  });

  notify();
  return host;
}
