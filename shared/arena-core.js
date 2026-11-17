export const MAX_PLAYERS = 8;
export const MAX_HUNDRED_PLAYERS = 100;
export const INITIAL_HP = 200;
export const ROUND_MS = 20000;
export const HUNDRED_ROUND_MS = 25000;
export const BETWEEN_ROUNDS_MS = 2500;

export const ARENA_SUBJECTS = Object.freeze([
  'Hóa học',
  'Toán học',
  'Tiếng Anh',
  'Vật lý',
  'Sinh học',
  'Tổng hợp'
]);

export const MILLIONAIRE_LADDER = Object.freeze([
  { step: 1, reward: '200.000 đ', points: 20, safe: false },
  { step: 2, reward: '400.000 đ', points: 40, safe: false },
  { step: 3, reward: '600.000 đ', points: 60, safe: false },
  { step: 4, reward: '1.000.000 đ', points: 100, safe: false },
  { step: 5, reward: '2.000.000 đ', points: 200, safe: true },
  { step: 6, reward: '3.000.000 đ', points: 300, safe: false },
  { step: 7, reward: '6.000.000 đ', points: 600, safe: false },
  { step: 8, reward: '10.000.000 đ', points: 1000, safe: false },
  { step: 9, reward: '14.000.000 đ', points: 1400, safe: false },
  { step: 10, reward: '22.000.000 đ', points: 2200, safe: true },
  { step: 11, reward: '30.000.000 đ', points: 3000, safe: false },
  { step: 12, reward: '40.000.000 đ', points: 4000, safe: false },
  { step: 13, reward: '60.000.000 đ', points: 6000, safe: false },
  { step: 14, reward: '85.000.000 đ', points: 8500, safe: false },
  { step: 15, reward: '150.000.000 đ', points: 15000, safe: true }
]);

export function damageFor(elapsedMs, roundMs = ROUND_MS, base = 30, alpha = 0.5) {
  if (![elapsedMs, roundMs, base, alpha].every(Number.isFinite) || roundMs <= 0) {
    throw Error('Thông số sát thương sai');
  }
  return Math.round(base * (1 + alpha * (roundMs - Math.min(roundMs, Math.max(0, elapsedMs))) / roundMs));
}

export function normalizeShortAnswer(value) {
  const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!raw) return '';
  if (/^[+-]?\d+(?:[.,]\d+)?$/.test(raw)) {
    const n = Number(raw.replace(',', '.'));
    if (Number.isFinite(n)) return String(n);
  }
  return raw;
}

export function isArenaAnswerCorrect(q, submitted) {
  if (!q) return false;
  if (q.kind === 'short') {
    const norm = normalizeShortAnswer(submitted);
    if (!norm) return false;
    const pool = Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length
      ? q.acceptedAnswers
      : [q.answer];
    return pool.some((item) => normalizeShortAnswer(item) === norm);
  }
  return String(submitted || '').trim().toUpperCase() === q.answer;
}

export function isValidQuestion(q) {
  return !!(
    q &&
    typeof q.prompt === 'string' &&
    q.prompt.trim().length >= 4 &&
    q.prompt.length <= 800 &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.every((x) => typeof x === 'string' && x.trim() && x.length <= 250) &&
    'ABCD'.includes(q.answer) &&
    q.answer.length === 1 &&
    ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao'].includes(q.level || 'Thông hiểu') &&
    typeof (q.topic || '') === 'string' &&
    (q.topic || '').length <= 80
  );
}

export function isValidHundredQuestion(q) {
  if (!q || typeof q.prompt !== 'string' || q.prompt.trim().length < 3 || q.prompt.length > 800) return false;
  if (q.kind === 'short') {
    const ans = String(q.answer ?? '').trim();
    return Boolean(ans && ans.length <= 160);
  }
  return isValidQuestion({ level: 'Thông hiểu', topic: 'Tổng hợp', ...q });
}

export function publicRoom(room, now = Date.now()) {
  if (!room) return null;
  const players = Object.entries(room.players || {}).map(([uid, p]) => ({
    uid,
    name: p.name,
    hp: p.hp,
    score: p.score || 0,
    joinedAt: p.joinedAt
  }));
  const result = {
    id: room.id,
    mode: room.mode || 'battle',
    title: room.title || 'Đấu trường 1v1 / Nhóm',
    subject: room.subject || 'Tổng hợp',
    hostUid: room.hostUid,
    status: room.status,
    players,
    maxPlayers: MAX_PLAYERS,
    round: room.round || 0,
    totalRounds: room.questions?.length || 0,
    serverNow: now,
    roundEndsAt: room.roundEndsAt || null,
    winnerUid: room.winnerUid || null,
    events: Object.values(room.events || {}).slice(-15),
    createdAt: room.createdAt
  };
  if (room.status === 'PLAYING' && room.roundEndsAt > now && room.round > 0) {
    const q = room.questions[room.round - 1];
    result.question = { prompt: q.prompt, options: q.options, topic: q.topic || '', level: q.level || 'Thông hiểu' };
  }
  if (room.status === 'FINISHED') result.finishedAt = room.finishedAt;
  return result;
}

export function publicHundredRoom(room, now = Date.now()) {
  if (!room) return null;
  const players = Object.entries(room.players || {})
    .filter(([, p]) => p)
    .map(([uid, p]) => ({
      uid,
      name: p.name,
      alive: p.alive !== false,
      eliminatedRound: p.eliminatedRound || null,
      correctCount: p.correctCount || 0,
      totalResponseMs: p.totalResponseMs || 0,
      joinedAt: p.joinedAt || 0
    }))
    .sort((a, b) => Number(b.alive) - Number(a.alive) || b.correctCount - a.correctCount || a.totalResponseMs - b.totalResponseMs || a.joinedAt - b.joinedAt);

  const aliveCount = players.filter((p) => p.alive).length;
  const result = {
    id: room.id,
    mode: 'hundred',
    title: room.title || 'Đấu trường 100',
    subject: room.subject || 'Tổng hợp',
    hostUid: room.hostUid,
    status: room.status,
    players,
    aliveCount,
    totalPlayers: players.length,
    maxPlayers: MAX_HUNDRED_PLAYERS,
    round: room.round || 0,
    totalRounds: room.questions?.length || 0,
    serverNow: now,
    roundEndsAt: room.roundEndsAt || null,
    winnerUids: Array.isArray(room.winnerUids) ? room.winnerUids : [],
    lastRoundSummary: room.lastRoundSummary || null,
    createdAt: room.createdAt
  };

  if (room.status === 'PLAYING' && room.round > 0) {
    const q = room.questions[room.round - 1];
    result.question = {
      kind: q.kind === 'short' ? 'short' : 'mcq',
      prompt: q.prompt,
      options: q.kind === 'short' ? [] : q.options,
      topic: q.topic || ''
    };
  }
  if (room.status === 'FINISHED') result.finishedAt = room.finishedAt;
  return result;
}

export function finalizeHundredRound(room, now = Date.now()) {
  if (!room || room.status !== 'PLAYING' || room.round <= 0) return room;
  const q = room.questions?.[room.round - 1];
  const answers = room.answers?.[room.round] || {};
  const survivorsBefore = Object.entries(room.players || {}).filter(([, p]) => p && p.alive !== false);
  const eliminatedNames = [];
  let survivedCount = 0;

  for (const [uid, player] of survivorsBefore) {
    const entry = answers[uid];
    if (entry && entry.correct) {
      survivedCount++;
    } else {
      player.alive = false;
      player.eliminatedRound = room.round;
      eliminatedNames.push(player.name || 'Thí sinh');
    }
  }

  room.lastRoundSummary = {
    round: room.round,
    correctAnswer: q?.kind === 'short' ? String(q.answer) : `${q?.answer || ''}`,
    survivedCount,
    eliminatedCount: eliminatedNames.length,
    eliminatedPreview: eliminatedNames.slice(0, 8)
  };

  const remaining = Object.entries(room.players || {}).filter(([, p]) => p && p.alive !== false);
  const noMoreRounds = room.round >= (room.questions?.length || 0);
  if (remaining.length <= 1 || noMoreRounds) {
    room.status = 'FINISHED';
    room.finishedAt = now;
    room.roundEndsAt = 0;
    if (remaining.length >= 1) {
      room.winnerUids = remaining
        .sort((a, b) => (b[1].correctCount || 0) - (a[1].correctCount || 0) || (a[1].totalResponseMs || 0) - (b[1].totalResponseMs || 0))
        .slice(0, remaining.length === 1 ? 1 : remaining.length)
        .map(([uid]) => uid);
    } else {
      // Fallback: if all survivors eliminated together on the final decisive round, crown top scorers from survivorsBefore.
      const topScore = Math.max(...survivorsBefore.map(([, p]) => p.correctCount || 0), 0);
      room.winnerUids = survivorsBefore
        .filter(([, p]) => (p.correctCount || 0) === topScore)
        .sort((a, b) => (a[1].totalResponseMs || 0) - (b[1].totalResponseMs || 0))
        .slice(0, 3)
        .map(([uid]) => uid);
    }
    return room;
  }

  room.status = 'ROUND_REVIEW';
  room.roundEndsAt = 0;
  return room;
}

export function winner(players) {
  return Object.entries(players).sort(
    (a, b) => b[1].hp - a[1].hp || b[1].score - a[1].score || a[1].joinedAt - b[1].joinedAt
  )[0]?.[0] || null;
}

export function safeCode(code) {
  return typeof code === 'string' && /^[A-Z0-9]{8}$/.test(code);
}
