import { SUBJECTS, COMBINATIONS, calculateCombinations, normalizeScores } from '../shared/admissions-math.js';

const buckets = new Map();
function allowRequest(key, now = Date.now()) {
  const old = buckets.get(key);
  const next = !old || now - old.start >= 60000 ? { start: now, count: 1 } : { ...old, count: old.count + 1 };
  buckets.set(key, next);
  if (buckets.size > 2000) for (const [k, v] of buckets) if (now - v.start > 120000) buckets.delete(k);
  return next.count <= 40;
}
function send(res, status, payload) { return res.status(status).json(payload); }
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); }
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 80);
  if (!allowRequest(ip)) return send(res, 429, { error: 'Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau một phút.' });
  if (req.method === 'GET') return send(res, 200, { subjects: SUBJECTS, combinations: COMBINATIONS, priorityFormula: 'S < 22.5: ưu tiên gốc; S >= 22.5: ((30 - S) / 7.5) × ưu tiên gốc', dataNotice: 'Chỉ chứa danh mục tổ hợp tham khảo, chưa phải cơ sở dữ liệu điểm chuẩn chính thức.' });
  try {
    const body = req.body || {};
    const serialized = JSON.stringify(body);
    if (serialized.length > 12000) return send(res, 413, { error: 'Dữ liệu yêu cầu quá lớn.' });
    const scores = normalizeScores(body.scores || {});
    const priority = body.basePriority === undefined ? 0 : Number(body.basePriority);
    if (!Number.isFinite(priority) || priority < 0 || priority > 3) return send(res, 400, { error: 'Điểm ưu tiên gốc phải từ 0 đến 3.' });
    return send(res, 200, { results: calculateCombinations(scores, priority), dataNotice: 'Gợi ý theo tổ hợp và điểm bạn nhập; không phải dự báo đỗ hay dữ liệu điểm chuẩn chính thức.' });
  } catch (error) {
    return send(res, 400, { error: error.message || 'Dữ liệu không hợp lệ.' });
  }
}
