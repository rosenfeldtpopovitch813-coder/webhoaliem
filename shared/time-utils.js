const VN_OFFSET_MS = 7 * 3600 * 1000; // UTC+7
const DAY_MS = 86400 * 1000;

/**
 * Chuyển đổi bất kỳ timestamp (ms) nào sang Chỉ số Ngày chuẩn Việt Nam (UTC+7).
 * Giúp tính Streak chính xác tuyệt đối lúc giao thừa / nửa đêm.
 */
export function getVNDayIndex(unixMs = Date.now()) {
  return Math.floor((unixMs + VN_OFFSET_MS) / DAY_MS);
}

/**
 * Định dạng chuỗi ngày YYYY-MM-DD theo đúng múi giờ Việt Nam
 */
export function getVNDateString(unixMs = Date.now()) {
  const vnTime = new Date(unixMs + VN_OFFSET_MS);
  return vnTime.toISOString().split('T')[0];
}

/**
 * Gộp các khoảng thời gian học bị chồng lấn (Chống mở nhiều tab cày giờ ảo)
 * @param {Array<[number, number]>} intervals - Mảng các cặp [startTime, endTime]
 * @returns {Array<[number, number]>} - Mảng đã gộp sạch chồng lấn
 */
export function mergeStudyIntervals(intervals) {
  if (!Array.isArray(intervals) || intervals.length === 0) return [];
  
  // Lọc bỏ khoảng không hợp lệ và sắp xếp tăng dần theo startTime
  const valid = intervals
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .sort((a, b) => a[0] - b[0]);

  if (valid.length === 0) return [];

  const merged = [valid[0].slice()];
  for (let i = 1; i < valid.length; i++) {
    const prev = merged[merged.length - 1];
    const [currStart, currEnd] = valid[i];

    if (currStart <= prev[1]) {
      // Có chồng lấn -> nối dài khoảng hiện tại
      prev[1] = Math.max(prev[1], currEnd);
    } else {
      merged.push([currStart, currEnd]);
    }
  }
  return merged;
}
