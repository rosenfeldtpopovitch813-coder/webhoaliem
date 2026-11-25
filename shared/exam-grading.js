export const PART2_WEIGHTS = Object.freeze([0, 10, 25, 50, 100]);
export const PART2_RATIOS_2025 = Object.freeze([0, 0.1, 0.25, 0.5, 1]);
// A practical safety ceiling, not the former 60-question restriction. Supports full 120-question tests.
export const MAX_EXAM_QUESTIONS = 1000;
const MICRO_PER_POINT = 1_000_000;

export const PRESET_SCORING_CONFIGS = Object.freeze({
  math_2025: Object.freeze({
    preset: 'math_2025',
    label: 'Toán 2025 (12–4–6)',
    perQuestion: Object.freeze({ I: 0.25, II: 1, III: 0.5 }),
    normalizeTo10: false
  }),
  science_2025: Object.freeze({
    preset: 'science_2025',
    label: 'Lý · Hóa · Sinh · Địa 2025 (18–4–6)',
    perQuestion: Object.freeze({ I: 0.25, II: 1, III: 0.25 }),
    normalizeTo10: false
  }),
  social_it_2025: Object.freeze({
    preset: 'social_it_2025',
    label: 'Sử · Tin · Công nghệ 2025 (24–4–0)',
    perQuestion: Object.freeze({ I: 0.25, II: 1, III: 0 }),
    normalizeTo10: false
  }),
  custom: Object.freeze({
    preset: 'custom',
    label: 'Tùy chỉnh từng phần',
    perQuestion: Object.freeze({ I: 0.25, II: 1, III: 0.5 }),
    normalizeTo10: false
  })
});

export function suggestScoringConfigForCounts(counts = {}) {
  const cI = Math.max(0, Math.floor(Number(counts.I) || 0));
  const cII = Math.max(0, Math.floor(Number(counts.II) || 0));
  const cIII = Math.max(0, Math.floor(Number(counts.III) || 0));
  if (cI === 12 && cII === 4 && cIII === 6) {
    return { preset: 'math_2025', perQuestion: { I: 0.25, II: 1, III: 0.5 }, normalizeTo10: false };
  }
  if (cI === 18 && cII === 4 && cIII === 6) {
    return { preset: 'science_2025', perQuestion: { I: 0.25, II: 1, III: 0.25 }, normalizeTo10: false };
  }
  if (cI === 24 && cII === 4 && cIII === 0) {
    return { preset: 'social_it_2025', perQuestion: { I: 0.25, II: 1, III: 0 }, normalizeTo10: false };
  }
  if (cI > 0 && cII === 0 && cIII === 0) {
    const pq = Math.round((10 / cI) * 10000) / 10000;
    return { preset: 'custom', perQuestion: { I: pq, II: 1, III: 0.5 }, partTotals: { I: 10, II: 0, III: 0 }, normalizeTo10: false };
  }
  const p3Default = cIII > 0 && cI <= 12 ? 0.5 : 0.25;
  return {
    preset: 'custom',
    perQuestion: { I: 0.25, II: 1, III: p3Default },
    normalizeTo10: false
  };
}

export function normalizeScoringConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const validPresets = new Set(['math_2025', 'science_2025', 'social_it_2025', 'custom']);
  const preset = validPresets.has(raw.preset) ? raw.preset : 'custom';
  const base = PRESET_SCORING_CONFIGS[preset]?.perQuestion || { I: 0.25, II: 1, III: 0.5 };
  const pqRaw = raw.perQuestion && typeof raw.perQuestion === 'object' ? raw.perQuestion : {};
  const ptRaw = raw.partTotals && typeof raw.partTotals === 'object' ? raw.partTotals : null;

  const cleanPoint = (val, fallback) => {
    if (val === null || val === undefined || val === '') return fallback;
    const n = Number(String(val).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 100) throw Error('Điểm cấu hình từng phần phải nằm trong khoảng 0 đến 100.');
    return Math.round(n * 1_000_000) / 1_000_000;
  };

  const perQuestion = {
    I: cleanPoint(pqRaw.I, base.I),
    II: cleanPoint(pqRaw.II, base.II),
    III: cleanPoint(pqRaw.III, base.III)
  };

  let partTotals = null;
  if (ptRaw) {
    partTotals = {
      I: cleanPoint(ptRaw.I, 0),
      II: cleanPoint(ptRaw.II, 0),
      III: cleanPoint(ptRaw.III, 0)
    };
  }

  return {
    preset,
    perQuestion,
    ...(partTotals ? { partTotals } : {}),
    normalizeTo10: Boolean(raw.normalizeTo10)
  };
}

export function parseRoomIdFromInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^[A-Za-z0-9]{12}$/.test(s)) return s.toUpperCase();
  const roomQuery = /[?&](?:room|id|exam)=([A-Za-z0-9]{12})(?:[&#]|$)/i.exec(s);
  if (roomQuery) return roomQuery[1].toUpperCase();
  const pathMatch = /\/exam\/([A-Za-z0-9]{12})(?:[/?#]|$)/i.exec(s);
  if (pathMatch) return pathMatch[1].toUpperCase();
  return '';
}

export function buildExamRoomShareUrl(origin, examId) {
  const cleanOrigin = String(origin || '').replace(/\/+$/, '');
  const cleanId = String(examId || '').trim().toUpperCase();
  return `${cleanOrigin}/exam?room=${encodeURIComponent(cleanId)}`;
}

const SAFE_HTML_TAGS = new Set([
  'strong', 'b', 'em', 'i', 'u', 'sub', 'sup', 'br', 'p', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code'
]);

export function sanitizeExamQuestionHtml(input) {
  const str = String(input ?? '');
  if (!str.includes('<')) return str;
  const stripped = str
    .replace(/<(script|style|iframe|object|embed|svg|form|textarea|input|button|link|meta)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|svg|form|textarea|input|button|link|meta)\b[^>]*\/?>/gi, '');

  return stripped.replace(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g, (_m, slash, rawTag, rawAttrs) => {
    const tag = rawTag.toLowerCase();
    if (!SAFE_HTML_TAGS.has(tag)) return '';
    if (slash) return `</${tag}>`;
    if (tag === 'br') return '<br/>';
    if (tag === 'div') {
      const clsM = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(rawAttrs || '');
      const cls = clsM?.[1] ?? clsM?.[2] ?? '';
      return cls.includes('exam-table-wrap') ? '<div class="exam-table-wrap">' : '<div>';
    }
    if (tag === 'table') return '<table class="exam-table">';
    if (tag === 'th' || tag === 'td') {
      const csM = /\bcolspan\s*=\s*"?(\d+)"?/i.exec(rawAttrs || '');
      const rsM = /\browspan\s*=\s*"?(\d+)"?/i.exec(rawAttrs || '');
      const cs = csM ? ` colspan="${Math.min(20, Math.max(1, Number(csM[1])))}"` : '';
      const rs = rsM ? ` rowspan="${Math.min(50, Math.max(1, Number(rsM[1])))}"` : '';
      return `<${tag}${cs}${rs}>`;
    }
    return `<${tag}>`;
  });
}

export function normalizeShort(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = Number(s); return Number.isFinite(n) ? n : null;
}
export function normalizeChoice(value) { return typeof value === 'string' && /^[ABCD]$/i.test(value.trim()) ? value.trim().toUpperCase() : null; }
export function normalizeTF(value) { return value === true || value === false ? value : null; }

function assertValidDataImage(img, label, maxLen = 300000) {
  if (!img) return '';
  if (typeof img !== 'string' || img.length > maxLen || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(img)) {
    throw Error(`${label}: ảnh phải là PNG, JPEG hoặc WebP đã nén (${Math.round(maxLen / 1000)} KB tối đa).`);
  }
  return img;
}

export function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > MAX_EXAM_QUESTIONS) throw Error(`Đề phải có từ 1 đến ${MAX_EXAM_QUESTIONS} câu.`);
  const cleaned = questions.map((q, i) => {
    if (!q || !['I', 'II', 'III'].includes(q.part)) throw Error(`Câu ${i + 1}: phần không hợp lệ.`);
    const image = assertValidDataImage(q.image == null ? '' : q.image, `Câu ${i + 1}`, 300000);
    const rawPrompt = typeof q.prompt === 'string' ? sanitizeExamQuestionHtml(q.prompt).trim() : '';
    const prompt = rawPrompt || (image ? `Câu ${i + 1}` : '');
    if (!prompt || prompt.length > 14000) throw Error(`Câu ${i + 1}: nội dung không hợp lệ hoặc quá dài.`);
    const latex = q.latex == null ? '' : String(q.latex);
    if (latex.length > 4000) throw Error(`Câu ${i + 1}: công thức nâng cao không quá 4000 ký tự.`);
    const explanation = q.explanation == null ? '' : sanitizeExamQuestionHtml(String(q.explanation)).trim();
    if (explanation.length > 12000) throw Error(`Câu ${i + 1}: lời giải không quá 12000 ký tự.`);
    const explanationImage = assertValidDataImage(q.explanationImage == null ? '' : q.explanationImage, `Lời giải câu ${i + 1}`, 300000);
    const partTitle = typeof q.partTitle === 'string' ? sanitizeExamQuestionHtml(q.partTitle).trim().slice(0, 200) : '';

    let extraImages = null;
    if (Array.isArray(q.extraImages) && q.extraImages.length) {
      extraImages = q.extraImages.slice(0, 3).map((im, idx) => assertValidDataImage(im, `Câu ${i + 1} (hình ${idx + 2})`, 260000)).filter(Boolean);
    }

    const base = {
      id: `q${i + 1}`,
      part: q.part,
      prompt,
      ...(latex.trim() ? { latex: latex.trim() } : {}),
      ...(image ? { image } : {}),
      ...(extraImages?.length ? { extraImages } : {}),
      ...(partTitle ? { partTitle } : {}),
      ...(q.lockOrder === true ? { lockOrder: true } : {}),
      ...(q.lockOptions === true ? { lockOptions: true } : {}),
      ...(explanation ? { explanation } : {}),
      ...(explanationImage ? { explanationImage } : {})
    };

    if (q.part === 'I') {
      let optionImages = null;
      if (Array.isArray(q.optionImages) && q.optionImages.some(Boolean)) {
        optionImages = [0, 1, 2, 3].map(idx => assertValidDataImage(q.optionImages[idx] || '', `Câu ${i + 1} đáp án ${'ABCD'[idx]}`, 200000));
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) throw Error(`Câu ${i + 1}: cần đủ 4 lựa chọn A, B, C, D.`);
      const normOpts = q.options.map((o, idx) => {
        const clean = typeof o === 'string' ? sanitizeExamQuestionHtml(o).trim() : '';
        return clean || (optionImages?.[idx] ? `Phương án ${'ABCD'[idx]}` : '');
      });
      if (normOpts.some(o => !o || o.length > 2500) || !normalizeChoice(q.answer)) {
        throw Error(`Câu ${i + 1}: cần 4 lựa chọn hợp lệ và đáp án A/B/C/D.`);
      }
      return {
        ...base,
        options: normOpts,
        ...(optionImages?.some(Boolean) ? { optionImages } : {}),
        answer: normalizeChoice(q.answer)
      };
    }

    if (q.part === 'II') {
      let optionImages = null;
      if (Array.isArray(q.optionImages) && q.optionImages.some(Boolean)) {
        optionImages = [0, 1, 2, 3].map(idx => assertValidDataImage(q.optionImages[idx] || '', `Câu ${i + 1} ý ${'abcd'[idx]}`, 200000));
      }
      if (!Array.isArray(q.options) || q.options.length !== 4 || !Array.isArray(q.answer) || q.answer.length !== 4 || q.answer.some(x => normalizeTF(x) === null)) {
        throw Error(`Câu ${i + 1}: cần 4 nhận định và 4 giá trị đúng/sai.`);
      }
      const normOpts = q.options.map((o, idx) => {
        const clean = typeof o === 'string' ? sanitizeExamQuestionHtml(o).trim() : '';
        return clean || (optionImages?.[idx] ? `Nhận định ${'abcd'[idx]}` : '');
      });
      if (normOpts.some(o => !o || o.length > 2500)) throw Error(`Câu ${i + 1}: nội dung nhận định không hợp lệ.`);
      return {
        ...base,
        options: normOpts,
        ...(optionImages?.some(Boolean) ? { optionImages } : {}),
        answer: [...q.answer]
      };
    }

    if (normalizeShort(q.answer) === null) throw Error(`Câu ${i + 1}: đáp án trả lời ngắn phải là số hợp lệ.`);
    const tolerance = q.tolerance == null ? 0.0001 : Number(q.tolerance);
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1) throw Error(`Câu ${i + 1}: sai số không hợp lệ.`);
    let acceptedAnswers = undefined;
    if (Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length) {
      const nums = q.acceptedAnswers.map(normalizeShort).filter(v => v !== null).slice(0, 6);
      if (nums.length) acceptedAnswers = [...new Set(nums)];
    }
    return {
      ...base,
      answer: normalizeShort(q.answer),
      tolerance,
      ...(acceptedAnswers ? { acceptedAnswers } : {})
    };
  });
  return cleaned;
}

export function publicQuestions(questions) {
  return questions.map(({ answer, tolerance, acceptedAnswers, explanation, explanationImage, ...rest }) => ({ ...rest }));
}

export function reviewQuestions(questions) {
  return questions.map(({ answer, tolerance, acceptedAnswers, ...rest }) => ({ ...rest }));
}

function buildQuestionMaxMicroMap(questions, cfg) {
  const map = new Map();
  for (const part of ['I', 'II', 'III']) {
    const partQs = questions.filter(q => q.part === part);
    const n = partQs.length;
    if (!n) continue;
    const hasExplicitPartTotal = cfg.partTotals && Number.isFinite(cfg.partTotals[part]) && cfg.partTotals[part] > 0;
    if (hasExplicitPartTotal) {
      const totalMicro = Math.round(cfg.partTotals[part] * MICRO_PER_POINT);
      const baseEach = Math.floor(totalMicro / n);
      const rem = totalMicro - baseEach * n;
      partQs.forEach((q, idx) => map.set(q.id, baseEach + (idx < rem ? 1 : 0)));
    } else {
      const pq = Number(cfg.perQuestion?.[part] ?? (part === 'II' ? 1 : 0.25));
      const eachMicro = Math.round(pq * MICRO_PER_POINT);
      partQs.forEach(q => map.set(q.id, eachMicro));
    }
  }
  return map;
}

export function gradeExam(questions, submitted = {}, rawScoringConfig = null) {
  const cfg = normalizeScoringConfig(rawScoringConfig);

  // Legacy path when no scoringConfig is stored: byte-for-byte compatible with historical attempts
  if (!cfg) {
    const details = [];
    let earned = 0; let possible = 0;
    const byPart = {
      I: { count: 0, correct: 0, earned: 0, possible: 0 },
      II: { count: 0, correct: 0, earned: 0, possible: 0 },
      III: { count: 0, correct: 0, earned: 0, possible: 0 }
    };
    for (const q of questions) {
      const raw = submitted && typeof submitted === 'object' ? submitted[q.id] : null;
      const max = q.part === 'I' ? 25 : q.part === 'II' ? 100 : 25;
      let points = 0; let correct = false;
      if (q.part === 'I') { correct = normalizeChoice(raw) === q.answer; points = correct ? max : 0; }
      else if (q.part === 'II') {
        const count = Array.isArray(raw) ? q.answer.reduce((n, answer, idx) => n + (normalizeTF(raw[idx]) === answer ? 1 : 0), 0) : 0;
        points = PART2_WEIGHTS[count]; correct = count === 4;
      } else {
        const val = normalizeShort(raw);
        const pool = Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length ? q.acceptedAnswers : [q.answer];
        correct = val !== null && pool.some(ans => Math.abs(val - ans) <= (q.tolerance ?? 0.0001));
        points = correct ? max : 0;
      }
      earned += points; possible += max;
      if (byPart[q.part]) {
        byPart[q.part].count += 1;
        if (correct) byPart[q.part].correct += 1;
        byPart[q.part].earned += points;
        byPart[q.part].possible += max;
      }
      details.push({ id: q.id, part: q.part, earned: points, possible: max, correct, answer: q.answer, response: raw ?? null, prompt: q.prompt });
    }
    const scale = possible ? 10 / possible : 0;
    const score = possible ? Math.round((earned / possible) * 1000) / 100 : 0;
    const partBreakdown = {};
    for (const part of ['I', 'II', 'III']) {
      const b = byPart[part];
      partBreakdown[part] = {
        count: b.count,
        correct: b.correct,
        earnedPoints: Math.round(b.earned * scale * 100) / 100,
        maxPoints: Math.round(b.possible * scale * 100) / 100
      };
    }
    return {
      score,
      maxScore: 10,
      earnedHundredths: earned,
      possibleHundredths: possible,
      partBreakdown,
      details,
      total: questions.length,
      fullyCorrect: details.filter(d => d.correct).length
    };
  }

  // Flexible per-part scoring (GDPT 2018 / BGD 2025 Part II progressive 10% / 25% / 50% / 100%)
  const maxMicroMap = buildQuestionMaxMicroMap(questions, cfg);
  const details = [];
  let earnedMicro = 0;
  let possibleMicro = 0;
  const byPart = {
    I: { count: 0, correct: 0, earnedMicro: 0, possibleMicro: 0 },
    II: { count: 0, correct: 0, earnedMicro: 0, possibleMicro: 0 },
    III: { count: 0, correct: 0, earnedMicro: 0, possibleMicro: 0 }
  };

  for (const q of questions) {
    const raw = submitted && typeof submitted === 'object' ? submitted[q.id] : null;
    const qMaxMicro = maxMicroMap.get(q.id) ?? 0;
    let qEarnedMicro = 0;
    let correct = false;

    if (q.part === 'I') {
      correct = normalizeChoice(raw) === q.answer;
      qEarnedMicro = correct ? qMaxMicro : 0;
    } else if (q.part === 'II') {
      const count = Array.isArray(raw)
        ? q.answer.reduce((n, answer, idx) => n + (normalizeTF(raw[idx]) === answer ? 1 : 0), 0)
        : 0;
      qEarnedMicro = Math.round(qMaxMicro * PART2_RATIOS_2025[count]);
      correct = count === 4;
    } else {
      const val = normalizeShort(raw);
      const pool = Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length ? q.acceptedAnswers : [q.answer];
      correct = val !== null && pool.some(ans => Math.abs(val - ans) <= (q.tolerance ?? 0.0001));
      qEarnedMicro = correct ? qMaxMicro : 0;
    }

    earnedMicro += qEarnedMicro;
    possibleMicro += qMaxMicro;
    if (byPart[q.part]) {
      byPart[q.part].count += 1;
      if (correct) byPart[q.part].correct += 1;
      byPart[q.part].earnedMicro += qEarnedMicro;
      byPart[q.part].possibleMicro += qMaxMicro;
    }

    // Keep earned/possible in hundredths for seamless UI compatibility (0.25đ -> 25, 0.10đ -> 10, 0.50đ -> 50)
    const earnedHundredthsQ = Math.round(qEarnedMicro / 1000) / 10;
    const possibleHundredthsQ = Math.round(qMaxMicro / 1000) / 10;
    details.push({
      id: q.id,
      part: q.part,
      earned: earnedHundredthsQ,
      possible: possibleHundredthsQ,
      correct,
      answer: q.answer,
      response: raw ?? null,
      prompt: q.prompt
    });
  }

  const normFactor = cfg.normalizeTo10 && possibleMicro > 0 ? (10 * MICRO_PER_POINT) / possibleMicro : 1;
  const finalEarnedMicro = earnedMicro * normFactor;
  const finalPossibleMicro = possibleMicro * normFactor;
  const score = Math.round((finalEarnedMicro / MICRO_PER_POINT) * 100) / 100;
  const maxScore = Math.round((finalPossibleMicro / MICRO_PER_POINT) * 100) / 100;

  const partBreakdown = {};
  for (const part of ['I', 'II', 'III']) {
    const b = byPart[part];
    partBreakdown[part] = {
      count: b.count,
      correct: b.correct,
      earnedPoints: Math.round(((b.earnedMicro * normFactor) / MICRO_PER_POINT) * 100) / 100,
      maxPoints: Math.round(((b.possibleMicro * normFactor) / MICRO_PER_POINT) * 100) / 100
    };
  }

  return {
    score,
    maxScore,
    earnedHundredths: Math.round(finalEarnedMicro / 10_000),
    possibleHundredths: Math.round(finalPossibleMicro / 10_000),
    partBreakdown,
    details,
    total: questions.length,
    fullyCorrect: details.filter(d => d.correct).length
  };
}

/** Keep only question ids present in the public exam when saving answer-sheet flags. */
export function sanitizeFlaggedQuestions(questions, flaggedQuestions) {
  if (!Array.isArray(questions)) throw Error('Không tìm thấy cấu trúc đề thi.');
  if (!Array.isArray(flaggedQuestions)) return [];
  const validIds = new Set(questions.map(q => q?.id).filter(id => typeof id === 'string'));
  return [...new Set(flaggedQuestions.filter(id => typeof id === 'string' && validIds.has(id)))].slice(0, MAX_EXAM_QUESTIONS);
}

export function sanitizeDraftAnswers(questions, answers) {
  if (!Array.isArray(questions)) throw Error('Không tìm thấy cấu trúc đề thi.');
  if (!answers || typeof answers !== 'object' || Array.isArray(answers) || Object.keys(answers).length > MAX_EXAM_QUESTIONS) throw Error('Bản nháp không hợp lệ hoặc vượt quá giới hạn an toàn.');
  const byId = new Map(questions.map(q => [q.id, q]));
  const cleaned = {};
  for (const [id, value] of Object.entries(answers)) {
    const q = byId.get(id);
    if (!q) continue;
    if (q.part === 'I') {
      if (typeof value === 'string' && /^[ABCD]$/i.test(value.trim())) cleaned[id] = value.trim().toUpperCase();
    } else if (q.part === 'II') {
      if (Array.isArray(value) && value.length <= 4 && value.every(item => item === null || typeof item === 'boolean')) {
        cleaned[id] = [0, 1, 2, 3].map(index => value[index] === true ? true : value[index] === false ? false : null);
      }
    } else if (q.part === 'III') {
      if (typeof value === 'string' && value.length <= 200) cleaned[id] = value;
    }
  }
  return cleaned;
}
