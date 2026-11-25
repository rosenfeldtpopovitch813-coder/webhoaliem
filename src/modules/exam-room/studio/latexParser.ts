import type { ExamOption, ExamQuestion, NormalizedParagraph, ParseResult } from './types';
import { computeParseStats, distributeExamPoints, parseNormalizedParagraphsToExam, validateQuestion } from './examFsm';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function readBraceGroup(str: string, startIdx: number): { content: string; nextIdx: number } | null {
  let i = startIdx;
  while (i < str.length && /\s/.test(str[i])) i++;
  if (str[i] !== '{') return null;
  let depth = 0;
  const contentStart = i + 1;
  for (; i < str.length; i++) {
    if (str[i] === '\\') {
      i++;
      continue;
    }
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        return { content: str.slice(contentStart, i), nextIdx: i + 1 };
      }
    }
  }
  return null;
}

export function parseLatexExam(texSource: string, fileName = 'de-thi.tex'): ParseResult {
  const t0 = performance.now();
  const clean = texSource.replace(/(^|[^\\])%.*$/gm, '$1');
  const exRe = /\\begin\{ex\}([\s\S]*?)\\end\{ex\}/g;
  const questions: ExamQuestion[] = [];
  const mathCount = (clean.match(/\$[^$]+\$/g) || []).length;

  let m: RegExpExecArray | null;
  let idx = 1;
  while ((m = exRe.exec(clean)) !== null) {
    let body = m[1].trim();
    let explanation = '';
    const options: ExamOption[] = [];
    const acceptedAnswers: string[] = [];
    let type: ExamQuestion['type'] = 'ESSAY';

    const lgIdx = body.indexOf('\\loigiai');
    if (lgIdx !== -1) {
      const grp = readBraceGroup(body, lgIdx + '\\loigiai'.length);
      if (grp) {
        explanation = grp.content.trim();
        body = (body.slice(0, lgIdx) + body.slice(grp.nextIdx)).trim();
      }
    }

    const tfIdx = body.indexOf('\\choiceTF');
    const mcIdx = tfIdx === -1 ? body.indexOf('\\choice') : -1;
    const saIdx = body.indexOf('\\shortans');

    if (tfIdx !== -1) {
      type = 'TRUE_FALSE';
      let cursor = tfIdx + '\\choiceTF'.length;
      const labels = ['a', 'b', 'c', 'd', 'e', 'f'];
      for (let k = 0; k < 6; k++) {
        const grp = readBraceGroup(body, cursor);
        if (!grp) break;
        const isTrue = /\\True\b/.test(grp.content);
        options.push({
          id: uid('opt'),
          label: labels[k],
          content: grp.content.replace(/\\True\b/g, '').trim(),
          isCorrect: isTrue,
          detectionSource: 'latex',
        });
        cursor = grp.nextIdx;
      }
      body = body.slice(0, tfIdx).trim();
    } else if (mcIdx !== -1) {
      let cursor = mcIdx + '\\choice'.length;
      const optBracket = body.slice(cursor).match(/^\s*\[[^\]]*\]/);
      if (optBracket) cursor += optBracket[0].length;
      const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
      for (let k = 0; k < 6; k++) {
        const grp = readBraceGroup(body, cursor);
        if (!grp) break;
        const isTrue = /\\True\b/.test(grp.content);
        options.push({
          id: uid('opt'),
          label: labels[k],
          content: grp.content.replace(/\\True\b/g, '').trim(),
          isCorrect: isTrue,
          detectionSource: isTrue ? 'latex' : undefined,
        });
        cursor = grp.nextIdx;
      }
      const correctCount = options.filter((o) => o.isCorrect).length;
      type = correctCount > 1 ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE';
      body = body.slice(0, mcIdx).trim();
    } else if (saIdx !== -1) {
      type = 'SHORT_ANSWER';
      let cursor = saIdx + '\\shortans'.length;
      const optBracket = body.slice(cursor).match(/^\s*\[[^\]]*\]/);
      if (optBracket) cursor += optBracket[0].length;
      const grp = readBraceGroup(body, cursor);
      if (grp) {
        const ans = grp.content.replace(/^\$|\$$/g, '').trim();
        if (ans) {
          acceptedAnswers.push(ans);
          if (ans.includes(',')) acceptedAnswers.push(ans.replace(/,/g, '.'));
          if (ans.includes('.')) acceptedAnswers.push(ans.replace(/\./g, ','));
        }
      }
      body = body.slice(0, saIdx).trim();
    }

    const stem = body.replace(/^\[[^\]]+\]\s*/, '').trim();

    questions.push({
      id: uid('q'),
      index: idx++,
      partIndex: type === 'TRUE_FALSE' ? 2 : type === 'SHORT_ANSWER' ? 3 : 1,
      type,
      stem,
      options,
      acceptedAnswers: [...new Set(acceptedAnswers)],
      explanation,
      points: 0,
      isFixedPosition: false,
      lockOptionOrder: false,
      warnings: [],
    });
  }

  if (questions.length === 0) {
    return parsePlainTextExam(texSource, fileName);
  }

  const scored = distributeExamPoints(questions, 10).map((q) => ({
    ...q,
    warnings: validateQuestion(q),
  }));

  return {
    title: fileName.replace(/\.[^.]+$/, ''),
    sourceFileName: fileName,
    sourceFormat: 'latex',
    questions: scored,
    stats: computeParseStats(scored, mathCount, 0, 0),
    rawPreviewText: texSource,
    parseDurationMs: Math.max(1, Math.round(performance.now() - t0)),
  };
}

export function parsePlainTextExam(rawText: string, fileName = 'de-thi-dan-nhanh.txt'): ParseResult {
  const t0 = performance.now();
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const mathCount = (rawText.match(/\$[^$]+\$/g) || []).length;
  let imagesCount = 0;

  const paragraphs: NormalizedParagraph[] = lines.map((line, idx) => {
    const trimmed = line.trim();
    const mdImg = trimmed.match(/^!\[[^\]]*\]\(([^)\s]+)\)$/);
    if (mdImg) {
      imagesCount++;
      return {
        id: `txt_img_${idx}`,
        runs: [{ text: '', kind: 'image', imageDataUrl: mdImg[1] }],
        plainText: '',
      };
    }
    const htmlImg = trimmed.match(/^<img\b[^>]+src=["']([^"']+)["'][^>]*\/?>$/i);
    if (htmlImg) {
      imagesCount++;
      return {
        id: `txt_img_${idx}`,
        runs: [{ text: '', kind: 'image', imageDataUrl: htmlImg[1] }],
        plainText: '',
      };
    }
    const tokImg = trimmed.match(/^\[\[IMG:([^\]]+)\]\]$/);
    if (tokImg) {
      imagesCount++;
      return {
        id: `txt_img_${idx}`,
        runs: [{ text: '', kind: 'image', imageDataUrl: tokImg[1] }],
        plainText: '',
      };
    }
    return {
      id: `txt_${idx}`,
      runs: [{ text: line, kind: 'text' }],
      plainText: line,
    };
  });

  return parseNormalizedParagraphsToExam(paragraphs, {
    sourceFileName: fileName,
    sourceFormat: 'text',
    mathFormulasDetected: mathCount,
    imagesExtracted: imagesCount,
    startedAtMs: t0,
  });
}
