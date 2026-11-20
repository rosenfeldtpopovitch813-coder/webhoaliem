// Shared rich-text sanitizer, font catalog, inline run parser, and safe math parser
// Used by both notes-app (ExamPaperStudio / examTemplates / examExport) and Node tests.

export const EXAM_FONT_CATALOG = [
  { group: 'Chuẩn đề thi (Có chân)', label: 'Times New Roman', value: '"Times New Roman", Times, Georgia, serif', docxName: 'Times New Roman' },
  { group: 'Chuẩn đề thi (Có chân)', label: 'Cambria', value: 'Cambria, Georgia, serif', docxName: 'Cambria' },
  { group: 'Chuẩn đề thi (Có chân)', label: 'Noto Serif', value: '"Noto Serif", Georgia, serif', docxName: 'Noto Serif' },
  { group: 'Chuẩn đề thi (Có chân)', label: 'Merriweather', value: '"Merriweather", Georgia, serif', docxName: 'Merriweather' },
  { group: 'Chuẩn đề thi (Có chân)', label: 'Lora', value: '"Lora", Georgia, serif', docxName: 'Lora' },
  { group: 'Chuẩn đề thi (Có chân)', label: 'EB Garamond', value: '"EB Garamond", Garamond, serif', docxName: 'EB Garamond' },
  { group: 'Hiện đại (Không chân)', label: 'Be Vietnam Pro', value: '"Be Vietnam Pro", Inter, sans-serif', docxName: 'Be Vietnam Pro' },
  { group: 'Hiện đại (Không chân)', label: 'Inter', value: '"Inter", system-ui, sans-serif', docxName: 'Inter' },
  { group: 'Hiện đại (Không chân)', label: 'Roboto', value: '"Roboto", Arial, sans-serif', docxName: 'Roboto' },
  { group: 'Hiện đại (Không chân)', label: 'Lexend', value: '"Lexend", "Be Vietnam Pro", sans-serif', docxName: 'Lexend' },
  { group: 'Hiện đại (Không chân)', label: 'Nunito', value: '"Nunito", "Be Vietnam Pro", sans-serif', docxName: 'Nunito' },
  { group: 'Hiện đại (Không chân)', label: 'Arial', value: 'Arial, Helvetica, sans-serif', docxName: 'Arial' },
  { group: 'Đơn cách (Tin học / Công thức)', label: 'JetBrains Mono', value: '"JetBrains Mono", Consolas, monospace', docxName: 'JetBrains Mono' }
];

export const EXAM_FONT_SIZES = [9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28];

export const EXAM_TEXT_COLORS = [
  { label: 'Mặc định (Đen mực)', value: '' },
  { label: 'Đen đậm', value: '#111827' },
  { label: 'Xám đậm', value: '#475569' },
  { label: 'Đỏ', value: '#dc2626' },
  { label: 'Cam đất', value: '#ea580c' },
  { label: 'Vàng nâu', value: '#b45309' },
  { label: 'Xanh lá', value: '#15803d' },
  { label: 'Xanh dương', value: '#1d4ed8' },
  { label: 'Tím', value: '#7c3aed' },
  { label: 'Hồng đậm', value: '#be185d' }
];

export const EXAM_BG_COLORS = [
  { label: 'Không nền', value: '' },
  { label: 'Vàng nhạt', value: '#fef08a' },
  { label: 'Xanh lá nhạt', value: '#dcfce7' },
  { label: 'Xanh dương nhạt', value: '#dbeafe' },
  { label: 'Hồng nhạt', value: '#fce7f3' },
  { label: 'Tím nhạt', value: '#ede9fe' },
  { label: 'Xám nhạt', value: '#f1f5f9' }
];

const ALLOWED_FONT_MAP = new Map(
  EXAM_FONT_CATALOG.flatMap((f) => [
    [f.value.toLowerCase(), f.value],
    [f.label.toLowerCase(), f.value],
    [f.docxName.toLowerCase(), f.value]
  ])
);

export function extractPrimaryFontName(fontCss) {
  const raw = String(fontCss || '').trim();
  if (!raw) return 'Times New Roman';
  const match = EXAM_FONT_CATALOG.find(
    (f) => f.value.toLowerCase() === raw.toLowerCase() || raw.toLowerCase().includes(f.docxName.toLowerCase())
  );
  if (match) return match.docxName;
  const first = raw.split(',')[0].replace(/['"]/g, '').trim();
  return first || 'Times New Roman';
}

export function sanitizeFontFamily(raw) {
  const val = String(raw || '').trim();
  if (!val) return '';
  const direct = ALLOWED_FONT_MAP.get(val.toLowerCase());
  if (direct) return direct;
  const first = val.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
  return ALLOWED_FONT_MAP.get(first) || '';
}

export function sanitizeColor(raw) {
  const val = String(raw || '').trim();
  if (!val) return '';
  const hex3 = /^#([0-9a-f]{3})$/i.exec(val);
  if (hex3) {
    const [r, g, b] = hex3[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(val)) return val.toLowerCase();
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.exec(val);
  if (rgb) {
    const [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    if (r <= 255 && g <= 255 && b <= 255) {
      const toHex = (n) => n.toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  }
  return '';
}

export function sanitizeFontSizePt(raw) {
  const val = String(raw || '').trim().toLowerCase();
  if (!val) return null;
  const ptMatch = /^(\d+(?:\.\d+)?)\s*pt$/.exec(val);
  if (ptMatch) {
    const n = Math.round(Number(ptMatch[1]) * 10) / 10;
    return Number.isFinite(n) ? Math.max(8, Math.min(48, n)) : null;
  }
  const pxMatch = /^(\d+(?:\.\d+)?)\s*px$/.exec(val);
  if (pxMatch) {
    const n = Math.round((Number(pxMatch[1]) * 0.75) * 10) / 10;
    return Number.isFinite(n) ? Math.max(8, Math.min(48, n)) : null;
  }
  const num = Number(val);
  if (Number.isFinite(num) && num >= 8 && num <= 48) {
    return Math.round(num * 10) / 10;
  }
  return null;
}

export function escapeHtmlText(raw) {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeBasicEntities(raw) {
  return String(raw ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

const ALLOWED_TAGS = new Set(['strong', 'em', 'u', 's', 'sup', 'sub', 'span', 'br']);
const TAG_ALIAS = {
  b: 'strong',
  i: 'em',
  strike: 's',
  del: 's',
  font: 'span'
};

function sanitizeSpanStyle(attrText) {
  const styles = [];
  const styleMatch = /style\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrText);
  const rawStyle = styleMatch ? (styleMatch[1] ?? styleMatch[2] ?? '') : '';
  if (rawStyle) {
    for (const part of rawStyle.split(';')) {
      const colon = part.indexOf(':');
      if (colon < 0) continue;
      const prop = part.slice(0, colon).trim().toLowerCase();
      const val = part.slice(colon + 1).trim();
      if (prop === 'color') {
        const c = sanitizeColor(val);
        if (c) styles.push(`color:${c}`);
      } else if (prop === 'background-color' || prop === 'background') {
        const bg = sanitizeColor(val);
        if (bg) styles.push(`background-color:${bg}`);
      } else if (prop === 'font-size') {
        const pt = sanitizeFontSizePt(val);
        if (pt !== null) styles.push(`font-size:${pt}pt`);
      } else if (prop === 'font-family') {
        const ff = sanitizeFontFamily(val);
        if (ff) styles.push(`font-family:${ff}`);
      }
    }
  }
  // Support legacy <font color="..." face="..."> produced by execCommand in some browsers
  const colorAttr = /\bcolor\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrText);
  if (colorAttr && !styles.some((s) => s.startsWith('color:'))) {
    const c = sanitizeColor(colorAttr[1] ?? colorAttr[2] ?? colorAttr[3]);
    if (c) styles.push(`color:${c}`);
  }
  const faceAttr = /\bface\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrText);
  if (faceAttr && !styles.some((s) => s.startsWith('font-family:'))) {
    const ff = sanitizeFontFamily(faceAttr[1] ?? faceAttr[2]);
    if (ff) styles.push(`font-family:${ff}`);
  }
  return styles.join(';');
}

/**
 * Strictly sanitize inline rich-text HTML.
 * Removes scripts/styles/iframes/images/events/javascript: URIs and keeps only
 * whitelisted formatting tags & validated CSS properties.
 */
export function sanitizeInlineRichHtml(raw) {
  let src = String(raw ?? '');
  if (!src) return '';

  // Remove dangerous element trees completely (including inner text)
  src = src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|iframe|object|embed|svg|math|noscript|template)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|svg|img|link|meta|base)\b[^>]*\/?>/gi, '');

  // Convert block dividers from contentEditable (<div>, <p>) into line breaks
  src = src
    .replace(/<\s*\/\s*(div|p)\s*>/gi, '<br>')
    .replace(/<\s*(div|p)\b[^>]*>/gi, '');

  // Tokenize HTML tags vs text so arbitrary `<` outside valid tags is escaped safely
  const tagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)(\s[^<>]*)?(\/?)>/g;
  const out = [];
  const openStack = [];
  let lastIndex = 0;
  let m;

  while ((m = tagRegex.exec(src)) !== null) {
    if (m.index > lastIndex) {
      out.push(escapeHtmlText(decodeBasicEntities(src.slice(lastIndex, m.index))));
    }
    const isClose = m[1] === '/';
    const rawName = m[2].toLowerCase();
    const mapped = TAG_ALIAS[rawName] || rawName;
    const attrs = m[3] || '';

    if (ALLOWED_TAGS.has(mapped)) {
      if (mapped === 'br') {
        if (!isClose) out.push('<br>');
      } else if (!isClose) {
        if (mapped === 'span') {
          const safeStyle = sanitizeSpanStyle(attrs);
          if (safeStyle) {
            out.push(`<span style="${safeStyle.replace(/"/g, '&quot;')}">`);
            openStack.push('span');
          } else {
            openStack.push('__skip_span__');
          }
        } else {
          out.push(`<${mapped}>`);
          openStack.push(mapped);
        }
      } else {
        // Close matching tag on stack
        const stackIdx = openStack.lastIndexOf(mapped === 'span' && openStack[openStack.length - 1] === '__skip_span__' ? '__skip_span__' : mapped);
        const realIdx = stackIdx >= 0 ? stackIdx : (mapped === 'span' ? openStack.lastIndexOf('__skip_span__') : -1);
        if (realIdx >= 0) {
          for (let i = openStack.length - 1; i >= realIdx; i--) {
            const top = openStack.pop();
            if (top && top !== '__skip_span__') out.push(`</${top}>`);
          }
        }
      }
    }
    lastIndex = m.index + m[0].length;
  }

  if (lastIndex < src.length) {
    out.push(escapeHtmlText(decodeBasicEntities(src.slice(lastIndex))));
  }
  while (openStack.length) {
    const top = openStack.pop();
    if (top && top !== '__skip_span__') out.push(`</${top}>`);
  }

  // Strip trailing redundant <br> produced by contentEditable
  return out.join('').replace(/(?:<br>)+$/i, '');
}

export function stripRichHtmlToPlainText(raw) {
  const safe = sanitizeInlineRichHtml(raw);
  return decodeBasicEntities(
    safe
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[^>]+>/g, '')
  ).trim();
}

export function hasRichInlineTags(raw) {
  return /<(?:strong|b|em|i|u|s|strike|del|sup|sub|span|font|br)\b/i.test(String(raw || ''));
}

export function hasMathNotation(raw) {
  return /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\ce\{/.test(String(raw || ''));
}

/**
 * Parse sanitized inline HTML + simple markdown (**bold**, *italic*, __underline__, ~~strike~~)
 * into flat formatted runs for Word .docx generation.
 */
export function parseRichInlineRuns(raw, baseStyle = {}) {
  const sanitized = sanitizeInlineRichHtml(raw);
  // Apply lightweight markdown formatting on text segments outside tags
  const withMd = sanitized
    .replace(/\*\*([^*<>]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_<>]+)__/g, '<u>$1</u>')
    .replace(/~~([^~<>]+)~~/g, '<s>$1</s>')
    .replace(/(^|[^*])\*([^*\n<>]+)\*(?!\*)/g, '$1<em>$2</em>');

  const runs = [];
  const styleStack = [{
    bold: Boolean(baseStyle.bold),
    italic: Boolean(baseStyle.italic),
    underline: Boolean(baseStyle.underline),
    strike: Boolean(baseStyle.strike),
    sup: false,
    sub: false,
    colorHex: sanitizeColor(baseStyle.textColor || '').replace(/^#/, '').toUpperCase() || '',
    bgHex: sanitizeColor(baseStyle.bgColor || '').replace(/^#/, '').toUpperCase() || '',
    fontSizePt: baseStyle.fontSizePt ? sanitizeFontSizePt(baseStyle.fontSizePt) : null,
    fontFamily: baseStyle.fontFamily ? extractPrimaryFontName(baseStyle.fontFamily) : ''
  }];

  const tagRe = /<(\/?)(strong|span|sup|sub|em|br|u|s)(?=\s|\/?>)([^>]*)>/gi;
  let last = 0;
  let m;
  while ((m = tagRe.exec(withMd)) !== null) {
    if (m.index > last) {
      const txt = decodeBasicEntities(withMd.slice(last, m.index));
      if (txt) runs.push({ text: txt, ...styleStack[styleStack.length - 1] });
    }
    const isClose = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] || '';
    if (tag === 'br') {
      runs.push({ text: '\n', ...styleStack[styleStack.length - 1] });
    } else if (!isClose) {
      const cur = { ...styleStack[styleStack.length - 1] };
      if (tag === 'strong') cur.bold = true;
      else if (tag === 'em') cur.italic = true;
      else if (tag === 'u') cur.underline = true;
      else if (tag === 's') cur.strike = true;
      else if (tag === 'sup') { cur.sup = true; cur.sub = false; }
      else if (tag === 'sub') { cur.sub = true; cur.sup = false; }
      else if (tag === 'span') {
        const styleStr = sanitizeSpanStyle(attrs);
        for (const decl of styleStr.split(';')) {
          const [p, v] = decl.split(':');
          if (!p || !v) continue;
          if (p === 'color') cur.colorHex = v.replace(/^#/, '').toUpperCase();
          else if (p === 'background-color') cur.bgHex = v.replace(/^#/, '').toUpperCase();
          else if (p === 'font-size') cur.fontSizePt = sanitizeFontSizePt(v);
          else if (p === 'font-family') cur.fontFamily = extractPrimaryFontName(v);
        }
      }
      styleStack.push(cur);
    } else if (styleStack.length > 1) {
      styleStack.pop();
    }
    last = m.index + m[0].length;
  }
  if (last < withMd.length) {
    const txt = decodeBasicEntities(withMd.slice(last));
    if (txt) runs.push({ text: txt, ...styleStack[styleStack.length - 1] });
  }
  return runs;
}

/**
 * Recursive-descent safe mathematical expression compiler for function graphing.
 * Zero eval() / Zero new Function(). Rejects arbitrary JS identifiers/syntax.
 */
const SAFE_MATH_FUNCS = Object.freeze({
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  abs: Math.abs,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round
});

export function compileSafeMathExpression(rawFormula) {
  const cleaned = String(rawFormula || '')
    .replace(/^\s*y\s*=\s*/i, '')
    .replace(/−|–/g, '-')
    .replace(/×|·/g, '*')
    .replace(/÷/g, '/')
    .replace(/\*\*/g, '^')
    .trim();
  if (!cleaned || cleaned.length > 200) return null;

  // Tokenize strictly
  const tokens = [];
  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let dots = 0;
      while (i < cleaned.length && /[0-9.]/.test(cleaned[i])) {
        if (cleaned[i] === '.') dots++;
        if (dots > 1) return null;
        numStr += cleaned[i++];
      }
      const val = Number(numStr);
      if (!Number.isFinite(val)) return null;
      tokens.push({ type: 'num', value: val });
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let ident = '';
      while (i < cleaned.length && /[a-zA-Z]/.test(cleaned[i])) ident += cleaned[i++];
      const low = ident.toLowerCase();
      if (low === 'x') tokens.push({ type: 'var' });
      else if (low === 'pi') tokens.push({ type: 'num', value: Math.PI });
      else if (low === 'e') tokens.push({ type: 'num', value: Math.E });
      else if (Object.prototype.hasOwnProperty.call(SAFE_MATH_FUNCS, low)) {
        tokens.push({ type: 'fn', name: low });
      } else {
        return null; // Reject any non-math identifier (e.g. alert, window, Function)
      }
      continue;
    }
    if ('+-*/^()'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    return null; // Reject any unexpected character (;, =, [, ], quotes, etc.)
  }
  if (!tokens.length) return null;

  // Insert implicit multiplication tokens (e.g. 2x, 3(x+1), (x-1)(x+1), 2sin(x), x(x+1))
  const expanded = [];
  for (let idx = 0; idx < tokens.length; idx++) {
    const cur = tokens[idx];
    const prev = expanded[expanded.length - 1];
    if (prev) {
      const prevIsValue = prev.type === 'num' || prev.type === 'var' || (prev.type === 'op' && prev.value === ')');
      const curStartsValue = cur.type === 'var' || cur.type === 'fn' || (cur.type === 'op' && cur.value === '(');
      if (prevIsValue && curStartsValue) {
        expanded.push({ type: 'op', value: '*' });
      }
    }
    expanded.push(cur);
  }

  // Build AST via recursive descent
  let pos = 0;
  const peek = () => expanded[pos];
  const consume = () => expanded[pos++];

  function parseExpr() {
    let node = parseTerm();
    if (!node) return null;
    while (peek()?.type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseTerm();
      if (!right) return null;
      node = { kind: 'bin', op, left: node, right };
    }
    return node;
  }

  function parseTerm() {
    let node = parseUnary();
    if (!node) return null;
    while (peek()?.type === 'op' && (peek().value === '*' || peek().value === '/')) {
      const op = consume().value;
      const right = parseUnary();
      if (!right) return null;
      node = { kind: 'bin', op, left: node, right };
    }
    return node;
  }

  function parseUnary() {
    if (peek()?.type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const arg = parseUnary();
      if (!arg) return null;
      return op === '-' ? { kind: 'neg', arg } : arg;
    }
    return parsePower();
  }

  function parsePower() {
    const base = parsePrimary();
    if (!base) return null;
    if (peek()?.type === 'op' && peek().value === '^') {
      consume();
      const exp = parseUnary();
      if (!exp) return null;
      return { kind: 'pow', base, exp };
    }
    return base;
  }

  function parsePrimary() {
    const tok = peek();
    if (!tok) return null;
    if (tok.type === 'num') { consume(); return { kind: 'num', value: tok.value }; }
    if (tok.type === 'var') { consume(); return { kind: 'var' }; }
    if (tok.type === 'fn') {
      consume();
      if (peek()?.type !== 'op' || peek().value !== '(') return null;
      consume();
      const arg = parseExpr();
      if (!arg || peek()?.type !== 'op' || peek().value !== ')') return null;
      consume();
      return { kind: 'call', fn: SAFE_MATH_FUNCS[tok.name], arg };
    }
    if (tok.type === 'op' && tok.value === '(') {
      consume();
      const inner = parseExpr();
      if (!inner || peek()?.type !== 'op' || peek().value !== ')') return null;
      consume();
      return inner;
    }
    return null;
  }

  const ast = parseExpr();
  if (!ast || pos !== expanded.length) return null;

  function evalNode(node, x) {
    switch (node.kind) {
      case 'num': return node.value;
      case 'var': return x;
      case 'neg': return -evalNode(node.arg, x);
      case 'pow': return Math.pow(evalNode(node.base, x), evalNode(node.exp, x));
      case 'call': return node.fn(evalNode(node.arg, x));
      case 'bin': {
        const l = evalNode(node.left, x);
        const r = evalNode(node.right, x);
        if (node.op === '+') return l + r;
        if (node.op === '-') return l - r;
        if (node.op === '*') return l * r;
        return l / r;
      }
      default: return NaN;
    }
  }

  return (x) => evalNode(ast, x);
}
