/**
 * Pure client-side image normalizer & compressor for exam figures and PDF slices.
 * Converts PNG / JPEG / WebP / BMP / GIF / SVG (from WMF/EMF converter) into compact
 * server-accepted JPEG or WebP Data URLs (<= 275 KB) with white background for transparent math/diagrams.
 */

const VALID_RASTER_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i;

export async function compressDataUrlForExam(
  dataUrl: string,
  maxChars = 275000,
  maxDim = 1360
): Promise<string> {
  if (!dataUrl) return '';
  if (typeof document === 'undefined') {
    return VALID_RASTER_RE.test(dataUrl) && dataUrl.length <= maxChars ? dataUrl : '';
  }
  if (VALID_RASTER_RE.test(dataUrl) && dataUrl.length <= Math.min(95000, maxChars)) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const natW = Math.max(1, img.naturalWidth || img.width || 320);
      const natH = Math.max(1, img.naturalHeight || img.height || 160);
      for (const dimCap of [maxDim, 1080, 840]) {
        const scale = Math.min(1, dimCap / Math.max(natW, natH));
        const w = Math.max(1, Math.round(natW * scale));
        const h = Math.max(1, Math.round(natH * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        for (const quality of [0.82, 0.7, 0.58, 0.45]) {
          const webp = canvas.toDataURL('image/webp', quality);
          if (VALID_RASTER_RE.test(webp) && webp.length <= maxChars) {
            canvas.width = 0;
            canvas.height = 0;
            resolve(webp);
            return;
          }
          const jpeg = canvas.toDataURL('image/jpeg', quality);
          if (VALID_RASTER_RE.test(jpeg) && jpeg.length <= maxChars) {
            canvas.width = 0;
            canvas.height = 0;
            resolve(jpeg);
            return;
          }
        }
        canvas.width = 0;
        canvas.height = 0;
      }
      resolve(VALID_RASTER_RE.test(dataUrl) && dataUrl.length <= 298000 ? dataUrl : '');
    };
    img.onerror = () => {
      resolve(VALID_RASTER_RE.test(dataUrl) && dataUrl.length <= 298000 ? dataUrl : '');
    };
    img.src = dataUrl;
  });
}

export async function compressImageFileForExam(file: File, maxChars = 275000): Promise<string> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Hãy chọn một tệp hình ảnh hợp lệ.');
  }
  if (file.size > 14 * 1024 * 1024) {
    throw new Error('Ảnh gốc tối đa 14 MB.');
  }
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không đọc được tệp ảnh.'));
    reader.readAsDataURL(file);
  });
  const compressed = await compressDataUrlForExam(rawDataUrl, maxChars, 1360);
  if (!compressed) {
    throw new Error('Ảnh quá lớn sau khi nén. Hãy cắt gọn vùng hình rồi thử lại.');
  }
  return compressed;
}
