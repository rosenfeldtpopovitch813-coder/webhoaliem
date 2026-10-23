import { parseCsv, rowsToLibraryItems } from '../shared/library-csv.js';

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQSOqdBnxsmKXQRqhkygde1R3vJdez_hFxt_9WRI7MEvhjOHD5iL7CkGzNZLYHFLqForH5FcVuZ3SRJ/pub?output=csv';
let cached = null;
let cacheAt = 0;
const CACHE_MS = 5 * 60 * 1000;
const rate = new Map();
function send(res, status, payload) { return res.status(status).json(payload); }
function allow(ip) {
  const now = Date.now(); const prior = rate.get(ip);
  const next = !prior || now - prior.start > 60000 ? { start: now, count: 1 } : { ...prior, count: prior.count + 1 };
  rate.set(ip, next);
  if (rate.size > 1000) for (const [key, value] of rate) if (now - value.start > 120000) rate.delete(key);
  return next.count <= 30;
}
export default async function handler(req, res) {
  const forceRefresh = Boolean(req.query?.refresh);
  res.setHeader('Cache-Control', forceRefresh ? 'no-store' : 's-maxage=300, stale-while-revalidate=600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); }
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 80);
  if (!allow(ip)) return send(res, 429, { error: 'Thư viện được truy vấn quá nhanh. Hãy thử lại sau.' });
  if (!forceRefresh && cached && Date.now() - cacheAt < CACHE_MS) return send(res, 200, { items: cached, cached: true, count: cached.length });
  try {
    const response = await fetch(SHEET_CSV_URL, { headers: { Accept: 'text/csv,text/plain;q=0.9,*/*;q=0.1' }, signal: AbortSignal.timeout(12000), cache: 'no-store' });
    if (!response.ok) return send(res, 502, { error: `Không đọc được Google Sheets (HTTP ${response.status}). Hãy kiểm tra bảng tính đã xuất bản công khai dạng CSV.` });
    const csv = await response.text();
    if (!csv.trim() || csv.length > 5_000_000) return send(res, 502, { error: 'CSV trống hoặc quá lớn (giới hạn 5 MB).' });
    const items = rowsToLibraryItems(parseCsv(csv));
    if (!items.length) return send(res, 502, { error: 'Đã tải CSV nhưng không tìm thấy dòng tài liệu có liên kết. Hãy kiểm tra các cột Tên tài liệu và Link.' });
    cached = items; cacheAt = Date.now();
    return send(res, 200, { items, cached: false, count: items.length, updatedAt: cacheAt });
  } catch (error) {
    console.error('Library CSV fetch failed:', error?.name || 'unknown');
    return send(res, 502, { error: error?.name === 'TimeoutError' ? 'Google Sheets phản hồi quá lâu. Hãy thử tải lại sau.' : 'Không kết nối được Google Sheets. Kiểm tra quyền xuất bản CSV và thử lại.' });
  }
}
