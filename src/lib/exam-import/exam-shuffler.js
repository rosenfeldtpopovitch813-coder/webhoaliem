// Deterministic seeded exam shuffler (mulberry32 PRNG).
// Preserves Part I/II/III grouping, respects lockOrder & lockOptions, and remaps answer keys cleanly.

export function hashSeed(input) {
  const s = String(input ?? '101');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleUnlocked(items, rng, isLocked) {
  const result = [...items];
  const freeIndices = [];
  for (let i = 0; i < result.length; i++) {
    if (!isLocked(result[i])) freeIndices.push(i);
  }
  const pool = freeIndices.map((idx) => result[idx]);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  freeIndices.forEach((idx, k) => {
    result[idx] = pool[k];
  });
  return result;
}

const LETTERS = ['A', 'B', 'C', 'D'];

function shuffleQuestionOptions(q, rng, shuffleOptionsEnabled) {
  const clone = structuredClone(q);
  if (!shuffleOptionsEnabled || clone.lockOptions) return clone;

  if (clone.part === 'I' && Array.isArray(clone.options) && clone.options.length === 4) {
    const order = [0, 1, 2, 3];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const oldCorrectIdx = LETTERS.indexOf(String(clone.answer || '').toUpperCase());
    clone.options = order.map((oldIdx) => clone.options[oldIdx]);
    if (oldCorrectIdx >= 0) {
      const newCorrectIdx = order.indexOf(oldCorrectIdx);
      clone.answer = LETTERS[newCorrectIdx];
    }
    clone.optionOrder = order;
  } else if (clone.part === 'II' && Array.isArray(clone.options) && clone.options.length === 4 && Array.isArray(clone.answer)) {
    const order = [0, 1, 2, 3];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    clone.options = order.map((oldIdx) => clone.options[oldIdx]);
    clone.answer = order.map((oldIdx) => clone.answer[oldIdx]);
    clone.optionOrder = order;
  }

  return clone;
}

/**
 * Generate one deterministic shuffled variant of an exam.
 */
export function generateExamVariant(exam, { code = '101', seed = null, shuffleQuestions = true, shuffleOptions = true } = {}) {
  const actualSeed = seed ?? hashSeed(`${exam.title || 'exam'}::${code}`);
  const rng = mulberry32(actualSeed);

  const byPart = {
    I: exam.questions.filter((q) => q.part === 'I'),
    II: exam.questions.filter((q) => q.part === 'II'),
    III: exam.questions.filter((q) => q.part === 'III')
  };

  const ordered = [];
  for (const part of ['I', 'II', 'III']) {
    const group = byPart[part];
    const arranged = shuffleQuestions ? shuffleUnlocked(group, rng, (q) => Boolean(q.lockOrder)) : [...group];
    for (const q of arranged) {
      const shuffled = shuffleQuestionOptions(q, rng, shuffleOptions);
      shuffled.sourceId = q.id;
      ordered.push(shuffled);
    }
  }

  ordered.forEach((q, idx) => {
    q.displayNumber = idx + 1;
  });

  return {
    code: String(code),
    seed: actualSeed,
    title: exam.title,
    subject: exam.subject || 'Hóa học',
    durationMinutes: exam.durationMinutes || 50,
    questions: ordered
  };
}

/**
 * Generate N exam codes (e.g. 101, 102, 103, 104) and build a master answer key table.
 */
export function generateExamVariants(exam, { count = 4, startCode = 101, shuffleQuestions = true, shuffleOptions = true } = {}) {
  const safeCount = Math.max(1, Math.min(24, Number(count) || 4));
  const baseCode = Math.max(1, Number(startCode) || 101);
  const variants = [];

  for (let i = 0; i < safeCount; i++) {
    const code = String(baseCode + i).padStart(3, '0');
    variants.push(generateExamVariant(exam, { code, shuffleQuestions, shuffleOptions }));
  }

  return {
    variants,
    answerKeyCsv: buildAnswerKeyCsv(variants)
  };
}

export function formatAnswerCell(q) {
  if (q.part === 'I') return q.answer || '?';
  if (q.part === 'II' && Array.isArray(q.answer)) {
    return q.answer.map((v) => (v === true ? 'Đ' : v === false ? 'S' : '?')).join('-');
  }
  if (q.part === 'III') return q.answer !== '' && q.answer != null ? String(q.answer) : '?';
  return '?';
}

export function buildAnswerKeyCsv(variants) {
  if (!variants.length) return '';
  const maxQ = Math.max(...variants.map((v) => v.questions.length));
  const header = ['Câu', 'Phần', ...variants.map((v) => `Mã ${v.code}`)];
  const rows = [header.join(',')];

  for (let i = 0; i < maxQ; i++) {
    const part = variants[0].questions[i]?.part || '';
    const cells = [
      String(i + 1),
      `Phần ${part}`,
      ...variants.map((v) => {
        const q = v.questions[i];
        return q ? `"${formatAnswerCell(q).replace(/"/g, '""')}"` : '';
      })
    ];
    rows.push(cells.join(','));
  }

  return '\uFEFF' + rows.join('\r\n');
}
