// Client-side PDF exam importer (text + baseline sub/sup recovery + CTM diagram cropping + scanned PDF detection).
// Reuses parseExamLines() and compressImageDataUrl() from docx-parser.js so .docx and .pdf share one parser contract.

import { parseExamLines, compressImageDataUrl } from './docx-parser.js';

let cachedPdfjsPromise = null;

async function loadPdfJs() {
  if (cachedPdfjsPromise) return cachedPdfjsPromise;
  cachedPdfjsPromise = (async () => {
    const pdfjs = await import('pdfjs-dist');
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    } catch {
      // Fallback cleanly if worker URL resolution is unavailable in Node test environment
    }
    return pdfjs;
  })().catch((err) => {
    cachedPdfjsPromise = null;
    throw new Error(`Không tải được bộ đọc PDF nội bộ: ${err?.message || err}`);
  });
  return cachedPdfjsPromise;
}

/**
 * Reconstruct logical lines from pdf.js textContent.items:
 * - Groups items on the same horizontal baseline
 * - Recovers subscripts & superscripts from vertical baseline offset + smaller font height (e.g. H2SO4, Fe3+)
 * - Preserves horizontal gaps as spaces or tabs (so inline A. ... B. ... options split cleanly)
 */
export function reconstructPdfPageLines(items) {
  const glyphs = (items || [])
    .filter((it) => typeof it.str === 'string' && it.str.length > 0 && Array.isArray(it.transform))
    .map((it) => {
      const [, , , sy, x, y] = it.transform;
      const h = Math.abs(it.height || sy || 11);
      const w = Math.abs(it.width || it.str.length * h * 0.45);
      return { str: it.str, x, y, h, w };
    });

  if (!glyphs.length) return [];

  // Sort top-to-bottom (PDF Y grows upwards -> descending Y), then left-to-right
  glyphs.sort((a, b) => (Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x));

  // Cluster into lines using baseline tolerance (allow slightly shifted sub/sup glyphs to join parent line)
  const rawLines = [];
  for (const g of glyphs) {
    let matched = null;
    let bestDy = Infinity;
    for (let i = rawLines.length - 1; i >= Math.max(0, rawLines.length - 6); i--) {
      const line = rawLines[i];
      const tol = Math.max(4.5, line.baseH * 0.58);
      const dy = Math.abs(g.y - line.baseY);
      if (dy <= tol && dy < bestDy) {
        bestDy = dy;
        matched = line;
      }
    }
    if (matched) {
      matched.items.push(g);
      // Keep dominant (largest font) baseline as reference so sub/sup don't drift the baseline
      if (g.h > matched.baseH * 1.05 && g.str.trim().length > 1) {
        matched.baseH = g.h;
        matched.baseY = g.y;
      }
    } else {
      rawLines.push({ baseY: g.y, baseH: g.h, items: [g] });
    }
  }

  rawLines.sort((a, b) => b.baseY - a.baseY);

  return rawLines.map((line) => {
    line.items.sort((a, b) => a.x - b.x);
    let text = '';
    let prevEnd = null;
    const baseH = line.baseH || 11;

    for (const g of line.items) {
      if (prevEnd !== null) {
        const gap = g.x - prevEnd;
        if (gap > baseH * 1.8) text += '\t';
        else if (gap > baseH * 0.22 && !text.endsWith(' ') && !g.str.startsWith(' ')) text += ' ';
      }

      const trimmed = g.str.trim();
      const dy = g.y - line.baseY; // negative = below baseline (subscript), positive = above (superscript)
      const isSmaller = g.h < baseH * 0.85;
      let piece = g.str;

      if (trimmed && trimmed.length <= 12 && isSmaller && Math.abs(dy) >= baseH * 0.16) {
        if (dy < 0 && /^[0-9a-zA-Z,+−-]+$/.test(trimmed)) {
          piece = `<sub>${trimmed}</sub>`;
        } else if (dy > 0 && /^[0-9a-zA-Z,+−°-]+$/.test(trimmed)) {
          piece = `<sup>${trimmed}</sup>`;
        }
      }

      text += piece;
      prevEnd = g.x + g.w;
    }

    const clean = text.replace(/\u00a0/g, ' ').replace(/[ ]{2,}/g, '  ').trim();
    return {
      text: clean,
      runs: [{ text: clean, rawText: clean, style: {} }],
      images: [],
      pdfY: line.baseY
    };
  }).filter((l) => l.text.length > 0);
}

function multiplyMatrix(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

function applyPoint(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * Extract embedded image bounding boxes in PDF user space by walking pdf.js operatorList CTM stack.
 * Merges horizontally/vertically adjacent image strips into one clean diagram rectangle.
 */
export function extractImageBoxesFromOpList(opList, OPS, pageWidth, pageHeight) {
  const fnArray = opList?.fnArray || [];
  const argsArray = opList?.argsArray || [];
  const stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const rawBoxes = [];

  const IMAGE_OPS = new Set(
    [
      OPS.paintImageXObject,
      OPS.paintInlineImageXObject,
      OPS.paintImageMaskXObject,
      OPS.paintJpegXObject,
      OPS.paintImageXObjectRepeat
    ].filter((v) => v !== undefined)
  );

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i];

    if (fn === OPS.save) {
      stack.push([...ctm]);
    } else if (fn === OPS.restore) {
      if (stack.length) ctm = stack.pop();
    } else if (fn === OPS.transform && Array.isArray(args) && args.length >= 6) {
      ctm = multiplyMatrix(ctm, args);
    } else if (IMAGE_OPS.has(fn)) {
      const pts = [
        applyPoint(ctm, 0, 0),
        applyPoint(ctm, 1, 0),
        applyPoint(ctm, 0, 1),
        applyPoint(ctm, 1, 1)
      ];
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const minX = Math.max(0, Math.min(...xs));
      const maxX = Math.min(pageWidth, Math.max(...xs));
      const minY = Math.max(0, Math.min(...ys));
      const maxY = Math.min(pageHeight, Math.max(...ys));
      const w = maxX - minX;
      const h = maxY - minY;

      // Ignore tiny bullets/icons (< 36x24 pt) and full-page background/watermarks
      if (w < 36 || h < 24) continue;
      if (w > pageWidth * 0.93 && h > pageHeight * 0.85) continue;
      rawBoxes.push({ minX, minY, maxX, maxY });
    }
  }

  // Merge adjacent/overlapping image tiles (Word -> PDF often slices one diagram into strips)
  const merged = [];
  for (const box of rawBoxes) {
    let absorbed = false;
    for (const m of merged) {
      const pad = 8;
      const overlapsX = box.minX <= m.maxX + pad && box.maxX >= m.minX - pad;
      const overlapsY = box.minY <= m.maxY + pad && box.maxY >= m.minY - pad;
      if (overlapsX && overlapsY) {
        m.minX = Math.min(m.minX, box.minX);
        m.minY = Math.min(m.minY, box.minY);
        m.maxX = Math.max(m.maxX, box.maxX);
        m.maxY = Math.max(m.maxY, box.maxY);
        absorbed = true;
        break;
      }
    }
    if (!absorbed) merged.push({ ...box });
  }

  // Sort top-to-bottom (higher maxY is higher up on the PDF page)
  merged.sort((a, b) => b.maxY - a.maxY);
  return merged;
}

/**
 * Attach extracted PDF images to the closest preceding text line on the same page by PDF Y-coordinate.
 */
export function attachPdfImagesToLines(pageLines, positionedImages) {
  if (!positionedImages.length) return pageLines;
  const result = pageLines.map((l) => ({ ...l, images: [...(l.images || [])] }));

  for (const img of positionedImages) {
    // Find the last line whose baseline is at or above the top of the image (within a small overlap tolerance)
    let targetIdx = -1;
    for (let i = 0; i < result.length; i++) {
      if (result[i].pdfY >= img.topY - 18) {
        targetIdx = i;
      }
    }
    if (targetIdx >= 0) {
      result[targetIdx].images.push(img.dataUrl);
    } else if (result.length > 0) {
      result[0].images.push(img.dataUrl);
    } else {
      result.push({ text: '', runs: [], images: [img.dataUrl], pdfY: img.topY });
    }
  }
  return result;
}

/**
 * Parse a real PDF File/ArrayBuffer in the browser:
 * - Extracts structured lines + baseline sub/sup from every page
 * - Crops embedded diagrams/figures via CTM boxes and attaches them to their owning question
 * - Detects scanned (image-only) PDFs cleanly and returns rendered page previews
 */
export async function parsePdfExam(arrayBuffer, fileName = 'de-thi.pdf', { maxPages = 25 } = {}) {
  const pdfjs = await loadPdfJs();
  const data = arrayBuffer instanceof Uint8Array ? new Uint8Array(arrayBuffer) : new Uint8Array(arrayBuffer);
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
  const pdfDoc = await loadingTask.promise;

  const pageCount = Math.min(pdfDoc.numPages, maxPages);
  const allLines = [];
  const scannedPages = [];
  let totalTextChars = 0;
  let extractedMediaCount = 0;

  for (let pNum = 1; pNum <= pageCount; pNum++) {
    const page = await pdfDoc.getPage(pNum);
    const baseViewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    const pageLines = reconstructPdfPageLines(textContent.items);
    const pageChars = pageLines.reduce((sum, l) => sum + l.text.length, 0);
    totalTextChars += pageChars;

    // Inspect operator list for embedded images/diagrams
    let boxes = [];
    try {
      const opList = await page.getOperatorList();
      boxes = extractImageBoxesFromOpList(opList, pdfjs.OPS, baseViewport.width, baseViewport.height);
    } catch {
      boxes = [];
    }

    const needsCanvas = boxes.length > 0 || pageChars < 40;
    if (needsCanvas && typeof document !== 'undefined') {
      const renderScale = 1.65;
      const viewport = page.getViewport({ scale: renderScale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        if (pageChars < 40 && scannedPages.length < 6) {
          const previewUrl = await compressImageDataUrl(canvas.toDataURL('image/jpeg', 0.78), {
            maxChars: 240000,
            maxWidth: 960
          });
          if (previewUrl) scannedPages.push({ pageNum: pNum, dataUrl: previewUrl });
        }

        if (boxes.length > 0) {
          const positioned = [];
          for (const box of boxes) {
            const rect = viewport.convertToViewportRectangle([box.minX, box.minY, box.maxX, box.maxY]);
            const x1 = Math.max(0, Math.floor(Math.min(rect[0], rect[2])) - 4);
            const y1 = Math.max(0, Math.floor(Math.min(rect[1], rect[3])) - 4);
            const x2 = Math.min(canvas.width, Math.ceil(Math.max(rect[0], rect[2])) + 4);
            const y2 = Math.min(canvas.height, Math.ceil(Math.max(rect[1], rect[3])) + 4);
            const cw = x2 - x1;
            const ch = y2 - y1;
            if (cw < 40 || ch < 30) continue;

            const crop = document.createElement('canvas');
            crop.width = cw;
            crop.height = ch;
            const cctx = crop.getContext('2d');
            if (!cctx) continue;
            cctx.drawImage(canvas, x1, y1, cw, ch, 0, 0, cw, ch);
            const compressed = await compressImageDataUrl(crop.toDataURL('image/png'));
            if (compressed) {
              positioned.push({ topY: box.maxY, dataUrl: compressed });
              extractedMediaCount += 1;
            }
          }
          allLines.push(...attachPdfImagesToLines(pageLines, positioned));
        } else {
          allLines.push(...pageLines);
        }
      } else {
        allLines.push(...pageLines);
      }
    } else {
      allLines.push(...pageLines);
    }
  }

  const isScannedPdf = pageCount > 0 && totalTextChars < Math.max(40, pageCount * 25);
  const cleanName = fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
  const parsed = parseExamLines(allLines, { title: cleanName || 'Đề thi nhập từ PDF' });

  const notices = [];
  if (pdfDoc.numPages > maxPages) {
    notices.push(`PDF có ${pdfDoc.numPages} trang; module hiện đọc tối đa ${maxPages} trang đầu để bảo vệ bộ nhớ trình duyệt.`);
  }
  if (isScannedPdf) {
    notices.push(
      'PDF này là bản ảnh scan không có lớp văn bản (text layer) nên trình duyệt không tách chữ trực tiếp được. Xem ảnh các trang bên dưới hoặc dùng file Word (.docx) / PDF xuất từ Word để nhận diện tự động.'
    );
  } else if (parsed.questions.length > 0 && parsed.stats.warningCount > 0) {
    notices.push(
      'File PDF không lưu sẵn thuộc tính gạch chân/màu đáp án như file Word (.docx), nên các câu chưa có bảng đáp án sau "HẾT" cần bạn bấm chọn nhanh đáp án ở cột rà soát.'
    );
  }

  return {
    ...parsed,
    sourceKind: 'pdf',
    sourceFileName: fileName,
    pageCount: pdfDoc.numPages,
    isScannedPdf,
    scannedPages,
    extractedMediaCount,
    notices
  };
}
