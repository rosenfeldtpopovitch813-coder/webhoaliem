import type * as PdfJsTypes from 'pdfjs-dist';
import type {
  ExamOption,
  ExamQuestion,
  NormalizedParagraph,
  ParseResult,
  PdfPagePreview,
  QuestionType,
} from './types';
import {
  computeParseStats,
  distributeExamPoints,
  parseNormalizedParagraphsToExam,
  validateQuestion,
} from './examFsm';
import { compressDataUrlForExam } from './imageCompression';

let pdfjsPromise: Promise<typeof PdfJsTypes> | null = null;
async function loadPdfJs(): Promise<typeof PdfJsTypes> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      return mod;
    });
  }
  return pdfjsPromise;
}

interface PdfToken {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  centerY: number;
}

interface PositionedLine {
  pageNumber: number;
  text: string;
  tokens: PdfToken[];
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'text' | 'image';
  imageUrl?: string;
}

const PART_RE = /^(?:PHẦN|Phần|PHAN|Phan|PART|Part)\s+([IVX\d]+|[A-Z])[\s.:–-]*(.*)$/;
const Q_START_RE = /^(?:Câu|CÂU|Cau|CAU|Question|QUESTION|Bài|BÀI|Bai|BAI)\s*(\d+)\s*(?:\(([^)]{1,30})\))?\s*[:.)\-]?\s*(.*)$/i;
const TF_OPT_RE = /^(\*?)\s*([a-h])\s*\)\s*(.*)$/;
const MC_OPT_RE = /^(\*?)\s*([A-H])\s*[.)]\s*(.*)$/;
const BLANK_ANS_LINE_RE = /^(?:Đáp\s+án|Đáp\s+số|Trả\s+lời)\s*[:.]?\s*[._…\s-]*$/i;
const PAGE_NOISE_RE = /^(?:Mã\s+đề\s+\d+\s*[·•|/-]\s*Trang\s+\d+\s*\/\s*\d+|Trang\s+\d+\s*\/\s*\d+|Thí\s+sinh\s+trả\s+lời\s+từ\s+câu\s+\d+|Trong\s+mỗi\s+ý\s+a\)\s*,\s*b\)|Thí\s+sinh\s+trả\s+lời\s+các\s+câu\s+hỏi\s+bên\s+dưới|[-–—=_*\s]*CHÚC\s+CÁC\s+(?:BẠN|EM)\s+LÀM\s+BÀI)/i;

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function multiplyMatrix(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyPoint(m: number[], x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

async function detectEmbeddedImageRects(
  page: PdfJsTypes.PDFPageProxy,
  baseViewport: PdfJsTypes.PageViewport,
  OPS: typeof PdfJsTypes.OPS
): Promise<Array<{ x: number; y: number; w: number; h: number }>> {
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  try {
    const opList = await page.getOperatorList();
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (fn === OPS.save) {
        stack.push([...ctm]);
      } else if (fn === OPS.restore) {
        ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
      } else if (fn === OPS.paintFormXObjectBegin) {
        stack.push([...ctm]);
        if (Array.isArray(args?.[0]) && args[0].length >= 6) {
          ctm = multiplyMatrix(ctm, args[0] as number[]);
        }
      } else if (fn === OPS.paintFormXObjectEnd) {
        ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
      } else if (fn === OPS.transform && Array.isArray(args) && args.length >= 6) {
        ctm = multiplyMatrix(ctm, args as number[]);
      } else if (
        fn === OPS.paintImageXObject ||
        fn === OPS.paintInlineImageXObject ||
        fn === OPS.paintImageMaskXObject ||
        fn === OPS.paintImageXObjectRepeat
      ) {
        const totalM = multiplyMatrix(baseViewport.transform as number[], ctm);
        const corners = [
          applyPoint(totalM, 0, 0),
          applyPoint(totalM, 1, 0),
          applyPoint(totalM, 1, 1),
          applyPoint(totalM, 0, 1),
        ];
        const xs = corners.map((c) => c[0] / baseViewport.width);
        const ys = corners.map((c) => c[1] / baseViewport.height);
        const minX = Math.max(0, Math.min(...xs));
        const maxX = Math.min(1, Math.max(...xs));
        const minY = Math.max(0, Math.min(...ys));
        const maxY = Math.min(1, Math.max(...ys));
        const w = maxX - minX;
        const h = maxY - minY;

        if (w >= 0.045 && h >= 0.025 && !(w > 0.94 && h > 0.88)) {
          const dup = rects.some(
            (r) =>
              Math.abs(r.x - minX) < 0.02 &&
              Math.abs(r.y - minY) < 0.02 &&
              Math.abs(r.w - w) < 0.02 &&
              Math.abs(r.h - h) < 0.02
          );
          if (!dup) {
            rects.push({ x: minX, y: minY, w, h });
          }
        }
      }
    }
  } catch {
    // Ignore operator-list issues on malformed PDF streams
  }
  return rects;
}

function detectVectorDiagramRects(
  canvas: HTMLCanvasElement,
  textLines: PositionedLine[],
  existingImgRects: Array<{ x: number; y: number; w: number; h: number }>
): Array<{ x: number; y: number; w: number; h: number }> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width < 100 || canvas.height < 100) return [];

  const sorted = [...textLines]
    .filter((l) => l.kind === 'text')
    .sort((a, b) => a.y - b.y);
  if (sorted.length < 2) return [];

  const bands: Array<{ y1: number; y2: number }> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapTop = sorted[i].y + sorted[i].h + 0.005;
    const gapBot = sorted[i + 1].y - 0.005;
    if (gapTop < 0.07 || gapBot > 0.93) continue;
    if (gapBot - gapTop >= 0.075) {
      bands.push({ y1: gapTop, y2: gapBot });
    }
  }

  const results: Array<{ x: number; y: number; w: number; h: number }> = [];
  const W = canvas.width;
  const H = canvas.height;

  for (const band of bands) {
    const overlapsExisting = existingImgRects.some(
      (r) => r.y < band.y2 && r.y + r.h > band.y1
    );
    if (overlapsExisting) continue;

    const sx = Math.floor(W * 0.05);
    const ex = Math.floor(W * 0.95);
    const sy = Math.max(0, Math.floor(H * band.y1));
    const ey = Math.min(H, Math.floor(H * band.y2));
    const bw = ex - sx;
    const bh = ey - sy;
    if (bw < 40 || bh < 30) continue;

    const imgData = ctx.getImageData(sx, sy, bw, bh).data;
    let minIx = bw;
    let maxIx = -1;
    let minIy = bh;
    let maxIy = -1;
    let inkPixels = 0;
    const step = 2;

    for (let py = 0; py < bh; py += step) {
      for (let px = 0; px < bw; px += step) {
        const idx = (py * bw + px) * 4;
        if (imgData[idx] < 238 || imgData[idx + 1] < 238 || imgData[idx + 2] < 238) {
          inkPixels++;
          if (px < minIx) minIx = px;
          if (px > maxIx) maxIx = px;
          if (py < minIy) minIy = py;
          if (py > maxIy) maxIy = py;
        }
      }
    }

    const sampledTotal = Math.ceil(bw / step) * Math.ceil(bh / step);
    const inkRatio = inkPixels / Math.max(1, sampledTotal);
    if (maxIx > minIx && maxIy > minIy && inkRatio >= 0.004 && inkRatio <= 0.85) {
      const rx = (sx + minIx) / W;
      const ry = (sy + minIy) / H;
      const rw = (maxIx - minIx) / W;
      const rh = (maxIy - minIy) / H;
      if (rw >= 0.08 && rh >= 0.055) {
        results.push({ x: rx, y: ry, w: rw, h: rh });
      }
    }
  }

  return results;
}

export async function cropRegionDataUrl(
  pageImageDataUrl: string,
  rect: { x: number; y: number; w: number; h: number },
  maxChars = 240000
): Promise<string> {
  const raw = await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const sx = Math.max(0, Math.floor(rect.x * img.width));
      const sy = Math.max(0, Math.floor(rect.y * img.height));
      const sw = Math.max(12, Math.min(img.width - sx, Math.ceil(rect.w * img.width)));
      const sh = Math.max(12, Math.min(img.height - sy, Math.ceil(rect.h * img.height)));
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sw, sh);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      }
      const out = canvas.toDataURL('image/jpeg', 0.82);
      canvas.width = 0;
      canvas.height = 0;
      resolve(out);
    };
    img.onerror = () => resolve('');
    img.src = pageImageDataUrl;
  });
  return raw ? compressDataUrlForExam(raw, maxChars, 1320) : '';
}

async function stitchImagesVertically(dataUrls: string[]): Promise<string> {
  const valid = dataUrls.filter(Boolean);
  if (valid.length === 0) return '';
  if (valid.length === 1) return valid[0];

  const imgs = await Promise.all(
    valid.map(
      (src) =>
        new Promise<HTMLImageElement | null>((resolve) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = () => resolve(null);
          im.src = src;
        })
    )
  );
  const loaded = imgs.filter((im): im is HTMLImageElement => Boolean(im));
  if (loaded.length === 0) return '';
  if (loaded.length === 1) return valid[0];

  const width = Math.max(...loaded.map((i) => i.width));
  const totalHeight = loaded.reduce((s, i) => s + i.height, 0);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, totalHeight);
    let yOff = 0;
    for (const im of loaded) {
      ctx.drawImage(im, 0, yOff);
      yOff += im.height;
    }
  }
  const out = canvas.toDataURL('image/jpeg', 0.8);
  canvas.width = 0;
  canvas.height = 0;
  return compressDataUrlForExam(out, 260000, 1320);
}

async function extractLinesAndRenderPages(
  file: File,
  renderScale = 1.65,
  extractInlineImages = false
): Promise<{ lines: PositionedLine[]; pages: PdfPagePreview[]; extractedImagesCount: number }> {
  const pdfjsLib = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const rawLines: PositionedLine[] = [];
  const pages: PdfPagePreview[] = [];
  let extractedImagesCount = 0;

  for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
    const page = await pdf.getPage(pNum);
    const viewport = page.getViewport({ scale: renderScale });
    const baseViewport = page.getViewport({ scale: 1 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport }).promise;
    }
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    pages.push({
      pageNumber: pNum,
      width: canvas.width,
      height: canvas.height,
      imageDataUrl,
      boxes: [],
    });

    const pageItems: PositionedLine[] = [];
    const textContent = await page.getTextContent();
    const tokens: PdfToken[] = [];

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const tx = item.transform;
      const x = tx[4] / baseViewport.width;
      const fontH = Math.max(7, Math.hypot(tx[2], tx[3])) / baseViewport.height;
      const yTop = Math.max(0, 1 - tx[5] / baseViewport.height - fontH);
      const w = Math.max(0.003, (item.width || 6) / baseViewport.width);
      tokens.push({
        str: item.str,
        x,
        y: yTop,
        w,
        h: fontH,
        centerY: yTop + fontH * 0.5,
      });
    }

    tokens.sort((a, b) => a.centerY - b.centerY || a.x - b.x);

    interface LineCluster {
      tokens: PdfToken[];
      anchorCenterY: number;
      anchorH: number;
    }
    const clusters: LineCluster[] = [];

    for (const tok of tokens) {
      let best: LineCluster | null = null;
      let bestDist = Infinity;
      for (let i = clusters.length - 1; i >= Math.max(0, clusters.length - 6); i--) {
        const cl = clusters[i];
        const refH = Math.max(cl.anchorH, tok.h);
        const dist = Math.abs(cl.anchorCenterY - tok.centerY);
        if (dist <= refH * 0.85 && dist < bestDist) {
          best = cl;
          bestDist = dist;
        }
      }
      if (best) {
        best.tokens.push(tok);
        if (tok.h > best.anchorH * 0.95) {
          best.anchorH = Math.max(best.anchorH, tok.h);
          best.anchorCenterY = (best.anchorCenterY + tok.centerY) / 2;
        }
      } else {
        clusters.push({ tokens: [tok], anchorCenterY: tok.centerY, anchorH: tok.h });
      }
    }

    for (const cl of clusters) {
      cl.tokens.sort((a, b) => a.x - b.x);
      let lineText = '';
      for (let i = 0; i < cl.tokens.length; i++) {
        if (i > 0) {
          const prev = cl.tokens[i - 1];
          const curr = cl.tokens[i];
          const gap = curr.x - (prev.x + prev.w);
          if (gap > 0.032) lineText += '\t';
          else if (gap > 0.003) lineText += ' ';
        }
        lineText += cl.tokens[i].str;
      }

      const minX = Math.min(...cl.tokens.map((t) => t.x));
      const minY = Math.min(...cl.tokens.map((t) => t.y));
      const maxX = Math.max(...cl.tokens.map((t) => t.x + t.w));
      const maxY = Math.max(...cl.tokens.map((t) => t.y + t.h));
      pageItems.push({
        pageNumber: pNum,
        text: lineText.trim(),
        tokens: cl.tokens,
        x: Math.max(0, minX),
        y: Math.max(0, minY),
        w: Math.min(1 - minX, Math.max(0.04, maxX - minX)),
        h: Math.max(0.012, maxY - minY),
        kind: 'text',
      });
    }

    if (extractInlineImages) {
      const rasterRects = await detectEmbeddedImageRects(page, baseViewport, pdfjsLib.OPS);
      const vectorRects = detectVectorDiagramRects(canvas, pageItems, rasterRects);
      const imgRects = [...rasterRects, ...vectorRects];
      for (const rect of imgRects) {
        const crop = await cropRegionDataUrl(
          imageDataUrl,
          {
            x: Math.max(0, rect.x - 0.004),
            y: Math.max(0, rect.y - 0.004),
            w: Math.min(1, rect.w + 0.008),
            h: Math.min(1, rect.h + 0.008),
          },
          240000
        );
        if (crop) {
          extractedImagesCount++;
          pageItems.push({
            pageNumber: pNum,
            text: '',
            tokens: [],
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h,
            kind: 'image',
            imageUrl: crop,
          });
        }
      }
    }

    pageItems.sort((a, b) => a.y - b.y || a.x - b.x);
    rawLines.push(...pageItems);

    canvas.width = 0;
    canvas.height = 0;
  }

  const marginTextCount = new Map<string, number>();
  for (const ln of rawLines) {
    if (ln.kind === 'text' && (ln.y < 0.08 || ln.y > 0.90)) {
      const key = ln.text.trim();
      if (key.length >= 4 && key.length <= 100 && !Q_START_RE.test(key)) {
        marginTextCount.set(key, (marginTextCount.get(key) ?? 0) + 1);
      }
    }
  }

  const cleanLines = rawLines.filter((ln) => {
    if (ln.kind === 'image') return true;
    const t = ln.text.trim();
    if (!t) return false;
    if (PAGE_NOISE_RE.test(t)) return false;
    if ((ln.y < 0.08 || ln.y > 0.90) && ln.pageNumber > 1 && (marginTextCount.get(t) ?? 0) >= 2) {
      return false;
    }
    return true;
  });

  if (!cleanLines.some((l) => l.kind === 'text')) {
    throw new Error(
      'Tệp PDF này là bản scan ảnh chưa có lớp chữ (text layer). Hãy dùng tệp Word (.docx), PDF xuất trực tiếp từ Word/LaTeX, hoặc chọn Kiểu 1 (Đề và phiếu riêng) cho bản PDF scan.'
    );
  }

  return { lines: cleanLines, pages, extractedImagesCount };
}

function convertPdfLinesToParagraphs(lines: PositionedLine[]): NormalizedParagraph[] {
  const paragraphs: NormalizedParagraph[] = [];
  let i = 0;

  while (i < lines.length) {
    const ln = lines[i];

    if (ln.kind === 'image' && ln.imageUrl) {
      paragraphs.push({
        id: `pdf_img_${i}`,
        runs: [{ text: '', kind: 'image', imageDataUrl: ln.imageUrl }],
        plainText: '',
      });
      i++;
      continue;
    }

    const isTableRow = (l: PositionedLine | undefined): boolean => {
      if (!l || l.kind !== 'text') return false;
      const t = l.text.trim();
      if (Q_START_RE.test(t) || PART_RE.test(t) || MC_OPT_RE.test(t) || TF_OPT_RE.test(t)) return false;
      const cols = t.split('\t').map((c) => c.trim()).filter(Boolean);
      return cols.length >= 3;
    };

    if (isTableRow(ln) && isTableRow(lines[i + 1])) {
      const tableRows: string[][] = [];
      let j = i;
      while (j < lines.length && isTableRow(lines[j]) && lines[j].pageNumber === ln.pageNumber) {
        tableRows.push(lines[j].text.split('\t').map((c) => c.trim()).filter(Boolean));
        j++;
      }
      if (tableRows.length >= 2) {
        const maxCols = Math.max(...tableRows.map((r) => r.length));
        const trHtml = tableRows
          .map((row, rIdx) => {
            const tag = rIdx === 0 ? 'th' : 'td';
            const cells = Array.from({ length: maxCols }, (_, c) => `<${tag}>${row[c] ?? ''}</${tag}>`).join('');
            return `<tr>${cells}</tr>`;
          })
          .join('');
        const tableHtml = `<div class="exam-table-wrap"><table class="exam-table"><tbody>${trHtml}</tbody></table></div>`;
        paragraphs.push({
          id: `pdf_tbl_${i}`,
          runs: [{ text: '', kind: 'html_table', tableHtml }],
          plainText: `[Bảng]\n${tableRows.map((r) => r.join(' | ')).join('\n')}`,
        });
        i = j;
        continue;
      }
    }

    paragraphs.push({
      id: `pdf_ln_${i}`,
      runs: [{ text: ln.text, kind: 'text' }],
      plainText: ln.text,
    });
    i++;
  }

  return paragraphs;
}

export async function parsePdfTextMode(file: File): Promise<ParseResult> {
  const t0 = performance.now();
  const { lines, pages, extractedImagesCount } = await extractLinesAndRenderPages(file, 1.55, true);
  const paragraphs = convertPdfLinesToParagraphs(lines);

  const res = parseNormalizedParagraphsToExam(paragraphs, {
    sourceFileName: file.name,
    sourceFormat: 'pdf_text',
    imagesExtracted: extractedImagesCount,
    startedAtMs: t0,
  });
  res.pdfPages = pages;
  return res;
}

function detectHorizontalOptionTokens(
  ln: PositionedLine
): Array<{ label: string; xStart: number; xEnd: number; text: string }> | null {
  const toks = ln.tokens;
  if (toks.length < 2) return null;

  const anchors: Array<{ label: string; tokIdx: number; x: number }> = [];
  for (let i = 0; i < toks.length; i++) {
    const s = toks[i].str.trim();
    const m = s.match(/^([A-D])\.(?:\s|$)/);
    const splitLetter =
      !m && /^[A-D]$/.test(s) && toks[i + 1]?.str.trim().startsWith('.') ? s : null;
    const label = m ? m[1] : splitLetter;
    if (label) {
      const prev = i > 0 ? toks[i - 1] : null;
      const gap = prev ? toks[i].x - (prev.x + prev.w) : 1;
      if (i === 0 || gap > 0.005) {
        anchors.push({ label, tokIdx: i, x: toks[i].x });
      }
    }
  }

  if (anchors.length < 2) return null;
  const seq: typeof anchors = [anchors[0]];
  for (let i = 1; i < anchors.length; i++) {
    if (anchors[i].label.charCodeAt(0) === seq[seq.length - 1].label.charCodeAt(0) + 1) {
      seq.push(anchors[i]);
    }
  }
  if (seq.length < 2 || seq[0].tokIdx !== 0) return null;

  return seq.map((a, idx) => {
    const nextTokIdx = idx + 1 < seq.length ? seq[idx + 1].tokIdx : toks.length;
    const xEnd = idx + 1 < seq.length ? Math.max(a.x + 0.08, seq[idx + 1].x - 0.006) : 0.96;
    const sliceText = toks
      .slice(a.tokIdx, nextTokIdx)
      .map((t) => t.str)
      .join(' ')
      .replace(/^[A-D]\.\s*/, '')
      .trim();
    return {
      label: a.label,
      xStart: Math.max(0.02, a.x - 0.005),
      xEnd: Math.min(0.97, xEnd),
      text: sliceText,
    };
  });
}

export async function parsePdfCropMode(file: File): Promise<ParseResult> {
  const t0 = performance.now();
  const { lines, pages } = await extractLinesAndRenderPages(file, 1.7, false);

  interface CropOptionBlock {
    label: string;
    pageNumber: number;
    x: number;
    yTop: number;
    w: number;
    yBottom: number;
    text: string;
  }

  interface RawQuestionBlock {
    id: string;
    globalIndex: number;
    partIndex: number;
    localIndex: number;
    partTitle?: string;
    partHintType?: QuestionType;
    explicitPoints: number;
    stemLines: PositionedLine[];
    options: CropOptionBlock[];
    blankAnswerYByPage: Map<number, number>;
    isTrueFalse: boolean;
    isShortAnswer: boolean;
  }

  const blocks: RawQuestionBlock[] = [];
  let current: RawQuestionBlock | null = null;
  let currentOpt: CropOptionBlock | null = null;
  let currentPartTitle: string | undefined;
  let currentPartIndex = 1;
  let partHintType: QuestionType | undefined;
  const partLocalCounter = new Map<number, number>();
  let detectedTitle = file.name.replace(/\.[^.]+$/, '');

  const parseRomanOrNum = (tok: string): number => {
    const up = tok.trim().toUpperCase();
    if (/^\d+$/.test(up)) return parseInt(up, 10);
    return ({ I: 1, II: 2, III: 3, IV: 4, V: 5, A: 1, B: 2, C: 3, D: 4 } as Record<string, number>)[up] ?? 1;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const ln = lines[idx];
    if (ln.kind !== 'text') continue;
    const text = ln.text.trim();
    if (!text) continue;

    const pm = text.match(PART_RE);
    if (pm && text.length < 180) {
      if (current) blocks.push(current);
      current = null;
      currentOpt = null;
      currentPartTitle = text;
      currentPartIndex = parseRomanOrNum(pm[1]);
      const lower = text.toLowerCase();
      if (/đúng\s*[-–/\s]+sai|true\s*[-–/\s]+false/.test(lower)) partHintType = 'TRUE_FALSE';
      else if (/trả\s+lời\s+ngắn|điền\s+khuyết|short\s+answer/.test(lower)) partHintType = 'SHORT_ANSWER';
      else if (/tự\s+luận|essay/.test(lower)) partHintType = 'ESSAY';
      else partHintType = 'SINGLE_CHOICE';
      continue;
    }

    const qm = text.match(Q_START_RE);
    if (qm) {
      if (current) blocks.push(current);
      const writtenNum = parseInt(qm[1], 10);
      const nextLocal = (partLocalCounter.get(currentPartIndex) ?? 0) + 1;
      partLocalCounter.set(currentPartIndex, nextLocal);
      const parenMeta = qm[2] ?? '';
      let explicitPts = 0;
      const ptM = parenMeta.match(/(\d+(?:[.,]\d+)?)\s*(?:điểm|diem|đ)/i);
      if (ptM) explicitPts = parseFloat(ptM[1].replace(',', '.')) || 0;

      current = {
        id: uid('q'),
        globalIndex: blocks.length + 1,
        partIndex: currentPartIndex,
        localIndex: !isNaN(writtenNum) && writtenNum > 0 ? writtenNum : nextLocal,
        partTitle: currentPartTitle,
        partHintType,
        explicitPoints: explicitPts,
        stemLines: [ln],
        options: [],
        blankAnswerYByPage: new Map(),
        isTrueFalse: partHintType === 'TRUE_FALSE',
        isShortAnswer: partHintType === 'SHORT_ANSWER',
      };
      currentOpt = null;
      continue;
    }

    if (!current) {
      if (
        ln.pageNumber === 1 &&
        text.length >= 8 &&
        text.length <= 120 &&
        /đề|kiểm tra|thi/i.test(text) &&
        detectedTitle === file.name.replace(/\.[^.]+$/, '')
      ) {
        const segs = text.split('\t').map((s) => s.trim()).filter(Boolean);
        const bestSeg = segs.find((s) => /đề|kiểm tra|thi/i.test(s)) ?? segs.join(' — ');
        detectedTitle = bestSeg;
      }
      continue;
    }

    if (BLANK_ANS_LINE_RE.test(text)) {
      if (current.options.length === 0) current.isShortAnswer = true;
      if (!current.blankAnswerYByPage.has(ln.pageNumber)) {
        current.blankAnswerYByPage.set(ln.pageNumber, ln.y);
      }
      currentOpt = null;
      continue;
    }

    const tfm = text.match(TF_OPT_RE);
    if (tfm && (current.isTrueFalse || partHintType === 'TRUE_FALSE')) {
      current.isTrueFalse = true;
      const prevLine = idx > 0 && lines[idx - 1].pageNumber === ln.pageNumber ? lines[idx - 1] : null;
      const prevBottom = prevLine ? prevLine.y + prevLine.h : 0;
      const opt: CropOptionBlock = {
        label: tfm[2].toLowerCase(),
        pageNumber: ln.pageNumber,
        x: Math.max(0.03, ln.x - 0.008),
        yTop: prevLine ? Math.max(prevBottom + 0.0015, ln.y - 0.002) : Math.max(0, ln.y - 0.002),
        w: 0.94,
        yBottom: Math.min(1, ln.y + ln.h + 0.003),
        text: tfm[3].trim(),
      };
      current.options.push(opt);
      currentOpt = opt;
      continue;
    }

    if (!current.isTrueFalse && !current.isShortAnswer) {
      const horiz = detectHorizontalOptionTokens(ln);
      if (horiz) {
        const prevLine = idx > 0 && lines[idx - 1].pageNumber === ln.pageNumber ? lines[idx - 1] : null;
        const nextLine = idx + 1 < lines.length && lines[idx + 1].pageNumber === ln.pageNumber ? lines[idx + 1] : null;
        const prevBottom = prevLine ? prevLine.y + prevLine.h : 0;
        const gapAbove = prevLine ? Math.max(0, ln.y - prevBottom) : 0.008;
        const gapBelow = nextLine ? Math.max(0, nextLine.y - (ln.y + ln.h)) : 0.012;
        const safeTop = prevLine
          ? Math.max(prevBottom + 0.002, ln.y - Math.min(0.003, gapAbove * 0.25))
          : Math.max(0, ln.y - 0.003);
        const safeBot = Math.min(1, ln.y + ln.h + Math.min(0.008, Math.max(0.003, gapBelow * 0.35)));

        for (const hOpt of horiz) {
          current.options.push({
            label: hOpt.label,
            pageNumber: ln.pageNumber,
            x: hOpt.xStart,
            yTop: safeTop,
            w: Math.max(0.12, hOpt.xEnd - hOpt.xStart),
            yBottom: safeBot,
            text: hOpt.text,
          });
        }
        currentOpt = null;
        continue;
      }

      const mcm = text.match(MC_OPT_RE);
      if (mcm) {
        const prevLine = idx > 0 && lines[idx - 1].pageNumber === ln.pageNumber ? lines[idx - 1] : null;
        const prevBottom = prevLine ? prevLine.y + prevLine.h : 0;
        const opt: CropOptionBlock = {
          label: mcm[2].toUpperCase(),
          pageNumber: ln.pageNumber,
          x: Math.max(0.03, ln.x - 0.008),
          yTop: prevLine ? Math.max(prevBottom + 0.0015, ln.y - 0.002) : Math.max(0, ln.y - 0.002),
          w: 0.94,
          yBottom: Math.min(1, ln.y + ln.h + 0.003),
          text: mcm[3].trim(),
        };
        current.options.push(opt);
        currentOpt = opt;
        continue;
      }
    }

    if (currentOpt && ln.pageNumber === currentOpt.pageNumber) {
      currentOpt.yBottom = Math.max(currentOpt.yBottom, Math.min(1, ln.y + ln.h + 0.003));
      currentOpt.text = `${currentOpt.text} ${text}`.trim();
    } else if (current.options.length === 0) {
      current.stemLines.push(ln);
    } else if (currentOpt && ln.pageNumber !== currentOpt.pageNumber) {
      currentOpt.text = `${currentOpt.text} ${text}`.trim();
    }
  }

  if (current) blocks.push(current);

  const questions: ExamQuestion[] = [];
  let croppedImagesCount = 0;

  for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
    const blk = blocks[bIdx];
    const padY = 0.004;

    const stemByPage = new Map<number, PositionedLine[]>();
    for (const sl of blk.stemLines) {
      const arr = stemByPage.get(sl.pageNumber) ?? [];
      arr.push(sl);
      stemByPage.set(sl.pageNumber, arr);
    }

    const stemCrops: string[] = [];
    let primaryRect = { x: 0.04, y: 0.05, w: 0.92, h: 0.1 };
    const primaryPage = blk.stemLines[0]?.pageNumber ?? 1;

    for (const [pNum, pLines] of stemByPage.entries()) {
      const pageObj = pages.find((p) => p.pageNumber === pNum);
      if (!pageObj) continue;

      const minY = Math.max(0, Math.min(...pLines.map((l) => l.y)) - padY);
      let maxY = Math.min(1, Math.max(...pLines.map((l) => l.y + l.h)) + padY);

      const firstOptOnPage = blk.options.find((o) => o.pageNumber === pNum);
      const blankAnsY = blk.blankAnswerYByPage.get(pNum);
      if (firstOptOnPage && firstOptOnPage.yTop > maxY + 0.01) {
        maxY = Math.max(maxY, firstOptOnPage.yTop - 0.004);
      } else if (blankAnsY !== undefined && blankAnsY > maxY) {
        maxY = Math.max(maxY, blankAnsY - 0.004);
      } else if (!firstOptOnPage && blankAnsY === undefined && bIdx + 1 < blocks.length) {
        const nextFirstLine = blocks[bIdx + 1].stemLines[0];
        if (nextFirstLine && nextFirstLine.pageNumber === pNum && nextFirstLine.y > maxY + 0.01 && nextFirstLine.y - maxY < 0.28) {
          maxY = Math.max(maxY, nextFirstLine.y - 0.008);
        }
      }

      const rect = {
        x: 0.04,
        y: minY,
        w: 0.92,
        h: Math.max(0.025, Math.min(1 - minY, maxY - minY)),
      };
      if (pNum === primaryPage) primaryRect = rect;

      pageObj.boxes.push({
        id: uid('box'),
        kind: 'question',
        questionId: blk.id,
        questionIndex: blk.globalIndex,
        pageNumber: pNum,
        ...rect,
      });

      const slice = await cropRegionDataUrl(pageObj.imageDataUrl, rect, 210000);
      if (slice) stemCrops.push(slice);
    }

    const stemUrl = await stitchImagesVertically(stemCrops);
    if (stemUrl) croppedImagesCount++;

    const options: ExamOption[] = [];
    for (const optBlk of blk.options) {
      const pageObj = pages.find((p) => p.pageNumber === optBlk.pageNumber);
      let optUrl = '';
      if (pageObj) {
        const optRect = {
          x: Math.max(0.02, optBlk.x),
          y: Math.max(0, optBlk.yTop),
          w: Math.min(0.96 - optBlk.x, Math.max(0.12, optBlk.w)),
          h: Math.max(0.018, Math.min(1 - optBlk.yTop, optBlk.yBottom - optBlk.yTop)),
        };
        pageObj.boxes.push({
          id: uid('box'),
          kind: 'option',
          questionId: blk.id,
          questionIndex: blk.globalIndex,
          optionLabel: optBlk.label,
          pageNumber: optBlk.pageNumber,
          ...optRect,
        });
        optUrl = await cropRegionDataUrl(pageObj.imageDataUrl, optRect, 140000);
        if (optUrl) croppedImagesCount++;
      }

      options.push({
        id: uid('opt'),
        label: optBlk.label,
        content: optBlk.text,
        cropImage: optUrl || undefined,
        isCorrect: false,
      });
    }

    let qType: QuestionType = 'ESSAY';
    if (blk.isTrueFalse && options.length >= 2) qType = 'TRUE_FALSE';
    else if (options.length >= 2) qType = 'SINGLE_CHOICE';
    else if (blk.isShortAnswer) qType = 'SHORT_ANSWER';

    const stemText = blk.stemLines
      .map((l) => l.text)
      .join(' ')
      .replace(Q_START_RE, '$3')
      .trim();

    questions.push({
      id: blk.id,
      index: blk.globalIndex,
      partIndex: blk.partIndex,
      localIndex: blk.localIndex,
      partTitle: blk.partTitle,
      type: qType,
      stem: stemText,
      stemCropImage: stemUrl || undefined,
      options,
      acceptedAnswers: [],
      explanation: '',
      points: blk.explicitPoints,
      isFixedPosition: false,
      lockOptionOrder: false,
      warnings: [],
      sourceMeta: { pageNumber: primaryPage, pdfRect: primaryRect },
    });
  }

  const scored = distributeExamPoints(questions, 10).map((q) => ({
    ...q,
    warnings: validateQuestion(q),
  }));

  return {
    title: detectedTitle,
    sourceFileName: file.name,
    sourceFormat: 'pdf_crop',
    questions: scored,
    stats: computeParseStats(scored, 0, croppedImagesCount, 0),
    rawPreviewText: lines
      .filter((l) => l.kind === 'text')
      .map((l) => l.text)
      .join('\n'),
    pdfPages: pages,
    parseDurationMs: Math.max(1, Math.round(performance.now() - t0)),
  };
}
