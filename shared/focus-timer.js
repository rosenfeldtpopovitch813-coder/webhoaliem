export const DEFAULT_FOCUS_SECONDS = 25 * 60;
export const MAX_FOCUS_SECONDS = 240 * 60;

export function validFocusDuration(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_FOCUS_SECONDS;
}

export function durationFromFields(minutes, seconds) {
  if (!Number.isInteger(minutes) || !Number.isInteger(seconds)) return null;
  if (minutes < 0 || minutes > 240 || seconds < 0 || seconds > 59) return null;
  const total = minutes * 60 + seconds;
  return validFocusDuration(total) ? total : null;
}

/** Remaining time is based on a monotonic clock, not the frequency of UI ticks. */
export function remainingFocusSeconds(remainingAtStart, startedAt, now) {
  const remaining = Number(remainingAtStart);
  const start = Number(startedAt);
  const current = Number(now);
  if (![remaining, start, current].every(Number.isFinite) || remaining < 0 || current < start) {
    return Math.max(0, Math.ceil(Number.isFinite(remaining) ? remaining : 0));
  }
  return Math.max(0, Math.ceil((remaining * 1000 - (current - start)) / 1000));
}

export function normalizeRemaining(value, duration) {
  if (!validFocusDuration(duration) || !Number.isFinite(value)) return duration;
  return Math.max(0, Math.min(duration, Math.floor(value)));
}

/** Study time increments only while focus Pomodoro runs or manual session is active. */
export function shouldCountStudy({ running = false, mode = 'focus', manualActive = false } = {}) {
  return (Boolean(running) && mode === 'focus') || Boolean(manualActive);
}

/** Isolate browser fallback study snapshots by Firebase uid. */
export function studyStorageKeyForUid(uid) {
  const safe = String(uid || '').trim().replace(/[^A-Za-z0-9_-]/g, '');
  return `htvvm-local-study-stats-v3:${safe || 'guest'}`;
}
