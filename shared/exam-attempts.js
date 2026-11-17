import { gradeExam } from './exam-grading.js';

export const SUBMISSION_GRACE_MS = 30_000;
export const MAX_EXAM_ATTEMPTS_LIMIT = 50;

export function parseMaxAttempts(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > MAX_EXAM_ATTEMPTS_LIMIT) {
    throw Error(`Giới hạn số lần làm phải là số nguyên từ 0 đến ${MAX_EXAM_ATTEMPTS_LIMIT} (0 = không giới hạn).`);
  }
  return n;
}

export function hasRemainingAttempts(maxAttempts, completedCount) {
  const limit = Math.max(0, Math.floor(Number(maxAttempts) || 0));
  if (limit === 0) return true;
  return Math.max(0, Math.floor(Number(completedCount) || 0)) < limit;
}

export function isExamLocked(meta, now = Date.now()) {
  if (!meta || typeof meta !== 'object') return false;
  if (meta.manualLocked === true) return true;
  const deadline = Number(meta.deadlineAt);
  return Number.isFinite(deadline) && deadline > 0 && now > deadline;
}

export function computeAttemptEndsAt(startedAt, durationMinutes, deadlineAt) {
  const durationEnds = startedAt + Math.max(1, Number(durationMinutes) || 1) * 60_000;
  const deadline = Number(deadlineAt);
  if (Number.isFinite(deadline) && deadline > startedAt) {
    return Math.min(durationEnds, deadline);
  }
  return durationEnds;
}

export function collectUserAttempts(attemptsMap, legacySession) {
  const list = [];
  const seen = new Set();
  if (attemptsMap && typeof attemptsMap === 'object') {
    for (const [attemptId, value] of Object.entries(attemptsMap)) {
      if (!value || value.status !== 'submitted' || !value.result) continue;
      list.push({ ...value, attemptId: value.attemptId || attemptId });
      seen.add(`${value.startedAt || 0}:${value.submittedAt || 0}`);
    }
  }
  if (legacySession && legacySession.status === 'submitted' && legacySession.result) {
    const key = `${legacySession.startedAt || 0}:${legacySession.submittedAt || 0}`;
    if (!seen.has(key)) {
      list.push({ ...legacySession, attemptId: legacySession.attemptId || 'legacy', legacy: true });
    }
  }
  list.sort((a, b) => (Number(b.submittedAt) || 0) - (Number(a.submittedAt) || 0));
  return list.map((item, idx) => ({
    ...item,
    attemptNumber: Number(item.attemptNumber) || (list.length - idx)
  }));
}

export function buildAutoSubmitRecord({ active, questions, existingCount = 0, now = Date.now() }) {
  const grading = gradeExam(questions, active?.draftAnswers || {});
  const startedAt = Number(active?.startedAt) || now;
  const endsAt = Number(active?.endsAt) || now;
  const submittedAt = Math.max(startedAt, Math.min(now, endsAt));
  const result = { ...grading, submittedAt, autoSubmitted: true };
  return {
    attemptId: active.attemptId || 'legacy',
    attemptNumber: existingCount + 1,
    startedAt,
    endsAt,
    submittedAt,
    elapsedMs: Math.max(0, submittedAt - startedAt),
    status: 'submitted',
    autoSubmitted: true,
    name: active.name || 'Người học',
    result
  };
}

export function aggregateExamLeaderboard({ attemptsByUid = {}, legacyByUid = {}, maxDurationMs = 0 }) {
  const uids = new Set([...Object.keys(attemptsByUid || {}), ...Object.keys(legacyByUid || {})]);
  const ranking = [];
  for (const uid of uids) {
    const attempts = collectUserAttempts(attemptsByUid?.[uid], legacyByUid?.[uid]);
    if (!attempts.length) continue;
    const elapsedOf = (item) => {
      const raw = Math.max(0, (Number(item.submittedAt) || 0) - (Number(item.startedAt) || 0));
      return maxDurationMs > 0 ? Math.min(raw, maxDurationMs) : raw;
    };
    let best = attempts[0];
    for (const item of attempts) {
      const sA = Number(item.result?.score) || 0;
      const sB = Number(best.result?.score) || 0;
      if (
        sA > sB ||
        (sA === sB && elapsedOf(item) < elapsedOf(best)) ||
        (sA === sB && elapsedOf(item) === elapsedOf(best) && (item.submittedAt || 0) < (best.submittedAt || 0))
      ) {
        best = item;
      }
    }
    const latest = attempts[0];
    ranking.push({
      uid,
      name: latest.name || best.name || 'Người học',
      score: Number(best.result?.score) || 0,
      latestScore: Number(latest.result?.score) || 0,
      submittedAt: Number(best.submittedAt) || 0,
      elapsedMs: elapsedOf(best),
      attemptCount: attempts.length,
      bestAttemptNumber: best.attemptNumber
    });
  }
  ranking.sort(
    (a, b) =>
      b.score - a.score ||
      a.elapsedMs - b.elapsedMs ||
      a.submittedAt - b.submittedAt
  );
  return ranking;
}
