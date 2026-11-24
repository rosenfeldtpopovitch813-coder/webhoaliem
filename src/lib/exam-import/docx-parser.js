// Portable client-side .docx OOXML + OMML (<m:oMath>) + numbering + multi-format image + answer-key parser.
// Works identically in modern browsers and Node.js (zero external dependencies).

import { readZipEntries, bytesToBase64 } from './zip-codec.js';

const textDecoder = new TextDecoder('utf-8');

const XML_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'"
};

function decodeXmlEntities(str) {
  return String(str || '').replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (_m, ent) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    }
    return XML_ENTITIES[ent] ?? `&${ent};`;
  });
}

/**
 * Minimal, standards-safe XML tree parser tailored for Word OOXML documents.
 * shortcut: ignores DOCTYPE/CDATA edge cases rare in Word OOXML, upgrade to fast-xml-parser if non-Word XML is needed.
 */
export function parseXml(xmlStr) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const s = String(xmlStr || '');
  let i = 0;

  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt < 0) {
      const tail = s.slice(i);
      if (tail) stack[stack.length - 1].children.push({ tag: '#text', text: decodeXmlEntities(tail) });
      break;
    }
    if (lt > i) {
      stack[stack.length - 1].children.push({ tag: '#text', text: decodeXmlEntities(s.slice(i, lt)) });
    }
    if (s.startsWith('<!--', lt)) {
      const end = s.indexOf('-->', lt + 4);
      i = end < 0 ? s.length : end + 3;
      continue;
    }
    if (s.startsWith('<?', lt) || s.startsWith('<!', lt)) {
      const end = s.indexOf('>', lt + 2);
      i = end < 0 ? s.length : end + 1;
      continue;
    }
    const gt = s.indexOf('>', lt + 1);
    if (gt < 0) break;

    const rawTag = s.slice(lt + 1, gt).trim();
    i = gt + 1;

    if (rawTag.startsWith('/')) {
      const closeName = rawTag.slice(1).trim();
      for (let k = stack.length - 1; k >= 1; k--) {
        if (stack[k].tag === closeName) {
          stack.length = k;
          break;
        }
      }
      continue;
    }

    const selfClose = rawTag.endsWith('/');
    const body = selfClose ? rawTag.slice(0, -1).trim() : rawTag;
    const spaceIdx = body.search(/\s/);
    const tag = spaceIdx < 0 ? body : body.slice(0, spaceIdx);
    const attrStr = spaceIdx < 0 ? '' : body.slice(spaceIdx + 1);
    const attrs = {};
    if (attrStr) {
      const attrRe = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let am;
      while ((am = attrRe.exec(attrStr)) !== null) {
        attrs[am[1]] = decodeXmlEntities(am[2] ?? am[3] ?? '');
      }
    }

    const node = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }

  return root;
}

function findChildren(node, tag) {
  return (node?.children || []).filter((c) => c.tag === tag);
}

function findFirst(node, tag) {
  return (node?.children || []).find((c) => c.tag === tag) || null;
}

function collectDescendants(node, predicate, out = []) {
  if (!node?.children) return out;
  for (const c of node.children) {
    if (predicate(c)) out.push(c);
    collectDescendants(c, predicate, out);
  }
  return out;
}

/**
 * Compress a browser image dataUrl using an offscreen <canvas> so large Word/PDF diagrams
 * always fit HTVVM Studio's 300 KB base64 ceiling instead of being dropped.
 */
export async function compressImageDataUrl(dataUrl, { maxChars = 290000, maxWidth = 1100 } = {}) {
  if (!dataUrl || dataUrl.length <= maxChars) return dataUrl;
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return dataUrl.length <= maxChars ? dataUrl : '';
  }

  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image load failed'));
      el.src = dataUrl;
    });

    const scale = Math.min(1, maxWidth / Math.max(1, img.naturalWidth || img.width || 1));
    let w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    let h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    for (const [ratio, quality] of [[1, 0.84], [1, 0.68], [0.78, 0.64], [0.6, 0.56]]) {
      canvas.width = Math.max(1, Math.round(w * ratio));
      canvas.height = Math.max(1, Math.round(h * ratio));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const webp = canvas.toDataURL('image/webp', quality);
      if (webp.startsWith('data:image/webp') && webp.length <= maxChars) return webp;
      const jpeg = canvas.toDataURL('image/jpeg', quality);
      if (jpeg.length <= maxChars) return jpeg;
    }
  } catch {
    return '';
  }
  return '';
}

const OMML_SYMBOL_TO_LATEX = [
  ['→', '\\rightarrow '],
  ['⇌', '\\rightleftharpoons '],
  ['⇒', '\\Rightarrow '],
  ['⇔', '\\Leftrightarrow '],
  ['↑', '\\uparrow '],
  ['↓', '\\downarrow '],
  ['≤', '\\le '],
  ['≥', '\\ge '],
  ['≠', '\\ne '],
  ['≈', '\\approx '],
  ['±', '\\pm '],
  ['×', '\\times '],
  ['⋅', '\\cdot '],
  ['÷', '\\div '],
  ['∞', '\\infty '],
  ['°', '^\\circ '],
  ['∆', '\\Delta '],
  ['Δ', '\\Delta '],
  ['α', '\\alpha '],
  ['β', '\\beta '],
  ['γ', '\\gamma '],
  ['π', '\\pi '],
  ['ω', '\\omega '],
  ['Ω', '\\Omega '],
  ['∈', '\\in '],
  ['∀', '\\forall '],
  ['∃', '\\exists '],
  ['⊥', '\\perp '],
  ['∥', '\\parallel '],
  ['∠', '\\angle '],
  ['△', '\\triangle ']
];

/**
 * Recursively convert Word Office Math Markup Language (<m:oMath>) node to KaTeX-safe LaTeX.
 */
export function ommlNodeToLatex(node) {
  if (!node) return '';
  if (node.tag === '#text') return node.text || '';

  const tag = node.tag;
  const kids = () => (node.children || []).map(ommlNodeToLatex).join('');

  if (tag === 'm:t') {
    let txt = (node.children || []).map((c) => c.text || '').join('');
    // Escape % and # so KaTeX never treats "80%" inside an equation as a comment!
    txt = txt.replace(/(^|[^\\])%/g, '$1\\%').replace(/(^|[^\\])#/g, '$1\\#');
    for (const [sym, rep] of OMML_SYMBOL_TO_LATEX) txt = txt.split(sym).join(rep);
    // Wrap words with Vietnamese diacritics in \text{...} so KaTeX renders them upright
    if (/[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(txt)) {
      return `\\text{${txt}}`;
    }
    return txt;
  }
  if (tag === 'm:r') {
    const rPr = findFirst(node, 'm:rPr');
    const isNormal = Boolean(findFirst(rPr, 'm:nor'));
    const body = findChildren(node, 'm:t').map(ommlNodeToLatex).join('');
    if (isNormal && body && !body.includes('\\')) {
      return `\\mathrm{${body}}`;
    }
    return body;
  }
  if (tag === 'm:f') {
    const num = ommlNodeToLatex(findFirst(node, 'm:num')).trim();
    const den = ommlNodeToLatex(findFirst(node, 'm:den')).trim();
    return `\\frac{${num}}{${den}}`;
  }
  if (tag === 'm:sSup') {
    const e = ommlNodeToLatex(findFirst(node, 'm:e')).trim();
    const sup = ommlNodeToLatex(findFirst(node, 'm:sup')).trim();
    return `${e}^{${sup}}`;
  }
  if (tag === 'm:sSub') {
    const e = ommlNodeToLatex(findFirst(node, 'm:e')).trim();
    const sub = ommlNodeToLatex(findFirst(node, 'm:sub')).trim();
    return `${e}_{${sub}}`;
  }
  if (tag === 'm:sSubSup') {
    const e = ommlNodeToLatex(findFirst(node, 'm:e')).trim();
    const sub = ommlNodeToLatex(findFirst(node, 'm:sub')).trim();
    const sup = ommlNodeToLatex(findFirst(node, 'm:sup')).trim();
    return `${e}_{${sub}}^{${sup}}`;
  }
  if (tag === 'm:sPre') {
    const sub = ommlNodeToLatex(findFirst(node, 'm:sub')).trim();
    const sup = ommlNodeToLatex(findFirst(node, 'm:sup')).trim();
    const e = ommlNodeToLatex(findFirst(node, 'm:e')).trim();
    return `{}_{${sub}}^{${sup}}${e}`;
  }
  if (tag === 'm:rad') {
    const deg = ommlNodeToLatex(findFirst(node, 'm:deg')).trim();
    const e = ommlNodeToLatex(findFirst(node, 'm:e')).trim();
    return deg ? `\\sqrt[${deg}]{${e}}` : `\\sqrt{${e}}`;
  }
  if (tag === 'm:d') {
    const dPr = findFirst(node, 'm:dPr');
    const beg = findFirst(dPr, 'm:begChr')?.attrs?.['m:val'] ?? '(';
    const end = findFirst(dPr, 'm:endChr')?.attrs?.['m:val'] ?? ')';
    const eqArr = findFirst(findFirst(node, 'm:e'), 'm:eqArr');
    if (eqArr && beg === '{' && !end) {
      const rows = findChildren(eqArr, 'm:e').map((r) => ommlNodeToLatex(r).trim());
      return `\\begin{cases} ${rows.join(' \\\\ ')} \\end{cases}`;
    }
    const inner = findChildren(node, 'm:e').map((c) => ommlNodeToLatex(c).trim()).join(', ');
    const safeBeg = beg === '{' ? '\\{' : beg;
    const safeEnd = end === '}' ? '\\}' : end;
    return `${safeBeg}${inner}${safeEnd}`;
  }
  if (tag === 'm:m') {
    const rows = findChildren(node, 'm:mr').map((mr) =>
      findChildren(mr, 'm:e').map((cell) => ommlNodeToLatex(cell).trim()).join(' & ')
    );
    return `\\begin{matrix} ${rows.join(' \\\\ ')} \\end{matrix}`;
  }
  if (tag === 'm:eqArr') {
    const rows = findChildren(node, 'm:e').map((r) => ommlNodeToLatex(r).trim());
    return rows.join(' \\\\ ');
  }
  if (tag === 'm:nary') {
    const nPr = findFirst(node, 'm:naryPr');
    const chr = findFirst(nPr, 'm:chr')?.attrs?.['m:val'] || '∫';
    const op = chr === '∑' ? '\\sum' : chr === '∏' ? '\\prod' : '\\int';
    const sub = ommlNodeToLatex(findFirst(node, 'm:sub')).trim();
    const sup = ommlNodeToLatex(findFirst(node, 'm:sup')).trim();
    const e = ommlNodeToLatex(findFirst(node, 'm:e')).trim();
    return `${op}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''} ${e}`.trim();
  }
  if (tag === 'm:acc') {
    const accPr = findFirst(node, 'm:accPr');
    const chr = findFirst(accPr, 'm:chr')?.attrs?.['m:val'] || '→';
    const e = ommlNodeToLatex(findFirst(node, 'm:e')).trim();
    if (chr === '→' || chr === '⃗') return `\\overrightarrow{${e}}`;
    if (chr === '¯' || chr === '̄') return `\\overline{${e}}`;
    return `\\hat{${e}}`;
  }
  if (tag === 'm:bar') {
    const pos = findFirst(findFirst(node, 'm:barPr'), 'm:pos')?.attrs?.['m:val'] || 'top';
    const e = ommlNodeToLatex(findFirst(node, 'm:e')).trim();
    return pos === 'bot' ? `\\underline{${e}}` : `\\overline{${e}}`;
  }
  if (tag === 'm:groupChr') {
    const chr = findFirst(findFirst(node, 'm:groupChrPr'), 'm:chr')?.attrs?.['m:val'] || '⏟';
    const e = ommlNodeToLatex(findFirst(node, 'm:e')).trim();
    return chr === '⏞' ? `\\overbrace{${e}}` : `\\underbrace{${e}}`;
  }
  if (tag === 'm:func') {
    const fName = ommlNodeToLatex(findFirst(node, 'm:fName')).trim();
    const e = ommlNodeToLatex(findFirst(node, 'm:e')).trim();
    return `${fName} ${e}`.trim();
  }
  if (tag === 'm:limLow' || tag === 'm:limUpp') {
    const e = ommlNodeToLatex(findFirst(node, 'm:e')).trim();
    const lim = ommlNodeToLatex(findFirst(node, 'm:lim')).trim();
    const cleanOp = e.replace(/^\\(?:mathrm|text)\{([^{}]+)\}$/, '$1').trim();
    if (cleanOp === '→' || cleanOp === '\\rightarrow') return `\\xrightarrow{${lim}}`;
    if (cleanOp === '⇌' || cleanOp === '\\rightleftharpoons') return `\\xrightleftharpoons{${lim}}`;
    if (/^(lim|max|min|sup|inf)$/i.test(cleanOp)) return `\\${cleanOp.toLowerCase()}_{${lim}}`;
    return tag === 'm:limUpp' ? `\\overset{${lim}}{${e}}` : `\\underset{${lim}}{${e}}`;
  }
  if (
    tag === 'm:oMath' || tag === 'm:oMathPara' || tag === 'm:e' || tag === 'm:num' ||
    tag === 'm:den' || tag === 'm:sub' || tag === 'm:sup' || tag === 'm:deg' ||
    tag === 'm:box' || tag === 'm:borderBox'
  ) {
    return kids();
  }
  if (tag.endsWith('Pr')) return '';
  return kids();
}

function isNonBlackColor(val, themeColor) {
  if (themeColor) {
    const tc = themeColor.trim().toLowerCase();
    if (tc && !['text1', 'dark1', 'background1', 'light1'].includes(tc)) return true;
  }
  if (!val) return false;
  const v = val.trim().toUpperCase();
  if (!v || v === 'AUTO' || v === '000000' || v === '111827' || v === '1F2937' || v === '333333' || v === '222222' || v === '0D0D0D') {
    return false;
  }
  return true;
}

function extractRunStyle(rNode) {
  const rPr = findFirst(rNode, 'w:rPr');
  if (!rPr) return { bold: false, underline: false, colored: false, highlighted: false, vertAlign: null };

  const bNode = findFirst(rPr, 'w:b');
  const bold = Boolean(bNode && bNode.attrs?.['w:val'] !== '0' && bNode.attrs?.['w:val'] !== 'false');

  const uNode = findFirst(rPr, 'w:u');
  const underline = Boolean(uNode && uNode.attrs?.['w:val'] !== 'none' && uNode.attrs?.['w:val'] !== '0');

  const colorNode = findFirst(rPr, 'w:color');
  const colorVal = colorNode?.attrs?.['w:val'] || '';
  const themeColor = colorNode?.attrs?.['w:themeColor'] || '';
  const colored = isNonBlackColor(colorVal, themeColor);

  const hlVal = findFirst(rPr, 'w:highlight')?.attrs?.['w:val'] || '';
  const shdFill = findFirst(rPr, 'w:shd')?.attrs?.['w:fill'] || '';
  const highlighted = Boolean(
    (hlVal && hlVal.toLowerCase() !== 'none') ||
    (shdFill && shdFill.toUpperCase() !== 'AUTO' && shdFill.toUpperCase() !== 'FFFFFF' && shdFill.toUpperCase() !== '000000')
  );

  const vertAlign = findFirst(rPr, 'w:vertAlign')?.attrs?.['w:val'] || null;
  return { bold, underline, colored, highlighted, vertAlign, colorVal };
}

function extractRunText(rNode) {
  let out = '';
  for (const child of rNode.children || []) {
    if (child.tag === 'w:t') {
      out += (child.children || []).map((t) => t.text || '').join('');
    } else if (child.tag === 'w:tab') {
      out += '\t';
    } else if (child.tag === 'w:br' || child.tag === 'w:cr') {
      out += '\n';
    }
  }
  return out;
}

/**
 * Parse word/numbering.xml so auto-numbered Word lists ("Câu 1.", "A.", "a)") are recovered cleanly.
 */
function parseNumberingXml(numberingXml) {
  const numToAbstract = new Map();
  const abstractLevels = new Map();
  if (!numberingXml) return { numToAbstract, abstractLevels };

  const tree = parseXml(numberingXml);
  for (const abs of collectDescendants(tree, (n) => n.tag === 'w:abstractNum')) {
    const absId = abs.attrs?.['w:abstractNumId'];
    if (!absId) continue;
    const lvls = new Map();
    for (const lvl of findChildren(abs, 'w:lvl')) {
      const ilvl = lvl.attrs?.['w:ilvl'] ?? '0';
      const start = Number(findFirst(lvl, 'w:start')?.attrs?.['w:val'] ?? 1) || 1;
      const numFmt = findFirst(lvl, 'w:numFmt')?.attrs?.['w:val'] || 'decimal';
      const lvlText = findFirst(lvl, 'w:lvlText')?.attrs?.['w:val'] || '%1.';
      lvls.set(ilvl, { start, numFmt, lvlText });
    }
    abstractLevels.set(absId, lvls);
  }

  for (const num of collectDescendants(tree, (n) => n.tag === 'w:num')) {
    const numId = num.attrs?.['w:numId'];
    const absId = findFirst(num, 'w:abstractNumId')?.attrs?.['w:val'];
    if (numId && absId) numToAbstract.set(numId, absId);
  }
  return { numToAbstract, abstractLevels };
}

function formatListNumber(n, fmt) {
  if (fmt === 'upperLetter') return String.fromCharCode(64 + ((n - 1) % 26) + 1);
  if (fmt === 'lowerLetter') return String.fromCharCode(96 + ((n - 1) % 26) + 1);
  if (fmt === 'upperRoman') {
    return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
  }
  if (fmt === 'bullet') return '•';
  return String(n);
}

function resolveMediaTarget(target) {
  if (!target) return '';
  let norm = target.replace(/\\/g, '/').replace(/^\/+/, '');
  if (norm.startsWith('../')) norm = norm.replace(/^\.\.\//, '');
  if (!norm.startsWith('word/')) norm = `word/${norm}`;
  return norm.toLowerCase();
}

function collectImagesFromNode(node, relsMap, mediaMap, outImages, stateCounters) {
  // Handle mc:AlternateContent without duplicating Choice + Fallback!
  if (node.tag === 'mc:AlternateContent') {
    const choice = findFirst(node, 'mc:Choice');
    const before = outImages.length;
    if (choice) collectImagesFromNode(choice, relsMap, mediaMap, outImages, stateCounters);
    if (outImages.length === before) {
      const fb = findFirst(node, 'mc:Fallback');
      if (fb) collectImagesFromNode(fb, relsMap, mediaMap, outImages, stateCounters);
    }
    return;
  }

  // Modern OOXML DrawingML (<a:blip r:embed="rId..."/>) & Legacy VML (<v:imagedata r:id="rId..."/>)
  const rId =
    (node.tag === 'a:blip' && (node.attrs?.['r:embed'] || node.attrs?.['r:link'])) ||
    (node.tag === 'v:imagedata' && (node.attrs?.['r:id'] || node.attrs?.['o:relid'])) ||
    (node.tag === 'imagedata' && (node.attrs?.['r:id'] || node.attrs?.['o:relid'])) ||
    null;

  if (rId) {
    const target = relsMap.get(rId);
    if (target) {
      const key = resolveMediaTarget(target);
      const entry = mediaMap.get(key);
      if (entry?.dataUrl) {
        if (!outImages.includes(entry.dataUrl)) outImages.push(entry.dataUrl);
      } else if (entry?.unsupported) {
        stateCounters.unsupportedMediaCount += 1;
      }
    }
    return;
  }

  for (const child of node.children || []) {
    collectImagesFromNode(child, relsMap, mediaMap, outImages, stateCounters);
  }
}

function extractParagraphData(pNode, relsMap, mediaMap, numberingCtx, stateCounters) {
  const runs = [];
  const images = [];

  // Recover Word automatic numbering (<w:numPr>) if present
  const pPr = findFirst(pNode, 'w:pPr');
  const numPr = findFirst(pPr, 'w:numPr');
  let autoPrefix = '';
  if (numPr && numberingCtx) {
    const numId = findFirst(numPr, 'w:numId')?.attrs?.['w:val'];
    const ilvl = findFirst(numPr, 'w:ilvl')?.attrs?.['w:val'] ?? '0';
    const absId = numberingCtx.numToAbstract.get(numId);
    const lvlDef = numberingCtx.abstractLevels.get(absId)?.get(ilvl);
    if (lvlDef && lvlDef.numFmt !== 'bullet') {
      const counterKey = `${numId}:${ilvl}`;
      const curVal = numberingCtx.counters.has(counterKey)
        ? numberingCtx.counters.get(counterKey) + 1
        : lvlDef.start;
      numberingCtx.counters.set(counterKey, curVal);
      // Reset deeper sub-levels (e.g. reset A..D when starting next Câu)
      for (const k of numberingCtx.counters.keys()) {
        const [kNum, kLvl] = k.split(':');
        if (kNum === numId && Number(kLvl) > Number(ilvl)) numberingCtx.counters.delete(k);
      }
      const token = formatListNumber(curVal, lvlDef.numFmt);
      const placeholder = `%${Number(ilvl) + 1}`;
      const rendered = lvlDef.lvlText.includes(placeholder)
        ? lvlDef.lvlText.replace(placeholder, token)
        : `${token}.`;
      autoPrefix = `${rendered} `;
    }
  }

  function walk(node) {
    for (const child of node.children || []) {
      if (child.tag === 'mc:AlternateContent') {
        const choice = findFirst(child, 'mc:Choice');
        const beforeRuns = runs.length;
        const beforeImgs = images.length;
        if (choice) walk(choice);
        if (runs.length === beforeRuns && images.length === beforeImgs) {
          const fb = findFirst(child, 'mc:Fallback');
          if (fb) walk(fb);
        }
      } else if (child.tag === 'w:r') {
        const style = extractRunStyle(child);
        const text = extractRunText(child);
        if (text) {
          let formatted = text;
          // Emit safe <sub>/<sup> for plain Word sub/superscripts instead of raw _{2}/^{2} outside math!
          if (style.vertAlign === 'subscript') formatted = `<sub>${text}</sub>`;
          else if (style.vertAlign === 'superscript') formatted = `<sup>${text}</sup>`;
          runs.push({ text: formatted, rawText: text, style });
        }
        collectImagesFromNode(child, relsMap, mediaMap, images, stateCounters);
      } else if (child.tag === 'm:oMathPara' || child.tag === 'm:oMath') {
        const latex = ommlNodeToLatex(child).trim();
        if (latex) {
          const token = `$${latex}$`;
          runs.push({
            text: token,
            rawText: token,
            style: { bold: false, underline: false, colored: false, highlighted: false }
          });
        }
      } else if (
        child.tag === 'w:hyperlink' || child.tag === 'w:ins' || child.tag === 'w:smartTag' ||
        child.tag === 'w:sdt' || child.tag === 'w:sdtContent' || child.tag === 'w:txbxContent' ||
        child.tag === 'w:p'
      ) {
        walk(child);
      }
    }
  }

  walk(pNode);

  let fullText = runs.map((r) => r.text).join('').replace(/\u00a0/g, ' ');
  if (autoPrefix && fullText.trim() && !fullText.trimStart().startsWith(autoPrefix.trim())) {
    fullText = autoPrefix + fullText;
    runs.unshift({ text: autoPrefix, rawText: autoPrefix, style: { bold: false, underline: false, colored: false, highlighted: false } });
  }
  return { text: fullText, runs, images };
}

function extractBodyLines(docXml, relsXml, numberingXml, mediaMap, stateCounters) {
  const relsMap = new Map();
  if (relsXml) {
    const relsTree = parseXml(relsXml);
    for (const r of collectDescendants(relsTree, (n) => n.tag === 'Relationship')) {
      if (r.attrs?.Id && r.attrs?.Target) relsMap.set(r.attrs.Id, r.attrs.Target);
    }
  }

  const numberingInfo = parseNumberingXml(numberingXml);
  const numberingCtx = { ...numberingInfo, counters: new Map() };

  const docTree = parseXml(docXml);
  const body = collectDescendants(docTree, (n) => n.tag === 'w:body')[0];
  if (!body) return [];

  const lines = [];

  for (const child of body.children || []) {
    if (child.tag === 'w:p') {
      const p = extractParagraphData(child, relsMap, mediaMap, numberingCtx, stateCounters);
      if (p.text.trim() || p.images.length) lines.push(p);
    } else if (child.tag === 'w:tbl') {
      const rows = findChildren(child, 'w:tr');
      for (const row of rows) {
        const cells = findChildren(row, 'w:tc');
        const cellItems = cells.map((tc) => {
          const ps = findChildren(tc, 'w:p').map((p) =>
            extractParagraphData(p, relsMap, mediaMap, numberingCtx, stateCounters)
          );
          return {
            text: ps.map((p) => p.text.trim()).filter(Boolean).join(' '),
            runs: ps.flatMap((p) => p.runs),
            images: ps.flatMap((p) => p.images)
          };
        });
        const nonEmpty = cellItems.filter((c) => c.text || c.images.length);
        if (!nonEmpty.length) continue;

        const hasOptionCells = nonEmpty.some((c) => /^\*?[A-Da-d][\.\)]\s*/.test(c.text));
        if (hasOptionCells) {
          for (const c of nonEmpty) lines.push(c);
        } else {
          lines.push({
            text: nonEmpty.map((c) => c.text).join('\t'),
            runs: nonEmpty.flatMap((c) => c.runs),
            images: nonEmpty.flatMap((c) => c.images),
            isTableRow: true,
            cells: nonEmpty.map((c) => c.text)
          });
        }
      }
    }
  }

  return lines;
}

function inspectOptionRuns(runs, optionLabelChar) {
  let hasUnderline = false;
  let hasColor = false;
  let hasHighlight = false;
  let labelBold = false;
  let bodyChars = 0;
  let boldBodyChars = 0;

  let acc = '';
  for (const r of runs || []) {
    const txt = r.text || '';
    const before = acc;
    acc += txt;
    const isLabelChunk =
      before.trim().length === 0 &&
      new RegExp(`^\\*?${optionLabelChar}[\\.\\)]\\s*$`, 'i').test(txt.trim());

    if (r.style?.underline) hasUnderline = true;
    if (r.style?.colored) hasColor = true;
    if (r.style?.highlighted) hasHighlight = true;
    if (isLabelChunk && r.style?.bold) labelBold = true;

    const trimmed = txt.replace(new RegExp(`^\\*?${optionLabelChar}[\\.\\)]\\s*`, 'i'), '').trim();
    if (trimmed) {
      bodyChars += trimmed.length;
      if (r.style?.bold) boldBodyChars += trimmed.length;
    }
  }

  const signal = hasUnderline ? 'underline' : hasHighlight ? 'highlight' : hasColor ? 'color' : null;
  const bodyBold = bodyChars > 0 && boldBodyChars / bodyChars >= 0.75;
  return { signal, labelBold, bodyBold };
}

function splitInlineOptions(line) {
  const txt = line.text;
  // Support A. / A) separated by tab, >=2 spaces, or single space before next letter B./C./D.
  const re = /(?:^|[\t ]+)(\*?[A-D])[\.\)]\s+/g;
  const matches = [];
  let m;
  while ((m = re.exec(txt)) !== null) {
    const letter = m[1].replace('*', '').toUpperCase();
    // Avoid false positives in mid-sentence unless starting at 0 or sequential after previous option
    const prevLetter = matches.length ? matches[matches.length - 1].letter : null;
    const expectedNext = prevLetter ? String.fromCharCode(prevLetter.charCodeAt(0) + 1) : 'A';
    if (matches.length === 0 && m.index > 0 && letter !== 'A') continue;
    if (matches.length > 0 && letter !== expectedNext && !['A', 'B', 'C', 'D'].includes(letter)) continue;
    matches.push({
      letter,
      starred: m[1].startsWith('*'),
      start: m.index,
      contentStart: m.index + m[0].length
    });
  }
  if (matches.length <= 1) return null;

  const charRuns = [];
  let pos = 0;
  for (const r of line.runs || []) {
    const len = (r.text || '').length;
    charRuns.push({ start: pos, end: pos + len, run: r });
    pos += len;
  }

  const leadPrompt = matches[0].start > 0 ? txt.slice(0, matches[0].start).trim() : '';
  const options = matches.map((cur, idx) => {
    const end = idx + 1 < matches.length ? matches[idx + 1].start : txt.length;
    const sliceRuns = charRuns.filter((cr) => cr.end > cur.start && cr.start < end).map((cr) => cr.run);
    const meta = inspectOptionRuns(sliceRuns, cur.letter);
    return {
      letter: cur.letter,
      starred: cur.starred,
      text: txt.slice(cur.contentStart, end).trim(),
      signal: cur.starred ? 'asterisk' : meta.signal,
      labelBold: meta.labelBold,
      bodyBold: meta.bodyBold
    };
  });

  return { leadPrompt, options };
}

function parseAnswerTable(linesAfterEnd) {
  const answers = new Map();

  for (let i = 0; i < linesAfterEnd.length; i++) {
    const line = linesAfterEnd[i];
    const txt = (line.text || '').trim();
    if (!txt) continue;

    // 2-row Word table: Row 1 "Câu | 1 | 2 | 3", Row 2 "Đáp án | A | C | B"
    if (line.cells && line.cells.length >= 2 && i + 1 < linesAfterEnd.length && linesAfterEnd[i + 1].cells) {
      const nums = line.cells.map((c) => c.match(/^\s*(?:Câu\s*)?(\d+)\s*$/i)?.[1] || null);
      const vals = linesAfterEnd[i + 1].cells;
      if (nums.filter(Boolean).length >= 2 && vals.length === nums.length) {
        for (let c = 0; c < nums.length; c++) {
          if (nums[c] && vals[c]?.trim()) answers.set(Number(nums[c]), vals[c].trim());
        }
        i++;
        continue;
      }
    }

    // Inline pairs: "1.A 2.B", "1. ĐSĐS", "Câu 1: Đ-S-Đ-Đ", "Câu 9: 8,2"
    const pairRe = /(?:Câu\s*)?(\d+)\s*[\.:\-\)]\s*([ĐSđsTFtf](?:[\s,\-]*[ĐSđsTFtf]){3}|[A-D]\b|[-+]?\d+(?:[.,]\d+)?)/g;
    let m;
    while ((m = pairRe.exec(txt)) !== null) {
      answers.set(Number(m[1]), m[2].trim());
    }
  }

  return answers;
}

function normalizeTagMetadata(text) {
  let level = 'TH';
  let chapter = 'Chung';
  let clean = text;

  const metaMatch = clean.match(/[\[\(]\s*(?:Mức\s*độ\s*:\s*)?(NB|TH|VDC|VD)(?:\s*[|·-]\s*([^\]\)]+))?\s*[\]\)]/i);
  if (metaMatch) {
    level = metaMatch[1].toUpperCase();
    if (metaMatch[2]) chapter = metaMatch[2].trim();
    clean = clean.replace(metaMatch[0], '').trim();
  }
  const chapMatch = clean.match(/\[Chương\s*:\s*([^\]]+)\]/i);
  if (chapMatch) {
    chapter = chapMatch[1].trim();
    clean = clean.replace(chapMatch[0], '').trim();
  }
  return { clean, level, chapter };
}

function extractAnswerFromSolution(explanation) {
  if (!explanation) return null;
  const m = explanation.match(/(?:chọn|đáp\s+án(?:\s+đúng)?(?:\s+là)?)\s*[:.]?\s*([A-D])\b/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Unified exam structure & answer-key parser shared by BOTH .docx and .pdf importers.
 */
export function parseExamLines(lines, { title = 'Đề thi mới nhập' } = {}) {
  let currentPart = 'I';
  let sawExplicitPart = false;
  let inAfterEnd = false;
  const afterEndLines = [];
  const questions = [];
  let current = null;
  let mode = 'prompt'; // 'prompt' | 'option' | 'solution'
  let lastOptionKey = null;
  let detectedTitle = title;

  const pushCurrent = () => {
    if (!current) return;

    // Auto-infer Part II if statements a-d were found even without a "PHẦN II" heading!
    const tfCount = Object.keys(current.statementsMap).length;
    const mcqCount = Object.keys(current.optionsMap).length;
    if (tfCount >= 2 && mcqCount === 0) {
      current.part = 'II';
    } else if (mcqCount >= 2 && tfCount === 0) {
      current.part = 'I';
    } else if (mcqCount === 0 && tfCount === 0 && current.part !== 'III' && current.answer && /^[-+]?\d+(?:[.,]\d+)?$/.test(String(current.answer))) {
      current.part = 'III';
    }

    if (current.part === 'I') {
      const letters = ['A', 'B', 'C', 'D'];
      const opts = letters.map((l) => (current.optionsMap[l] || '').trim());
      current.options = opts;

      // Signal #5: Bold contrast (if EXACTLY 1 of 4 options is bold in body or label)
      if (!current.answer) {
        const boldBodyLetters = letters.filter((l) => current.optionMeta[l]?.bodyBold);
        const boldLabelLetters = letters.filter((l) => current.optionMeta[l]?.labelBold);
        if (boldBodyLetters.length === 1) {
          current.answer = boldBodyLetters[0];
          current.answerSignal = 'bold-contrast';
        } else if (boldLabelLetters.length === 1) {
          current.answer = boldLabelLetters[0];
          current.answerSignal = 'bold-contrast';
        }
      }

      // Signal #6: Fallback extraction from Lời giải ("Chọn C")
      if (!current.answer && current.explanation) {
        const fromSol = extractAnswerFromSolution(current.explanation);
        if (fromSol) {
          current.answer = fromSol;
          current.answerSignal = 'from-solution';
        }
      }

      if (!current.answer) current.warnings.push('Chưa nhận diện được đáp án đúng (A/B/C/D).');
      if (opts.some((o) => !o)) current.warnings.push('Thiếu một hoặc nhiều phương án A–D.');
    } else if (current.part === 'II') {
      const labels = ['a', 'b', 'c', 'd'];
      current.options = labels.map((l) => (current.statementsMap[l]?.text || '').trim());
      current.answer = labels.map((l) => current.statementsMap[l]?.correct ?? null);
      if (current.options.some((o) => !o)) current.warnings.push('Thiếu nhận định a/b/c/d.');
      if (current.answer.some((v) => v === null)) current.warnings.push('Chưa đủ đáp án Đúng/Sai cho cả 4 ý a–d.');
    } else if (current.part === 'III') {
      if (current.answer === null || current.answer === '') {
        current.warnings.push('Chưa có đáp án số cho câu trả lời ngắn.');
      }
    }

    current.image = current.images[0] || '';
    delete current.optionsMap;
    delete current.optionMeta;
    delete current.statementsMap;
    questions.push(current);
    current = null;
    lastOptionKey = null;
  };

  for (const line of lines) {
    const raw = (line.text || '').trim();
    const lineImgs = Array.isArray(line.images) ? line.images.filter(Boolean) : [];
    if (!raw && !lineImgs.length) continue;

    // End-of-exam marker (HẾT or BẢNG ĐÁP ÁN)
    if (
      /^[-—–=*_\s]*(?:HẾT|HET)[-—–=*_\s]*$/i.test(raw) ||
      (questions.length > 0 && /^(?:BẢNG\s+ĐÁP\s+ÁN|BANG\s+DAP\s+AN|ĐÁP\s+ÁN\s+THAM\s+KHẢO|ĐÁP\s+ÁN\s+ĐỀ\s+THI)\b/i.test(raw))
    ) {
      pushCurrent();
      inAfterEnd = true;
      continue;
    }
    if (inAfterEnd) {
      afterEndLines.push(line);
      continue;
    }

    if (!current && questions.length === 0 && /^(?:ĐỀ\s+(?:KIỂM\s+TRA|THI|ÔN\s+TẬP|MINH\s+HỌA)|DE\s+(?:KIEM\s+TRA|THI)|BÀI\s+KIỂM\s+TRA|SỞ\s+GIÁO\s+DỤC)/i.test(raw)) {
      if (!/^SỞ\s+GIÁO\s+DỤC/i.test(raw)) detectedTitle = raw;
      continue;
    }

    // Flexible Part headers: "PHẦN I.", "Phần 2:", "PHAN I", "I. TRẮC NGHIỆM", "II. ĐÚNG SAI", "III. TRẢ LỜI NGẮN"
    const partMatch =
      raw.match(/^(?:PHẦN|Phần|PHAN|Phan)\s+(III|II|I|1|2|3)\b/i) ||
      raw.match(/^(III|II|I)[\.\:]\s*(?:PHẦN|CÂU\s+TRẮC\s+NGHIỆM|TRẮC\s+NGHIỆM|ĐÚNG\s*[-/]?\s*SAI|TRẢ\s+LỜI\s+NGẮN)/i);
    if (partMatch) {
      pushCurrent();
      const token = partMatch[1].toUpperCase();
      currentPart = token === '1' ? 'I' : token === '2' ? 'II' : token === '3' ? 'III' : token;
      sawExplicitPart = true;
      continue;
    }

    // Flexible Question header:
    // "Câu 1.", "Cau 1.", "Câu 01:", "Câu 1 (0,25 điểm):", "Câu 1 [NB].", "Bài 2:", "Question 3.", or bare "1." inside a Part
    const qMatch =
      raw.match(/^(?:Câu|Cau|Bài|Bai|Question)\s+0*(\d+)(?:\s*[\(\[][^\)\]]{1,40}[\)\]])?\s*(?:[\.:\)]\s*|\s+)(.*)$/i) ||
      (sawExplicitPart && mode !== 'solution' ? raw.match(/^0*(\d+)\.\s+(.{8,})$/) : null);

    if (qMatch) {
      pushCurrent();
      const { clean, level, chapter } = normalizeTagMetadata(qMatch[2] || '');
      current = {
        id: `q${questions.length + 1}`,
        sourceNumber: Number(qMatch[1]),
        part: currentPart,
        prompt: clean,
        optionsMap: {},
        optionMeta: {},
        statementsMap: {},
        options: [],
        answer: currentPart === 'III' ? '' : null,
        answerSignal: null,
        explanation: '',
        images: [...lineImgs],
        image: lineImgs[0] || '',
        lockOrder: false,
        lockOptions: false,
        level,
        chapter,
        warnings: []
      };
      mode = 'prompt';
      lastOptionKey = null;

      // Check if options A. B. C. D. were written on the VERY SAME line as the question prompt!
      if (current.part === 'I') {
        const inlineSameLine = splitInlineOptions({ text: current.prompt, runs: line.runs });
        if (inlineSameLine && inlineSameLine.options.length >= 2) {
          current.prompt = inlineSameLine.leadPrompt;
          for (const opt of inlineSameLine.options) {
            current.optionsMap[opt.letter] = opt.text;
            current.optionMeta[opt.letter] = { labelBold: opt.labelBold, bodyBold: opt.bodyBold };
            if (opt.signal && !current.answer) {
              current.answer = opt.letter;
              current.answerSignal = opt.signal;
            }
            lastOptionKey = opt.letter;
          }
          mode = 'option';
        }
      }
      continue;
    }

    if (!current) continue;

    // Attach ALL unique images found on any line belonging to the current question
    for (const img of lineImgs) {
      if (!current.images.includes(img)) current.images.push(img);
    }
    if (!raw) continue;

    // Solution / Explanation
    const solMatch = raw.match(/^(?:Lời\s+giải|Hướng\s+dẫn\s+giải|Giải\s+thích|HDG|Giải)\s*[:.]\s*(.*)$/i);
    if (solMatch) {
      mode = 'solution';
      lastOptionKey = null;
      current.explanation = solMatch[1].trim();
      continue;
    }

    // Explicit Answer line inside question
    const ansLineMatch = raw.match(/^(?:Đáp\s+án(?:\s+đúng)?|Chọn|Key)\s*[:.]?\s*(.+)$/i);
    if (ansLineMatch && mode !== 'solution') {
      const val = ansLineMatch[1].trim();
      if (current.part === 'I') {
        const ch = val.match(/^([A-D])\b/i);
        if (ch) {
          current.answer = ch[1].toUpperCase();
          current.answerSignal = 'explicit-key';
          continue;
        }
      } else if (current.part === 'III') {
        const num = val.match(/[-+]?\d+(?:[.,]\d+)?/);
        if (num) {
          current.answer = num[0].replace(',', '.');
          current.answerSignal = 'explicit-key';
          continue;
        }
      } else if (current.part === 'II') {
        const flags = [...val.matchAll(/(?:[a-d]\s*[\)\.\-:]\s*)?(Đúng|Sai|Đ|S|True|False|T|F)\b/gi)].map((x) =>
          /^(?:Đ|T)/i.test(x[1])
        );
        if (flags.length === 4) {
          ['a', 'b', 'c', 'd'].forEach((l, idx) => {
            if (!current.statementsMap[l]) current.statementsMap[l] = { text: '', correct: flags[idx] };
            else current.statementsMap[l].correct = flags[idx];
          });
          current.answerSignal = 'explicit-key';
          continue;
        }
      }
    }

    if (mode === 'solution') {
      current.explanation = current.explanation ? `${current.explanation}\n${raw}` : raw;
      continue;
    }

    // Check Part II statements a) b) c) d) EVEN IF currentPart was still 'I' (missing PHẦN II header!)
    const tfMatch = raw.match(/^(\*?)([a-d])[\)\.]\s+(.+)$/);
    if (tfMatch && (current.part === 'II' || Object.keys(current.optionsMap).length === 0)) {
      const starred = tfMatch[1] === '*';
      const label = tfMatch[2].toLowerCase();
      let text = tfMatch[3].trim();
      let correct = null;

      const tagEnd = text.match(/\s*[\[\(]\s*(ĐÚNG|SAI|Đ|S|TRUE|FALSE)\s*[\]\)]\s*$/i);
      const tagStart = !tagEnd ? text.match(/^[\[\(]\s*(ĐÚNG|SAI|Đ|S|TRUE|FALSE)\s*[\]\)]\s*/i) : null;
      if (tagEnd) {
        correct = /^(?:Đ|T)/i.test(tagEnd[1]);
        text = text.slice(0, tagEnd.index).trim();
        current.answerSignal = current.answerSignal || 'inline-tag';
      } else if (tagStart) {
        correct = /^(?:Đ|T)/i.test(tagStart[1]);
        text = text.slice(tagStart[0].length).trim();
        current.answerSignal = current.answerSignal || 'inline-tag';
      } else if (starred) {
        correct = true;
        current.answerSignal = current.answerSignal || 'asterisk';
      } else {
        const meta = inspectOptionRuns(line.runs, label);
        if (meta.signal) {
          correct = true;
          current.answerSignal = current.answerSignal || meta.signal;
        }
      }
      current.statementsMap[label] = { text, correct };
      mode = 'option';
      lastOptionKey = label;
      continue;
    }

    // Part I options A. B. C. D. (inline or single-line)
    if (current.part === 'I' || Object.keys(current.statementsMap).length === 0) {
      const inlineRes = splitInlineOptions(line);
      if (inlineRes && inlineRes.options.length >= 2) {
        if (inlineRes.leadPrompt) {
          current.prompt = current.prompt ? `${current.prompt}\n${inlineRes.leadPrompt}` : inlineRes.leadPrompt;
        }
        for (const opt of inlineRes.options) {
          current.optionsMap[opt.letter] = opt.text;
          current.optionMeta[opt.letter] = { labelBold: opt.labelBold, bodyBold: opt.bodyBold };
          if (opt.signal && !current.answer) {
            current.answer = opt.letter;
            current.answerSignal = opt.signal;
          }
          lastOptionKey = opt.letter;
        }
        mode = 'option';
        continue;
      }

      const singleOpt = raw.match(/^(\*?)([A-D])[\.\)]\s*(.+)$/);
      if (singleOpt) {
        const starred = singleOpt[1] === '*';
        const letter = singleOpt[2].toUpperCase();
        current.optionsMap[letter] = singleOpt[3].trim();
        const meta = inspectOptionRuns(line.runs, letter);
        current.optionMeta[letter] = { labelBold: meta.labelBold, bodyBold: meta.bodyBold };
        const sig = starred ? 'asterisk' : meta.signal;
        if (sig && !current.answer) {
          current.answer = letter;
          current.answerSignal = sig;
        }
        mode = 'option';
        lastOptionKey = letter;
        continue;
      }
    }

    // Continuation line: attach to active option if we're inside an option, otherwise prompt!
    if (mode === 'option' && lastOptionKey) {
      if (/[A-D]/.test(lastOptionKey) && current.optionsMap[lastOptionKey] != null) {
        current.optionsMap[lastOptionKey] = `${current.optionsMap[lastOptionKey]} ${raw}`.trim();
        continue;
      }
      if (/[a-d]/.test(lastOptionKey) && current.statementsMap[lastOptionKey]) {
        current.statementsMap[lastOptionKey].text = `${current.statementsMap[lastOptionKey].text} ${raw}`.trim();
        continue;
      }
    }

    current.prompt = current.prompt ? `${current.prompt}\n${raw}` : raw;
  }

  pushCurrent();

  // Apply answer table found after "HẾT" or "BẢNG ĐÁP ÁN"
  if (afterEndLines.length) {
    const answerMap = parseAnswerTable(afterEndLines);
    for (const q of questions) {
      const fromTable = answerMap.get(q.sourceNumber);
      if (!fromTable) continue;
      if (q.part === 'I' && /^[A-D]$/i.test(fromTable)) {
        q.answer = fromTable.toUpperCase();
        q.answerSignal = 'end-table';
        q.warnings = q.warnings.filter((w) => !w.includes('đáp án'));
      } else if (q.part === 'II') {
        const flags = [...fromTable.matchAll(/[ĐSđsTFtf]/g)].map((x) => /^[ĐđTt]$/.test(x[0]));
        if (flags.length === 4) {
          q.answer = flags;
          q.answerSignal = 'end-table';
          q.warnings = q.warnings.filter((w) => !w.includes('Đúng/Sai'));
        }
      } else if (q.part === 'III' && /^[-+]?\d+(?:[.,]\d+)?$/.test(fromTable)) {
        q.answer = fromTable.replace(',', '.');
        q.answerSignal = 'end-table';
        q.warnings = q.warnings.filter((w) => !w.includes('đáp án'));
      }
    }
  }

  // Infer unmarked Part II statements as False when teacher highlighted/underlined ONLY the True ones
  for (const q of questions) {
    if (q.part === 'II' && Array.isArray(q.answer)) {
      const hasTrue = q.answer.some((v) => v === true);
      const hasNull = q.answer.some((v) => v === null);
      if (hasTrue && hasNull && ['underline', 'color', 'highlight', 'asterisk'].includes(q.answerSignal)) {
        q.answer = q.answer.map((v) => (v === true ? true : false));
        q.warnings = q.warnings.filter((w) => !w.includes('Đúng/Sai'));
      }
    }
    if (
      q.part === 'I' &&
      q.options.some((o) =>
        /cả\s+[a-d]\s+và\s+[a-d]|tất\s+cả\s+(?:các\s+)?(?:ý|đáp\s+án|phương\s+án|phát\s+biểu|nhận\s+định|câu|trên)|đều\s+(?:đúng|sai)/i.test(o)
      )
    ) {
      q.lockOptions = true;
    }
  }

  questions.forEach((q, idx) => {
    q.id = `q${idx + 1}`;
  });

  const warningCount = questions.reduce((n, q) => n + q.warnings.length, 0);
  return {
    title: detectedTitle,
    subject: 'Hóa học',
    durationMinutes: 50,
    examCode: '101',
    questions,
    stats: {
      total: questions.length,
      partI: questions.filter((q) => q.part === 'I').length,
      partII: questions.filter((q) => q.part === 'II').length,
      partIII: questions.filter((q) => q.part === 'III').length,
      withExplanation: questions.filter((q) => Boolean(q.explanation)).length,
      withImages: questions.filter((q) => (q.images?.length || 0) > 0).length,
      warningCount
    }
  };
}

/**
 * Parse a real Microsoft Word .docx ArrayBuffer/Uint8Array right in the browser!
 */
export async function parseDocxExam(arrayBuffer, fileName = 'de-thi.docx') {
  const entries = await readZipEntries(arrayBuffer);
  const docBytes = entries.get('word/document.xml');
  if (!docBytes) {
    throw new Error('Không tìm thấy word/document.xml bên trong tệp .docx.');
  }
  const docXml = textDecoder.decode(docBytes);
  const relsBytes = entries.get('word/_rels/document.xml.rels');
  const relsXml = relsBytes ? textDecoder.decode(relsBytes) : '';
  const numberingBytes = entries.get('word/numbering.xml');
  const numberingXml = numberingBytes ? textDecoder.decode(numberingBytes) : '';

  // Load & auto-compress embedded images (PNG, JPEG, WebP, GIF, BMP, SVG); flag legacy WMF/EMF explicitly
  const mediaMap = new Map();
  let extractedMediaCount = 0;
  for (const [entryPath, bytes] of entries.entries()) {
    const lowerPath = entryPath.toLowerCase();
    if (!lowerPath.startsWith('word/media/')) continue;
    const ext = lowerPath.split('.').pop();
    if (ext === 'wmf' || ext === 'emf') {
      mediaMap.set(lowerPath, { unsupported: true, ext });
      continue;
    }
    const mime =
      ext === 'png' ? 'image/png' :
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'webp' ? 'image/webp' :
      ext === 'gif' ? 'image/gif' :
      ext === 'bmp' ? 'image/bmp' :
      ext === 'svg' ? 'image/svg+xml' : null;
    if (!mime) continue;

    const rawUrl = `data:${mime};base64,${bytesToBase64(bytes)}`;
    const finalUrl = ext === 'svg' ? rawUrl : await compressImageDataUrl(rawUrl);
    if (finalUrl) {
      mediaMap.set(lowerPath, { dataUrl: finalUrl });
      extractedMediaCount += 1;
    }
  }

  const stateCounters = { unsupportedMediaCount: 0 };
  const lines = extractBodyLines(docXml, relsXml, numberingXml, mediaMap, stateCounters);
  const cleanName = fileName.replace(/\.docx$/i, '').replace(/[_-]+/g, ' ').trim();
  const parsed = parseExamLines(lines, { title: cleanName || 'Đề thi nhập từ Word' });

  const notices = [];
  if (stateCounters.unsupportedMediaCount > 0) {
    notices.push(
      `Phát hiện ${stateCounters.unsupportedMediaCount} công thức/ảnh định dạng cũ (.wmf/.emf, thường từ MathType) mà trình duyệt không hiển thị trực tiếp. Bạn có thể chuyển MathType sang Word Equation hoặc xuất PDF để giữ nguyên hình.`
    );
  }

  return {
    ...parsed,
    sourceKind: 'docx',
    sourceFileName: fileName,
    extractedMediaCount,
    unsupportedMediaCount: stateCounters.unsupportedMediaCount,
    notices
  };
}

/**
 * Parse pasted text from Word / clipboard using the exact same pipeline.
 */
export function parseTextExam(rawText, title = 'Đề thi dán trực tiếp') {
  const lines = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((text) => ({ text, runs: [{ text, rawText: text, style: {} }], images: [] }));
  return {
    ...parseExamLines(lines, { title }),
    sourceKind: 'text',
    notices: []
  };
}
