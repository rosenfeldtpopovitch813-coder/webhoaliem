export const SUBJECTS = Object.freeze([
  { key: 'math', label: 'Toán' },
  { key: 'literature', label: 'Ngữ văn' },
  { key: 'english', label: 'Tiếng Anh' },
  { key: 'physics', label: 'Vật lí' },
  { key: 'chemistry', label: 'Hóa học' },
  { key: 'biology', label: 'Sinh học' },
  { key: 'history', label: 'Lịch sử' },
  { key: 'geography', label: 'Địa lí' },
  { key: 'civics', label: 'GDKT&PL' },
  { key: 'informatics', label: 'Tin học' },
  { key: 'technology', label: 'Công nghệ' }
]);

export const COMBINATIONS = Object.freeze([
  { code: 'A00', name: 'Toán – Vật lí – Hóa học', subjects: ['math', 'physics', 'chemistry'], fields: ['Kỹ thuật', 'Công nghệ', 'Khoa học tự nhiên'] },
  { code: 'A01', name: 'Toán – Vật lí – Tiếng Anh', subjects: ['math', 'physics', 'english'], fields: ['Kỹ thuật', 'Công nghệ', 'Kinh tế'] },
  { code: 'A02', name: 'Toán – Vật lí – Sinh học', subjects: ['math', 'physics', 'biology'], fields: ['Khoa học tự nhiên', 'Môi trường'] },
  { code: 'B00', name: 'Toán – Hóa học – Sinh học', subjects: ['math', 'chemistry', 'biology'], fields: ['Khoa học sự sống', 'Sức khỏe'] },
  { code: 'C00', name: 'Ngữ văn – Lịch sử – Địa lí', subjects: ['literature', 'history', 'geography'], fields: ['Xã hội và nhân văn', 'Giáo dục'] },
  { code: 'C01', name: 'Ngữ văn – Toán – Vật lí', subjects: ['literature', 'math', 'physics'], fields: ['Giáo dục', 'Kỹ thuật'] },
  { code: 'C02', name: 'Ngữ văn – Toán – Hóa học', subjects: ['literature', 'math', 'chemistry'], fields: ['Giáo dục', 'Khoa học'] },
  { code: 'D01', name: 'Toán – Ngữ văn – Tiếng Anh', subjects: ['math', 'literature', 'english'], fields: ['Ngôn ngữ', 'Kinh tế', 'Xã hội'] },
  { code: 'D07', name: 'Toán – Hóa học – Tiếng Anh', subjects: ['math', 'chemistry', 'english'], fields: ['Khoa học', 'Kỹ thuật', 'Kinh tế'] },
  { code: 'D08', name: 'Toán – Sinh học – Tiếng Anh', subjects: ['math', 'biology', 'english'], fields: ['Khoa học sự sống', 'Môi trường'] },
  { code: 'D14', name: 'Ngữ văn – Lịch sử – Tiếng Anh', subjects: ['literature', 'history', 'english'], fields: ['Ngôn ngữ', 'Xã hội và nhân văn'] },
  { code: 'D15', name: 'Ngữ văn – Địa lí – Tiếng Anh', subjects: ['literature', 'geography', 'english'], fields: ['Du lịch', 'Ngôn ngữ', 'Xã hội'] }
]);

export function normalizeScore(value) {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const raw = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  if (raw === '') return null;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10 ? Math.round(parsed * 100) / 100 : null;
}

export function normalizeScores(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Danh sách điểm không hợp lệ.');
  const allowed = new Set(SUBJECTS.map((subject) => subject.key));
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new TypeError(`Môn học không hợp lệ: ${key}`);
  const output = {};
  for (const subject of SUBJECTS) {
    const value = Object.hasOwn(input, subject.key) ? input[subject.key] : null;
    if (value === '' || value === null || value === undefined) continue;
    const score = normalizeScore(value);
    if (score === null) throw new TypeError(`Điểm ${subject.label} phải nằm trong khoảng 0–10.`);
    output[subject.key] = score;
  }
  return output;
}

export function createSubjectBitmask(scoreMap = {}) {
  let mask = 0;
  SUBJECTS.forEach((subject, index) => {
    if (normalizeScore(scoreMap[subject.key]) !== null) mask |= (1 << index);
  });
  return mask;
}

export function combinationMask(combination) {
  let mask = 0;
  for (const key of combination.subjects) {
    const index = SUBJECTS.findIndex((subject) => subject.key === key);
    if (index < 0) throw new TypeError(`Môn không hợp lệ: ${key}`);
    mask |= (1 << index);
  }
  return mask;
}

export function calculatePriority(basePriority, combinationScore) {
  const base = Number(basePriority);
  const score = Number(combinationScore);
  if (!Number.isFinite(base) || base < 0 || base > 3) throw new TypeError('Điểm ưu tiên gốc phải từ 0 đến 3.');
  if (!Number.isFinite(score) || score < 0 || score > 30) throw new TypeError('Tổng điểm tổ hợp phải từ 0 đến 30.');
  const actual = score < 22.5 ? base : ((30 - score) / 7.5) * base;
  return Math.round((Math.max(0, actual) + Number.EPSILON) * 100) / 100;
}

export function calculateCombinations(rawScores, basePriority = 0) {
  const scores = normalizeScores(rawScores);
  const availableMask = createSubjectBitmask(scores);
  const results = [];
  for (const combo of COMBINATIONS) {
    const mask = combinationMask(combo);
    if ((availableMask & mask) !== mask) continue;
    const score = Math.round(combo.subjects.reduce((total, key) => total + scores[key], 0) * 100) / 100;
    const priority = calculatePriority(basePriority, score);
    results.push({ code: combo.code, name: combo.name, fields: [...combo.fields], score, priority, total: Math.round((score + priority + Number.EPSILON) * 100) / 100 });
  }
  return results.sort((a, b) => b.total - a.total || b.score - a.score || a.code.localeCompare(b.code));
}
