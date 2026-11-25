import JSZip from 'jszip';
import type { NormalizedParagraph, ParseResult, StyledRun } from './types';
import { ommlElementToLatex } from './ommlToLatex';
import { parseNormalizedParagraphsToExam, runsToContent } from './examFsm';
import { convertMetafileToDataUrl } from './metafileToSvg';
import { compressDataUrlForExam } from './imageCompression';

interface NumberingLevelSpec {
  numFmt: string;
  lvlText: string;
  start: number;
}

interface NumberingRegistry {
  abstractLevels: Map<string, Map<number, NumberingLevelSpec>>;
  numToAbstract: Map<string, string>;
  counters: Map<string, number>;
}

interface StyleFormatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  colorHex?: string;
}

function localName(el: Element): string {
  return el.localName || el.tagName.replace(/^.*:/, '');
}

function childElements(el: Element): Element[] {
  const res: Element[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const n = el.childNodes[i];
    if (n.nodeType === 1) res.push(n as Element);
  }
  return res;
}

function findChild(el: Element, name: string): Element | undefined {
  return childElements(el).find((c) => localName(c) === name);
}

function getAttr(el: Element | undefined, attr: string): string | undefined {
  if (!el) return undefined;
  const direct = el.getAttribute(`w:${attr}`) ?? el.getAttribute(`r:${attr}`) ?? el.getAttribute(attr);
  if (direct !== null && direct !== undefined) return direct;
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    const ln = a.localName || a.name.replace(/^.*:/, '');
    if (ln === attr) return a.value;
  }
  return undefined;
}

function mimeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'bmp':
      return 'image/bmp';
    default:
      return '';
  }
}

function formatNumValue(val: number, fmt: string): string {
  if (fmt === 'upperLetter') {
    return String.fromCharCode(64 + Math.max(1, Math.min(26, val)));
  }
  if (fmt === 'lowerLetter') {
    return String.fromCharCode(96 + Math.max(1, Math.min(26, val)));
  }
  if (fmt === 'upperRoman') {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return romans[val - 1] ?? String(val);
  }
  return String(val);
}

function parseNumberingXml(xmlText: string | null): NumberingRegistry {
  const reg: NumberingRegistry = {
    abstractLevels: new Map(),
    numToAbstract: new Map(),
    counters: new Map(),
  };
  if (!xmlText) return reg;

  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const root = doc.documentElement;
  if (!root) return reg;

  for (const child of childElements(root)) {
    const name = localName(child);
    if (name === 'abstractNum') {
      const absId = getAttr(child, 'abstractNumId');
      if (!absId) continue;
      const lvlMap = new Map<number, NumberingLevelSpec>();
      for (const lvl of childElements(child)) {
        if (localName(lvl) !== 'lvl') continue;
        const ilvl = parseInt(getAttr(lvl, 'ilvl') ?? '0', 10);
        const numFmt = getAttr(findChild(lvl, 'numFmt'), 'val') ?? 'decimal';
        const lvlText = getAttr(findChild(lvl, 'lvlText'), 'val') ?? '%1.';
        const start = parseInt(getAttr(findChild(lvl, 'start'), 'val') ?? '1', 10);
        lvlMap.set(ilvl, { numFmt, lvlText, start });
      }
      reg.abstractLevels.set(absId, lvlMap);
    } else if (name === 'num') {
      const numId = getAttr(child, 'numId');
      const absId = getAttr(findChild(child, 'abstractNumId'), 'val');
      if (numId && absId) reg.numToAbstract.set(numId, absId);
    }
  }
  return reg;
}

function nextListPrefix(reg: NumberingRegistry, numId: string, ilvl: number): string | undefined {
  const absId = reg.numToAbstract.get(numId);
  if (!absId) return undefined;
  const spec = reg.abstractLevels.get(absId)?.get(ilvl);
  if (!spec || spec.numFmt === 'bullet' || spec.numFmt === 'none') return undefined;

  const key = `${numId}:${ilvl}`;
  const current = reg.counters.has(key) ? reg.counters.get(key)! + 1 : spec.start;
  reg.counters.set(key, current);

  for (let d = ilvl + 1; d <= 8; d++) {
    reg.counters.delete(`${numId}:${d}`);
  }

  const formatted = formatNumValue(current, spec.numFmt);
  return spec.lvlText.replace(/%\d+/g, formatted) + ' ';
}

function parseStylesXml(xmlText: string | null): Map<string, StyleFormatting> {
  const styles = new Map<string, StyleFormatting>();
  if (!xmlText) return styles;
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const root = doc.documentElement;
  if (!root) return styles;

  for (const st of childElements(root)) {
    if (localName(st) !== 'style') continue;
    const styleId = getAttr(st, 'styleId');
    if (!styleId) continue;
    const rPr = findChild(st, 'rPr');
    if (!rPr) continue;
    styles.set(styleId, extractRunProps(rPr));
  }
  return styles;
}

function extractRunProps(
  rPr: Element | undefined,
  base?: StyleFormatting
): StyleFormatting & { highlight?: string; vanish?: boolean } {
  if (!rPr) return { ...base };
  const bEl = findChild(rPr, 'b');
  const iEl = findChild(rPr, 'i');
  const uEl = findChild(rPr, 'u');
  const colorEl = findChild(rPr, 'color');
  const hlEl = findChild(rPr, 'highlight');
  const shdEl = findChild(rPr, 'shd');
  const vanishEl = findChild(rPr, 'vanish');

  const boolVal = (el: Element | undefined, fallback?: boolean) => {
    if (!el) return fallback;
    const v = getAttr(el, 'val');
    if (v === '0' || v === 'false' || v === 'none') return false;
    return true;
  };

  const uVal = uEl ? getAttr(uEl, 'val') : undefined;
  const underline = uEl ? uVal !== 'none' && uVal !== '0' && uVal !== 'false' : base?.underline;

  const colorHex = colorEl ? getAttr(colorEl, 'val') : base?.colorHex;
  let highlight = hlEl ? getAttr(hlEl, 'val') : undefined;
  if (!highlight && shdEl) {
    const fill = getAttr(shdEl, 'fill');
    if (
      fill &&
      fill.toUpperCase() !== 'AUTO' &&
      fill.toUpperCase() !== 'FFFFFF' &&
      fill.toUpperCase() !== 'CLEAR'
    ) {
      highlight = fill;
    }
  }

  return {
    bold: boolVal(bEl, base?.bold),
    italic: boolVal(iEl, base?.italic),
    underline,
    colorHex,
    highlight,
    vanish: boolVal(vanishEl, false),
  };
}

function extractImagesFromGraphicNode(
  container: Element,
  relMediaMap: Map<string, string>
): string[] {
  const seenRIds = new Set<string>();
  const urls: string[] = [];

  const allDesc = Array.from(container.getElementsByTagName('*'));
  for (const el of allDesc) {
    const name = localName(el);
    if (name !== 'blip' && name !== 'imagedata' && name !== 'svgBlip') continue;
    const rId =
      getAttr(el, 'embed') ??
      getAttr(el, 'id') ??
      getAttr(el, 'relid') ??
      getAttr(el, 'link');
    if (rId && !seenRIds.has(rId) && relMediaMap.has(rId)) {
      seenRIds.add(rId);
      urls.push(relMediaMap.get(rId)!);
    }
  }
  return urls;
}

function extractParagraph(
  pEl: Element,
  idx: number,
  relMediaMap: Map<string, string>,
  numbering: NumberingRegistry,
  styles: Map<string, StyleFormatting>,
  counters: { math: number; images: number }
): NormalizedParagraph {
  const runs: StyledRun[] = [];
  const pPr = findChild(pEl, 'pPr');
  let listPrefix: string | undefined;

  const pStyleId = getAttr(pPr ? findChild(pPr, 'pStyle') : undefined, 'val');
  const pBaseStyle = pStyleId ? styles.get(pStyleId) : undefined;
  const pRPr = pPr ? findChild(pPr, 'rPr') : undefined;
  const pRunStyle = extractRunProps(pRPr, pBaseStyle);

  const numPr = pPr ? findChild(pPr, 'numPr') : undefined;
  if (numPr) {
    const numId = getAttr(findChild(numPr, 'numId'), 'val');
    const ilvl = parseInt(getAttr(findChild(numPr, 'ilvl'), 'val') ?? '0', 10);
    if (numId && numId !== '0') {
      listPrefix = nextListPrefix(numbering, numId, ilvl);
    }
  }

  if (listPrefix) {
    runs.push({
      text: listPrefix,
      kind: 'text',
      bold: pRunStyle.bold,
      italic: pRunStyle.italic,
      underline: pRunStyle.underline,
      colorHex: pRunStyle.colorHex,
      highlight: pRunStyle.highlight,
    });
  }

  const pushGraphicImages = (el: Element) => {
    const imgUrls = extractImagesFromGraphicNode(el, relMediaMap);
    for (const url of imgUrls) {
      counters.images++;
      runs.push({ text: '', kind: 'image', imageDataUrl: url });
    }
    const txbx = Array.from(el.getElementsByTagName('*')).find((d) => localName(d) === 'txbxContent');
    if (txbx) {
      for (const tp of childElements(txbx)) {
        if (localName(tp) === 'p') {
          const inner = extractParagraph(tp, idx + 10000, relMediaMap, numbering, styles, counters);
          runs.push(...inner.runs);
        }
      }
    }
  };

  const handleAlternateContent = (altEl: Element) => {
    const choice = findChild(altEl, 'Choice');
    const fallback = findChild(altEl, 'Fallback');
    const beforeLen = runs.length;
    if (choice) {
      for (const c of childElements(choice)) walkNode(c);
    }
    if (runs.length === beforeLen && fallback) {
      for (const c of childElements(fallback)) walkNode(c);
    }
  };

  const walkRunChild = (
    c: Element,
    props: StyleFormatting & { highlight?: string; vanish?: boolean }
  ) => {
    const cTag = localName(c);
    if (cTag === 't' || cTag === 'delText') {
      if (cTag === 'delText') return;
      const text = c.textContent ?? '';
      if (text) {
        runs.push({
          text,
          kind: 'text',
          bold: props.bold,
          italic: props.italic,
          underline: props.underline,
          colorHex: props.colorHex,
          highlight: props.highlight,
        });
      }
    } else if (cTag === 'tab') {
      runs.push({ text: '\t', kind: 'tab' });
    } else if (cTag === 'br' || cTag === 'cr') {
      runs.push({ text: '\n', kind: 'break' });
    } else if (cTag === 'drawing' || cTag === 'pict' || cTag === 'object') {
      pushGraphicImages(c);
    } else if (cTag === 'AlternateContent') {
      const choice = findChild(c, 'Choice');
      const fallback = findChild(c, 'Fallback');
      const before = runs.length;
      if (choice) {
        for (const ch of childElements(choice)) walkRunChild(ch, props);
      }
      if (runs.length === before && fallback) {
        for (const fb of childElements(fallback)) walkRunChild(fb, props);
      }
    } else if (cTag === 'oMath') {
      const tex = ommlElementToLatex(c);
      if (tex) {
        counters.math++;
        runs.push({ text: tex, kind: 'math_inline' });
      }
    }
  };

  const walkNode = (node: Element) => {
    const tag = localName(node);
    if (tag === 'del' || tag === 'moveFrom') return;

    if (tag === 'AlternateContent') {
      handleAlternateContent(node);
      return;
    }

    if (
      tag === 'ins' ||
      tag === 'hyperlink' ||
      tag === 'smartTag' ||
      tag === 'sdt' ||
      tag === 'sdtContent' ||
      tag === 'fldSimple'
    ) {
      for (const c of childElements(node)) walkNode(c);
      return;
    }

    if (tag === 'drawing' || tag === 'pict' || tag === 'object') {
      pushGraphicImages(node);
      return;
    }

    if (tag === 'oMathPara') {
      const tex = ommlElementToLatex(node);
      if (tex) {
        counters.math++;
        runs.push({ text: tex, kind: 'math_block' });
      }
      return;
    }

    if (tag === 'oMath') {
      const tex = ommlElementToLatex(node);
      if (tex) {
        counters.math++;
        runs.push({ text: tex, kind: 'math_inline' });
      }
      return;
    }

    if (tag === 'r') {
      const rPr = findChild(node, 'rPr');
      const rStyleId = getAttr(rPr ? findChild(rPr, 'rStyle') : undefined, 'val');
      const inherited = { ...pRunStyle, ...(rStyleId ? styles.get(rStyleId) : undefined) };
      const props = extractRunProps(rPr, inherited);
      if (props.vanish) return;

      for (const c of childElements(node)) {
        if (localName(c) === 'rPr') continue;
        walkRunChild(c, props);
      }
    }
  };

  for (const child of childElements(pEl)) {
    if (localName(child) === 'pPr') continue;
    walkNode(child);
  }

  const coalesced: StyledRun[] = [];
  for (const r of runs) {
    const prev = coalesced[coalesced.length - 1];
    if (
      prev &&
      prev.kind === 'text' &&
      r.kind === 'text' &&
      prev.bold === r.bold &&
      prev.italic === r.italic &&
      prev.underline === r.underline &&
      prev.colorHex === r.colorHex &&
      prev.highlight === r.highlight
    ) {
      prev.text += r.text;
    } else {
      coalesced.push(r);
    }
  }

  const plainText = coalesced
    .map((r) => {
      if (r.kind === 'text') return r.text;
      if (r.kind === 'tab') return '\t';
      if (r.kind === 'math_inline') return `$${r.text}$`;
      if (r.kind === 'math_block') return `$$${r.text}$$`;
      return '';
    })
    .join('');

  return {
    id: `p_${idx}`,
    listPrefix,
    runs: coalesced,
    plainText,
  };
}

function splitParagraphBySoftBreaks(para: NormalizedParagraph): NormalizedParagraph[] {
  if (!para.runs.some((r) => r.kind === 'break')) return [para];

  const segments: StyledRun[][] = [];
  let curr: StyledRun[] = [];
  for (const run of para.runs) {
    if (run.kind === 'break') {
      segments.push(curr);
      curr = [];
    } else {
      curr.push(run);
    }
  }
  segments.push(curr);

  const out: NormalizedParagraph[] = [];
  segments.forEach((segRuns, sIdx) => {
    const plain = segRuns
      .map((r) => {
        if (r.kind === 'text') return r.text;
        if (r.kind === 'tab') return '\t';
        if (r.kind === 'math_inline') return `$${r.text}$`;
        if (r.kind === 'math_block') return `$$${r.text}$$`;
        return '';
      })
      .join('');
    const hasMedia = segRuns.some((r) => r.kind === 'image' || r.kind === 'html_table');
    if (plain.trim() || hasMedia) {
      out.push({
        id: `${para.id}_br${sIdx}`,
        listPrefix: sIdx === 0 ? para.listPrefix : undefined,
        runs: segRuns,
        plainText: plain,
      });
    }
  });
  return out.length > 0 ? out : [para];
}

interface ParsedCell {
  paras: NormalizedParagraph[];
  colspan: number;
  vMerge: 'none' | 'restart' | 'continue';
  rowspan: number;
  skip: boolean;
  isHeader: boolean;
}

function extractTable(
  tblEl: Element,
  baseIdx: number,
  relMediaMap: Map<string, string>,
  numbering: NumberingRegistry,
  styles: Map<string, StyleFormatting>,
  counters: { math: number; images: number }
): NormalizedParagraph[] {
  const matrix: ParsedCell[][] = [];
  let pCounter = baseIdx;

  for (const tr of childElements(tblEl)) {
    if (localName(tr) !== 'tr') continue;
    const trPr = findChild(tr, 'trPr');
    const isRowHeader = Boolean(trPr && findChild(trPr, 'tblHeader'));
    const rowCells: ParsedCell[] = [];

    for (const tc of childElements(tr)) {
      if (localName(tc) !== 'tc') continue;
      const tcPr = findChild(tc, 'tcPr');
      const gridSpanVal = parseInt(getAttr(tcPr ? findChild(tcPr, 'gridSpan') : undefined, 'val') ?? '1', 10);
      const colspan = Math.max(1, isNaN(gridSpanVal) ? 1 : gridSpanVal);

      const vMergeEl = tcPr ? findChild(tcPr, 'vMerge') : undefined;
      let vMerge: ParsedCell['vMerge'] = 'none';
      if (vMergeEl) {
        const val = getAttr(vMergeEl, 'val');
        vMerge = val === 'restart' ? 'restart' : 'continue';
      }

      const cellParas: NormalizedParagraph[] = [];
      for (const child of childElements(tc)) {
        const cTag = localName(child);
        if (cTag === 'p') {
          const p = extractParagraph(child, pCounter++, relMediaMap, numbering, styles, counters);
          if (p.plainText.trim().length > 0 || p.runs.some((r) => r.kind === 'image' || r.kind === 'html_table')) {
            cellParas.push(p);
          }
        } else if (cTag === 'tbl') {
          cellParas.push(...extractTable(child, pCounter++, relMediaMap, numbering, styles, counters));
        }
      }

      rowCells.push({
        paras: cellParas,
        colspan,
        vMerge,
        rowspan: 1,
        skip: false,
        isHeader: isRowHeader,
      });
    }
    if (rowCells.length > 0) matrix.push(rowCells);
  }

  if (matrix.length === 0) return [];

  for (let r = 0; r < matrix.length; r++) {
    let colCursor = 0;
    for (let c = 0; c < matrix[r].length; c++) {
      const cell = matrix[r][c];
      if (cell.vMerge === 'restart') {
        let span = 1;
        for (let nr = r + 1; nr < matrix.length; nr++) {
          let nextCol = 0;
          const match = matrix[nr].find((nc) => {
            const ok = nextCol === colCursor;
            nextCol += nc.colspan;
            return ok;
          });
          if (match && match.vMerge === 'continue') {
            match.skip = true;
            span++;
          } else {
            break;
          }
        }
        cell.rowspan = span;
      } else if (cell.vMerge === 'continue') {
        cell.skip = true;
      }
      colCursor += cell.colspan;
    }
  }

  const cellTexts = matrix.map((r) =>
    r.map((c) => c.paras.map((p) => p.plainText.trim()).join(' ').trim())
  );

  const ANS_CELL_RE =
    /^(?:[A-H](?:[\s,;-]+[A-H])*|[ĐSđsTFtf](?:[-,;\s/]*[ĐSđsTFtf]){3}|(?:[a-d]\s*[-:.)]?\s*[ĐSđsTFtf][\s,;/]*){2,4}|-?\d+(?:[.,]\d+)?)$/;
  const QNUM_CELL_RE = /^(?:Câu\s*)?(\d+)\.?$/i;
  const PART_CELL_RE = /^(?:PHẦN|Phần|PHAN|PART)\s+([IVX\d]+)/i;

  const ansOutputParas: NormalizedParagraph[] = [];
  let totalAnsPairs = 0;

  for (let r = 0; r < cellTexts.length; r++) {
    const rCurr = cellTexts[r];
    const rowJoined = rCurr.filter(Boolean).join(' ').trim();
    const partM = rowJoined.match(PART_CELL_RE);
    if (partM && rCurr.filter(Boolean).length <= 2) {
      ansOutputParas.push({
        id: `tbl_part_${baseIdx}_${r}`,
        runs: [{ text: `__TBL_PART__${rowJoined}`, kind: 'text' }],
        plainText: `__TBL_PART__${rowJoined}`,
      });
      continue;
    }
    if (r + 1 < cellTexts.length) {
      const rNext = cellTexts[r + 1];
      if (rCurr.length === rNext.length && rCurr.length >= 2) {
        let numCount = 0;
        let ansCount = 0;
        for (let c = 0; c < rCurr.length; c++) {
          if (QNUM_CELL_RE.test(rCurr[c])) numCount++;
          if (ANS_CELL_RE.test(rNext[c])) ansCount++;
        }
        if (numCount >= 2 && ansCount >= 2) {
          const rowPairs: string[] = [];
          for (let c = 0; c < rCurr.length; c++) {
            const numMatch = rCurr[c].match(QNUM_CELL_RE);
            if (numMatch && rNext[c] && ANS_CELL_RE.test(rNext[c])) {
              rowPairs.push(`${numMatch[1]}=${rNext[c]}`);
              totalAnsPairs++;
            }
          }
          if (rowPairs.length >= 2) {
            ansOutputParas.push({
              id: `tbl_ans_${baseIdx}_${r}`,
              runs: [{ text: `__TBL_PAIR__${rowPairs.join('||')}`, kind: 'text' }],
              plainText: `__TBL_PAIR__${rowPairs.join('||')}`,
            });
          }
          r++;
          continue;
        }
      }
    }
  }

  if (totalAnsPairs < 2 && cellTexts.length >= 2) {
    const vertPairs: string[] = [];
    for (let r = 0; r < cellTexts.length; r++) {
      const row = cellTexts[r];
      for (let c = 0; c + 1 < row.length; c += 2) {
        const nm = row[c].match(QNUM_CELL_RE);
        const val = row[c + 1];
        if (nm && val && ANS_CELL_RE.test(val)) {
          vertPairs.push(`${nm[1]}=${val}`);
        }
      }
    }
    const nonHeaderRows = cellTexts.length - (/(?:câu|đáp án|mã đề)/i.test(cellTexts[0].join(' ')) ? 1 : 0);
    if (vertPairs.length >= 2 && vertPairs.length >= nonHeaderRows) {
      return [
        {
          id: `tbl_ans_v_${baseIdx}`,
          runs: [{ text: `__TBL_PAIR__${vertPairs.join('||')}`, kind: 'text' }],
          plainText: `__TBL_PAIR__${vertPairs.join('||')}`,
        },
      ];
    }
  }

  if (totalAnsPairs >= 2) {
    return ansOutputParas;
  }

  const nonEmptyCells = matrix.flat().filter((c) => !c.skip && c.paras.length > 0);
  const optionCells = nonEmptyCells.filter((c) =>
    /^\*?[A-H]\s*[.)]/.test(c.paras[0]?.plainText.trim() ?? '')
  );
  if (
    optionCells.length >= 2 &&
    optionCells.length === nonEmptyCells.length &&
    matrix.length <= 4
  ) {
    return nonEmptyCells.flatMap((c) => c.paras);
  }

  const trHtmls: string[] = [];
  matrix.forEach((row, rIdx) => {
    const tdHtmls: string[] = [];
    for (const cell of row) {
      if (cell.skip) continue;
      const cellContent = cell.paras.map((p) => runsToContent(p.runs)).join('<br/>') || '&nbsp;';
      const tag = cell.isHeader || (rIdx === 0 && matrix.length >= 2 && row.length >= 2 && cell.paras.every((p) => p.runs.every((r) => r.kind !== 'text' || r.bold)))
        ? 'th'
        : 'td';
      const csAttr = cell.colspan > 1 ? ` colspan="${cell.colspan}"` : '';
      const rsAttr = cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : '';
      tdHtmls.push(`<${tag}${csAttr}${rsAttr}>${cellContent}</${tag}>`);
    }
    if (tdHtmls.length > 0) {
      trHtmls.push(`<tr>${tdHtmls.join('')}</tr>`);
    }
  });

  const tableHtml = `<div class="exam-table-wrap"><table class="exam-table"><tbody>${trHtmls.join('')}</tbody></table></div>`;
  const plainSummary = cellTexts.map((r) => r.join(' | ')).join('\n');

  return [
    {
      id: `tbl_html_${baseIdx}`,
      runs: [{ text: '', kind: 'html_table', tableHtml }],
      plainText: `[Bảng]\n${plainSummary}`,
    },
  ];
}

export async function parseDocxBuffer(buffer: ArrayBuffer, fileName = 'de-thi.docx'): Promise<ParseResult> {
  const t0 = performance.now();
  const zip = await JSZip.loadAsync(buffer);

  const zipIndex = new Map<string, JSZip.JSZipObject>();
  zip.forEach((relPath, entry) => {
    zipIndex.set(relPath.toLowerCase().replace(/^\/+/, ''), entry);
  });
  const getZipEntry = (p: string) => zipIndex.get(p.toLowerCase().replace(/^\/+/, ''));

  const docXmlText = await getZipEntry('word/document.xml')?.async('string');
  if (!docXmlText) {
    throw new Error('Không tìm thấy word/document.xml. Tệp .docx có thể bị hỏng hoặc là định dạng .doc cũ.');
  }

  const numberingXml = (await getZipEntry('word/numbering.xml')?.async('string')) ?? null;
  const stylesXml = (await getZipEntry('word/styles.xml')?.async('string')) ?? null;
  const relsXml = (await getZipEntry('word/_rels/document.xml.rels')?.async('string')) ?? null;

  const relMediaMap = new Map<string, string>();
  if (relsXml) {
    const relsDoc = new DOMParser().parseFromString(relsXml, 'application/xml');
    const relEls = Array.from(relsDoc.getElementsByTagName('*')).filter((el) => localName(el) === 'Relationship');

    await Promise.all(
      relEls.map(async (rel) => {
        const id = rel.getAttribute('Id');
        const target = rel.getAttribute('Target');
        const targetMode = rel.getAttribute('TargetMode');
        if (!id || !target || targetMode === 'External') return;

        const cleanTarget = target.replace(/\\/g, '/').replace(/^\/+/, '');
        const candidates = [
          cleanTarget.startsWith('word/') ? cleanTarget : `word/${cleanTarget.replace(/^\.\//, '')}`,
          cleanTarget.replace(/^\.\.\//, ''),
          `word/${cleanTarget.replace(/^\.\.\//, '')}`,
        ];

        const zipEntry = candidates.map((c) => getZipEntry(c)).find(Boolean);
        if (!zipEntry) return;

        const ext = cleanTarget.split('.').pop()?.toLowerCase() ?? '';
        let dataUrl: string | null = null;

        const directMime = mimeFromExt(ext);
        if (directMime) {
          const b64 = await zipEntry.async('base64');
          dataUrl = `data:${directMime};base64,${b64}`;
        } else if (ext === 'wmf' || ext === 'emf') {
          const rawBytes = await zipEntry.async('uint8array');
          dataUrl = convertMetafileToDataUrl(rawBytes, ext);
        }

        if (!dataUrl) return;
        const compressed = await compressDataUrlForExam(dataUrl, 265000, 1280);
        if (compressed) relMediaMap.set(id, compressed);
      })
    );
  }

  const numbering = parseNumberingXml(numberingXml);
  const styles = parseStylesXml(stylesXml);
  const doc = new DOMParser().parseFromString(docXmlText, 'application/xml');
  const parseErr = doc.getElementsByTagName('parsererror')[0];
  if (parseErr) {
    throw new Error(`XML trong tệp .docx không hợp lệ: ${parseErr.textContent?.slice(0, 140) || 'parse error'}`);
  }
  const body = Array.from(doc.getElementsByTagName('*')).find((el) => localName(el) === 'body');
  if (!body) {
    throw new Error('Không đọc được nội dung tài liệu Word.');
  }

  const paragraphs: NormalizedParagraph[] = [];
  const counters = { math: 0, images: 0 };
  let pIdx = 0;

  for (const child of childElements(body)) {
    const tag = localName(child);
    if (tag === 'p') {
      const extracted = extractParagraph(child, pIdx++, relMediaMap, numbering, styles, counters);
      paragraphs.push(...splitParagraphBySoftBreaks(extracted));
    } else if (tag === 'tbl') {
      const tblParas = extractTable(child, pIdx, relMediaMap, numbering, styles, counters);
      pIdx += tblParas.length + 1;
      paragraphs.push(...tblParas);
    }
  }

  return parseNormalizedParagraphsToExam(paragraphs, {
    sourceFileName: fileName,
    sourceFormat: 'docx',
    mathFormulasDetected: counters.math,
    imagesExtracted: counters.images,
    startedAtMs: t0,
  });
}

export async function parseDocxFile(file: File): Promise<ParseResult> {
  return parseDocxBuffer(await file.arrayBuffer(), file.name);
}
