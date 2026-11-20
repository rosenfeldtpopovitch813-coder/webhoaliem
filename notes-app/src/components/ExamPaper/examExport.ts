import { ExamBlockStyle, ExamInlineFigure, ExamPaperDocument } from '../../types/board';
import { renderRichExamText } from './examTemplates';
import {
  extractPrimaryFontName,
  parseRichInlineRuns,
  sanitizeColor,
  sanitizeFontFamily,
  sanitizeFontSizePt,
  stripRichHtmlToPlainText
} from '../../../../shared/exam-rich-text.js';

function escapeXml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert LaTeX expression to native Word Office Math Markup Language (OMML <m:oMath>)
 * so formulas opened in Microsoft Word are real editable Word equations!
 */
function latexToOmmlInner(texInput: string): string {
  let tex = texInput.trim();

  // Handle \ce{...}
  tex = tex.replace(/\\ce\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_m, inner: string) => {
    return inner
      .replace(/<=>/g, '⇌')
      .replace(/->/g, '→')
      .replace(/([A-Za-z)\]])(\d+)/g, '$1_$2');
  });

  // Handle system of equations \begin{cases} ... \end{cases}
  const casesMatch = tex.match(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/);
  if (casesMatch) {
    const rows = casesMatch[1]
      .split(/\\\\/)
      .map(r => r.trim())
      .filter(Boolean);
    return `<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/></m:dPr><m:e><m:eqArr>${rows
      .map(r => `<m:e>${latexToOmmlInner(r)}</m:e>`)
      .join('')}</m:eqArr></m:e></m:d>`;
  }

  // Replace common LaTeX symbols with Unicode math characters for clean OMML runs
  const symbolMap: Array<[RegExp, string]> = [
    [/\\infty/g, '∞'],
    [/\\to|\\rightarrow/g, '→'],
    [/\\Rightarrow/g, '⇒'],
    [/\\Leftrightarrow/g, '⇔'],
    [/\\rightleftharpoons/g, '⇌'],
    [/\\leq|\\le/g, '≤'],
    [/\\geq|\\ge/g, '≥'],
    [/\\neq|\\ne/g, '≠'],
    [/\\approx/g, '≈'],
    [/\\pm/g, '±'],
    [/\\cdot/g, '⋅'],
    [/\\times/g, '×'],
    [/\\parallel/g, '∥'],
    [/\\perp/g, '⊥'],
    [/\\triangle/g, '△'],
    [/\\alpha/g, 'α'],
    [/\\beta/g, 'β'],
    [/\\gamma/g, 'γ'],
    [/\\Delta/g, 'Δ'],
    [/\\pi/g, 'π'],
    [/\\omega/g, 'ω'],
    [/\\^\s*\\circ|\^\\circ/g, '°'],
    [/\\,/g, ' '],
    [/\\quad/g, '  ']
  ];
  for (const [re, sym] of symbolMap) tex = tex.replace(re, sym);

  // Convert \frac{a}{b}
  let prev = '';
  while (prev !== tex) {
    prev = tex;
    tex = tex.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_m, num, den) => {
      return `@@OMML_FRAC(${ btoa(unescape(encodeURIComponent(num))) },${ btoa(unescape(encodeURIComponent(den))) })@@`;
    });
    tex = tex.replace(/\\sqrt\[([^{}\]]*)\]\{([^{}]*)\}/g, (_m, deg, rad) => {
      return `@@OMML_NROOT(${ btoa(unescape(encodeURIComponent(deg))) },${ btoa(unescape(encodeURIComponent(rad))) })@@`;
    });
    tex = tex.replace(/\\sqrt\{([^{}]*)\}/g, (_m, rad) => {
      return `@@OMML_SQRT(${ btoa(unescape(encodeURIComponent(rad))) })@@`;
    });
    tex = tex.replace(/\\overrightarrow\{([^{}]*)\}|\\vec\{([^{}]*)\}/g, (_m, v1, v2) => {
      return `@@OMML_VEC(${ btoa(unescape(encodeURIComponent(v1 || v2))) })@@`;
    });
    tex = tex.replace(/\\int_\{([^{}]*)\}\^\{([^{}]*)\}/g, (_m, sub, sup) => {
      return `@@OMML_INT(${ btoa(unescape(encodeURIComponent(sub))) },${ btoa(unescape(encodeURIComponent(sup))) })@@`;
    });
    tex = tex.replace(/\\lim_\{([^{}]*)\}/g, (_m, sub) => {
      return `@@OMML_LIM(${ btoa(unescape(encodeURIComponent(sub))) })@@`;
    });
  }

  // Clean remaining \text{...} or \mathrm{...}
  tex = tex.replace(/\\(?:text|mathrm|mathbf)\{([^{}]*)\}/g, '$1');

  // Split by @@OMML_...@@ tokens and convert runs + sup/sub
  const parts = tex.split(/(@@OMML_[A-Z]+\([^)]*\)@@)/g);
  const out: string[] = [];

  const decode = (b64: string) => {
    try { return decodeURIComponent(escape(atob(b64))); } catch { return ''; }
  };

  for (const part of parts) {
    if (!part) continue;
    const frac = part.match(/^@@OMML_FRAC\(([^,]*),([^)]*)\)@@$/);
    if (frac) {
      out.push(`<m:f><m:num>${latexToOmmlInner(decode(frac[1]))}</m:num><m:den>${latexToOmmlInner(decode(frac[2]))}</m:den></m:f>`);
      continue;
    }
    const sqrt = part.match(/^@@OMML_SQRT\(([^)]*)\)@@$/);
    if (sqrt) {
      out.push(`<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${latexToOmmlInner(decode(sqrt[1]))}</m:e></m:rad>`);
      continue;
    }
    const nroot = part.match(/^@@OMML_NROOT\(([^,]*),([^)]*)\)@@$/);
    if (nroot) {
      out.push(`<m:rad><m:deg>${latexToOmmlInner(decode(nroot[1]))}</m:deg><m:e>${latexToOmmlInner(decode(nroot[2]))}</m:e></m:rad>`);
      continue;
    }
    const vec = part.match(/^@@OMML_VEC\(([^)]*)\)@@$/);
    if (vec) {
      out.push(`<m:acc><m:accPr><m:chr m:val="→"/></m:accPr><m:e>${latexToOmmlInner(decode(vec[1]))}</m:e></m:acc>`);
      continue;
    }
    const intMatch = part.match(/^@@OMML_INT\(([^,]*),([^)]*)\)@@$/);
    if (intMatch) {
      out.push(`<m:nary><m:naryPr><m:chr m:val="∫"/><m:limLoc m:val="undOvr"/></m:naryPr><m:sub>${latexToOmmlInner(decode(intMatch[1]))}</m:sub><m:sup>${latexToOmmlInner(decode(intMatch[2]))}</m:sup><m:e><m:r><m:t> </m:t></m:r></m:e></m:nary>`);
      continue;
    }
    const limMatch = part.match(/^@@OMML_LIM\(([^)]*)\)@@$/);
    if (limMatch) {
      out.push(`<m:limLow><m:e><m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>lim</m:t></m:r></m:e><m:lim>${latexToOmmlInner(decode(limMatch[1]))}</m:lim></m:limLow>`);
      continue;
    }

    // Handle simple superscripts and subscripts: x^{2}, x_1, H_2
    const subSupRegex = /([A-Za-z0-9)\]])(?:_\{([^{}]+)\}|_([A-Za-z0-9]))?(?:\^\{([^{}]+)\}|\^([A-Za-z0-9+-]))?/g;
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = subSupRegex.exec(part)) !== null) {
      const [full, base, sub1, sub2, sup1, sup2] = m;
      const sub = sub1 ?? sub2;
      const sup = sup1 ?? sup2;
      if (!sub && !sup) continue;
      if (m.index > lastIdx) {
        const plain = part.slice(lastIdx, m.index);
        if (plain) out.push(`<m:r><m:t>${escapeXml(plain)}</m:t></m:r>`);
      }
      if (sub && sup) {
        out.push(`<m:sSubSup><m:e><m:r><m:t>${escapeXml(base)}</m:t></m:r></m:e><m:sub><m:r><m:t>${escapeXml(sub)}</m:t></m:r></m:sub><m:sup><m:r><m:t>${escapeXml(sup)}</m:t></m:r></m:sup></m:sSubSup>`);
      } else if (sub) {
        out.push(`<m:sSub><m:e><m:r><m:t>${escapeXml(base)}</m:t></m:r></m:e><m:sub><m:r><m:t>${escapeXml(sub)}</m:t></m:r></m:sub></m:sSub>`);
      } else if (sup) {
        out.push(`<m:sSup><m:e><m:r><m:t>${escapeXml(base)}</m:t></m:r></m:e><m:sup><m:r><m:t>${escapeXml(sup)}</m:t></m:r></m:sup></m:sSup>`);
      }
      lastIdx = m.index + full.length;
    }
    const tail = part.slice(lastIdx);
    if (tail) out.push(`<m:r><m:t>${escapeXml(tail)}</m:t></m:r>`);
  }

  return out.join('');
}

type WordRunOpts = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  colorHex?: string;
  bgHex?: string;
  fontSizePt?: number;
  fontName?: string;
};

function textWithMathToWordXml(
  source: string,
  boldOrOpts: boolean | WordRunOpts = false,
  colorHex?: string,
  underline = false
): string {
  const opts: WordRunOpts = typeof boldOrOpts === 'object'
    ? boldOrOpts
    : { bold: boldOrOpts, colorHex, underline };
  const defaultFont = opts.fontName || 'Times New Roman';
  const parts: string[] = [];
  const pattern = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\ce\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const makeStyledRuns = (rawSegment: string) => {
    if (!rawSegment) return '';
    const runs = parseRichInlineRuns(rawSegment, {
      bold: opts.bold,
      italic: opts.italic,
      underline: opts.underline,
      strike: opts.strike,
      textColor: opts.colorHex ? `#${opts.colorHex.replace(/^#/, '')}` : '',
      bgColor: opts.bgHex ? `#${opts.bgHex.replace(/^#/, '')}` : '',
      fontSizePt: opts.fontSizePt,
      fontFamily: defaultFont
    });
    return runs.map((run) => {
      if (run.text === '\n') return '<w:r><w:br/></w:r>';
      const fName = escapeXml(run.fontFamily || defaultFont);
      const rPr: string[] = [`<w:rFonts w:ascii="${fName}" w:hAnsi="${fName}" w:cs="${fName}"/>`];
      if (run.bold) rPr.push('<w:b/>');
      if (run.italic) rPr.push('<w:i/>');
      if (run.underline) rPr.push('<w:u w:val="single"/>');
      if (run.strike) rPr.push('<w:strike/>');
      if (run.sup) rPr.push('<w:vertAlign w:val="superscript"/>');
      else if (run.sub) rPr.push('<w:vertAlign w:val="subscript"/>');
      if (run.colorHex) rPr.push(`<w:color w:val="${run.colorHex}"/>`);
      if (run.bgHex) rPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${run.bgHex}"/>`);
      if (run.fontSizePt) {
        const halfPts = Math.round(run.fontSizePt * 2);
        rPr.push(`<w:sz w:val="${halfPts}"/><w:szCs w:val="${halfPts}"/>`);
      }
      return `<w:r><w:rPr>${rPr.join('')}</w:rPr><w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`;
    }).join('');
  };

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push(makeStyledRuns(source.slice(lastIndex, match.index)));
    }
    const rawTex = match[1] ?? match[2] ?? match[3] ?? match[4] ?? (match[5] ? `\\ce{${match[5]}}` : '');
    const cleanTex = stripRichHtmlToPlainText(rawTex);
    parts.push(`<m:oMath>${latexToOmmlInner(cleanTex)}</m:oMath>`);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < source.length) {
    parts.push(makeStyledRuns(source.slice(lastIndex)));
  }
  return parts.join('');
}

function wordAlign(align?: ExamBlockStyle['align']): string {
  if (align === 'center' || align === 'right') return align;
  if (align === 'justify') return 'both';
  return 'left';
}

function blockStyleToCss(block: ExamBlockStyle): string {
  const styles: string[] = [];
  if (block.align) styles.push(`text-align:${block.align}`);
  const ff = sanitizeFontFamily(block.fontFamily);
  if (ff) styles.push(`font-family:${ff}`);
  const fs = sanitizeFontSizePt(block.fontSizePt);
  if (fs !== null) styles.push(`font-size:${fs}pt`);
  const tc = sanitizeColor(block.textColor);
  if (tc) styles.push(`color:${tc}`);
  const bg = sanitizeColor(block.bgColor);
  if (bg) styles.push(`background-color:${bg};padding:4px 8px;border-radius:6px`);
  if (block.lineHeight && block.lineHeight >= 1.1 && block.lineHeight <= 2.6) {
    styles.push(`line-height:${block.lineHeight}`);
  }
  if (block.bold) styles.push('font-weight:700');
  if (block.italic) styles.push('font-style:italic');
  if (block.underline && block.strike) styles.push('text-decoration:underline line-through');
  else if (block.underline) styles.push('text-decoration:underline');
  else if (block.strike) styles.push('text-decoration:line-through');
  return styles.join(';');
}

/**
 * Pure-TS minimal ZIP writer (Stored mode with CRC32) to produce a genuine .docx file
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZipArchive(files: Array<{ name: string; data: Uint8Array }>): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = file.data;
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // Stored (0)
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, data);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralSize = centralParts.reduce((s, a) => s + a.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, eocd], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const m = dataUrl.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/);
  if (!m) return null;
  try {
    const bin = atob(m[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  } catch {
    return null;
  }
}

export function exportExamPaperToDocx(paper: ExamPaperDocument, mode: 'student' | 'teacher'): void {
  const encoder = new TextEncoder();
  const isTeacher = mode === 'teacher';
  const h = paper.header;

  const mediaFiles: Array<{ name: string; data: Uint8Array; rId: string }> = [];
  let imgCounter = 0;

  const registerImage = (fig: ExamInlineFigure): string | null => {
    const bytes = dataUrlToBytes(fig.src);
    if (!bytes) return null;
    imgCounter++;
    const rId = `rIdImg${imgCounter}`;
    const fileName = `image${imgCounter}.png`;
    mediaFiles.push({ name: `word/media/${fileName}`, data: bytes, rId });
    // 1 px ~ 9525 EMUs
    const cx = Math.round(Math.min(540, Math.max(100, fig.width || 260)) * 9525);
    const cy = Math.round(cx * 0.72);
    const jc = fig.align === 'left' ? 'left' : fig.align === 'right' ? 'right' : 'center';
    return `<w:p><w:pPr><w:jc w:val="${jc}"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${imgCounter}" name="Picture ${imgCounter}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${imgCounter}" name="${fileName}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  };

  const bodyXml: string[] = [];

  // Header table (2 columns: Department/School vs Exam Title/Subject/Time)
  bodyXml.push(`
    <w:tbl>
      <w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="2200" w:type="pct"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>${textWithMathToWordXml(h.department, false)}</w:p>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>${textWithMathToWordXml(h.school, true, undefined, true)}</w:p>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>${textWithMathToWordXml(`Mã đề: ${h.examCode}`, true)}</w:p>
        </w:tc>
        <w:tc><w:tcPr><w:tcW w:w="2800" w:type="pct"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>${textWithMathToWordXml(h.examTitle, true)}</w:p>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>${textWithMathToWordXml(h.subject, true)}</w:p>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>${textWithMathToWordXml(h.duration, false)}</w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
  `);

  if (h.showStudentInfo) {
    bodyXml.push(
      `<w:p><w:pPr><w:spacing w:before="120" w:after="120"/></w:pPr>${textWithMathToWordXml('Họ và tên thí sinh: ........................................................................... Số báo danh: ...........................', false)}</w:p>`
    );
  }

  let qIndex = 0;
  let listNumIndex = 0;
  const docFontName = extractPrimaryFontName(paper.fontFamily);
  for (const block of paper.blocks) {
    if (block.type === 'page-break') {
      listNumIndex = 0;
      bodyXml.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
      continue;
    }

    if (block.pageBreakBefore) {
      bodyXml.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
    }

    if (block.type === 'section') {
      qIndex = 0;
      listNumIndex = 0;
      const bFont = block.fontFamily ? extractPrimaryFontName(block.fontFamily) : docFontName;
      const jc = wordAlign(block.align);
      const secColor = sanitizeColor(block.textColor).replace(/^#/, '').toUpperCase() || undefined;
      bodyXml.push(`<w:p><w:pPr><w:jc w:val="${jc}"/><w:spacing w:before="200" w:after="60"/></w:pPr>${textWithMathToWordXml(block.title, { bold: true, colorHex: secColor, fontSizePt: block.fontSizePt, fontName: bFont })}</w:p>`);
      if (block.subtitle) {
        bodyXml.push(`<w:p><w:pPr><w:jc w:val="${jc}"/><w:spacing w:after="100"/></w:pPr>${textWithMathToWordXml(block.subtitle, { italic: true, fontName: bFont })}</w:p>`);
      }
      continue;
    }

    if (block.type === 'paragraph') {
      const variant = block.variant || 'text';
      if (variant === 'numbered') listNumIndex += 1;
      else listNumIndex = 0;
      const prefix = variant === 'bullet' ? '• ' : variant === 'numbered' ? `${listNumIndex}. ` : '';
      const variantSize = variant === 'h1' ? 18 : variant === 'h2' ? 15 : variant === 'h3' ? 13 : undefined;
      const bFont = block.fontFamily ? extractPrimaryFontName(block.fontFamily) : docFontName;
      const jc = wordAlign(block.align);
      const bgHex = sanitizeColor(block.bgColor).replace(/^#/, '').toUpperCase() || (variant === 'callout' ? 'F1F5F9' : '');
      const shdXml = bgHex ? `<w:shd w:val="clear" w:color="auto" w:fill="${bgHex}"/>` : '';
      const indXml = variant === 'bullet' || variant === 'numbered' ? '<w:ind w:left="360"/>' : '';
      const runOpts: WordRunOpts = {
        bold: Boolean(block.bold || variant === 'h1' || variant === 'h2' || variant === 'h3'),
        italic: Boolean(block.italic),
        underline: Boolean(block.underline),
        strike: Boolean(block.strike),
        colorHex: sanitizeColor(block.textColor).replace(/^#/, '').toUpperCase() || undefined,
        fontSizePt: block.fontSizePt || variantSize,
        fontName: bFont
      };
      bodyXml.push(`<w:p><w:pPr><w:jc w:val="${jc}"/>${indXml}${shdXml}<w:spacing w:before="${variant.startsWith('h') ? 160 : 60}" w:after="80"/></w:pPr>${prefix ? textWithMathToWordXml(prefix, { ...runOpts, bold: true }) : ''}${textWithMathToWordXml(block.text, runOpts)}</w:p>`);
      for (const fig of block.figures || []) {
        const figXml = registerImage(fig);
        if (figXml) bodyXml.push(figXml);
      }
      continue;
    }

    listNumIndex = 0;
    qIndex++;
    const qFont = block.fontFamily ? extractPrimaryFontName(block.fontFamily) : docFontName;
    const qColor = sanitizeColor(block.textColor).replace(/^#/, '').toUpperCase() || undefined;
    const qBg = sanitizeColor(block.bgColor).replace(/^#/, '').toUpperCase() || undefined;
    const qRunOpts: WordRunOpts = {
      bold: Boolean(block.bold),
      italic: Boolean(block.italic),
      underline: Boolean(block.underline),
      strike: Boolean(block.strike),
      colorHex: qColor,
      fontSizePt: block.fontSizePt,
      fontName: qFont
    };
    const qShd = qBg ? `<w:shd w:val="clear" w:color="auto" w:fill="${qBg}"/>` : '';
    const labelStr = `Câu ${qIndex}${block.points ? ` (${block.points})` : ''}. `;
    bodyXml.push(
      `<w:p><w:pPr><w:jc w:val="${wordAlign(block.align)}"/>${qShd}<w:spacing w:before="120" w:after="60"/></w:pPr>${textWithMathToWordXml(labelStr, { ...qRunOpts, bold: true })}${textWithMathToWordXml(block.prompt, qRunOpts)}</w:p>`
    );

    for (const fig of block.figures || []) {
      const figXml = registerImage(fig);
      if (figXml) bodyXml.push(figXml);
    }

    if (block.questionType === 'mcq' && block.options) {
      const cols = block.optionCols || 4;
      const letters = ['A', 'B', 'C', 'D'] as const;
      if (cols === 4) {
        bodyXml.push(`<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr><w:tr>${block.options.map((opt, idx) => {
          const isAns = isTeacher && block.correctChoice === letters[idx];
          return `<w:tc><w:p>${textWithMathToWordXml(`${letters[idx]}. `, true, isAns ? 'DC2626' : undefined, isAns)}${textWithMathToWordXml(opt, false)}</w:p></w:tc>`;
        }).join('')}</w:tr></w:tbl>`);
      } else if (cols === 2) {
        bodyXml.push(`<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr>
          <w:tr>${[0, 1].map(idx => {
            const isAns = isTeacher && block.correctChoice === letters[idx];
            return `<w:tc><w:p>${textWithMathToWordXml(`${letters[idx]}. `, true, isAns ? 'DC2626' : undefined, isAns)}${textWithMathToWordXml(block.options![idx], false)}</w:p></w:tc>`;
          }).join('')}</w:tr>
          <w:tr>${[2, 3].map(idx => {
            const isAns = isTeacher && block.correctChoice === letters[idx];
            return `<w:tc><w:p>${textWithMathToWordXml(`${letters[idx]}. `, true, isAns ? 'DC2626' : undefined, isAns)}${textWithMathToWordXml(block.options![idx], false)}</w:p></w:tc>`;
          }).join('')}</w:tr>
        </w:tbl>`);
      } else {
        block.options.forEach((opt, idx) => {
          const isAns = isTeacher && block.correctChoice === letters[idx];
          bodyXml.push(`<w:p>${textWithMathToWordXml(`${letters[idx]}. `, true, isAns ? 'DC2626' : undefined, isAns)}${textWithMathToWordXml(opt, false)}</w:p>`);
        });
      }
    } else if (block.questionType === 'tf' && block.statements) {
      for (const st of block.statements) {
        const badge = isTeacher && st.correct !== null ? ` [${st.correct ? 'ĐÚNG' : 'SAI'}]` : '';
        bodyXml.push(`<w:p>${textWithMathToWordXml(`${st.label}) `, true)}${textWithMathToWordXml(st.text, false)}${badge ? textWithMathToWordXml(badge, true, st.correct ? '059669' : 'DC2626') : ''}</w:p>`);
      }
    } else if (block.questionType === 'short') {
      const ansText = isTeacher && block.shortAnswer ? block.shortAnswer : '........................';
      bodyXml.push(`<w:p>${textWithMathToWordXml('Đáp án: ', true)}${textWithMathToWordXml(ansText, isTeacher)}</w:p>`);
    }

    if (isTeacher && block.solution?.trim()) {
      bodyXml.push(`<w:p>${textWithMathToWordXml('Lời giải: ', true, '1D4ED8')}${textWithMathToWordXml(block.solution, false)}</w:p>`);
    }
  }

  if (h.showFooter !== false) {
    const endMark = (h.footerCenterText ?? '—————— HẾT ——————').trim();
    if (endMark) {
      bodyXml.push(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="200"/></w:pPr>${textWithMathToWordXml(endMark, { bold: true, fontName: docFontName })}</w:p>`);
    }
  }

  const runningHdrText = (h.runningHeaderText ?? h.examTitle ?? '').trim();
  const footerLeftTxt = (h.footerLeftText ?? `Mã đề ${h.examCode}`).trim();
  const hasWordHeader = h.showRunningHeader !== false && Boolean(runningHdrText);
  const hasWordFooter = h.showFooter !== false && (Boolean(footerLeftTxt) || h.showPageNumbers !== false);

  const header1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="${escapeXml(docFontName)}" w:hAnsi="${escapeXml(docFontName)}"/><w:sz w:val="19"/><w:color w:val="64748B"/></w:rPr><w:t xml:space="preserve">${escapeXml(runningHdrText)}</w:t></w:r></w:p>
</w:hdr>`;

  const footer1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:pPr><w:jc w:val="both"/></w:pPr>${footerLeftTxt ? `<w:r><w:rPr><w:rFonts w:ascii="${escapeXml(docFontName)}" w:hAnsi="${escapeXml(docFontName)}"/><w:sz w:val="20"/><w:color w:val="475569"/></w:rPr><w:t xml:space="preserve">${escapeXml(footerLeftTxt)}${h.showPageNumbers !== false ? '    ·    Trang ' : ''}</w:t></w:r>` : (h.showPageNumbers !== false ? `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">Trang </w:t></w:r>` : '')}${h.showPageNumbers !== false ? `<w:fldSimple w:instr="PAGE"/><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve"> / </w:t></w:r><w:fldSimple w:instr="NUMPAGES"/>` : ''}</w:p>
</w:ftr>`;

  const sectRefs = [
    hasWordHeader ? '<w:headerReference w:type="default" r:id="rIdHdr1"/>' : '',
    hasWordFooter ? '<w:footerReference w:type="default" r:id="rIdFtr1"/>' : ''
  ].join('');
  bodyXml.push(`<w:sectPr>${sectRefs}<w:titlePg/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="950"/></w:sectPr>`);

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>${bodyXml.join('')}</w:body>
</w:document>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  ${hasWordHeader ? '<Relationship Id="rIdHdr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : ''}
  ${hasWordFooter ? '<Relationship Id="rIdFtr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : ''}
  ${mediaFiles.map(mf => `<Relationship Id="${mf.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mf.name.split('/').pop()}"/>`).join('\n  ')}
</Relationships>`;

  const safeDocFont = escapeXml(docFontName);
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="${safeDocFont}" w:hAnsi="${safeDocFont}" w:cs="${safeDocFont}"/><w:sz w:val="${(paper.fontSizePt || 12) * 2}"/></w:rPr></w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  ${hasWordHeader ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ''}
  ${hasWordFooter ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ''}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const zipBlob = buildZipArchive([
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: encoder.encode(rootRelsXml) },
    { name: 'word/document.xml', data: encoder.encode(documentXml) },
    { name: 'word/styles.xml', data: encoder.encode(stylesXml) },
    ...(hasWordHeader ? [{ name: 'word/header1.xml', data: encoder.encode(header1Xml) }] : []),
    ...(hasWordFooter ? [{ name: 'word/footer1.xml', data: encoder.encode(footer1Xml) }] : []),
    { name: 'word/_rels/document.xml.rels', data: encoder.encode(relsXml) },
    ...mediaFiles.map(mf => ({ name: mf.name, data: mf.data }))
  ]);

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  const slug = (h.examTitle || 'de-thi-a4').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'de-thi-a4';
  a.href = url;
  a.download = `${slug}-${isTeacher ? 'ban-giao-vien' : 'ban-hoc-sinh'}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportExamPaperToPDF(paper: ExamPaperDocument, mode: 'student' | 'teacher'): void {
  const isTeacher = mode === 'teacher';
  const h = paper.header;
  const styles = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map(l => `<link rel="stylesheet" href="${escapeHtml((l as HTMLLinkElement).href)}">`)
    .join('');

  let qCounter = 0;
  let pdfListNum = 0;
  const bodyHtml: string[] = [];

  for (const block of paper.blocks) {
    if (block.type === 'page-break') {
      pdfListNum = 0;
      bodyHtml.push(`<div style="page-break-before:always;break-before:page;height:0"></div>`);
      continue;
    }
    if (block.pageBreakBefore) {
      bodyHtml.push(`<div style="page-break-before:always;break-before:page;height:0"></div>`);
    }
    if (block.type === 'section') {
      qCounter = 0;
      pdfListNum = 0;
      const secStyle = blockStyleToCss(block);
      bodyHtml.push(`<div class="pdf-section"${secStyle ? ` style="${secStyle}"` : ''}><h3>${renderRichExamText(block.title)}</h3>${block.subtitle ? `<p>${renderRichExamText(block.subtitle)}</p>` : ''}</div>`);
      continue;
    }
    if (block.type === 'paragraph') {
      const variant = block.variant || 'text';
      if (variant === 'numbered') pdfListNum += 1;
      else pdfListNum = 0;
      const pStyle = blockStyleToCss(block);
      const pFigs = (block.figures || [])
        .map(f => `<div class="pdf-fig" style="text-align:${f.align || 'center'}"><img src="${escapeHtml(f.src)}" style="width:${f.width || 250}px;max-width:100%" alt="Hình minh họa"/></div>`)
        .join('');
      const content = renderRichExamText(block.text);
      if (variant === 'h1') bodyHtml.push(`<h1 class="pdf-h1"${pStyle ? ` style="${pStyle}"` : ''}>${content}</h1>${pFigs}`);
      else if (variant === 'h2') bodyHtml.push(`<h2 class="pdf-h2"${pStyle ? ` style="${pStyle}"` : ''}>${content}</h2>${pFigs}`);
      else if (variant === 'h3') bodyHtml.push(`<h3 class="pdf-h3"${pStyle ? ` style="${pStyle}"` : ''}>${content}</h3>${pFigs}`);
      else if (variant === 'bullet') bodyHtml.push(`<div class="pdf-list-item"${pStyle ? ` style="${pStyle}"` : ''}><span class="pdf-list-marker">•</span><div>${content}</div></div>${pFigs}`);
      else if (variant === 'numbered') bodyHtml.push(`<div class="pdf-list-item"${pStyle ? ` style="${pStyle}"` : ''}><span class="pdf-list-marker">${pdfListNum}.</span><div>${content}</div></div>${pFigs}`);
      else if (variant === 'callout') bodyHtml.push(`<div class="pdf-callout"${pStyle ? ` style="${pStyle}"` : ''}>${content}</div>${pFigs}`);
      else bodyHtml.push(`<p class="pdf-para"${pStyle ? ` style="${pStyle}"` : ''}>${content}</p>${pFigs}`);
      continue;
    }

    pdfListNum = 0;
    qCounter++;
    const figsHtml = (block.figures || [])
      .map(f => `<div class="pdf-fig" style="text-align:${f.align || 'center'}"><img src="${escapeHtml(f.src)}" style="width:${f.width || 250}px;max-width:100%" alt="Hình câu ${qCounter}"/></div>`)
      .join('');

    let optionsHtml = '';
    if (block.questionType === 'mcq' && block.options) {
      const cols = block.optionCols || 4;
      const letters = ['A', 'B', 'C', 'D'] as const;
      optionsHtml = `<div class="pdf-options cols-${cols}">${block.options
        .map((opt, idx) => {
          const isAns = isTeacher && block.correctChoice === letters[idx];
          return `<div class="pdf-opt"><span class="pdf-opt-letter ${isAns ? 'is-correct' : ''}">${letters[idx]}.</span> <span>${renderRichExamText(opt)}</span></div>`;
        })
        .join('')}</div>`;
    } else if (block.questionType === 'tf' && block.statements) {
      optionsHtml = `<div class="pdf-tf-list">${block.statements
        .map(st => {
          const badge = isTeacher && st.correct !== null ? `<strong class="pdf-tf-ans ${st.correct ? 'true' : 'false'}">[${st.correct ? 'Đ' : 'S'}]</strong>` : '';
          return `<div class="pdf-tf-row"><strong>${st.label})</strong> <span>${renderRichExamText(st.text)}</span> ${badge}</div>`;
        })
        .join('')}</div>`;
    } else if (block.questionType === 'short') {
      optionsHtml = `<div class="pdf-short-ans"><strong>Đáp án:</strong> ${
        isTeacher && block.shortAnswer
          ? `<span class="pdf-short-filled">${renderRichExamText(block.shortAnswer)}</span>`
          : `<span class="pdf-short-box">&nbsp;</span>`
      }</div>`;
    }

    const solutionHtml =
      isTeacher && block.solution?.trim()
        ? `<div class="pdf-solution"><strong>Lời giải:</strong> ${renderRichExamText(block.solution)}</div>`
        : '';

    const qStyle = blockStyleToCss(block);
    bodyHtml.push(`
      <article class="pdf-question"${qStyle ? ` style="${qStyle}"` : ''}>
        <div class="pdf-q-prompt"><strong class="pdf-q-label">Câu ${qCounter}${block.points ? ` (${escapeHtml(block.points)})` : ''}.</strong> ${renderRichExamText(block.prompt)}</div>
        ${figsHtml}
        ${optionsHtml}
        ${solutionHtml}
      </article>
    `);
  }

  const win = window.open('', '_blank');
  if (!win) {
    alert('Trình duyệt đang chặn cửa sổ bật lên (popup). Hãy cho phép popup để in / lưu PDF.');
    return;
  }
  win.document.open();
  win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(h.examTitle)}</title>${styles}
  <style>
    @page { size: A4; margin: 14mm 16mm 15mm 18mm; }
    * { box-sizing: border-box; }
    body {
      font-family: ${paper.fontFamily || '"Times New Roman", Times, serif'};
      font-size: ${paper.fontSizePt || 12}pt;
      line-height: 1.5;
      color: #111827;
      margin: 0;
      background: #fff;
    }
    .pdf-header-grid {
      display: grid;
      grid-template-columns: 44% 56%;
      border-bottom: 1.5px solid #1e293b;
      padding-bottom: 10px;
      margin-bottom: 12px;
      text-align: center;
    }
    .pdf-header-left p, .pdf-header-right p { margin: 2px 0; }
    .pdf-school { font-weight: 700; text-decoration: underline; }
    .pdf-exam-title { font-weight: 700; font-size: 13pt; text-transform: uppercase; }
    .pdf-code-box { display: inline-block; margin-top: 4px; padding: 2px 10px; border: 1px solid #1e293b; font-weight: 700; font-size: 10.5pt; }
    .pdf-student-info { margin: 8px 0 14px; font-size: 11.5pt; display: flex; justify-content: space-between; gap: 16px; }
    .pdf-section { margin: 14px 0 8px; }
    .pdf-section h3 { margin: 0; font-size: 12pt; font-weight: 700; text-transform: uppercase; }
    .pdf-section p { margin: 2px 0 0; font-style: italic; font-size: 11pt; }
    .pdf-para { margin: 4px 0 8px; }
    .pdf-h1 { margin: 14px 0 6px; font-size: 18pt; font-weight: 700; line-height: 1.3; }
    .pdf-h2 { margin: 12px 0 5px; font-size: 15pt; font-weight: 700; line-height: 1.35; }
    .pdf-h3 { margin: 10px 0 4px; font-size: 13pt; font-weight: 700; line-height: 1.4; }
    .pdf-list-item { display: flex; gap: 8px; margin: 3px 0 5px; padding-left: 12px; }
    .pdf-list-marker { font-weight: 700; flex: none; min-width: 16px; }
    .pdf-callout { margin: 8px 0; padding: 9px 12px; background: #f8fafc; border-left: 3.5px solid #2563eb; border-radius: 6px; }
    .pdf-question { margin: 0 0 11px; break-inside: avoid; page-break-inside: avoid; }
    .pdf-q-label { font-weight: 700; }
    .pdf-fig { margin: 8px 0; }
    .pdf-options { display: grid; gap: 4px 14px; margin-top: 5px; }
    .pdf-options.cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .pdf-options.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .pdf-options.cols-1 { grid-template-columns: 1fr; }
    .pdf-opt-letter { font-weight: 700; }
    .pdf-opt-letter.is-correct { color: #dc2626; text-decoration: underline; }
    .pdf-tf-list { display: grid; gap: 4px; margin-top: 5px; padding-left: 8px; }
    .pdf-tf-ans.true { color: #059669; margin-left: 6px; }
    .pdf-tf-ans.false { color: #dc2626; margin-left: 6px; }
    .pdf-short-ans { margin-top: 6px; display: flex; align-items: center; gap: 8px; }
    .pdf-short-box { display: inline-block; width: 150px; height: 24px; border: 1px dashed #475569; border-radius: 4px; }
    .pdf-short-filled { font-weight: 700; color: #059669; padding: 1px 8px; border: 1px solid #059669; border-radius: 4px; }
    .pdf-solution { margin-top: 6px; padding: 6px 10px; background: #f8fafc; border-left: 3px solid #2563eb; font-size: 11pt; }
    .pdf-footer-end { text-align: center; font-weight: 700; margin-top: 18px; letter-spacing: 0.1em; }
    @media screen {
      body { max-width: 210mm; margin: 20px auto; padding: 18mm; box-shadow: 0 10px 35px rgba(0,0,0,0.15); }
      .print-banner { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-family: system-ui, sans-serif; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
      .print-banner button { background: #2563eb; color: #fff; border: 0; border-radius: 6px; padding: 6px 14px; font-weight: 700; cursor: pointer; }
    }
    @media print { .print-banner { display: none !important; } }
  </style></head><body>
    <div class="print-banner">
      <span><strong>${isTeacher ? 'Bản Giáo viên (có đáp án & lời giải)' : 'Bản phát cho Học sinh (đã ẩn đáp án & lời giải)'}</strong> — Chọn máy in hoặc “Lưu dưới dạng PDF (Save as PDF)”.</span>
      <button onclick="window.print()">🖨 In / Lưu PDF ngay</button>
    </div>
    <header class="pdf-header-grid">
      <div class="pdf-header-left">
        <p>${escapeHtml(h.department)}</p>
        <p class="pdf-school">${escapeHtml(h.school)}</p>
        <div class="pdf-code-box">Mã đề: ${escapeHtml(h.examCode)}</div>
      </div>
      <div class="pdf-header-right">
        <p class="pdf-exam-title">${escapeHtml(h.examTitle)}</p>
        <p><strong>${escapeHtml(h.subject)}</strong></p>
        <p><em>${escapeHtml(h.duration)}</em></p>
      </div>
    </header>
    ${h.showStudentInfo !== false ? `<div class="pdf-student-info"><span>Họ và tên thí sinh: ........................................................................</span><span>Số báo danh: ..............................</span></div>` : ''}
    ${bodyHtml.join('')}
    ${h.showFooter !== false ? `<div class="pdf-footer-end">${escapeHtml(h.footerCenterText ?? '—————— HẾT ——————')}</div>${(h.footerLeftText ?? '').trim() ? `<div style="margin-top:8px;font-size:10pt;color:#475569;text-align:left">${escapeHtml(h.footerLeftText!)}</div>` : ''}` : ''}
    <script>window.addEventListener('load', () => setTimeout(() => { window.focus(); window.print(); }, 450));</script>
  </body></html>`);
  win.document.close();
}

export function convertExamPaperToOnlineQuestions(paper: ExamPaperDocument) {
  const questions: Array<{
    part: 'I' | 'II' | 'III';
    prompt: string;
    image?: string;
    options?: string[];
    answer: string | boolean[];
    tolerance?: number;
  }> = [];

  for (const block of paper.blocks) {
    if (block.type !== 'question') continue;
    const firstFig = block.figures?.[0]?.src || '';
    const image = firstFig.startsWith('data:image/') && firstFig.length <= 300000 ? firstFig : '';
    if (block.questionType === 'mcq') {
      const opts = (block.options || ['A', 'B', 'C', 'D']).map((o, i) => stripRichHtmlToPlainText(o) || `Phương án ${'ABCD'[i]}`);
      questions.push({
        part: 'I',
        prompt: stripRichHtmlToPlainText(block.prompt) || 'Câu hỏi trắc nghiệm',
        ...(image ? { image } : {}),
        options: opts,
        answer: block.correctChoice || 'A'
      });
    } else if (block.questionType === 'tf') {
      const sts = block.statements || [];
      const opts = [0, 1, 2, 3].map(i => stripRichHtmlToPlainText(sts[i]?.text) || `Nhận định ${'abcd'[i]}`);
      const ans = [0, 1, 2, 3].map(i => (sts[i]?.correct === false ? false : true));
      questions.push({
        part: 'II',
        prompt: stripRichHtmlToPlainText(block.prompt) || 'Câu hỏi đúng sai',
        ...(image ? { image } : {}),
        options: opts,
        answer: ans
      });
    } else if (block.questionType === 'short') {
      const numeric = Number(stripRichHtmlToPlainText(block.shortAnswer || '0').replace(',', '.'));
      questions.push({
        part: 'III',
        prompt: stripRichHtmlToPlainText(block.prompt) || 'Câu hỏi trả lời ngắn',
        ...(image ? { image } : {}),
        answer: Number.isFinite(numeric) ? String(numeric) : '0',
        tolerance: 0.0001
      });
    }
  }
  return questions;
}
