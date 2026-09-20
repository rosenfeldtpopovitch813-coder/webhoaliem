'use strict';

const DAY_MS = 86400000;
const ACTIVE_WINDOW_MS = 45_000;
const MAX_HEARTBEAT_STEP_MS = 30_000;
const FIVE_HOURS = 18_000;

const dayKey = now => new Date(Number(now) + 7 * 3600000).toISOString().slice(0, 10);

function clone(v) { return structuredClone(v || {}); }

function splitByVietnamDay(start, end) {
  const pieces = [];
  let at = Number(start);
  const finish = Number(end);
  while (at < finish) {
    const vnDayNumber = Math.floor((at + 7 * 3600000) / DAY_MS);
    const nextMidnight = (vnDayNumber + 1) * DAY_MS - 7 * 3600000;
    const until = Math.min(finish, nextMidnight);
    if (until <= at) throw new Error('Invalid Vietnam-day boundary');
    pieces.push({key: dayKey(at), start: at, end: until});
    at = until;
  }
  return pieces;
}

function addSeconds(daily, start, end) {
  if (end <= start) return 0;
  const target = daily && typeof daily === 'object' ? daily : {};
  let accepted = 0;
  for (const piece of splitByVietnamDay(start, end)) {
    const old = Math.max(0, Math.floor(Number(target[piece.key]) || 0));
    const room = Math.max(0, 86400 - old);
    const seconds = Math.min(Math.floor((piece.end - piece.start) / 1000), room);
    if (seconds > 0) {
      target[piece.key] = old + seconds;
      accepted += seconds;
    }
  }
  return accepted;
}

function activeSessions(sessions, now) {
  return Object.entries(sessions || {}).filter(([, s]) => {
    if (!s || typeof s !== 'object') return false;
    return !s.endedAt && now - Number(s.lastHeartbeatAt || 0) <= ACTIVE_WINDOW_MS;
  });
}

/**
 * All study accounting happens inside one user transaction. The caller should
 * subsequently persist the returned state as the transaction snapshot.
 */
function applyStudy(current, action, id, now, opts = {}) {
  const user = clone(current);
  const sessions = user.studySessions && typeof user.studySessions === 'object' ? user.studySessions : {};
  user.studySessions = sessions;
  user.dailyStudy ||= {};
  user.dailySessions ||= {};
  const rewardEvery = Number(opts.rewardEvery || 3600);
  const rewardAmount = Number(opts.rewardAmount || 50);

  // TTL cleanup of abandoned sessions.
  for (const [key, s] of Object.entries(sessions)) {
    const hb = Number(s?.lastHeartbeatAt || s?.startedAt || 0);
    if (!s?.endedAt && now - hb > DAY_MS) s.endedAt = Math.min(now, hb + ACTIVE_WINDOW_MS);
    if (s?.endedAt && now - Number(s.endedAt) > DAY_MS) delete sessions[key];
  }

  if (action === 'start') {
    const existing = activeSessions(sessions, now);
    const clientInstanceId = String(opts.clientInstanceId || '');
    const reusable = existing.find(([, s]) => clientInstanceId && s.clientInstanceId === clientInstanceId);
    if (reusable) {
      const existingId = reusable[0];
      return {...user, __result: {sessionId: existingId, acceptedSeconds: 0, reused: true, needsConfirmation: now >= Number(reusable[1].confirmAt || Infinity)}};
    }
    if (existing.length) return undefined;
    const session = {
      sessionId: id,
      clientInstanceId: clientInstanceId.slice(0, 120),
      startedAt: now,
      lastHeartbeatAt: now,
      creditedSeconds: 0,
      countedHours: Math.floor((Number(user.totalStudySeconds) || 0) / rewardEvery),
      confirmAt: now + FIVE_HOURS * 1000,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };
    sessions[id] = session;
    user.totalStudySeconds = Math.max(0, Math.floor(Number(user.totalStudySeconds) || 0));
    user.wallet ||= {balance: 0, lifetimeEarned: 0, lifetimeSpent: 0};
    user.__result = {sessionId: id, acceptedSeconds: 0, rewardAmount: 0, needsConfirmation: false};
    return user;
  }

  const session = sessions[id];
  if (!session || session.status === 'stopped') return undefined;
  if (action === 'heartbeat' && (session.status === 'needs_confirmation' || session.endedAt)) return undefined;

  if (action === 'continue') {
    if (now > Number(session.confirmAt || 0) + 30_000) return undefined;
    session.confirmAt = now + FIVE_HOURS * 1000;
    session.lastHeartbeatAt = now;
    session.endedAt = null;
    session.status = 'active';
    session.updatedAt = now;
    user.__result = {sessionId: id, acceptedSeconds: 0, rewardAmount: 0, needsConfirmation: false};
    return user;
  }

  if (action === 'heartbeat' || action === 'stop') {
    const previous = Number(session.lastHeartbeatAt || session.startedAt || now);
    const hardEnd = Math.min(now, Number(session.confirmAt || now));
    const gap = Math.max(0, now - previous);
    const cappedEnd = Math.min(hardEnd, previous + MAX_HEARTBEAT_STEP_MS);
    const acceptedStart = previous;
    const acceptedEnd = gap > ACTIVE_WINDOW_MS ? previous : Math.max(previous, cappedEnd);
    const acceptedSeconds = acceptedEnd > acceptedStart ? addSeconds(user.dailyStudy, acceptedStart, acceptedEnd) : 0;
    user.totalStudySeconds = Math.max(0, Math.floor(Number(user.totalStudySeconds) || 0)) + acceptedSeconds;
    session.creditedSeconds = Math.max(0, Math.floor(Number(session.creditedSeconds) || 0)) + acceptedSeconds;
    session.lastHeartbeatAt = now;
    session.updatedAt = now;

    let rewardAmountGranted = 0;
    const beforeHours = Math.floor((Math.max(0, user.totalStudySeconds - acceptedSeconds)) / rewardEvery);
    const afterHours = Math.floor(Math.max(0, user.totalStudySeconds) / rewardEvery);
    const hoursToReward = Math.max(0, afterHours - beforeHours);
    if (hoursToReward) {
      const wallet = user.wallet && typeof user.wallet === 'object' ? user.wallet : {balance: 0, lifetimeEarned: 0, lifetimeSpent: 0};
      user.wallet = wallet;
      rewardAmountGranted = hoursToReward * rewardAmount;
      wallet.balance = Math.min(10_000_000, Math.max(0, Number(wallet.balance) || 0) + rewardAmountGranted);
      wallet.lifetimeEarned = Math.max(0, Number(wallet.lifetimeEarned) || 0) + rewardAmountGranted;
      wallet.updatedAt = now;
      const ledger = user.tokenLedger && typeof user.tokenLedger === 'object' ? user.tokenLedger : {};
      user.tokenLedger = ledger;
      const rewardBase = Number(session.rewardCursor || beforeHours);
      for (let hour = rewardBase + 1; hour <= afterHours; hour++) {
        const txId = `study-${id}-${hour}`;
        if (!ledger[txId]) ledger[txId] = {type: 'study_reward', amount: rewardAmount, source: 'study_time', sourceId: `${id}:${hour}`, createdAt: now, reason: '60 phút học hợp lệ'};
      }
      session.rewardCursor = afterHours;
    }

    if (acceptedSeconds > 0) {
      const today = dayKey(acceptedEnd - 1);
      user.dailySessions[today] = Math.max(0, Number(user.dailySessions[today]) || 0) + (session.counted ? 0 : 1);
      session.counted = true;
      if (user.lastStudyDate !== today) {
        const yesterday = dayKey(acceptedEnd - DAY_MS);
        user.studyStreak = user.lastStudyDate === yesterday ? Math.max(0, Number(user.studyStreak) || 0) + 1 : 1;
        user.lastStudyDate = today;
      }
    }

    const reachedConfirmation = now >= Number(session.confirmAt || Infinity);
    if (action === 'stop' || reachedConfirmation) {
      session.status = action === 'stop' ? 'stopped' : 'needs_confirmation';
      session.endedAt = now;
      session.updatedAt = now;
      if (action === 'stop') delete sessions[id];
    }
    if (action === 'heartbeat' && reachedConfirmation) user.__result = {sessionId: id, acceptedSeconds, rewardAmount: rewardAmountGranted, needsConfirmation: true};
    else user.__result = {sessionId: id, acceptedSeconds, rewardAmount: rewardAmountGranted, needsConfirmation: false, gapClamped: gap > MAX_HEARTBEAT_STEP_MS};
    return user;
  }

  return undefined;
}

function sanitizePublicState(data, day = dayKey(Date.now())) {
  const wallet = data?.wallet || {};
  return {
    totalStudySeconds: Math.max(0, Math.floor(Number(data?.totalStudySeconds) || 0)),
    todayStudySeconds: Math.max(0, Math.floor(Number(data?.dailyStudy?.[day]) || 0)),
    todaySessions: Math.max(0, Math.floor(Number(data?.dailySessions?.[day]) || 0)),
    streak: Math.max(0, Math.floor(Number(data?.studyStreak) || 0)),
    wallet: {
      balance: Math.max(0, Math.floor(Number(wallet.balance) || 0)),
      lifetimeEarned: Math.max(0, Math.floor(Number(wallet.lifetimeEarned) || 0)),
      lifetimeSpent: Math.max(0, Math.floor(Number(wallet.lifetimeSpent) || 0))
    }
  };
}

module.exports = {DAY_MS, ACTIVE_WINDOW_MS, MAX_HEARTBEAT_STEP_MS, FIVE_HOURS, dayKey, splitByVietnamDay, addSeconds, activeSessions, applyStudy, sanitizePublicState};
