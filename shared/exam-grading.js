export const PART2_WEIGHTS = Object.freeze([0, 10, 25, 50, 100]);
export function normalizeShort(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = Number(s); return Number.isFinite(n) ? n : null;
}
export function normalizeChoice(value) { return typeof value === 'string' && /^[ABCD]$/i.test(value.trim()) ? value.trim().toUpperCase() : null; }
export function normalizeTF(value) { return value === true || value === false ? value : null; }
export function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 60) throw Error('Đề phải có từ 1 đến 60 câu.');
  let counts = { I: 0, II: 0, III: 0 };
  const cleaned = questions.map((q, i) => {
    if (!q || !['I','II','III'].includes(q.part) || typeof q.prompt !== 'string' || !q.prompt.trim() || q.prompt.length > 5000) throw Error(`Câu ${i+1}: nội dung hoặc phần không hợp lệ.`);
    const base = { id: `q${i+1}`, part: q.part, prompt: q.prompt.trim() }; counts[q.part]++;
    if (q.part === 'I') {
      if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(o=>typeof o !== 'string' || !o.trim() || o.length > 1200) || !normalizeChoice(q.answer)) throw Error(`Câu ${i+1}: cần 4 lựa chọn và đáp án A/B/C/D.`);
      return { ...base, options: q.options.map(x=>x.trim()), answer: normalizeChoice(q.answer) };
    }
    if (q.part === 'II') {
      if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(o=>typeof o !== 'string' || !o.trim() || o.length > 1200) || !Array.isArray(q.answer) || q.answer.length !== 4 || q.answer.some(x=>normalizeTF(x) === null)) throw Error(`Câu ${i+1}: cần 4 nhận định và 4 giá trị đúng/sai.`);
      return { ...base, options: q.options.map(x=>x.trim()), answer: [...q.answer] };
    }
    if (normalizeShort(q.answer) === null) throw Error(`Câu ${i+1}: đáp án trả lời ngắn phải là số hợp lệ.`);
    const tolerance = q.tolerance == null ? 0.0001 : Number(q.tolerance);
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1) throw Error(`Câu ${i+1}: sai số không hợp lệ.`);
    return { ...base, answer: normalizeShort(q.answer), tolerance };
  });
  return cleaned;
}
export function publicQuestions(questions) { return questions.map(({answer, tolerance, ...rest}) => ({...rest})); }
export function gradeExam(questions, submitted = {}) {
  const details = [];
  let earned = 0; let possible = 0;
  for (const q of questions) {
    const raw = submitted && typeof submitted === 'object' ? submitted[q.id] : null;
    const max = q.part === 'I' ? 25 : q.part === 'II' ? 100 : 25;
    let points = 0; let correct = false;
    if (q.part === 'I') { correct = normalizeChoice(raw) === q.answer; points = correct ? max : 0; }
    else if (q.part === 'II') {
      const count = Array.isArray(raw) ? q.answer.reduce((n, answer, idx) => n + (normalizeTF(raw[idx]) === answer ? 1 : 0), 0) : 0;
      points = PART2_WEIGHTS[count]; correct = count === 4;
    } else { const val = normalizeShort(raw); correct = val !== null && Math.abs(val-q.answer) <= (q.tolerance ?? .0001); points = correct ? max : 0; }
    earned += points; possible += max;
    details.push({ id:q.id, part:q.part, earned: points, possible:max, correct, answer:q.answer, response:raw ?? null, prompt:q.prompt });
  }
  // Preserve integer hundredths internally; normalize to the ten-point scale for arbitrary tests.
  const score = possible ? Math.round((earned / possible) * 1000) / 100 : 0;
  return { score, earnedHundredths:earned, possibleHundredths:possible, details, total:questions.length, fullyCorrect:details.filter(d=>d.correct).length };
}
