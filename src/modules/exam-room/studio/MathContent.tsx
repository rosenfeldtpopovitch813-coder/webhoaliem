import React, { useMemo } from 'react';
import katex from 'katex';
import { prepareExamMathForKatex, splitRichExamSegments } from '../../../../shared/exam-rich-text.js';

interface MathContentProps {
  content: string;
  className?: string;
}

const ALLOWED_HTML_TAGS = new Set([
  'strong',
  'b',
  'em',
  'i',
  'u',
  'sub',
  'sup',
  'br',
  'p',
  'span',
  'div',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'code',
]);

function isSafeImgSrc(src: string): boolean {
  const s = src.trim();
  if (/^data:image\/(?:png|jpeg|jpg|gif|webp|bmp);base64,[a-zA-Z0-9+/=\s]+$/i.test(s)) return true;
  if (/^https:\/\//i.test(s)) return true;
  return false;
}

export function sanitizeExamHtml(input: string): string {
  const stripped = String(input || '')
    .replace(/<(script|style|iframe|object|embed|svg|form|textarea|input|button|link|meta)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|svg|form|textarea|input|button|link|meta)\b[^>]*\/?>/gi, '');

  return stripped.replace(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g, (_match, slash: string, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_HTML_TAGS.has(tag)) return '';
    if (slash) return `</${tag}>`;

    if (tag === 'br') return '<br/>';

    if (tag === 'img') {
      const srcM = rawAttrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const src = srcM?.[1] ?? srcM?.[2] ?? '';
      if (!isSafeImgSrc(src)) return '';
      const altM = rawAttrs.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const alt = (altM?.[1] ?? altM?.[2] ?? 'Hình minh họa').replace(/["<>]/g, '');
      return `<img src="${src.trim()}" alt="${alt}" />`;
    }

    if (tag === 'div') {
      const clsM = rawAttrs.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const cls = clsM?.[1] ?? clsM?.[2] ?? '';
      return cls.includes('exam-table-wrap') ? '<div class="exam-table-wrap">' : '<div>';
    }

    if (tag === 'table') {
      return '<table class="exam-table">';
    }

    if (tag === 'th' || tag === 'td') {
      const csM = rawAttrs.match(/\bcolspan\s*=\s*"?(\d+)"?/i);
      const rsM = rawAttrs.match(/\browspan\s*=\s*"?(\d+)"?/i);
      const cs = csM ? ` colspan="${Math.min(20, Math.max(1, Number(csM[1])))}"` : '';
      const rs = rsM ? ` rowspan="${Math.min(50, Math.max(1, Number(rsM[1])))}"` : '';
      return `<${tag}${cs}${rs}>`;
    }

    return `<${tag}>`;
  });
}

const SAFE_HTML_TAG_RE =
  /<\/?(?:strong|b|em|i|u|sub|sup|br|p|span|div|img|table|thead|tbody|tr|th|td|code)\b[^>]*>/gi;

export function renderSafeExamHtmlWithMath(raw: string): string {
  const safe = sanitizeExamHtml(raw);
  const tags: string[] = [];
  const placeholderText = safe.replace(SAFE_HTML_TAG_RE, (tag) => {
    tags.push(tag);
    return `HTVVMTAG${tags.length - 1}END`;
  });

  const segments = splitRichExamSegments(placeholderText);
  const rendered = segments
    .map((seg) => {
      if (seg.type !== 'math') return seg.raw;
      const rawTex = String(seg.tex || '').trim();
      if (!rawTex) return seg.raw;
      const tex = prepareExamMathForKatex(rawTex);
      try {
        return katex.renderToString(tex, {
          displayMode: Boolean(seg.displayMode),
          throwOnError: false,
          trust: false,
          strict: 'ignore',
        });
      } catch {
        return `<code>${seg.raw}</code>`;
      }
    })
    .join('');

  return rendered.replace(/HTVVMTAG(\d+)END/g, (_m, idx) => tags[Number(idx)] ?? '');
}

export const MathContent: React.FC<MathContentProps> = ({ content, className = '' }) => {
  const html = useMemo(() => renderSafeExamHtmlWithMath(content || ''), [content]);
  return (
    <div
      className={`exu-math-content ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
