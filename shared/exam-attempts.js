import { gradeExam } from './exam-grading.js';

export const SUBMISSION_GRACE_MS = 30_000;
export const MAX_EXAM_ATTEMPTS_LIMIT = 50;
export const MAX_VIOLATION_EVENTS = 30;
const VALID_VIOLATION_REASONS = new Set(['tab-hidden', 'fullscreen-exit']);

export function normalizeLeaveScreenCount(raw) {
  const n = Math.floor(Number(raw) || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(200, n);
}

export function normalizeViolationEvents(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const at = Math.floor(Number(item.at) || 0);
    if (!Number.isFinite(at) || at <= 0) continue;
    const reason = VALID_VIOLATION_REASONS.has(item.reason) ? item.reason : 'tab-hidden';
    out.push({ at, reason });
    if (out.length >= MAX_VIOLATION_EVENTS) break;
  }
  return out;
}

export function resolveAttemptReviewStatus(attempt) {
  const leaveCount = normalizeLeaveScreenCount(attempt?.leaveScreenCount);
  if (leaveCount === 0) return 'clean';
  const raw = String(attempt?.reviewStatus || '').trim().toLowerCase();
  if (raw === 'approved' || raw === 'rejected' || raw === 'pending') return raw;
  return 'pending';
}

export function isAttemptLeaderboardEligible(attempt) {
  if (!attempt || attempt.status !== 'submitted' || !attempt.result) return false;
  const status = resolveAttemptReviewStatus(attempt);
  return status === 'clean' || status === 'approved';
}

export function summarizeUserModerationStatus(attempts = []) {
  const list = Array.isArray(attempts) ? attempts : [];
  let pendingCount = 0;
  let rejectedCount = 0;
  let approvedFlaggedCount = 0;
  let eligibleCount = 0;
  let latestFlagged = null;

  for (const item of list) {
    const status = resolveAttemptReviewStatus(item);
    const leaveCount = normalizeLeaveScreenCount(item?.leaveScreenCount);
    if (status === 'clean' || status === 'approved') eligibleCount += 1;
    if (status === 'approved' && leaveCount > 0) approvedFlaggedCount += 1;
    if (status === 'pending') {
      pendingCount += 1;
      if (!latestFlagged) latestFlagged = item;
    } else if (status === 'rejected') {
      rejectedCount += 1;
      if (!latestFlagged) latestFlagged = item;
    }
  }

  return {
    eligibleCount,
    pendingCount,
    rejectedCount,
    approvedFlaggedCount,
    hasPending: pendingCount > 0,
    hasRejected: rejectedCount > 0,
    latestFlaggedLeaveCount: latestFlagged ? normalizeLeaveScreenCount(latestFlagged.leaveScreenCount) : 0,
    reviewStatus: pendingCount > 0 ? 'pending' : (rejectedCount > 0 && eligibleCount === 0 ? 'rejected' : 'clean')
  };
}

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
  return list.map((item, idx) => {
    const leaveScreenCount = normalizeLeaveScreenCount(item.leaveScreenCount);
    const violationEvents = normalizeViolationEvents(item.violationEvents);
    const reviewStatus = resolveAttemptReviewStatus({ ...item, leaveScreenCount });
    return {
      ...item,
      attemptNumber: Number(item.attemptNumber) || (list.length - idx),
      leaveScreenCount,
      violationEvents,
      flaggedForCheating: leaveScreenCount > 0,
      reviewStatus,
      reviewedAt: Number(item.reviewedAt) || 0,
      reviewNote: typeof item.reviewNote === 'string' ? item.reviewNote : ''
    };
  });
}

export function buildAutoSubmitRecord({ active, questions, scoringConfig = null, existingCount = 0, now = Date.now() }) {
  const grading = gradeExam(questions, active?.draftAnswers || {}, scoringConfig);
  const startedAt = Number(active?.startedAt) || now;
  const endsAt = Number(active?.endsAt) || now;
  const submittedAt = Math.max(startedAt, Math.min(now, endsAt));
  const leaveScreenCount = normalizeLeaveScreenCount(active?.leaveScreenCount);
  const violationEvents = normalizeViolationEvents(active?.violationEvents);
  const reviewStatus = leaveScreenCount > 0 ? 'pending' : 'clean';
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
    leaveScreenCount,
    violationEvents,
    flaggedForCheating: leaveScreenCount > 0,
    reviewStatus,
    result
  };
}

export function aggregateExamLeaderboard({ attemptsByUid = {}, legacyByUid = {}, maxDurationMs = 0 }) {
  const uids = new Set([...Object.keys(attemptsByUid || {}), ...Object.keys(legacyByUid || {})]);
  const ranking = [];
  for (const uid of uids) {
    const allAttempts = collectUserAttempts(attemptsByUid?.[uid], legacyByUid?.[uid]);
    const attempts = allAttempts.filter(isAttemptLeaderboardEligible);
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
      bestAttemptNumber: best.attemptNumber,
      bestAttemptId: best.attemptId,
      flaggedApproved: normalizeLeaveScreenCount(best.leaveScreenCount) > 0 && resolveAttemptReviewStatus(best) === 'approved'
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

export function serializeExamSummary(meta, now, extra = {}) {
  const maxAttempts = Number(meta.maxAttempts) || 0;
  return {
    id: meta.id,
    title: meta.title,
    durationMinutes: meta.durationMinutes,
    maxAttempts,
    createdAt: meta.createdAt,
    status: meta.status,
    ownerName: meta.ownerName || 'Giáo viên',
    isOwner: extra.isOwner ?? false,
    counts: meta.counts,
    displayMode: meta.displayMode === 'unified_inline' ? 'unified_inline' : 'split_omr',
    hasSourceDocument: Boolean(meta.sourceUrl),
    hasPassword: Boolean(meta.hasPassword),
    scoringConfig: meta.scoringConfig || null,
    shuffleQuestions: Boolean(meta.shuffleQuestions),
    shuffleOptions: Boolean(meta.shuffleOptions),
    deadlineAt: meta.deadlineAt || null,
    manualLocked: Boolean(meta.manualLocked),
    isLocked: isExamLocked(meta, now),
    ...extra
  };
}
