import type {
  AnswerDetectionSource,
  ExamOption,
  ExamQuestion,
  NormalizedParagraph,
  ParseResult,
  QuestionType,
  StyledRun,
} from './types';

type ParserState =
  | 'HEADER'
  | 'QUESTION_STEM'
  | 'OPTIONS'
  | 'EXPLANATION'
  | 'ANSWER_TABLE';

const PART_RE = /^(?:PHẦN|Phần|PHAN|Phan|PART|Part)\s+([IVX\d]+|[A-Z])[\s.:–-]*(.*)$/;
const ANSWER_SUBPART_RE = /^(?:(?:PHẦN|Phần|PHAN|Phan|PART|Part)\s+)?([IVX]+|\d+)\s*[.:–-]\s*(.*)$/;
const QUESTION_START_RE = /^(?:Câu|CÂU|Cau|CAU|Question|QUESTION|Bài|BÀI|Bai|BAI)\s*(\d+)\s*(?:\(([^)]{1,30})\))?\s*[:.)\-]?\s*(.*)$/i;
const END_OF_EXAM_RE = /^[-–—=_*\s]*(?:HẾT|HET|THE END|CHÚC CÁC BẠN LÀM BÀI THẬT TỐT)[-–—=_*\s]*$/i;
const ANSWER_TABLE_HEADING_RE =
  /^(?:BẢNG\s+ĐÁP\s+ÁN(?:\s+(?:CHI\s+TIẾT|THAM\s+KHẢO|ĐỀ\s+THI|CHÍNH\s+THỨC|MÃ\s+ĐỀ\s*\d*))?|ĐÁP\s+ÁN(?:\s+(?:CHI\s+TIẾT|THAM\s+KHẢO|ĐỀ\s+THI|CHÍNH\s+THỨC|VÀ\s+HƯỚNG\s+DẪN\s+CHẤM|MÃ\s+ĐỀ\s*\d*))?|HƯỚNG\s+DẪN\s+CHẤM(?:\s+CHI\s+TIẾT)?|BANG\s+DAP\s+AN|HUONG\s+DAN\s+CHAM|ANSWER\s+KEY)\s*:?\s*$/i;
const EXPLANATION_HEADING_RE = /^(?:Lời\s+giải|Hướng\s+dẫn\s+giải|Giải\s+thích|Giải|HDG|Loi\s+giai|Huong\s+dan\s+giai)\s*[:.]?\s*(.*)$/i;
const INLINE_CHOOSE_RE = /^(?:Chọn|Chon|Đáp\s+án(?:\s+đúng)?|Dap\s+an|Đáp\s+số|Trả\s+lời)\s*[:.]?\s*(.*)$/i;

const NOISE_LINE_RE =
  /^(?:Mã\s+đề\s+\d+\s*[·•|/-]\s*Trang\s+\d+\s*\/\s*\d+|Trang\s+\d+\s*\/\s*\d+|Thí\s+sinh\s+trả\s+lời\s+từ\s+câu\s+\d+|Trong\s+mỗi\s+ý\s+a\)\s*,\s*b\)|Thí\s+sinh\s+trả\s+lời\s+các\s+câu\s+hỏi\s+bên\s+dưới|[-–—=_*\s]*CHÚC\s+CÁC\s+(?:BẠN|EM)\s+LÀM\s+BÀI)/i;

const MC_OPTION_RE = /^(\*?)\s*([A-H])\s*[.)]\s*(.*)$/;
const TF_OPTION_RE = /^(\*?)\s*([a-h])\s*\)\s*(.*)$/;

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeMatchSpaces(text: string): string {
  return text.replace(/[\u00A0\u2007\u202F]/g, ' ');
}

function parsePartNumber(token: string): number {
  const up = token.trim().toUpperCase();
  if (/^\d+$/.test(up)) return parseInt(up, 10);
  const romanMap: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, A: 1, B: 2, C: 3, D: 4 };
  return romanMap[up] ?? 1;
}

function inferPartHintType(partText: string): QuestionType {
  const lower = partText.toLowerCase();
  if (/đúng\s*[-–/\s]+sai|dung\s*[-–/\s]+sai|true\s*[-–/\s]+false/.test(lower)) return 'TRUE_FALSE';
  if (/trả\s+lời\s+ngắn|tra\s+loi\s+ngan|điền\s+khuyết|điền\s+từ|short\s+answer/.test(lower)) return 'SHORT_ANSWER';
  if (/tự\s+luận|tu\s+luan|essay/.test(lower)) return 'ESSAY';
  return 'SINGLE_CHOICE';
}

function isColoredHex(hex?: string): boolean {
  if (!hex) return false;
  const c = hex.replace('#', '').toUpperCase();
  if (!c || c === 'AUTO' || c === '000000' || c === 'FFFFFF' || c === '222222' || c === '333333' || c === '111111') {
    return false;
  }
  return true;
}

export function runsToContent(runs: StyledRun[], stripLeadingChars = 0): string {
  let remainingSkip = stripLeadingChars;
  let out = '';

  for (const run of runs) {
    if (run.kind === 'break') {
      if (remainingSkip > 0) continue;
      out += '<br/>';
      continue;
    }
    if (run.kind === 'tab') {
      if (remainingSkip > 0) {
        remainingSkip = Math.max(0, remainingSkip - 1);
        continue;
      }
      out += ' ';
      continue;
    }
    if (run.kind === 'image' && run.imageDataUrl) {
      out += `<img src="${run.imageDataUrl}" alt="exam-figure" />`;
      continue;
    }
    if (run.kind === 'html_table' && run.tableHtml) {
      out += run.tableHtml;
      continue;
    }
    if (run.kind === 'math_inline') {
      const tex = run.text.trim();
      if (tex) out += ` $${tex}$ `;
      continue;
    }
    if (run.kind === 'math_block') {
      const tex = run.text.trim();
      if (tex) out += `\n$$${tex}$$\n`;
      continue;
    }

    let text = run.text;
    if (remainingSkip > 0) {
      if (text.length <= remainingSkip) {
        remainingSkip -= text.length;
        continue;
      } else {
        text = text.slice(remainingSkip);
        remainingSkip = 0;
      }
    }
    if (!text) continue;

    let chunk = escapeHtml(text);
    if (run.bold) chunk = `<strong>${chunk}</strong>`;
    if (run.italic) chunk = `<em>${chunk}</em>`;
    if (run.underline) chunk = `<u>${chunk}</u>`;
    out += chunk;
  }

  return out.replace(/\s+<br\/>/g, '<br/>').trim();
}

function detectLabelFormatting(
  runs: StyledRun[],
  labelCharCount: number
): { source?: AnswerDetectionSource; isBoldOnly: boolean } {
  let pos = 0;
  let hasUnderline = false;
  let hasColor = false;
  let hasHighlight = false;
  let hasBold = false;
  let inspectedChars = 0;

  for (const run of runs) {
    if (run.kind !== 'text') continue;
    for (let i = 0; i < run.text.length; i++) {
      const ch = run.text[i];
      if (pos === 0 && /\s/.test(ch)) continue;
      pos++;
      if (pos <= labelCharCount) {
        inspectedChars++;
        if (run.underline) hasUnderline = true;
        if (isColoredHex(run.colorHex)) hasColor = true;
        if (run.highlight && run.highlight !== 'none') hasHighlight = true;
        if (run.bold) hasBold = true;
      }
    }
    if (pos >= labelCharCount) break;
  }

  if (inspectedChars === 0) return { isBoldOnly: false };
  if (hasUnderline) return { source: 'underline', isBoldOnly: false };
  if (hasColor) return { source: 'color', isBoldOnly: false };
  if (hasHighlight) return { source: 'highlight', isBoldOnly: false };
  return { isBoldOnly: hasBold };
}

function getRawParagraphOffsetString(runs: StyledRun[]): string {
  return runs
    .map((r) => (r.kind === 'text' ? r.text : r.kind === 'tab' ? '\t' : r.kind === 'math_inline' ? `$${r.text}$` : ''))
    .join('');
}

function sliceRunsByOffset(runs: StyledRun[], start: number, end: number): StyledRun[] {
  const out: StyledRun[] = [];
  let cursor = 0;

  for (const run of runs) {
    let len = 0;
    if (run.kind === 'text') len = run.text.length;
    else if (run.kind === 'tab') len = 1;
    else if (run.kind === 'math_inline') len = run.text.length + 2;

    const rStart = cursor;
    const rEnd = cursor + len;
    cursor = rEnd;

    if (run.kind === 'image' || run.kind === 'math_block' || run.kind === 'html_table') {
      if (rStart >= start && rStart < end) out.push(run);
      continue;
    }
    if (rEnd <= start || rStart >= end) continue;

    if (run.kind === 'text') {
      const localS = Math.max(0, start - rStart);
      const localE = Math.min(run.text.length, end - rStart);
      const sub = run.text.slice(localS, localE);
      if (sub) out.push({ ...run, text: sub });
    } else if (run.kind === 'math_inline') {
      out.push(run);
    }
  }
  return out;
}

function sliceParagraphAtOffsets(
  para: NormalizedParagraph,
  txt: string,
  cutPoints: number[],
  suffix: string
): NormalizedParagraph[] {
  const rawFull = getRawParagraphOffsetString(para.runs);
  const leadingTrim = rawFull.length - rawFull.trimStart().length;
  const results: NormalizedParagraph[] = [];

  for (let i = 0; i < cutPoints.length; i++) {
    const segStart = cutPoints[i];
    const segEnd = i + 1 < cutPoints.length ? cutPoints[i + 1] : txt.length;
    const plain = txt.slice(segStart, segEnd).trim();
    const slicedRuns = sliceRunsByOffset(
      para.runs,
      segStart + leadingTrim,
      i + 1 < cutPoints.length ? segEnd + leadingTrim : rawFull.length
    );
    if (plain || slicedRuns.some((r) => r.kind === 'image')) {
      results.push({
        id: `${para.id}_${suffix}${i}`,
        runs: slicedRuns,
        plainText: plain,
      });
    }
  }
  return results.length > 0 ? results : [para];
}

function splitSameLineMcOptions(para: NormalizedParagraph): NormalizedParagraph[] {
  if (para.runs.some((r) => r.kind === 'html_table')) return [para];
  const txt = para.plainText.trim();
  if (!txt) return [para];
  const normTxt = normalizeMatchSpaces(txt);

  const startsWithOption = /^\*?[A-H]\.\s+/.test(normTxt);
  if (startsWithOption) {
    const markerRe = /(?:^|\s)(\*?[A-H]\.)(?=\s|$)/g;
    const rawMatches: Array<{ labelStart: number; label: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = markerRe.exec(normTxt)) !== null) {
      const labelToken = m[1];
      const labelStart = m.index + m[0].indexOf(labelToken);
      const letter = labelToken.replace('*', '').replace('.', '');
      rawMatches.push({ labelStart, label: letter });
    }
    if (rawMatches.length >= 2 && rawMatches[0].labelStart === 0) {
      const seq = [rawMatches[0]];
      for (let i = 1; i < rawMatches.length; i++) {
        if (rawMatches[i].label.charCodeAt(0) === seq[seq.length - 1].label.charCodeAt(0) + 1) {
          seq.push(rawMatches[i]);
        }
      }
      if (seq.length >= 2) {
        return sliceParagraphAtOffsets(para, txt, seq.map((s) => s.labelStart), 'opt');
      }
    }
    return [para];
  }

  const qPrefix = normTxt.match(QUESTION_START_RE);
  const searchFloor = qPrefix ? normTxt.length - (qPrefix[3]?.length ?? 0) : 0;

  const inlineRe = /(?:^|[\s:?.!)\]}”"'])(\*?[A-H]\.)(?=\s)/g;
  const candidates: Array<{ labelStart: number; label: string; isWideSep: boolean }> = [];
  let im: RegExpExecArray | null;
  while ((im = inlineRe.exec(normTxt)) !== null) {
    const labelToken = im[1];
    const labelStart = im.index + im[0].indexOf(labelToken);
    if (labelStart < searchFloor) continue;
    const before = normTxt.slice(Math.max(0, labelStart - 2), labelStart);
    const isWideSep = /\t|\s{2}/.test(before);
    candidates.push({
      labelStart,
      label: labelToken.replace('*', '').replace('.', ''),
      isWideSep,
    });
  }

  let bestChain: typeof candidates = [];
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i].label !== 'A') continue;
    const chain = [candidates[i]];
    for (let j = i + 1; j < candidates.length; j++) {
      const prev = chain[chain.length - 1];
      if (
        candidates[j].label.charCodeAt(0) === prev.label.charCodeAt(0) + 1 &&
        candidates[j].labelStart - prev.labelStart >= 3
      ) {
        chain.push(candidates[j]);
      }
    }
    const qualifies =
      chain.length >= 3 || (chain.length >= 2 && chain.every((c, idx) => idx === 0 || c.isWideSep));
    if (qualifies && (chain.length > bestChain.length || (chain.length === bestChain.length && chain[0].labelStart > (bestChain[0]?.labelStart ?? -1)))) {
      bestChain = chain;
    }
  }

  if (bestChain.length >= 2) {
    const cuts = bestChain[0].labelStart > 0 ? [0, ...bestChain.map((c) => c.labelStart)] : bestChain.map((c) => c.labelStart);
    return sliceParagraphAtOffsets(para, txt, cuts, 'imc');
  }

  return [para];
}

function splitInlineTrueFalseOptions(para: NormalizedParagraph, inTrueFalsePart: boolean): NormalizedParagraph[] {
  if (para.runs.some((r) => r.kind === 'html_table')) return [para];
  const txt = para.plainText.trim();
  if (!txt) return [para];
  const normTxt = normalizeMatchSpaces(txt);

  const qPrefix = normTxt.match(QUESTION_START_RE);
  const searchFloor = qPrefix ? normTxt.length - (qPrefix[3]?.length ?? 0) : 0;

  const tfRe = /(\*?[a-d]\))(?=\s)/g;
  const candidates: Array<{ labelStart: number; label: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = tfRe.exec(normTxt)) !== null) {
    const labelStart = m.index;
    if (labelStart < searchFloor) continue;

    let validBoundary = labelStart === 0;
    if (!validBoundary) {
      const prev1 = normTxt[labelStart - 1];
      if (/[\s.?!:”"’')\]…]/.test(prev1)) {
        validBoundary = true;
      } else if (prev1 === 'Đ' || prev1 === 'S') {
        const prev2 = labelStart >= 2 ? normTxt[labelStart - 2] : ' ';
        if (/[\s.?!:”"’')\]…]/.test(prev2)) {
          validBoundary = true;
        }
      }
    }
    if (validBoundary) {
      candidates.push({
        labelStart,
        label: m[1].replace('*', '').replace(')', ''),
      });
    }
  }

  if (candidates.length === 0) return [para];

  if (candidates[0].labelStart === 0) {
    const seq = [candidates[0]];
    for (let i = 1; i < candidates.length; i++) {
      const prev = seq[seq.length - 1];
      if (
        candidates[i].label.charCodeAt(0) === prev.label.charCodeAt(0) + 1 &&
        candidates[i].labelStart - prev.labelStart >= 3
      ) {
        seq.push(candidates[i]);
      }
    }
    if (seq.length >= 2) {
      return sliceParagraphAtOffsets(para, txt, seq.map((s) => s.labelStart), 'tf');
    }
    return [para];
  }

  let bestChain: typeof candidates = [];
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i].label !== 'a') continue;
    const chain = [candidates[i]];
    for (let j = i + 1; j < candidates.length; j++) {
      const prev = chain[chain.length - 1];
      if (
        candidates[j].label.charCodeAt(0) === prev.label.charCodeAt(0) + 1 &&
        candidates[j].labelStart - prev.labelStart >= 3
      ) {
        chain.push(candidates[j]);
      }
    }
    const qualifies = chain.length >= 3 || (inTrueFalsePart && chain.length >= 1);
    if (qualifies && (chain.length > bestChain.length || (chain.length === bestChain.length && chain[0].labelStart > (bestChain[0]?.labelStart ?? -1)))) {
      bestChain = chain;
    }
  }

  if (bestChain.length >= 1) {
    return sliceParagraphAtOffsets(para, txt, [0, ...bestChain.map((c) => c.labelStart)], 'itf');
  }

  return [para];
}

function extractTrailingTrueFalseFlag(
  html: string
): { cleanHtml: string; isCorrect: boolean; found: boolean } {
  const trimmed = html.trim();
  if (!trimmed) return { cleanHtml: trimmed, isCorrect: false, found: false };

  const bracketedRe =
    /(?:\s*(?:=>|->|→)\s*|\s+)(\[\s*(Đúng|Sai|Đ|S|T|F)\s*\]|\(\s*(Đúng|Sai|Đ|S|T|F)\s*\)|(Đúng|Sai))\.?\s*$/iu;
  const bm = trimmed.match(bracketedRe);
  if (bm) {
    const token = (bm[2] ?? bm[3] ?? bm[4] ?? '').trim().toUpperCase();
    const isCorrect = token === 'Đ' || token === 'ĐÚNG' || token === 'T';
    return {
      cleanHtml: trimmed.slice(0, bm.index).trim(),
      isCorrect,
      found: true,
    };
  }

  const bareRe =
    /(?<=[.?!…)”"']|<\/(?:strong|em|u)>)\s*(?:<(?:strong|em|u)>)*\s*([ĐS])\s*(?:<\/(?:strong|em|u)>)*\s*$/u;
  const bareM = trimmed.match(bareRe);
  if (bareM && bareM.index !== undefined) {
    const clean = trimmed.slice(0, bareM.index).trim();
    if (clean.length >= 4) {
      return {
        cleanHtml: clean,
        isCorrect: bareM[1] === 'Đ',
        found: true,
      };
    }
  }

  return { cleanHtml: trimmed, isCorrect: false, found: false };
}

function extractTrailingShortAnswer(stemHtml: string): { cleanStem: string; answer: string } | null {
  const trimmed = stemHtml.trim();
  if (!trimmed) return null;
  const m = trimmed.match(
    /(\?|\)\.)\s*(?:<\/(?:strong|em|u)>)*\s*(?:<(?:strong|em|u)>)*\s*(-?\d+(?:[.,]\d+)?)\s*(?:<\/(?:strong|em|u)>)*\s*$/
  );
  if (!m || m.index === undefined) return null;
  const num = m[2];
  if (!num || num.length > 12) return null;
  const cleanStem = (trimmed.slice(0, m.index) + m[1]).trim();
  return { cleanStem, answer: num };
}

function normalizeShortAnswerVariants(raw: string): string[] {
  const clean = raw.replace(/^[:.\s]+/, '').trim();
  if (!clean || /^[._…\s-]+$/.test(clean)) return [];
  const variants = new Set<string>([clean]);
  if (clean.includes(',')) variants.add(clean.replace(/,/g, '.'));
  if (clean.includes('.')) variants.add(clean.replace(/\./g, ','));
  return [...variants];
}

function normalizeTrueFalseKeyString(raw: string): string | null {
  const labeledRe = /(?:^|[\s,;/|])([a-d])\s*[-:.)]?\s*(Đúng|Sai|Đ|S|T|F)(?=$|[\s,;/|.)])/gi;
  const byLetter = new Map<string, string>();
  let lm: RegExpExecArray | null;
  while ((lm = labeledRe.exec(raw)) !== null) {
    const ch = lm[1].toLowerCase();
    const val = lm[2].toUpperCase();
    byLetter.set(ch, val === 'Đ' || val === 'ĐÚNG' || val === 'T' ? 'Đ' : 'S');
  }
  if (byLetter.size >= 2) {
    return ['a', 'b', 'c', 'd'].map((k) => byLetter.get(k) ?? 'S').join('');
  }
  const tokens = raw.toUpperCase().match(/[ĐSTF]/g);
  if (tokens && tokens.length >= 2) {
    return tokens.map((t) => (t === 'Đ' || t === 'T' ? 'Đ' : 'S')).join('');
  }
  return null;
}

export interface ParsedAnswerKeyMap {
  byPartAndLocal: Map<string, string>;
  byGlobal: Map<number, string>;
  byTypeAndLocal: Map<string, string>;
  hasPartHeaders: boolean;
}

export function parseMultiPartAnswerKey(lines: string[]): ParsedAnswerKeyMap {
  const byPartAndLocal = new Map<string, string>();
  const byGlobal = new Map<number, string>();
  const byTypeAndLocal = new Map<string, string>();
  let activePartIdx: number | null = null;
  let activePartType: QuestionType | null = null;
  let hasPartHeaders = false;

  const recordKey = (qNum: number, val: string) => {
    if (isNaN(qNum) || qNum <= 0 || !val.trim()) return;
    const cleanVal = val.trim();
    if (activePartIdx !== null) {
      byPartAndLocal.set(`${activePartIdx}:${qNum}`, cleanVal);
      if (activePartType) {
        byTypeAndLocal.set(`${activePartType}:${qNum}`, cleanVal);
      }
    } else {
      byGlobal.set(qNum, cleanVal);
    }
  };

  for (const rawLine of lines) {
    let line = normalizeMatchSpaces(rawLine).trim();
    if (!line) continue;

    if (line.startsWith('__TBL_PART__')) {
      const heading = line.replace('__TBL_PART__', '').trim();
      const pm = heading.match(PART_RE) ?? heading.match(ANSWER_SUBPART_RE);
      if (pm) {
        activePartIdx = parsePartNumber(pm[1]);
        activePartType = inferPartHintType(heading);
        hasPartHeaders = true;
      }
      continue;
    }

    if (line.startsWith('__TBL_PAIR__')) {
      const parts = line.replace('__TBL_PAIR__', '').split('||');
      for (const pair of parts) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) continue;
        const qNum = parseInt(pair.slice(0, eqIdx).trim(), 10);
        const ansVal = pair.slice(eqIdx + 1).trim();
        recordKey(qNum, ansVal);
      }
      continue;
    }

    const partM = line.match(PART_RE);
    if (partM && line.length < 220) {
      activePartIdx = parsePartNumber(partM[1]);
      activePartType = inferPartHintType(line);
      hasPartHeaders = true;
      const rest = (partM[2] ?? '').trim();
      if (!/\d+\s*(?:[.:)\-]\s*(?:[A-HĐS]|-?\d)|[A-H]\b)/i.test(rest)) {
        continue;
      }
      line = rest;
    } else {
      const subM = line.match(ANSWER_SUBPART_RE);
      if (
        subM &&
        /trắc nghiệm|đúng\s*[-–/\s]*sai|trả lời ngắn|tự luận|nhiều lựa chọn|multiple|true|short/i.test(subM[2])
      ) {
        activePartIdx = parsePartNumber(subM[1]);
        activePartType = inferPartHintType(line);
        hasPartHeaders = true;
        continue;
      }
    }

    const tfLabeledRe =
      /(?:Câu\s*)?(\d+)\s*[:.)\-]\s*((?:[a-d]\s*[-:.)]?\s*(?:Đúng|Sai|Đ|S|T|F)[\s,;/]*){2,4})/gi;
    let tfFoundOnLine = false;
    let tlm: RegExpExecArray | null;
    while ((tlm = tfLabeledRe.exec(line)) !== null) {
      const norm = normalizeTrueFalseKeyString(tlm[2]);
      if (norm) {
        recordKey(parseInt(tlm[1], 10), norm);
        tfFoundOnLine = true;
      }
    }
    if (tfFoundOnLine) continue;

    const pairRe =
      /(?:Câu\s*)?(\d+)\s*[.:\-)]\s*([ĐSđsTFtf](?:[\s,\-/]*[ĐSđsTFtf]){3}|[A-H](?:\s*,\s*[A-H])*|-?\d+(?:[.,]\d+)?)(?=\s|$|[,;|])/gi;
    let matchedAny = false;
    let pm2: RegExpExecArray | null;
    while ((pm2 = pairRe.exec(line)) !== null) {
      recordKey(parseInt(pm2[1], 10), pm2[2]);
      matchedAny = true;
    }

    if (!matchedAny) {
      const compactRe = /\b(\d{1,3})([A-H])\b/g;
      let cm: RegExpExecArray | null;
      while ((cm = compactRe.exec(line)) !== null) {
        recordKey(parseInt(cm[1], 10), cm[2]);
      }
    }
  }

  return { byPartAndLocal, byGlobal, byTypeAndLocal, hasPartHeaders };
}

export function applyAnswerKeyToQuestion(
  q: ExamQuestion,
  rawKey: string,
  source: AnswerDetectionSource
): boolean {
  const key = rawKey.trim();
  if (!key || /^[._…\s-]+$/.test(key)) return false;

  if (q.type === 'TRUE_FALSE') {
    const norm = normalizeTrueFalseKeyString(key);
    if (norm && norm.length >= Math.min(2, q.options.length)) {
      q.options.forEach((opt, i) => {
        if (i < norm.length) {
          opt.isCorrect = norm[i] === 'Đ';
          opt.detectionSource = source;
        }
      });
      return true;
    }
    return false;
  }

  if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') {
    const letters = key
      .toUpperCase()
      .split(/[\s,;-]+/)
      .map((s) => s.replace(/[^A-H]/g, ''))
      .filter((s) => s.length === 1);
    if (letters.length === 0) return false;
    let matched = false;
    for (const opt of q.options) {
      if (letters.includes(opt.label.toUpperCase())) {
        opt.isCorrect = true;
        opt.detectionSource = source;
        matched = true;
      } else {
        opt.isCorrect = false;
      }
    }
    if (letters.length > 1) q.type = 'MULTIPLE_CHOICE';
    return matched;
  }

  if (q.type === 'SHORT_ANSWER') {
    const variants = normalizeShortAnswerVariants(key);
    if (variants.length > 0) {
      q.acceptedAnswers = variants;
      return true;
    }
  }

  return false;
}

export function applyBulkAnswerKeyText(
  questions: ExamQuestion[],
  rawKeyText: string,
  scope: 'auto' | 'MC' | 'TRUE_FALSE' | 'SHORT_ANSWER' = 'auto',
  source: AnswerDetectionSource = 'answer_table'
): { questions: ExamQuestion[]; matchedCount: number } {
  const lines = rawKeyText.replace(/\r\n/g, '\n').split('\n');
  const parsed = parseMultiPartAnswerKey(lines);
  const cloned = questions.map((q) => ({
    ...q,
    options: q.options.map((o) => ({ ...o })),
    acceptedAnswers: [...q.acceptedAnswers],
  }));

  const bareListFallback =
    parsed.byGlobal.size === 0 && parsed.byPartAndLocal.size === 0
      ? rawKeyText
          .split(/[\n;|]+/)
          .flatMap((seg) => (scope === 'MC' ? seg.trim().split(/[\s,]+/) : scope === 'TRUE_FALSE' ? seg.trim().split(/[\s,/]+/) : [seg.trim()]))
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  let matchedCount = 0;
  let scopedSeqIdx = 0;

  for (const q of cloned) {
    const inScope =
      scope === 'auto' ||
      (scope === 'MC' && (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE')) ||
      (scope === 'TRUE_FALSE' && q.type === 'TRUE_FALSE') ||
      (scope === 'SHORT_ANSWER' && q.type === 'SHORT_ANSWER');

    if (!inScope) continue;
    scopedSeqIdx++;

    let keyVal: string | undefined;

    if (parsed.hasPartHeaders) {
      if (q.partIndex !== undefined && q.localIndex !== undefined) {
        keyVal = parsed.byPartAndLocal.get(`${q.partIndex}:${q.localIndex}`);
      }
      if (!keyVal && q.localIndex !== undefined) {
        keyVal = parsed.byTypeAndLocal.get(`${q.type}:${q.localIndex}`);
      }
      if (!keyVal) {
        keyVal = parsed.byTypeAndLocal.get(`${q.type}:${scopedSeqIdx}`);
      }
    } else if (scope !== 'auto') {
      keyVal = parsed.byGlobal.get(q.localIndex ?? scopedSeqIdx) ?? parsed.byGlobal.get(scopedSeqIdx) ?? bareListFallback[scopedSeqIdx - 1];
    } else {
      keyVal = parsed.byGlobal.get(q.index);
    }

    if (keyVal && applyAnswerKeyToQuestion(q, keyVal, source)) {
      q.warnings = validateQuestion(q);
      matchedCount++;
    }
  }

  return { questions: cloned, matchedCount };
}

export function distributeExamPoints(questions: ExamQuestion[], totalPoints = 10): ExamQuestion[] {
  if (questions.length === 0) return questions;

  const cI = questions.filter((q) => q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE').length;
  const cII = questions.filter((q) => q.type === 'TRUE_FALSE').length;
  const cIII = questions.filter((q) => q.type === 'SHORT_ANSWER').length;

  // Auto-match BGD 2025 standard distributions when totalPoints === 10
  if (totalPoints === 10 && cI === 12 && cII === 4 && cIII === 6 && questions.length === 22) {
    return questions.map((q) => ({
      ...q,
      points: q.type === 'TRUE_FALSE' ? 1 : q.type === 'SHORT_ANSWER' ? 0.5 : 0.25,
    }));
  }
  if (totalPoints === 10 && cI === 18 && cII === 4 && cIII === 6 && questions.length === 28) {
    return questions.map((q) => ({
      ...q,
      points: q.type === 'TRUE_FALSE' ? 1 : 0.25,
    }));
  }
  if (totalPoints === 10 && cI === 24 && cII === 4 && cIII === 0 && questions.length === 28) {
    return questions.map((q) => ({
      ...q,
      points: q.type === 'TRUE_FALSE' ? 1 : 0.25,
    }));
  }

  const hasTF = cII > 0;
  const hasSA = cIII > 0;
  if (hasTF || hasSA) {
    const weights = questions.map((q) => {
      if (q.type === 'TRUE_FALSE') return 4;
      if (q.type === 'SHORT_ANSWER') return 2;
      if (q.type === 'ESSAY') return 4;
      return 1;
    });
    const sumW = weights.reduce((a, b) => a + b, 0);
    return questions.map((q, i) => ({
      ...q,
      points: Math.round(((weights[i] / sumW) * totalPoints) * 100) / 100,
    }));
  }

  const perQ = Math.round((totalPoints / questions.length) * 100) / 100;
  return questions.map((q) => ({ ...q, points: perQ }));
}

function isValidNumberAnswer(s: string): boolean {
  const norm = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(norm) && Number.isFinite(Number(norm));
}

export function validateQuestion(q: ExamQuestion): string[] {
  const warnings: string[] = [];
  if (!q.stem.trim() && !q.stemCropImage) {
    warnings.push('Nội dung câu hỏi đang trống');
  }
  if (q.type === 'ESSAY') {
    warnings.push('Câu Tự luận chưa thuộc 3 dạng tự chấm BGD 2025 — hãy chuyển loại hoặc xóa trước khi mở phòng');
    return warnings;
  }
  if (q.type === 'MULTIPLE_CHOICE') {
    warnings.push('Đang ở dạng Nhiều đáp án — hãy chọn 1 đáp án đúng (Phần I) hoặc chuyển sang Đúng–Sai (Phần II)');
  }
  if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') {
    if (q.options.length !== 4) {
      warnings.push(`Phần I cần đúng 4 phương án A–D (hiện có ${q.options.length})`);
    }
    const correctCount = q.options.filter((o) => o.isCorrect).length;
    if (correctCount === 0) {
      warnings.push('Chưa chọn đáp án đúng A/B/C/D');
    } else if (q.type === 'SINGLE_CHOICE' && correctCount > 1) {
      warnings.push('Phần I chỉ được chọn duy nhất 1 đáp án đúng');
    }
  } else if (q.type === 'TRUE_FALSE') {
    if (q.options.length !== 4) {
      warnings.push(`Phần II Đúng–Sai cần đúng 4 ý a, b, c, d (hiện có ${q.options.length})`);
    }
    const hasAnyDetected = q.options.some((o) => o.detectionSource);
    if (!hasAnyDetected) {
      warnings.push('Chưa xác nhận đáp án Đúng/Sai cho từng ý');
    }
  } else if (q.type === 'SHORT_ANSWER') {
    if (q.acceptedAnswers.length === 0) {
      warnings.push('Chưa nhập đáp số chuẩn cho câu trả lời ngắn');
    } else if (!q.acceptedAnswers.some(isValidNumberAnswer)) {
      warnings.push('Đáp số Phần III phải là giá trị số hợp lệ (VD: 12,5 hoặc -4)');
    }
  }
  return warnings;
}

export function computeParseStats(
  questions: ExamQuestion[],
  mathFormulasDetected: number,
  imagesExtracted: number,
  answerTableMatched: number
): ParseResult['stats'] {
  return {
    total: questions.length,
    singleChoice: questions.filter((q) => q.type === 'SINGLE_CHOICE').length,
    multipleChoice: questions.filter((q) => q.type === 'MULTIPLE_CHOICE').length,
    trueFalse: questions.filter((q) => q.type === 'TRUE_FALSE').length,
    shortAnswer: questions.filter((q) => q.type === 'SHORT_ANSWER').length,
    essay: questions.filter((q) => q.type === 'ESSAY').length,
    withAnswerKey: questions.filter((q) => {
      if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') {
        return q.options.some((o) => o.isCorrect);
      }
      if (q.type === 'TRUE_FALSE') return q.options.some((o) => Boolean(o.detectionSource));
      if (q.type === 'SHORT_ANSWER') return q.acceptedAnswers.length > 0;
      return false;
    }).length,
    withWarnings: questions.filter((q) => q.warnings.length > 0).length,
    mathFormulasDetected,
    imagesExtracted,
    answerTableMatched,
  };
}

function detectRepeatingHeaders(paragraphs: NormalizedParagraph[]): Set<string> {
  const counts = new Map<string, number>();
  for (const p of paragraphs) {
    const t = p.plainText.trim();
    if (
      t.length >= 8 &&
      t.length <= 90 &&
      !QUESTION_START_RE.test(t) &&
      !MC_OPTION_RE.test(t) &&
      !TF_OPTION_RE.test(t) &&
      !INLINE_CHOOSE_RE.test(t)
    ) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  const repeated = new Set<string>();
  for (const [txt, cnt] of counts.entries()) {
    if (cnt >= 3) repeated.add(txt);
  }
  return repeated;
}

function isImageOnlyParagraph(p: NormalizedParagraph): boolean {
  return p.plainText.trim() === '' && p.runs.length > 0 && p.runs.every((r) => r.kind === 'image');
}

function cleanHeaderTitle(raw: string): string {
  const segs = raw
    .replace(/^\[Bảng\]\s*/i, '')
    .split(/[\t|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return segs.find((s) => /đề|đê|kiểm tra|khảo sát|thi|ôn tập|exam|test/i.test(s)) ?? segs.join(' — ');
}

export function parseNormalizedParagraphsToExam(
  rawParagraphs: NormalizedParagraph[],
  opts: {
    sourceFileName: string;
    sourceFormat: ParseResult['sourceFormat'];
    defaultTitle?: string;
    mathFormulasDetected?: number;
    imagesExtracted?: number;
    startedAtMs?: number;
  }
): ParseResult {
  const t0 = opts.startedAtMs ?? performance.now();
  const repeatedHeaders = detectRepeatingHeaders(rawParagraphs);

  const paragraphs: NormalizedParagraph[] = [];
  let scanInTfPart = false;
  let scanInAnswerSection = false;
  for (const p of rawParagraphs) {
    const pt = normalizeMatchSpaces(p.plainText).trim();
    if (pt.startsWith('__TBL_PAIR__') || pt.startsWith('__TBL_PART__')) {
      paragraphs.push(p);
      continue;
    }
    if (ANSWER_TABLE_HEADING_RE.test(pt) || END_OF_EXAM_RE.test(pt)) {
      scanInAnswerSection = true;
      paragraphs.push(p);
      continue;
    }
    if (!scanInAnswerSection) {
      const pm = pt.match(PART_RE);
      if (pm && pt.length < 180) {
        scanInTfPart = inferPartHintType(pt) === 'TRUE_FALSE';
        paragraphs.push(p);
        continue;
      }
      const mcExpanded = splitSameLineMcOptions(p);
      for (const seg of mcExpanded) {
        const tfExpanded = splitInlineTrueFalseOptions(seg, scanInTfPart);
        paragraphs.push(...tfExpanded);
      }
    } else {
      paragraphs.push(p);
    }
  }

  let state: ParserState = 'HEADER';
  const defaultTitleVal = opts.defaultTitle || opts.sourceFileName.replace(/\.[^.]+$/, '');
  let detectedTitle = defaultTitleVal;
  let currentPartTitle: string | undefined;
  let currentPartIndex = 1;
  let partHintType: QuestionType | undefined;
  const partLocalCounter = new Map<number, number>();

  const questions: ExamQuestion[] = [];
  const optionBoldFlags = new Map<string, boolean[]>();
  const answerTableLines: string[] = [];

  let currentQ: ExamQuestion | null = null;
  let currentOption: ExamOption | null = null;
  let pendingLeadingImages: string[] = [];

  const finalizeQuestion = () => {
    if (!currentQ) return;

    if (currentQ.type === 'TRUE_FALSE') {
      for (const opt of currentQ.options) {
        if (!opt.detectionSource) {
          const flag = extractTrailingTrueFalseFlag(opt.content);
          if (flag.found) {
            opt.content = flag.cleanHtml;
            opt.isCorrect = flag.isCorrect;
            opt.detectionSource = 'inline_text';
          }
        }
      }
    }

    const hasExplicitKey = currentQ.options.some((o) => o.isCorrect);
    if (!hasExplicitKey && currentQ.options.length >= 2 && currentQ.type !== 'TRUE_FALSE') {
      const bolds = optionBoldFlags.get(currentQ.id) ?? [];
      const boldIndices = bolds
        .map((b, idx) => (b ? idx : -1))
        .filter((idx) => idx >= 0);
      if (boldIndices.length === 1) {
        currentQ.options[boldIndices[0]].isCorrect = true;
        currentQ.options[boldIndices[0]].detectionSource = 'bold';
      }
    }

    if (currentQ.options.length === 0) {
      if (
        partHintType === 'SHORT_ANSWER' ||
        currentQ.type === 'SHORT_ANSWER' ||
        currentQ.acceptedAnswers.length > 0 ||
        /\.{3,}|_{3,}|\[___+\]/.test(currentQ.stem)
      ) {
        currentQ.type = 'SHORT_ANSWER';
        if (currentQ.acceptedAnswers.length === 0) {
          const trailing = extractTrailingShortAnswer(currentQ.stem);
          if (trailing) {
            currentQ.stem = trailing.cleanStem;
            currentQ.acceptedAnswers = normalizeShortAnswerVariants(trailing.answer);
          }
        }
      } else {
        currentQ.type = 'ESSAY';
      }
    } else if (currentQ.type !== 'TRUE_FALSE') {
      const correctCount = currentQ.options.filter((o) => o.isCorrect).length;
      currentQ.type = correctCount > 1 ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE';
    }

    if (!questions.some((q) => q.id === currentQ!.id)) {
      questions.push(currentQ);
    }
    currentQ = null;
    currentOption = null;
  };

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx];
    const text = normalizeMatchSpaces(para.plainText).trim();
    const hasRichBlock = para.runs.some((r) => r.kind === 'image' || r.kind === 'html_table');
    if (!text && !hasRichBlock) continue;

    if (!hasRichBlock && NOISE_LINE_RE.test(text)) {
      continue;
    }
    if (!hasRichBlock && repeatedHeaders.has(text)) {
      if (state === 'HEADER' && detectedTitle === defaultTitleVal) {
        detectedTitle = cleanHeaderTitle(text);
      }
      continue;
    }

    if (isImageOnlyParagraph(para) && state !== 'ANSWER_TABLE') {
      const imgHtml = runsToContent(para.runs);
      let nextNonEmptyText = '';
      for (let k = pIdx + 1; k < paragraphs.length; k++) {
        const nt = normalizeMatchSpaces(paragraphs[k].plainText).trim();
        if (!nt || NOISE_LINE_RE.test(nt) || repeatedHeaders.has(nt)) continue;
        nextNonEmptyText = nt;
        break;
      }
      const nextIsNewQuestion = QUESTION_START_RE.test(nextNonEmptyText);
      const nextIsPart = PART_RE.test(nextNonEmptyText);

      let attachToNextQuestion = false;
      if (!currentQ) {
        attachToNextQuestion = true;
      } else if (nextIsNewQuestion && !nextIsPart) {
        const lastOpt = currentQ.options[currentQ.options.length - 1];
        const mcComplete =
          (currentQ.type === 'SINGLE_CHOICE' || currentQ.type === 'MULTIPLE_CHOICE') &&
          (currentQ.options.length >= 4 || (lastOpt && lastOpt.label.toUpperCase() >= 'D'));
        const tfComplete =
          currentQ.type === 'TRUE_FALSE' &&
          (currentQ.options.length >= 4 || (lastOpt && lastOpt.label.toLowerCase() >= 'd'));
        const stemExpectsFigureBelow = /(?:hình\s*(?:vẽ|bên\s*dưới|sau)|sơ\s*đồ\s*(?:bên\s*dưới|sau)|:\s*$)/i.test(
          currentQ.stem.replace(/<[^>]+>/g, '').trim()
        );
        const saComplete =
          (currentQ.type === 'SHORT_ANSWER' || partHintType === 'SHORT_ANSWER') &&
          currentQ.options.length === 0 &&
          !stemExpectsFigureBelow &&
          /(?:\?|\)\.)\s*(?:-?\d+(?:[.,]\d+)?)?\s*$/.test(currentQ.stem.replace(/<[^>]+>/g, '').trim());

        if (mcComplete || tfComplete || saComplete) {
          attachToNextQuestion = true;
        }
      }

      if (attachToNextQuestion) {
        pendingLeadingImages.push(imgHtml);
        continue;
      }
    }

    if (para.runs.length === 1 && para.runs[0].kind === 'html_table' && para.runs[0].tableHtml) {
      if (state === 'HEADER' && !currentQ && detectedTitle === defaultTitleVal) {
        const candidate = cleanHeaderTitle(text);
        if (candidate && /đề|đê|kiểm tra|khảo sát|thi|ôn tập/i.test(candidate)) {
          detectedTitle = candidate.slice(0, 120);
        }
      } else if (currentQ) {
        const tblHtml = para.runs[0].tableHtml;
        if (state === 'EXPLANATION') {
          currentQ.explanation = currentQ.explanation ? `${currentQ.explanation}${tblHtml}` : tblHtml;
        } else if (state === 'OPTIONS' && currentOption) {
          currentOption.content = currentOption.content ? `${currentOption.content}${tblHtml}` : tblHtml;
        } else {
          currentQ.stem = currentQ.stem ? `${currentQ.stem}${tblHtml}` : tblHtml;
        }
      }
      continue;
    }

    if (text.startsWith('__TBL_PAIR__') || text.startsWith('__TBL_PART__')) {
      finalizeQuestion();
      answerTableLines.push(text);
      continue;
    }

    if (END_OF_EXAM_RE.test(text)) {
      finalizeQuestion();
      state = 'ANSWER_TABLE';
      continue;
    }

    if (ANSWER_TABLE_HEADING_RE.test(text)) {
      finalizeQuestion();
      state = 'ANSWER_TABLE';
      continue;
    }

    if (state === 'ANSWER_TABLE') {
      const pmAns = text.match(PART_RE) ?? text.match(ANSWER_SUBPART_RE);
      if (pmAns && /phần|part|trắc nghiệm|đúng|trả lời|tự luận/i.test(text)) {
        answerTableLines.push(text);
        continue;
      }
      if (
        /^(?:Câu\s*)?\d+\s*[:.)\-]\s*(?:[A-H](?:\s*,\s*[A-H])*|[ĐSđsTFtf](?:[\s,\-/]*[ĐSđsTFtf]){3}|(?:[a-d]\s*[-:.)]?\s*(?:Đúng|Sai|Đ|S|T|F)[\s,;/]*){2,4}|-?\d+(?:[.,]\d+)?)\s*$/i.test(
          text
        )
      ) {
        answerTableLines.push(text);
        continue;
      }
      const qAfter = text.match(QUESTION_START_RE);
      if (qAfter) {
        const qNum = parseInt(qAfter[1], 10);
        const existing = questions.find((x) => x.index === qNum);
        if (existing) {
          const restText = qAfter[3] ?? '';
          const prefixLen = text.length - restText.length;
          const restContent = runsToContent(para.runs, prefixLen);
          const chooseInLine = restText.match(INLINE_CHOOSE_RE);
          if (chooseInLine) {
            applyAnswerKeyToQuestion(existing, chooseInLine[1], 'answer_table');
          } else if (restContent) {
            existing.explanation = existing.explanation
              ? `${existing.explanation}<br/>${restContent}`
              : restContent;
          }
          currentQ = existing;
          state = 'EXPLANATION';
          continue;
        }
      }
      answerTableLines.push(text);
      continue;
    }

    const partMatch = text.match(PART_RE);
    if (partMatch && text.length < 180) {
      finalizeQuestion();
      currentPartTitle = text;
      currentPartIndex = parsePartNumber(partMatch[1]);
      partHintType = inferPartHintType(text);
      state = 'HEADER';
      continue;
    }

    const qMatch = text.match(QUESTION_START_RE);
    if (qMatch) {
      finalizeQuestion();
      const writtenNum = parseInt(qMatch[1], 10);
      const nextLocal = (partLocalCounter.get(currentPartIndex) ?? 0) + 1;
      partLocalCounter.set(currentPartIndex, nextLocal);
      const localIndex = !isNaN(writtenNum) && writtenNum > 0 ? writtenNum : nextLocal;

      const parenMeta = qMatch[2] ?? '';
      const restText = qMatch[3] ?? '';
      const prefixLen = text.length - restText.length;
      let stemHtml = runsToContent(para.runs, prefixLen);

      if (pendingLeadingImages.length > 0) {
        const prefixImgs = pendingLeadingImages.join('<br/>');
        stemHtml = stemHtml ? `${prefixImgs}<br/>${stemHtml}` : prefixImgs;
        pendingLeadingImages = [];
      }

      let explicitPts = 0;
      const ptMatch = parenMeta.match(/(\d+(?:[.,]\d+)?)\s*(?:điểm|diem|đ|pt)/i);
      if (ptMatch) {
        explicitPts = parseFloat(ptMatch[1].replace(',', '.')) || 0;
      }

      currentQ = {
        id: uid('q'),
        index: questions.length + 1,
        partIndex: currentPartIndex,
        localIndex,
        partTitle: currentPartTitle,
        type: partHintType ?? 'SINGLE_CHOICE',
        stem: stemHtml,
        options: [],
        acceptedAnswers: [],
        explanation: '',
        points: explicitPts,
        isFixedPosition: false,
        lockOptionOrder: false,
        warnings: [],
      };
      optionBoldFlags.set(currentQ.id, []);
      currentOption = null;
      state = 'QUESTION_STEM';
      continue;
    }

    if (state === 'HEADER' && !currentQ) {
      if (
        text.length >= 6 &&
        text.length <= 200 &&
        /đề|đê|kiểm tra|khảo sát|thi|ôn tập|bài tập|exam|test/i.test(text) &&
        detectedTitle === defaultTitleVal
      ) {
        detectedTitle = cleanHeaderTitle(text).slice(0, 120);
      }
      continue;
    }

    if (!currentQ) continue;

    const expMatch = text.match(EXPLANATION_HEADING_RE);
    if (expMatch && state !== 'EXPLANATION') {
      state = 'EXPLANATION';
      currentOption = null;
      const prefixLen = text.length - (expMatch[1]?.length ?? 0);
      const content = runsToContent(para.runs, prefixLen);
      if (content) {
        currentQ.explanation = currentQ.explanation ? `${currentQ.explanation}<br/>${content}` : content;
      }
      continue;
    }

    const chooseMatch = text.match(INLINE_CHOOSE_RE);
    if (chooseMatch && text.length < 90) {
      const valStr = (chooseMatch[1] ?? '').trim();
      if (!valStr || /^[._…\s-]+$/.test(valStr)) {
        if (currentQ.options.length === 0) {
          currentQ.type = 'SHORT_ANSWER';
        }
        continue;
      }
      if (currentQ.options.length === 0) {
        currentQ.type = 'SHORT_ANSWER';
      }
      if (applyAnswerKeyToQuestion(currentQ, valStr, 'answer_table')) {
        continue;
      }
    }

    if (state === 'EXPLANATION') {
      const chunk = runsToContent(para.runs);
      if (chunk) {
        currentQ.explanation = currentQ.explanation ? `${currentQ.explanation}<br/>${chunk}` : chunk;
      }
      continue;
    }

    const tfMatch = text.match(TF_OPTION_RE);
    if (
      tfMatch &&
      (partHintType === 'TRUE_FALSE' ||
        currentQ.type === 'TRUE_FALSE' ||
        currentQ.options.length === 0 ||
        currentQ.options[0].label === currentQ.options[0].label.toLowerCase())
    ) {
      const hasStar = tfMatch[1] === '*';
      const label = tfMatch[2].toLowerCase();
      const prefixLen = text.length - (tfMatch[3]?.length ?? 0);
      let content = runsToContent(para.runs, prefixLen);
      const fmt = detectLabelFormatting(para.runs, Math.min(prefixLen, 3));

      let isCorrect = hasStar || Boolean(fmt.source);
      let detSource: AnswerDetectionSource | undefined = hasStar ? 'asterisk' : fmt.source;

      if (!detSource) {
        const inlineFlag = extractTrailingTrueFalseFlag(content);
        if (inlineFlag.found) {
          content = inlineFlag.cleanHtml;
          isCorrect = inlineFlag.isCorrect;
          detSource = 'inline_text';
        }
      }

      const opt: ExamOption = {
        id: uid('opt'),
        label,
        content,
        isCorrect,
        detectionSource: detSource,
      };
      currentQ.type = 'TRUE_FALSE';
      currentQ.options.push(opt);
      optionBoldFlags.get(currentQ.id)?.push(fmt.isBoldOnly);
      currentOption = opt;
      state = 'OPTIONS';
      continue;
    }

    const mcMatch = text.match(MC_OPTION_RE);
    if (mcMatch) {
      const hasStar = mcMatch[1] === '*';
      const label = mcMatch[2].toUpperCase();
      const prefixLen = text.length - (mcMatch[3]?.length ?? 0);
      const content = runsToContent(para.runs, prefixLen);
      const fmt = detectLabelFormatting(para.runs, Math.min(prefixLen, 3));

      const isCorrect = hasStar || Boolean(fmt.source);
      const opt: ExamOption = {
        id: uid('opt'),
        label,
        content,
        isCorrect,
        detectionSource: hasStar ? 'asterisk' : fmt.source,
      };
      currentQ.options.push(opt);
      optionBoldFlags.get(currentQ.id)?.push(fmt.isBoldOnly);
      currentOption = opt;
      state = 'OPTIONS';
      continue;
    }

    const htmlChunk = runsToContent(para.runs);
    if (!htmlChunk) continue;
    const isMedia = htmlChunk.startsWith('<img') || htmlChunk.startsWith('<div class="exam-table-wrap"');
    if (state === 'OPTIONS' && currentOption) {
      currentOption.content = currentOption.content
        ? `${currentOption.content}${isMedia ? '' : ' '}${htmlChunk}`
        : htmlChunk;
    } else {
      currentQ.stem = currentQ.stem
        ? `${currentQ.stem}${isMedia ? '' : '<br/>'}${htmlChunk}`
        : htmlChunk;
    }
  }

  finalizeQuestion();

  let answerTableMatched = 0;
  if (answerTableLines.length > 0) {
    const parsedKeys = parseMultiPartAnswerKey(answerTableLines);
    const typeSeqCounter = new Map<QuestionType, number>();

    for (const q of questions) {
      const nextTypeSeq = (typeSeqCounter.get(q.type) ?? 0) + 1;
      typeSeqCounter.set(q.type, nextTypeSeq);

      let keyVal: string | undefined;
      if (parsedKeys.hasPartHeaders) {
        if (q.partIndex !== undefined && q.localIndex !== undefined) {
          keyVal = parsedKeys.byPartAndLocal.get(`${q.partIndex}:${q.localIndex}`);
        }
        if (!keyVal && q.localIndex !== undefined) {
          keyVal = parsedKeys.byTypeAndLocal.get(`${q.type}:${q.localIndex}`);
        }
        if (!keyVal) {
          keyVal = parsedKeys.byTypeAndLocal.get(`${q.type}:${nextTypeSeq}`);
        }
      } else {
        keyVal = parsedKeys.byGlobal.get(q.index);
      }

      if (keyVal && applyAnswerKeyToQuestion(q, keyVal, 'answer_table')) {
        answerTableMatched++;
      }
    }
  }

  const hasExplicitAll = questions.length > 0 && questions.every((q) => q.points > 0);
  const scoredQuestions = (hasExplicitAll ? questions : distributeExamPoints(questions, 10)).map((q) => ({
    ...q,
    warnings: validateQuestion(q),
  }));

  const rawPreviewText = rawParagraphs
    .filter((p) => !p.plainText.startsWith('__TBL_PAIR__') && !p.plainText.startsWith('__TBL_PART__'))
    .map((p) => p.plainText)
    .join('\n');

  return {
    title: detectedTitle,
    sourceFileName: opts.sourceFileName,
    sourceFormat: opts.sourceFormat,
    questions: scoredQuestions,
    stats: computeParseStats(
      scoredQuestions,
      opts.mathFormulasDetected ?? 0,
      opts.imagesExtracted ?? 0,
      answerTableMatched
    ),
    rawPreviewText,
    parseDurationMs: Math.max(1, Math.round(performance.now() - t0)),
  };
}
