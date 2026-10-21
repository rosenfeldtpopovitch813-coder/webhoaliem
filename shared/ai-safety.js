export const AI_LIMITS = Object.freeze({ windowMs: 10 * 60 * 1000, windowCount: 8, dayCount: 35, questionChars: 8000, imageBytes: 2 * 1024 * 1024 });
export const IMAGE_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

export function validateTutorInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypeError('Dữ liệu gửi lên không hợp lệ.');
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const image = body.image;
  if (!question && !image) throw new TypeError('Hãy nhập câu hỏi hoặc đính kèm một hình ảnh.');
  if (question.length > AI_LIMITS.questionChars) throw new RangeError(`Câu hỏi tối đa ${AI_LIMITS.questionChars} ký tự.`);
  let cleanImage = null;
  if (image !== undefined && image !== null) {
    if (!image || typeof image !== 'object' || !IMAGE_MIME_TYPES.includes(image.mimeType)) throw new TypeError('Ảnh chỉ hỗ trợ JPG, PNG hoặc WebP.');
    if (typeof image.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)) throw new TypeError('Dữ liệu ảnh không hợp lệ.');
    const bytes = Math.floor(image.data.length * 3 / 4) - (image.data.endsWith('==') ? 2 : image.data.endsWith('=') ? 1 : 0);
    if (bytes <= 0 || bytes > AI_LIMITS.imageBytes) throw new RangeError('Ảnh tối đa 2 MB.');
    cleanImage = { mimeType: image.mimeType, data: image.data };
  }
  return { question, image: cleanImage };
}

export function consumeAiRateLimit(state, now = Date.now(), vnDayIndex = Math.floor((now + 7 * 3600000) / 86400000)) {
  const previous = state && typeof state === 'object' ? state : {};
  const windowStart = Number(previous.windowStart) || now;
  const windowCount = now - windowStart >= AI_LIMITS.windowMs || now < windowStart ? 0 : Number(previous.windowCount) || 0;
  const dayCount = Number(previous.vnDayIndex) === vnDayIndex ? Number(previous.dayCount) || 0 : 0;
  if (windowCount >= AI_LIMITS.windowCount) return { allowed: false, reason: 'Bạn đã dùng hết lượt AI trong 10 phút. Hãy thử lại sau.' };
  if (dayCount >= AI_LIMITS.dayCount) return { allowed: false, reason: 'Bạn đã đạt giới hạn AI trong ngày.' };
  return { allowed: true, state: { windowStart: windowCount === 0 ? now : windowStart, windowCount: windowCount + 1, vnDayIndex, dayCount: dayCount + 1, updatedAt: now } };
}
