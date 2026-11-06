/** Small offline study ledger used only when the server-side tracker is unavailable. */
export const LOCAL_STUDY_STORAGE_KEY = 'htvvm.local-study-stats.v1';

export function localStudyDayKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function normalizeLocalStudyStats(value) {
  const source = value && typeof value === 'object' ? value : {};
  const byDay = {};
  if (source.byDay && typeof source.byDay === 'object' && !Array.isArray(source.byDay)) {
    for (const [day, seconds] of Object.entries(source.byDay)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Number(seconds))) {
        byDay[day] = Math.max(0, Math.floor(Number(seconds)));
      }
    }
  }
  const sum = Object.values(byDay).reduce((total, seconds) => total + seconds, 0);
  const totalSeconds = Number.isFinite(Number(source.totalSeconds))
    ? Math.max(sum, Math.floor(Number(source.totalSeconds)), 0)
    : sum;
  return { totalSeconds, byDay };
}

export function addLocalStudySeconds(value, seconds, dayKey = localStudyDayKey()) {
  const state = normalizeLocalStudyStats(value);
  const amount = Number.isFinite(Number(seconds)) ? Math.max(0, Math.floor(Number(seconds))) : 0;
  if (!amount || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return state;
  state.totalSeconds += amount;
  state.byDay[dayKey] = (state.byDay[dayKey] || 0) + amount;
  return state;
}

export function localStudyTotals(value, dayKey = localStudyDayKey()) {
  const state = normalizeLocalStudyStats(value);
  return {
    totalSeconds: state.totalSeconds,
    todaySeconds: state.byDay[dayKey] || 0,
  };
}
