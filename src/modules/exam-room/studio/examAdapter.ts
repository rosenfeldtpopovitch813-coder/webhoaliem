import type { ExamOption, ExamQuestion, ParseResult } from './types';
import { computeParseStats, distributeExamPoints, validateQuestion } from './examFsm';
import { parsePlainTextExam } from './latexParser';
import { compressDataUrlForExam } from './imageCompression';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const VALID_RASTER_DATA_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i;

function extractImgTagsFromHtml(html: string): { cleanHtml: string; imgSrcs: string[] } {
  const imgSrcs: string[] = [];
  const cleaned = String(html || '')
    .replace(/<img\b[^>]+src=["']([^"']+)["'][^>]*\/?>/gi, (_full, src: string) => {
      const s = String(src || '').trim();
      if (s.startsWith('data:image/')) {
        imgSrcs.push(s);
        return '';
      }
      return _full;
    })
    .replace(/^(?:<br\s*\/?>\s*)+|(?:<br\s*\/?>\s*)+$/gi, '')
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br/><br/>')
    .trim();
  return { cleanHtml: cleaned, imgSrcs };
}

export interface PendingExamPaperPayload {
  title?: string;
  rawExamText?: string;
  questions?: Array<{
    part: 'I' | 'II' | 'III';
    partTitle?: string;
    prompt: string;
    image?: string;
    extraImages?: string[];
    options?: string[];
    answer: string | boolean[];
    tolerance?: number;
    explanation?: string;
  }>;
}

/**
 * Convert an exam exported from `Soạn đề` (/exam-paper) directly into a Studio ParseResult
 * so `/exam` opens straight in Mode 2 (Phiếu và đề chung) Proofread Studio.
 */
export function pendingExamPaperToParseResult(pending: PendingExamPaperPayload): ParseResult {
  const t0 = performance.now();
  const title = String(pending?.title || '').trim() || 'Đề chuyển từ mục Soạn đề';

  if (Array.isArray(pending?.questions) && pending.questions.length > 0) {
    let mathCount = 0;
    let imgCount = 0;
    const partCounters = { I: 0, II: 0, III: 0 };

    const studioQuestions: ExamQuestion[] = pending.questions.map((src, i) => {
      const part = src.part === 'II' ? 'II' : src.part === 'III' ? 'III' : 'I';
      partCounters[part] += 1;
      const partIndex = part === 'I' ? 1 : part === 'II' ? 2 : 3;
      const defaultPartTitle =
        part === 'I'
          ? 'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn'
          : part === 'II'
            ? 'PHẦN II. Câu trắc nghiệm đúng sai'
            : 'PHẦN III. Câu trắc nghiệm trả lời ngắn';

      let stemHtml = String(src.prompt || '').trim();
      if (src.image && VALID_RASTER_DATA_RE.test(src.image)) {
        imgCount += 1;
        stemHtml = stemHtml ? `${stemHtml}<br/><img src="${src.image}" alt="exam-figure" />` : `<img src="${src.image}" alt="exam-figure" />`;
      }
      if (Array.isArray(src.extraImages)) {
        for (const ex of src.extraImages) {
          if (ex && VALID_RASTER_DATA_RE.test(ex)) {
            imgCount += 1;
            stemHtml = `${stemHtml}<br/><img src="${ex}" alt="exam-figure" />`;
          }
        }
      }
      mathCount += (stemHtml.match(/\$[^$]+\$/g) || []).length;

      let options: ExamOption[] = [];
      let acceptedAnswers: string[] = [];
      const qType = part === 'I' ? 'SINGLE_CHOICE' : part === 'II' ? 'TRUE_FALSE' : 'SHORT_ANSWER';

      if (part === 'I') {
        const rightLetter = String(src.answer || 'A').trim().toUpperCase();
        options = ['A', 'B', 'C', 'D'].map((letter, idx) => ({
          id: uid('opt'),
          label: letter,
          content: String(src.options?.[idx] || `Phương án ${letter}`).trim(),
          isCorrect: letter === rightLetter,
          detectionSource: letter === rightLetter ? 'manual' : undefined,
        }));
      } else if (part === 'II') {
        const ansArr = Array.isArray(src.answer) ? src.answer : [true, false, true, false];
        options = ['a', 'b', 'c', 'd'].map((letter, idx) => ({
          id: uid('opt'),
          label: letter,
          content: String(src.options?.[idx] || `Nhận định ${letter}`).trim(),
          isCorrect: Boolean(ansArr[idx]),
          detectionSource: 'manual',
        }));
      } else {
        const rawAns = String(src.answer ?? '0').trim();
        if (rawAns) {
          acceptedAnswers = [rawAns];
          if (rawAns.includes(',')) acceptedAnswers.push(rawAns.replace(/,/g, '.'));
          if (rawAns.includes('.')) acceptedAnswers.push(rawAns.replace(/\./g, ','));
          acceptedAnswers = [...new Set(acceptedAnswers)];
        }
      }

      const q: ExamQuestion = {
        id: uid('q'),
        index: i + 1,
        partIndex,
        localIndex: partCounters[part],
        partTitle: src.partTitle || defaultPartTitle,
        type: qType,
        stem: stemHtml,
        options,
        acceptedAnswers,
        explanation: String(src.explanation || '').trim(),
        points: 0,
        isFixedPosition: false,
        lockOptionOrder: false,
        warnings: [],
      };
      return q;
    });

    const scored = distributeExamPoints(studioQuestions, 10).map((q) => ({
      ...q,
      warnings: validateQuestion(q),
    }));

    const rawPreviewText =
      pending.rawExamText ||
      scored
        .map((q) => `Câu ${q.index}. ${q.stem.replace(/<[^>]+>/g, ' ').trim()}`)
        .join('\n');

    return {
      title,
      sourceFileName: 'Soạn đề HTVVM',
      sourceFormat: 'exam_paper',
      questions: scored,
      stats: computeParseStats(scored, mathCount, imgCount, scored.length),
      rawPreviewText,
      parseDurationMs: Math.max(1, Math.round(performance.now() - t0)),
    };
  }

  if (pending?.rawExamText?.trim()) {
    const parsed = parsePlainTextExam(pending.rawExamText, 'Soạn đề HTVVM');
    return { ...parsed, title: title || parsed.title, sourceFormat: 'exam_paper' };
  }

  return {
    title,
    sourceFileName: 'Soạn đề HTVVM',
    sourceFormat: 'exam_paper',
    questions: [],
    stats: computeParseStats([], 0, 0, 0),
    rawPreviewText: '',
    parseDurationMs: 1,
  };
}

export interface HtvvmQuestionPayload {
  part: 'I' | 'II' | 'III';
  partTitle?: string;
  prompt: string;
  image?: string;
  extraImages?: string[];
  options?: string[];
  optionImages?: string[];
  answer: string | boolean[] | number;
  acceptedAnswers?: number[];
  tolerance?: number;
  explanation?: string;
  explanationImage?: string;
  lockOrder?: boolean;
  lockOptions?: boolean;
}

function parseNumericShort(raw: string): number | null {
  const clean = String(raw ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

/**
 * Convert Studio ExamQuestion[] -> validated HTVVM API questions array,
 * compressing any remaining large Data URLs so the JSON body fits cleanly under Vercel's 4 MB cap.
 */
export async function studioQuestionsToHtvvmPayload(
  questions: ExamQuestion[]
): Promise<{ payload: HtvvmQuestionPayload[]; approxBytes: number }> {
  if (!questions.length) {
    throw new Error('Đề thi chưa có câu hỏi nào.');
  }

  const unsupported = questions.filter((q) => q.type === 'ESSAY' || q.type === 'MULTIPLE_CHOICE');
  if (unsupported.length > 0) {
    throw new Error(
      `Câu ${unsupported.map((u) => u.index).join(', ')} đang ở dạng "${
        unsupported[0].type === 'ESSAY' ? 'Tự luận' : 'Nhiều đáp án'
      }". Hãy chuyển sang 1 trong 3 dạng chuẩn BGD 2025 (Trắc nghiệm 1 ĐA, Đúng–Sai 4 ý, Trả lời ngắn) hoặc xóa trước khi tạo phòng.`
    );
  }

  // Group into canonical BGD order I -> II -> III while preserving internal order
  const ordered: ExamQuestion[] = [
    ...questions.filter((q) => q.type === 'SINGLE_CHOICE'),
    ...questions.filter((q) => q.type === 'TRUE_FALSE'),
    ...questions.filter((q) => q.type === 'SHORT_ANSWER'),
  ];

  const out: HtvvmQuestionPayload[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const q = ordered[i];
    const qLabel = `Câu ${q.index}`;
    const { cleanHtml: cleanStem, imgSrcs: stemInlineImgs } = extractImgTagsFromHtml(q.stem);

    const rawImages: string[] = [];
    if (q.stemCropImage) rawImages.push(q.stemCropImage);
    rawImages.push(...stemInlineImgs);

    const compressedStemImgs: string[] = [];
    for (const src of rawImages.slice(0, 4)) {
      const comp = await compressDataUrlForExam(src, 260000, 1320);
      if (comp) compressedStemImgs.push(comp);
    }

    const primaryImage = compressedStemImgs[0] || '';
    const extraImages = compressedStemImgs.slice(1, 4);
    const prompt = cleanStem || (primaryImage ? qLabel : '');
    if (!prompt) {
      throw new Error(`${qLabel}: Nội dung đề bài đang để trống.`);
    }

    const { cleanHtml: cleanExp, imgSrcs: expImgs } = extractImgTagsFromHtml(q.explanation);
    const explanationImage = expImgs[0] ? await compressDataUrlForExam(expImgs[0], 240000, 1200) : '';

    const base: Partial<HtvvmQuestionPayload> = {
      prompt,
      ...(q.partTitle ? { partTitle: q.partTitle } : {}),
      ...(primaryImage ? { image: primaryImage } : {}),
      ...(extraImages.length ? { extraImages } : {}),
      ...(cleanExp ? { explanation: cleanExp } : {}),
      ...(explanationImage ? { explanationImage } : {}),
      ...(q.isFixedPosition ? { lockOrder: true } : {}),
      ...(q.lockOptionOrder ? { lockOptions: true } : {}),
    };

    if (q.type === 'SINGLE_CHOICE') {
      if (q.options.length !== 4) {
        throw new Error(`${qLabel}: Phần I cần đúng 4 phương án A, B, C, D (hiện có ${q.options.length}).`);
      }
      const correctIdx = q.options.findIndex((o) => o.isCorrect);
      if (correctIdx === -1) {
        throw new Error(`${qLabel}: Chưa chọn đáp án đúng A/B/C/D.`);
      }
      const optTexts: string[] = [];
      const optImages: string[] = [];
      for (let idx = 0; idx < 4; idx++) {
        const opt = q.options[idx];
        const { cleanHtml: cleanOpt, imgSrcs: optInline } = extractImgTagsFromHtml(opt.content);
        const rawOptImg = opt.cropImage || optInline[0] || '';
        const compOptImg = rawOptImg ? await compressDataUrlForExam(rawOptImg, 160000, 960) : '';
        optImages.push(compOptImg);
        optTexts.push(cleanOpt || (compOptImg ? `Phương án ${'ABCD'[idx]}` : ''));
        if (!optTexts[idx]) {
          throw new Error(`${qLabel}: Phương án ${'ABCD'[idx]} đang để trống.`);
        }
      }
      out.push({
        ...(base as HtvvmQuestionPayload),
        part: 'I',
        options: optTexts,
        ...(optImages.some(Boolean) ? { optionImages: optImages } : {}),
        answer: 'ABCD'[correctIdx],
      });
    } else if (q.type === 'TRUE_FALSE') {
      if (q.options.length !== 4) {
        throw new Error(`${qLabel}: Phần II Đúng–Sai cần đúng 4 ý a, b, c, d (hiện có ${q.options.length}).`);
      }
      if (!q.options.some((o) => o.detectionSource)) {
        throw new Error(`${qLabel}: Chưa xác nhận đáp án Đúng/Sai cho các ý a, b, c, d.`);
      }
      const optTexts: string[] = [];
      const optImages: string[] = [];
      for (let idx = 0; idx < 4; idx++) {
        const opt = q.options[idx];
        const { cleanHtml: cleanOpt, imgSrcs: optInline } = extractImgTagsFromHtml(opt.content);
        const rawOptImg = opt.cropImage || optInline[0] || '';
        const compOptImg = rawOptImg ? await compressDataUrlForExam(rawOptImg, 160000, 960) : '';
        optImages.push(compOptImg);
        optTexts.push(cleanOpt || (compOptImg ? `Nhận định ${'abcd'[idx]}` : ''));
        if (!optTexts[idx]) {
          throw new Error(`${qLabel}: Ý ${'abcd'[idx]}) đang để trống.`);
        }
      }
      out.push({
        ...(base as HtvvmQuestionPayload),
        part: 'II',
        options: optTexts,
        ...(optImages.some(Boolean) ? { optionImages: optImages } : {}),
        answer: q.options.slice(0, 4).map((o) => Boolean(o.isCorrect)),
      });
    } else {
      const nums = q.acceptedAnswers
        .map(parseNumericShort)
        .filter((v): v is number => v !== null);
      if (!nums.length) {
        throw new Error(`${qLabel}: Hãy nhập đáp số hợp lệ (VD: 12,5 hoặc -4) cho câu trả lời ngắn.`);
      }
      out.push({
        ...(base as HtvvmQuestionPayload),
        part: 'III',
        answer: nums[0],
        ...(nums.length > 1 ? { acceptedAnswers: [...new Set(nums)].slice(0, 6) } : {}),
        tolerance: 0.01,
      });
    }
  }

  const approxBytes = new TextEncoder().encode(JSON.stringify(out)).length;
  if (approxBytes > 3_750_000) {
    throw new Error(
      `Tổng dung lượng đề thi (${(approxBytes / 1048576).toFixed(2)} MB) vượt ngưỡng an toàn 3,75 MB. Hãy giảm số ảnh cắt hoặc dùng chế độ PDF Tách chữ nhanh.`
    );
  }

  return { payload: out, approxBytes };
}

function hashSeedString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed >>> 0;
  const nextRnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface ShuffledPublicOption {
  displayLetter: string;
  origChoice: string;
  text: string;
  image?: string;
}

export interface ShuffledPublicQuestion {
  id: string;
  part: 'I' | 'II' | 'III';
  partTitle?: string;
  prompt: string;
  latex?: string;
  image?: string;
  extraImages?: string[];
  options?: string[];
  optionImages?: string[];
  displayOptions?: ShuffledPublicOption[];
}

/**
 * Deterministic per-attempt shuffle within each Part (I, II, III).
 * Preserves canonical `q.id` and canonical `origChoice` ('A'|'B'|'C'|'D') so server-side grading
 * and draft auto-save remain 100% accurate across page reloads!
 */
export function deterministicShuffleForAttempt(
  publicQs: ShuffledPublicQuestion[],
  attemptSeedStr: string,
  opts: { shuffleQuestions?: boolean; shuffleOptions?: boolean } = {}
): ShuffledPublicQuestion[] {
  const baseSeed = hashSeedString(attemptSeedStr || 'default');
  const result: ShuffledPublicQuestion[] = [];

  for (const part of ['I', 'II', 'III'] as const) {
    const partItems = publicQs.filter((q) => q.part === part);
    if (!partItems.length) continue;

    let orderedPart = [...partItems];
    if (opts.shuffleQuestions) {
      const movableIdx: number[] = [];
      const movableQs: ShuffledPublicQuestion[] = [];
      orderedPart.forEach((q, idx) => {
        if (!(q as { lockOrder?: boolean }).lockOrder) {
          movableIdx.push(idx);
          movableQs.push(q);
        }
      });
      const shuffled = seededShuffle(movableQs, baseSeed ^ hashSeedString(`part:${part}`));
      movableIdx.forEach((origIdx, i) => {
        orderedPart[origIdx] = shuffled[i];
      });
    }

    for (const q of orderedPart) {
      if (q.part === 'I' && Array.isArray(q.options) && q.options.length === 4) {
        const rawOpts: ShuffledPublicOption[] = ['A', 'B', 'C', 'D'].map((orig, idx) => ({
          displayLetter: orig,
          origChoice: orig,
          text: q.options?.[idx] || `Phương án ${orig}`,
          image: q.optionImages?.[idx] || undefined,
        }));
        let finalOpts = rawOpts;
        if (opts.shuffleOptions && !(q as { lockOptions?: boolean }).lockOptions) {
          const mixed = seededShuffle(rawOpts, baseSeed ^ hashSeedString(q.id));
          finalOpts = mixed.map((item, idx) => ({
            ...item,
            displayLetter: 'ABCD'[idx],
          }));
        }
        result.push({ ...q, displayOptions: finalOpts });
      } else {
        result.push({ ...q });
      }
    }
  }

  return result;
}
