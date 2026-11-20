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

const WORD_NAMED_COLORS = Object.freeze({
  red: '#dc2626',
  blue: '#2563eb',
  green: '#15803d',
  navy: '#1e3a8a',
  purple: '#7c3aed',
  orange: '#ea580c',
  maroon: '#7f1d1d',
  teal: '#0f766e',
  brown: '#78350f',
  gray: '#475569',
  grey: '#475569',
  yellow: '#facc15',
  pink: '#db2777',
  cyan: '#0891b2',
  magenta: '#c026d3',
  olive: '#4d7c0f',
  lime: '#65a30d',
  aqua: '#06b6d4',
  fuchsia: '#c026d3',
  black: '#000000'
});

export function sanitizeColor(raw) {
  const val = String(raw || '').trim();
  if (!val) return '';
  const named = WORD_NAMED_COLORS[val.toLowerCase()];
  if (named) return named;
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
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&hellip;/gi, '…')
    .replace(/&times;/gi, '×')
    .replace(/&divide;/gi, '÷')
    .replace(/&plusmn;/gi, '±')
    .replace(/&deg;/gi, '°')
    .replace(/&#(\d+);/g, (_m, dec) => {
      const cp = Number(dec);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const cp = parseInt(hex, 16);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
    })
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

const NEUTRAL_DARK_INK = new Set(['#000000', '#0d0d0d', '#111111', '#111827', '#0f172a', '#1e293b', '#222222', '#333333']);
const NEUTRAL_LIGHT_BG = new Set(['#ffffff', '#fff', 'transparent']);

function sanitizeSpanStyle(attrText, { stripNeutralPaste = false } = {}) {
  const styles = [];
  const styleMatch = /style\s*=\s*(?:"([^"]*)"|'([^']*)'|([^>\s]+))/i.exec(attrText);
  const rawStyle = styleMatch ? (styleMatch[1] ?? styleMatch[2] ?? styleMatch[3] ?? '') : '';
  if (rawStyle) {
    for (const part of rawStyle.split(';')) {
      const colon = part.indexOf(':');
      if (colon < 0) continue;
      const prop = part.slice(0, colon).trim().toLowerCase();
      const val = part.slice(colon + 1).trim();
      if (prop === 'color') {
        const c = sanitizeColor(val);
        if (c && (!stripNeutralPaste || !NEUTRAL_DARK_INK.has(c))) styles.push(`color:${c}`);
      } else if (prop === 'background-color' || prop === 'background') {
        const bg = sanitizeColor(val);
        if (bg && (!stripNeutralPaste || !NEUTRAL_LIGHT_BG.has(bg))) styles.push(`background-color:${bg}`);
      } else if (prop === 'font-size' && !stripNeutralPaste) {
        const pt = sanitizeFontSizePt(val);
        if (pt !== null) styles.push(`font-size:${pt}pt`);
      } else if (prop === 'font-family' && !stripNeutralPaste) {
        const ff = sanitizeFontFamily(val);
        if (ff) styles.push(`font-family:${ff}`);
      }
    }
  }
  // Support legacy <font color="..." face="..."> produced by execCommand in some browsers
  const colorAttr = /\bcolor\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrText);
  if (colorAttr && !styles.some((s) => s.startsWith('color:'))) {
    const c = sanitizeColor(colorAttr[1] ?? colorAttr[2] ?? colorAttr[3]);
    if (c && (!stripNeutralPaste || !NEUTRAL_DARK_INK.has(c))) styles.push(`color:${c}`);
  }
  if (!stripNeutralPaste) {
    const faceAttr = /\bface\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrText);
    if (faceAttr && !styles.some((s) => s.startsWith('font-family:'))) {
      const ff = sanitizeFontFamily(faceAttr[1] ?? faceAttr[2]);
      if (ff) styles.push(`font-family:${ff}`);
    }
  }
  return styles.join(';');
}

/**
 * Strictly sanitize inline rich-text HTML.
 * Removes scripts/styles/iframes/images/events/javascript: URIs and keeps only
 * whitelisted formatting tags & validated CSS properties.
 */
export function sanitizeInlineRichHtml(raw, { stripNeutralPaste = false } = {}) {
  let src = String(raw ?? '');
  if (!src) return '';

  // Remove dangerous element trees, XML/doctype declarations, and Word conditional markers FIRST
  src = src
    .replace(/<\?xml[\s\S]*?\?>|<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|svg|math|noscript|template)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|svg|img|link|meta|base)\b[^>]*\/?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[(?:if\b[^\]]*|endif)\]>/gi, '');

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
          const safeStyle = sanitizeSpanStyle(attrs, { stripNeutralPaste });
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

function extractWordOmmlToText(ommlHtml) {
  let s = String(ommlHtml ?? '');
  if (!/<m:oMath/i.test(s)) return '';
  const innerTag = (tag, body) => {
    const m = new RegExp(`<m:${tag}\\b[^>]*>([\\s\\S]*?)<\\/m:${tag}>`, 'i').exec(body);
    return m ? m[1] : '';
  };
  let hasLatex = false;
  for (let pass = 0; pass < 8; pass++) {
    const next = s
      .replace(/<m:f\b[^>]*>((?:(?!<m:f\b)[\s\S])*?)<\/m:f>/gi, (_m, body) => {
        const num = innerTag('num', body).trim();
        const den = innerTag('den', body).trim();
        if (!num && !den) return '';
        if (!num || !den) return `${num}${den}`;
        hasLatex = true;
        return `\\frac{${num}}{${den}}`;
      })
      .replace(/<m:sSup\b[^>]*>((?:(?!<m:sSup\b)[\s\S])*?)<\/m:sSup>/gi, (_m, body) => {
        const base = innerTag('e', body).trim();
        const sup = innerTag('sup', body).trim();
        if (!sup) return base;
        hasLatex = true;
        return `${base}^{${sup}}`;
      })
      .replace(/<m:sSub\b[^>]*>((?:(?!<m:sSub\b)[\s\S])*?)<\/m:sSub>/gi, (_m, body) => {
        const base = innerTag('e', body).trim();
        const sub = innerTag('sub', body).trim();
        if (!sub) return base;
        hasLatex = true;
        return `${base}_{${sub}}`;
      })
      .replace(/<m:rad\b[^>]*>((?:(?!<m:rad\b)[\s\S])*?)<\/m:rad>/gi, (_m, body) => {
        const base = innerTag('e', body).trim();
        if (!base) return '';
        hasLatex = true;
        const deg = innerTag('deg', body).trim();
        return deg ? `\\sqrt[${deg}]{${base}}` : `\\sqrt{${base}}`;
      });
    if (next === s) break;
    s = next;
  }
  const plain = decodeBasicEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  if (!plain) return '';
  return hasLatex ? `$${plain}$` : plain;
}

function normalizeWordSpans(html) {
  const stack = [];
  const tokenRe = /<(\/?)span\b([^<>]*)>/gi;
  let out = '';
  let last = 0;
  let m;
  while ((m = tokenRe.exec(html)) !== null) {
    out += html.slice(last, m.index);
    const isClose = m[1] === '/';
    const attrs = m[2] || '';
    if (!isClose) {
      const styleMatch = /style\s*=\s*(?:"([^"]*)"|'([^']*)'|([^>\s]+))/i.exec(attrs);
      const rawStyle = styleMatch ? (styleMatch[1] ?? styleMatch[2] ?? styleMatch[3] ?? '') : '';
      const closeTags = [];
      const safeStyle = sanitizeSpanStyle(attrs, { stripNeutralPaste: true });
      if (safeStyle) {
        out += `<span style="${safeStyle.replace(/"/g, '&quot;')}">`;
        closeTags.push('span');
      }
      if (/(?:^|[;\s])font-weight\s*:\s*(?:bold|bolder|[6-9]\d{2})\b/i.test(rawStyle)) {
        out += '<strong>';
        closeTags.push('strong');
      }
      if (/(?:^|[;\s])font-style\s*:\s*(?:italic|oblique)\b/i.test(rawStyle)) {
        out += '<em>';
        closeTags.push('em');
      }
      if (/(?:^|[;\s])text-decoration(?:-line)?\s*:[^;"']*\bunderline\b/i.test(rawStyle)) {
        out += '<u>';
        closeTags.push('u');
      }
      if (/(?:^|[;\s])text-decoration(?:-line)?\s*:[^;"']*\bline-through\b/i.test(rawStyle)) {
        out += '<s>';
        closeTags.push('s');
      }
      const vAlign = /(?:^|[;\s])vertical-align\s*:\s*(super|sub)\b/i.exec(rawStyle);
      const raiseMatch = /(?:^|[;\s])mso-text-raise\s*:\s*(-?\d+(?:\.\d+)?)\s*(?:pt|%)/i.exec(rawStyle);
      if (vAlign) {
        const tag = vAlign[1].toLowerCase() === 'super' ? 'sup' : 'sub';
        out += `<${tag}>`;
        closeTags.push(tag);
      } else if (raiseMatch && Number(raiseMatch[1]) !== 0) {
        const tag = Number(raiseMatch[1]) > 0 ? 'sup' : 'sub';
        out += `<${tag}>`;
        closeTags.push(tag);
      }
      stack.push(closeTags);
    } else if (stack.length > 0) {
      const closeTags = stack.pop();
      for (let i = closeTags.length - 1; i >= 0; i--) {
        out += `</${closeTags[i]}>`;
      }
    }
    last = m.index + m[0].length;
  }
  out += html.slice(last);
  while (stack.length > 0) {
    const closeTags = stack.pop();
    for (let i = closeTags.length - 1; i >= 0; i--) {
      out += `</${closeTags[i]}>`;
    }
  }
  return out;
}

/**
 * Clean clipboard HTML pasted from Microsoft Word / Google Docs / Web while preserving
 * bold, italic, underline, real accent colors, superscript, subscript, tables, lists, and `<=>` arrows.
 */
export function cleanWordClipboardHtml(rawHtml, fallbackPlain = '') {
  const html = String(rawHtml ?? '').trim();
  const plainFallback = sanitizeInlineRichHtml(
    String(fallbackPlain ?? '')
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '<br>')
  );
  if (!html) return plainFallback;

  // Slice between CF_HTML StartFragment/EndFragment markers if present so <head>/<style> noise is skipped
  let fragment = html;
  const startFrag = /<!--\s*StartFragment\s*-->/i.exec(fragment);
  const endFrag = /<!--\s*EndFragment\s*-->/i.exec(fragment);
  if (startFrag && endFrag && endFrag.index > startFrag.index) {
    fragment = fragment.slice(startFrag.index + startFrag[0].length, endFrag.index);
  }

  // Strip dangerous/metadata subtrees BEFORE comments so malformed CSS comments in <style> never leak
  fragment = fragment
    .replace(/<\?xml[\s\S]*?\?>|<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\s*(xml|style|script|head|title|noscript)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');

  // Convert Word OMML equation blocks before stripping comments; drop redundant sibling !msEquation image fallback
  fragment = fragment.replace(
    /<!--\[if\s+gte\s+msEquation[^\]]*\]>([\s\S]*?)<!\[endif\]-->\s*(?:<!\[if\s+!msEquation\]>[\s\S]*?<!\[endif\]>)?/gi,
    (_m, eqBody) => extractWordOmmlToText(eqBody)
  );
  fragment = fragment.replace(/<m:oMathPara\b[^>]*>([\s\S]*?)<\/m:oMathPara>|<m:oMath\b[^>]*>[\s\S]*?<\/m:oMath>/gi, (m) =>
    extractWordOmmlToText(m)
  );

  let cleaned = fragment
    // Remove standard HTML comments and MSO conditional delimiters while keeping inner text (e.g. list numbers inside !supportLists)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[(?:if\b[^\]]*|endif)\]>/gi, '')
    // Remove Word namespace tags like <o:p></o:p>, <w:...>, <v:...>
    .replace(/<\/?\s*(?:o|w|v|m|st1):[a-zA-Z0-9_-]+(?:\s[^<>]*)?\/?>/gi, '')
    // Collapse soft line-wraps (\r\n) that Word inserts inside paragraphs/attributes
    .replace(/\r?\n+/g, ' ');

  // Preserve HTML list bullets/numbers for <ul>/<ol> before stripping list tags
  cleaned = cleaned.replace(/<(ol|ul)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, listType, listBody) => {
    let idx = 0;
    return String(listBody).replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_lm, itemBody) => {
      idx += 1;
      const plainHead = itemBody.replace(/<[^>]+>/g, '').trim();
      const prefix =
        listType.toLowerCase() === 'ol'
          ? (/^\d+[.)]\s/.test(plainHead) ? '' : `${idx}. `)
          : (/^[•\-\*–]\s/.test(plainHead) ? '' : '• ');
      return `${prefix}${itemBody}@@WORD_BR@@`;
    });
  });

  // Convert nested Word spans (bold/italic/underline/strike/sub/sup + accent colors, without #000000/font bloat)
  cleaned = normalizeWordSpans(cleaned)
    // Preserve readable spacing between table cells while breaking on rows/blocks
    .replace(/<\s*\/\s*(?:td|th)\s*>(?!\s*<\s*\/\s*tr\b)/gi, ' \u00A0 ')
    .replace(/<\s*\/\s*(?:td|th|tr|li|p|div|h[1-6])\s*>/gi, '@@WORD_BR@@')
    .replace(/<\s*br\s*\/?>/gi, '@@WORD_BR@@')
    .replace(/[ \t]*@@WORD_BR@@[ \t]*/g, '<br>')
    .replace(/(?:<br>\s*){3,}/gi, '<br><br>');

  let result = sanitizeInlineRichHtml(cleaned, { stripNeutralPaste: true })
    .replace(/^(?:<br>\s*)+|(?:<br>\s*)+$/gi, '');
  // Merge adjacent identical tags created when Word splits a Vietnamese word across spellcheck/IME runs
  for (let pass = 0; pass < 3; pass++) {
    const merged = result.replace(/<\/(strong|em|u|s|sup|sub)>(\s*)<\1>/gi, '$2');
    if (merged === result) break;
    result = merged;
  }
  if (!stripRichHtmlToPlainText(result).trim() && stripRichHtmlToPlainText(plainFallback).trim()) {
    return plainFallback;
  }
  return result;
}

/**
 * Automatically format lead prefix at the start of a line or after <br>
 * e.g. "câu 1: Cho chất X" -> "<strong>Câu 1:</strong> Cho chất X"
 *      "bài 2. Giải PT"    -> "<strong>Bài 2.</strong> Giải PT"
 *      "lời giải: Ta có"   -> "<strong>Lời giải:</strong> Ta có"
 * Ensures the prefix is capitalized & bolded while the content after it stays outside <strong>.
 */
const LEAD_PREFIX_MAP = [
  { re: /^(câu|question)\s+(\d+(?:\s*\([^)\n]+\))?)\s*([.:])(\s+)([\s\S]*)$/i, format: (m) => ({ label: `${/^question/i.test(m[1]) ? 'Question' : 'Câu'} ${m[2].trim()}${m[3]}`, space: m[4], rest: m[5] }) },
  { re: /^(bài)\s+(\d+(?:\s*\([^)\n]+\))?)\s*([.:])(\s+)([\s\S]*)$/i, format: (m) => ({ label: `Bài ${m[2].trim()}${m[3]}`, space: m[4], rest: m[5] }) },
  { re: /^(ví\s+dụ)\s+(\d+(?:\s*\([^)\n]+\))?)\s*([.:])(\s+)([\s\S]*)$/i, format: (m) => ({ label: `Ví dụ ${m[2].trim()}${m[3]}`, space: m[4], rest: m[5] }) },
  { re: /^(lời\s+giải|hướng\s+dẫn\s+giải|hướng\s+dẫn)\s*([.:])(\s+)([\s\S]*)$/i, format: (m) => ({ label: `${/^hướng\s+dẫn\s+giải/i.test(m[1]) ? 'Hướng dẫn giải' : /^hướng/i.test(m[1]) ? 'Hướng dẫn' : 'Lời giải'}${m[2]}`, space: m[3], rest: m[4] }) },
  { re: /^(chú\s+ý|lưu\s+ý|ghi\s+chú|nhận\s+xét|cho\s+biết)\s*([.:])(\s+)([\s\S]*)$/i, format: (m) => {
    const k = m[1].toLowerCase().replace(/\s+/g, ' ');
    const cap = k === 'lưu ý' ? 'Lưu ý' : k === 'ghi chú' ? 'Ghi chú' : k === 'nhận xét' ? 'Nhận xét' : k === 'cho biết' ? 'Cho biết' : 'Chú ý';
    return { label: `${cap}${m[2]}`, space: m[3], rest: m[4] };
  } }
];

export function matchLeadPrefix(plainLine) {
  const src = String(plainLine ?? '');
  for (const rule of LEAD_PREFIX_MAP) {
    const m = rule.re.exec(src);
    if (m) return rule.format(m);
  }
  return null;
}

export function autoFormatLeadPrefixHtml(rawHtml, tag = 'strong') {
  const openTag = tag === 'b' ? '<b>' : '<strong>';
  const closeTag = tag === 'b' ? '</b>' : '</strong>';
  const src = String(rawHtml ?? '');
  if (!src) return '';

  return src
    .split(/(<\s*br\s*\/?>)/gi)
    .map((part) => {
      if (/^<\s*br\s*\/?>$/i.test(part)) return '<br>';
      const trimmedLead = part.replace(/^\s+/, '');
      const leadingWs = part.slice(0, part.length - trimmedLead.length);
      // Case 1: already starts with <strong> or <b> that accidentally swallowed the rest of the line
      const wrappedMatch = /^<\s*(?:strong|b)\s*>([\s\S]*?)<\s*\/\s*(?:strong|b)\s*>([\s\S]*)$/i.exec(trimmedLead);
      if (wrappedMatch) {
        const inner = wrappedMatch[1];
        const after = wrappedMatch[2];
        const splitInner = matchLeadPrefix(inner);
        if (splitInner && splitInner.rest.trim()) {
          return `${leadingWs}${openTag}${splitInner.label}${closeTag} ${splitInner.rest}${after}`;
        }
        return part;
      }
      // Case 2: unbolded lead prefix
      const hit = matchLeadPrefix(trimmedLead);
      if (hit) {
        return `${leadingWs}${openTag}${hit.label}${closeTag} ${hit.rest}`;
      }
      return part;
    })
    .join('');
}

/**
 * Parse MCQ options from a single line or tab-separated line:
 * Supports "A. ... B. ... C. ... D. ..." or "A. ... B. ..." (2 options on one line).
 */
export function parseFlexibleOptionTokens(line) {
  const clean = String(line ?? '').replace(/\t+/g, '   ').trim();
  if (!clean) return [];
  const tokenRe = /(?:^|\s{2,}|\t)([ABCD])\s*[.:)]\s*(.+?)(?=(?:\s{2,}|\t)[ABCD]\s*[.:)]|$)/g;
  const results = [];
  let m;
  while ((m = tokenRe.exec(clean)) !== null) {
    results.push({ letter: m[1].toUpperCase(), text: m[2].trim() });
  }
  if (results.length >= 2) return results;

  // Fallback for single-space separated A. ... B. ... C. ... D. ... on one line
  const allFour = /^\s*A\s*[.:)]\s*(.+?)\s+B\s*[.:)]\s*(.+?)\s+C\s*[.:)]\s*(.+?)\s+D\s*[.:)]\s*(.+)\s*$/i.exec(clean);
  if (allFour) {
    return [
      { letter: 'A', text: allFour[1].trim() },
      { letter: 'B', text: allFour[2].trim() },
      { letter: 'C', text: allFour[3].trim() },
      { letter: 'D', text: allFour[4].trim() }
    ];
  }
  const pairAB = /^\s*A\s*[.:)]\s*(.+?)\s+B\s*[.:)]\s*(.+)\s*$/i.exec(clean);
  if (pairAB) {
    return [
      { letter: 'A', text: pairAB[1].trim() },
      { letter: 'B', text: pairAB[2].trim() }
    ];
  }
  const pairCD = /^\s*C\s*[.:)]\s*(.+?)\s+D\s*[.:)]\s*(.+)\s*$/i.exec(clean);
  if (pairCD) {
    return [
      { letter: 'C', text: pairCD[1].trim() },
      { letter: 'D', text: pairCD[2].trim() }
    ];
  }
  const singleOpt = /^\s*([ABCD])\s*[.:)]\s*(.+)\s*$/.exec(clean);
  if (singleOpt) {
    return [{ letter: singleOpt[1].toUpperCase(), text: singleOpt[2].trim() }];
  }
  return [];
}

const SUP_UNICODE = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','(':'⁽',')':'⁾','=':'⁼','n':'ⁿ' };
const SUB_UNICODE = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','+':'₊','-':'₋','(':'₍',')':'₎','=':'₌' };

function htmlToCleanOptionPlain(rawHtml) {
  const mapped = String(rawHtml ?? '')
    .replace(/<\s*sup\s*>([^<>]+)<\s*\/\s*sup\s*>/gi, (m, inner) =>
      [...inner].every((c) => SUP_UNICODE[c]) ? [...inner].map((c) => SUP_UNICODE[c]).join('') : `^${inner}`
    )
    .replace(/<\s*sub\s*>([^<>]+)<\s*\/\s*sub\s*>/gi, (m, inner) =>
      [...inner].every((c) => SUB_UNICODE[c]) ? [...inner].map((c) => SUB_UNICODE[c]).join('') : inner
    );
  return stripRichHtmlToPlainText(mapped).replace(/\u00A0/g, ' ').trim();
}

function sliceRichHtmlAfterPlainPrefix(richHtml, plainPrefixLen) {
  const s = String(richHtml ?? '');
  if (plainPrefixLen <= 0) return s.trim();
  const stack = [];
  let i = 0;
  let visible = 0;
  while (i < s.length && visible < plainPrefixLen) {
    if (s[i] === '<') {
      const end = s.indexOf('>', i);
      if (end > i) {
        const tag = s.slice(i, end + 1);
        const closeM = /^<\s*\/\s*([a-z0-9]+)/i.exec(tag);
        if (closeM) {
          const closeName = closeM[1].toLowerCase();
          for (let k = stack.length - 1; k >= 0; k--) {
            if (stack[k].name === closeName) {
              stack.splice(k, stack.length - k);
              break;
            }
          }
        } else if (!/\/>\s*$/.test(tag)) {
          const openM = /^<\s*([a-z0-9]+)/i.exec(tag);
          if (openM && openM[1].toLowerCase() !== 'br') {
            stack.push({ name: openM[1].toLowerCase(), opener: tag });
          }
        }
        i = end + 1;
        continue;
      }
    }
    if (s[i] === '&') {
      const semi = s.indexOf(';', i);
      if (semi > i && semi - i <= 10) {
        visible += 1;
        i = semi + 1;
        continue;
      }
    }
    visible += 1;
    i += 1;
  }
  const opener = stack.map((x) => x.opener).join('');
  return sanitizeInlineRichHtml(opener + s.slice(i)).replace(/^\s+/, '');
}

/**
 * Determine whether pasted text/HTML represents a multi-question or structured exam excerpt
 * suitable for direct parsing into Section / MCQ / TF / Essay / Short blocks.
 */
export function shouldSmartParseWordPaste(rawInput) {
  const plain = stripRichHtmlToPlainText(String(rawInput ?? '').replace(/<\s*br\s*\/?>/gi, '\n'));
  if (!plain) return false;
  const qMatches = plain.match(/(?:^|\n)\s*(?:Câu|Question)\s*\d+\s*(?:\([^)\n]+\))?\s*[.:]/gi);
  const hasSection = /(?:^|\n)\s*PHẦN\s+[IVX0-9]+/i.test(plain);
  const hasMcqLine = /(?:^|\n)\s*A\s*[.:)]\s+\S+[\s\S]*?(?:\n|\s{2,}|\t)B\s*[.:)]\s+\S+/i.test(plain) ||
    (/(?:^|\n)\s*A\s*[.:)]\s+/i.test(plain) && /(?:^|\n)\s*B\s*[.:)]\s+/i.test(plain));
  const hasTfLines = /(?:^|\n)\s*a\s*[.)]\s+/i.test(plain) && /(?:^|\n)\s*b\s*[.)]\s+/i.test(plain);
  if (qMatches && qMatches.length >= 2) return true;
  if (hasSection && ((qMatches && qMatches.length >= 1) || hasMcqLine || hasTfLines)) return true;
  if (qMatches && qMatches.length >= 1 && (hasMcqLine || hasTfLines)) return true;
  return false;
}

/**
 * Smart multi-question & Word paste parser (supports BOTH plain text AND cleaned Word rich HTML).
 * Recognizes:
 * - Prologue lines before PHẦN I / Câu 1 (e.g., "Cho biết nguyên tử khối...", "Cho các hằng số...")
 * - PHẦN I, PHẦN II, PHẦN III...
 * - Câu 1., Câu 1:, Question 1: (turns into MCQ/TF/Short/Essay WITHOUT fake option placeholders)
 * - A. B. C. D. on 1 line, 2 lines (2x2 or tab-separated), or 4 separate lines
 * - True/False a) b) c) d) statements across lines
 * - Đáp án: / Lời giải: / Hướng dẫn giải:
 */
export function parseSmartExamClipboardText(rawText) {
  const rawLines = String(rawText ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .split('\n');

  const parsedLines = rawLines
    .map((rawLn) => {
      const rich = sanitizeInlineRichHtml(rawLn).replace(/^(?:&nbsp;|[ \t\u00A0])+|(?:&nbsp;|[ \t\u00A0])+$/g, '');
      const plain = stripRichHtmlToPlainText(rich).replace(/\u00A0/g, ' ').trim();
      return { rich, plain };
    })
    .filter((item) => Boolean(item.plain));

  const prologueLines = [];
  const blocks = [];
  let currentQ = null;
  let seenSectionOrQuestion = false;
  let inTfSection = false;
  let optionMap = {};
  let optionLineCount = 0;

  const makeId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `blk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const flushQuestion = () => {
    if (!currentQ) return;
    const keys = Object.keys(optionMap);
    if (keys.length >= 2) {
      currentQ.questionType = 'mcq';
      currentQ.options = [
        optionMap.A || 'Phương án A',
        optionMap.B || 'Phương án B',
        optionMap.C || 'Phương án C',
        optionMap.D || 'Phương án D'
      ];
      currentQ.optionCols = optionLineCount === 1 ? 4 : optionLineCount === 2 ? 2 : 1;
      currentQ.correctChoice = currentQ.correctChoice || 'A';
    } else if (inTfSection || (currentQ.statements && currentQ.statements.length > 0)) {
      currentQ.questionType = 'tf';
      currentQ.statements = currentQ.statements || [];
    } else if (currentQ.shortAnswer !== undefined || currentQ.points) {
      currentQ.questionType = currentQ.shortAnswer !== undefined ? 'short' : 'essay';
    } else {
      currentQ.questionType = 'essay';
    }
    blocks.push(currentQ);
    currentQ = null;
    optionMap = {};
    optionLineCount = 0;
  };

  for (const { rich, plain } of parsedLines) {
    if (/^PHẦN\s+[IVX0-9]+/i.test(plain)) {
      flushQuestion();
      seenSectionOrQuestion = true;
      inTfSection = /đúng\s*sai/i.test(plain);
      blocks.push({
        id: makeId(),
        type: 'section',
        title: hasRichInlineTags(rich) ? rich : plain
      });
      continue;
    }

    const qMatch = /^(?:Câu|Question)\s*(\d+)\s*(?:\(([^)]+)\))?\s*[.:]\s*([\s\S]*)$/i.exec(plain);
    if (qMatch) {
      flushQuestion();
      seenSectionOrQuestion = true;
      const points = qMatch[2]?.trim();
      const restPlain = (qMatch[3] || '').trim();
      const prefixLen = restPlain ? plain.length - qMatch[3].length : plain.length;
      const restHtml = hasRichInlineTags(rich)
        ? (sliceRichHtmlAfterPlainPrefix(rich, prefixLen) || restPlain)
        : restPlain;
      currentQ = {
        id: makeId(),
        type: 'question',
        questionType: inTfSection ? 'tf' : 'essay',
        ...(points ? { points } : {}),
        prompt: restHtml,
        ...(inTfSection ? { statements: [] } : {})
      };
      continue;
    }

    if (!seenSectionOrQuestion && /^(?:Cho\s+biết|Nguyên\s+tử\s+khối|Biết\s+nguyên\s+tử\s+khối|Hằng\s+số|Ghi\s+chú)/i.test(plain)) {
      prologueLines.push(autoFormatLeadPrefixHtml(hasRichInlineTags(rich) ? rich : plain));
      continue;
    }

    if (currentQ) {
      const optClean = htmlToCleanOptionPlain(rich);
      const optTokens = parseFlexibleOptionTokens(optClean);
      if (optTokens.length > 0 && (optTokens.length >= 2 || Object.keys(optionMap).length > 0 || optTokens[0].letter === 'A')) {
        optionLineCount += 1;
        for (const tk of optTokens) {
          optionMap[tk.letter] = tk.text;
        }
        continue;
      }

      const tfMatch = /^([abcd])\s*[.)]\s*(.+)$/i.exec(optClean);
      if (tfMatch) {
        currentQ.questionType = 'tf';
        const label = tfMatch[1].toLowerCase();
        const rawSt = tfMatch[2].trim();
        let correct = true;
        let cleanSt = rawSt;
        const tagMatch = /^(.*?)\s*\[(\s*Đ(?:ÚNG)?|\s*S(?:AI)?)\s*\]\s*$/i.exec(rawSt);
        if (tagMatch) {
          cleanSt = tagMatch[1].trim();
          correct = /^đ/i.test(tagMatch[2].trim());
        }
        currentQ.statements = currentQ.statements || [];
        currentQ.statements.push({
          id: makeId(),
          label,
          text: cleanSt,
          correct
        });
        continue;
      }

      const ansMatch = /^Đáp\s*án\s*[.:]\s*(.+)$/i.exec(plain);
      if (ansMatch) {
        const val = ansMatch[1].trim();
        if (/^[ABCD]$/i.test(val)) {
          currentQ.correctChoice = val.toUpperCase();
        } else {
          if (Object.keys(optionMap).length === 0 && (!currentQ.statements || currentQ.statements.length === 0)) {
            currentQ.questionType = 'short';
          }
          currentQ.shortAnswer = val;
        }
        continue;
      }

      const solMatch = /^(?:Lời\s*giải|Hướng\s*dẫn(?:\s*giải)?)\s*[.:]\s*([\s\S]+)$/i.exec(plain);
      if (solMatch) {
        const solRestPlain = solMatch[1].trim();
        const solPrefixLen = plain.length - solMatch[1].length;
        currentQ.solution = hasRichInlineTags(rich)
          ? (sliceRichHtmlAfterPlainPrefix(rich, solPrefixLen) || solRestPlain)
          : solRestPlain;
        continue;
      }

      // Continuation of question prompt or solution preserving rich inline formatting
      const lineOut = hasRichInlineTags(rich) ? rich : plain;
      if (currentQ.solution !== undefined && currentQ.solution.length > 0) {
        currentQ.solution += (hasRichInlineTags(currentQ.solution) || hasRichInlineTags(lineOut) ? '<br>' : '\n') + lineOut;
      } else {
        const sep = currentQ.prompt ? (hasRichInlineTags(currentQ.prompt) || hasRichInlineTags(lineOut) ? '<br>' : '\n') : '';
        currentQ.prompt = `${currentQ.prompt || ''}${sep}${lineOut}`;
      }
    } else {
      const pHtml = hasRichInlineTags(rich) ? rich : autoFormatLeadPrefixHtml(plain);
      blocks.push({
        id: makeId(),
        type: 'paragraph',
        text: pHtml
      });
    }
  }
  flushQuestion();

  return {
    prologue: prologueLines.join('<br>'),
    blocks,
    questionCount: blocks.filter((b) => b.type === 'question').length
  };
}

/**
 * Ctrl + I Auto-Normalize Formula for Chemistry, Physics, and Math.
 * Normalizes plain-typed formulas outside existing $...$ into clean KaTeX / \ce{...}.
 */
const CHEM_ELEMENTS = new Set([
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
  'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Ag', 'Cd',
  'Sn', 'Sb', 'I', 'Xe', 'Cs', 'Ba', 'Pt', 'Au', 'Hg', 'Pb', 'Bi'
]);

const NON_CHEM_ACRONYMS = new Set(['A4', 'A3', 'A2', 'A1', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'MP3', 'MP4', 'H1', 'H2', 'H3', '3D', '2D']);

export function isLikelyChemicalToken(token) {
  const raw = String(token ?? '').trim();
  if (!raw || NON_CHEM_ACRONYMS.has(raw.toUpperCase())) return false;
  // Strip leading stoichiometric coefficient like 2H2O, 3Fe3O4
  const body = raw.replace(/^\d+/, '');
  if (!body || body.length < 2) return false;
  // Must contain at least one uppercase element and either a digit, parenthesis, hydrate dot, or ionic charge
  if (!/[A-Z]/.test(body)) return false;
  if (!/(?:\d|[()]|\^\d*[+-]|[+-]$)/.test(body)) return false;

  // Validate that all letter sequences inside the token are valid chemical elements
  const cleaned = body
    .replace(/\.\d*H2O/g, '')
    .replace(/\^\d*[+-]/g, '')
    .replace(/[+-]$/g, '')
    .replace(/[()[\]\d.]/g, '');
  if (!cleaned) return false;

  const symbols = cleaned.match(/[A-Z][a-z]?/g);
  if (!symbols || symbols.join('') !== cleaned) return false;
  return symbols.every((sym) => CHEM_ELEMENTS.has(sym));
}

function normalizePlainTextFormulas(textSegment) {
  let s = String(textSegment ?? '');
  if (!s.trim()) return s;

  // 1. Chemical reaction equations containing -> or <=> between chemical species
  // e.g. "CH3COOH + C2H5OH <=> CH3COOC2H5 + H2O" or "CaCO3 ->[t°] CaO + CO2"
  const chemTerm = `(?:\\d*[A-Z][A-Za-z0-9().]*(?:\\^?\\d*[+-])?(?:\\s+[\\^v])?)`;
  const chemSide = `${chemTerm}(?:\\s*\\+\\s*${chemTerm})*`;
  const chemEqRe = new RegExp(
    `(${chemSide}\\s*(?:<=>|<->|->)(?:\\[[^\\]\\n]*\\])?\\s*${chemSide})`,
    'g'
  );
  s = s.replace(chemEqRe, (match) => {
    const normalizedCond = match
      .replace(/<->/g, '<=>')
      .replace(/t°|t0/g, '$t^\\circ$');
    return `$\\ce{${normalizedCond.trim()}}$`;
  });

  // Protect newly created $...$ inside this segment before token-level replacements
  const subSegments = splitRichExamSegments(s);
  return subSegments
    .map((seg) => {
      if (seg.type !== 'text') return seg.raw;
      let t = seg.raw;

      // 2. Standalone chemical formulas and ions (e.g., H2SO4, Fe2(SO4)3, Cu(OH)2, CuSO4.5H2O, Fe2+, OH-, SO4^2-)
      t = t.replace(
        /(^|[\s,;:([{"'])(\d*[A-Z][A-Za-z0-9().]*(?:\^\d*[+-]|[234][+-]|[+-])?)(?=$|[\s,;:.!?)\]}"'])/g,
        (full, pre, cand) => {
          if (isLikelyChemicalToken(cand)) {
            // Convert trailing ion charge like Fe2+, Fe3+, SO4^2-, OH- into clean mhchem/LaTeX
            const formattedIon = cand
              .replace(/^([A-Za-z0-9()]+?)([234])([+-])$/, '$1^{$2$3}')
              .replace(/^([A-Za-z0-9()]+?)\^(\d+[+-])$/, '$1^{$2}')
              .replace(/^([A-Za-z0-9()]+?)([+-])$/, '$1^{$2}');
            return `${pre}$\\ce{${formattedIon}}$`;
          }
          return full;
        }
      );

      // 3. Math & Physics expressions outside $...$
      // Convert sqrt(...) -> \sqrt{...}
      t = t.replace(/\bsqrt\(\s*([^()\n]+)\s*\)/g, (_m, inner) => `$\\sqrt{${inner.trim()}}$`);

      // Convert algebraic equations/inequalities with exponents like "x^2 - 4x + 3 >= 0" or "x^2 + 2x - 3 = 0"
      t = t.replace(
        /\b([a-zA-Z]\^\d+(?:\s*[+\-]\s*\d*[a-zA-Z]?(?:\^\d+)?)*\s*(?:>=|<=|!=|=|>|<)\s*-?\d+(?:[.,]\d+)?)/g,
        (expr) => {
          const tex = expr
            .replace(/>=/g, '\\ge ')
            .replace(/<=/g, '\\le ')
            .replace(/!=/g, '\\ne ');
          return `$${tex}$`;
        }
      );

      // Convert standalone power tokens like 10^-19, x^2, m/s^2
      t = t.replace(/\b(10\^\{?-?\d+\}?|m\/s\^\d+|[a-zA-Z]\^\d+)\b/g, (tok) => {
        const cleaned = tok.replace(/\^(-?\d+)$/, '^{$1}');
        return `$${cleaned}$`;
      });

      // Convert standalone comparison operators >=, <=, !=, +- when surrounded by spaces/numbers/variables
      t = t
        .replace(/(\b[a-zA-Z0-9]+\s*)(>=|<=|!=)(\s*-?[a-zA-Z0-9]+\b)/g, (_m, l, op, r) => {
          const map = { '>=': '\\ge', '<=': '\\le', '!=': '\\ne' };
          return `$${l.trim()} ${map[op]} ${r.trim()}$`;
        });

      return t;
    })
    .join('');
}

export function autoNormalizeFormulaText(input) {
  const src = String(input ?? '');
  if (!src) return '';
  const withPrefix = autoFormatLeadPrefixHtml(src);
  const segments = splitRichExamSegments(withPrefix);

  // If the entire selected snippet is a single plain chemical or math expression without any $, normalize it directly
  if (segments.length === 1 && segments[0].type === 'text') {
    const normalized = normalizePlainTextFormulas(segments[0].raw);
    return normalized;
  }

  return segments
    .map((seg) => (seg.type === 'text' ? normalizePlainTextFormulas(seg.raw) : seg.raw))
    .join('');
}

/**
 * Transform a formula string between display modes:
 * - 'inline': $...$
 * - 'display': $$...$$
 * - 'boxed': $$\boxed{...}$$
 * - 'numbered': $$... \qquad (1)$$
 */
export function convertFormulaDisplayMode(rawText, mode = 'inline', eqNumber = 1) {
  const trimmed = String(rawText ?? '').trim();
  if (!trimmed) return '';
  let inner = trimmed
    .replace(/^\$\$([\s\S]*)\$\$$/, '$1')
    .replace(/^\$([\s\S]*)\$$/, '$1')
    .trim();
  inner = inner
    .replace(/^\\boxed\{([\s\S]*)\}$/, '$1')
    .replace(/\s*\\qquad\s*\(\d+\)\s*$/, '')
    .trim();
  if (!inner) return trimmed;
  if (mode === 'display') return `$$${inner}$$`;
  if (mode === 'boxed') return `$$\\boxed{${inner}}$$`;
  if (mode === 'numbered') return `$$${inner} \\qquad (${eqNumber})$$`;
  return `$${inner}$`;
}

export function stripFormattedHtmlTags(raw) {
  return String(raw ?? '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/g, '');
}

export function stripRichHtmlToPlainText(raw) {
  const safe = sanitizeInlineRichHtml(raw);
  return decodeBasicEntities(stripFormattedHtmlTags(safe)).trim();
}

export function hasRichInlineTags(raw) {
  return /<(?:strong|b|em|i|u|s|strike|del|sup|sub|span|font|br)\b/i.test(String(raw || ''));
}

export function hasMathNotation(raw) {
  return /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\ce\{/.test(String(raw || ''));
}

/**
 * Convert mhchem-like \ce{...} inner body to pure KaTeX LaTeX without sentinel strings.
 * Preserves arrow conditions ([$...$] or plain text like [H2SO4 đặc]) and chemical subscripts.
 */
export function convertChemicalExprToLatex(ceExpr) {
  const decoded = decodeBasicEntities(String(ceExpr ?? '')).trim();
  const arrowRe = /(<=>|->)(?:\[([^\]]*)\])?/g;

  const formatChemBody = (part) => part
    .replace(/\s+\^(?=\s|$)/g, '\\uparrow ')
    .replace(/\s+v(?=\s|$)/g, '\\downarrow ')
    .replace(/([A-Za-z)\]])(\d+)/g, '$1_{$2}');

  const formatCondition = (rawCond) => {
    const cond = String(rawCond ?? '').trim();
    if (!cond) return '';
    const dollar = /^\$([\s\S]*)\$$/.exec(cond);
    const inner = (dollar ? dollar[1] : cond).trim();
    if (/[\\_^]/.test(inner)) return inner;
    return inner.replace(/([A-Za-z0-9()]+)|([^A-Za-z0-9()]+)/g, (_seg, word, other) => {
      if (other) return `\\text{${other}}`;
      if (/\d/.test(word) && /[A-Za-z)]/.test(word)) {
        return `\\mathrm{${word.replace(/([A-Za-z)])(\d+)/g, '$1_{$2}')}}`;
      }
      return `\\text{${word}}`;
    });
  };

  let out = '';
  let last = 0;
  let m;
  while ((m = arrowRe.exec(decoded)) !== null) {
    out += formatChemBody(decoded.slice(last, m.index));
    const op = m[1];
    const condRaw = m[2];
    if (condRaw !== undefined) {
      const condTex = formatCondition(condRaw);
      out += op === '<=>' ? `\\xrightleftharpoons{${condTex}} ` : `\\xrightarrow{${condTex}} `;
    } else {
      out += op === '<=>' ? '\\rightleftharpoons ' : '\\rightarrow ';
    }
    last = arrowRe.lastIndex;
  }
  out += formatChemBody(decoded.slice(last));
  return `\\mathrm{${out.trim()}}`;
}

export function expandCeCommands(input) {
  const src = String(input ?? '');
  let out = '';
  let i = 0;
  while (i < src.length) {
    const idx = src.indexOf('\\ce{', i);
    if (idx < 0) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, idx);
    let pos = idx + 4;
    let depth = 1;
    while (pos < src.length && depth > 0) {
      const ch = src[pos];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      pos++;
    }
    if (depth === 0) {
      out += convertChemicalExprToLatex(src.slice(idx + 4, pos - 1));
      i = pos;
    } else {
      out += src.slice(idx);
      break;
    }
  }
  return out;
}

/**
 * Split exam text into prose segments and math segments (with nested [$...$] inside \ce{...} kept intact).
 */
export function splitRichExamSegments(source) {
  const str = String(source ?? '');
  const segments = [];
  let textStart = 0;
  let i = 0;

  const pushText = (end) => {
    if (end > textStart) segments.push({ type: 'text', raw: str.slice(textStart, end) });
  };

  const readBracedEnd = (openBraceIdx) => {
    let depth = 1;
    let p = openBraceIdx + 1;
    while (p < str.length && depth > 0) {
      if (str[p] === '\\' && p + 1 < str.length) { p += 2; continue; }
      if (str[p] === '{') depth++;
      else if (str[p] === '}') depth--;
      p++;
    }
    return depth === 0 ? p : -1;
  };

  const findClosingInlineDollar = (openIdx) => {
    let p = openIdx + 1;
    let braceDepth = 0;
    while (p < str.length) {
      const ch = str[p];
      if (ch === '\n' || ch === '\r') return -1;
      if (ch === '\\') {
        if (str.startsWith('\\ce{', p)) {
          const endBrace = readBracedEnd(p + 3);
          if (endBrace > 0) { p = endBrace; continue; }
        }
        p += Math.min(2, str.length - p);
        continue;
      }
      if (ch === '{') braceDepth++;
      else if (ch === '}' && braceDepth > 0) braceDepth--;
      else if (braceDepth > 0 && ch === '[' && str[p + 1] === '$') {
        const innerClose = str.indexOf('$', p + 2);
        if (innerClose > 0 && innerClose < str.indexOf('\n', p + 2) >>> 0) {
          p = innerClose + 1;
          continue;
        }
      } else if (ch === '$') {
        return p;
      }
      p++;
    }
    return -1;
  };

  while (i < str.length) {
    if (str.startsWith('$$', i)) {
      const close = str.indexOf('$$', i + 2);
      if (close > i + 2) {
        pushText(i);
        segments.push({ type: 'math', raw: str.slice(i, close + 2), tex: str.slice(i + 2, close), displayMode: true });
        i = close + 2;
        textStart = i;
        continue;
      }
    }
    if (str.startsWith('\\[', i)) {
      const close = str.indexOf('\\]', i + 2);
      if (close > i + 2) {
        pushText(i);
        segments.push({ type: 'math', raw: str.slice(i, close + 2), tex: str.slice(i + 2, close), displayMode: true });
        i = close + 2;
        textStart = i;
        continue;
      }
    }
    if (str.startsWith('\\(', i)) {
      const close = str.indexOf('\\)', i + 2);
      if (close > i + 2) {
        pushText(i);
        segments.push({ type: 'math', raw: str.slice(i, close + 2), tex: str.slice(i + 2, close), displayMode: false });
        i = close + 2;
        textStart = i;
        continue;
      }
    }
    if (str[i] === '$') {
      const close = findClosingInlineDollar(i);
      if (close > i + 1) {
        pushText(i);
        segments.push({ type: 'math', raw: str.slice(i, close + 1), tex: str.slice(i + 1, close), displayMode: false });
        i = close + 1;
        textStart = i;
        continue;
      }
    }
    if (str.startsWith('\\ce{', i)) {
      const endBrace = readBracedEnd(i + 3);
      if (endBrace > i + 4) {
        pushText(i);
        segments.push({ type: 'math', raw: str.slice(i, endBrace), tex: str.slice(i, endBrace), displayMode: false });
        i = endBrace;
        textStart = i;
        continue;
      }
    }
    i++;
  }
  pushText(str.length);
  return segments;
}

export function prepareExamMathForKatex(rawMath) {
  const withoutTags = stripFormattedHtmlTags(String(rawMath ?? ''));
  const decoded = decodeBasicEntities(withoutTags).trim();
  return expandCeCommands(decoded);
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
