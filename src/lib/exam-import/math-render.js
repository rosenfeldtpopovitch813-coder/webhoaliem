// Safe rich-text + KaTeX + \ce{...} chemistry + inline <sub>/<sup> renderer.
// Designed to handle real Vietnamese Word/OMML/PDF/LaTeX exams with zero .katex-error leaks.

import katexModule from 'katex';

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function convertChemSpecies(segment) {
  // Match chemical formulas including parenthesized groups like (C17H35COO)3C3H5, Cu(OH)2, Fe2(SO4)3, H2SO4, Zn^{2+}
  // Preserve leading stoichiometric numbers (e.g. 2HCl -> 2\mathrm{HCl}, 16HCl -> 16\mathrm{HCl})
  return segment.replace(
    /(?<![A-Za-z\\])(\(?[A-Z][a-z]?(?:[A-Z][a-z]?|\d|\([A-Za-z0-9]+\)\d*)*\)?\d*)(?:\^(?:\{([^{}]+)\}|(\d*[+-])))?/g,
    (_m, formula, bracedCharge, plainCharge) => {
      const charge = bracedCharge ?? plainCharge ?? '';
      const withSub = formula.replace(/([A-Za-z\)])(\d+)/g, '$1_{$2}');
      const body = `\\mathrm{${withSub}}`;
      return charge ? `${body}^{${charge}}` : body;
    }
  );
}

function formatArrowCondition(cond) {
  return cond
    .trim()
    .split(/(\s+|,\s*)/)
    .map((tok) => {
      if (!tok) return '';
      if (/^[\s,]+$/.test(tok)) return `\\text{${tok}}`;
      if (tok === 't°' || tok === 't^o' || tok === 't^0') return 't^\\circ';
      if (/^[A-Z][a-z]?(?:[A-Z][a-z]?|\d|\([A-Za-z0-9]+\)\d*)+$/.test(tok)) {
        return convertChemSpecies(tok);
      }
      return `\\text{${tok}}`;
    })
    .join('');
}

function convertChemInnerToLatex(raw) {
  let c = raw.trim();
  const arrowTokens = [];
  const stashArrow = (latex) => {
    const key = `\uE000${arrowTokens.length}\uE001`;
    arrowTokens.push(latex);
    return ` ${key} `;
  };

  // Stash arrow conditions BEFORE chemical formula substitution so \mathrm is never nested inside \text{}
  c = c.replace(/<=>\[([^\]]+)\]/g, (_m, cond) => stashArrow(`\\xrightleftharpoons{${formatArrowCondition(cond)}}`));
  c = c.replace(/<=>/g, () => stashArrow('\\rightleftharpoons'));
  c = c.replace(/->\[([^\]]+)\]/g, (_m, cond) => stashArrow(`\\xrightarrow{${formatArrowCondition(cond)}}`));
  c = c.replace(/->/g, () => stashArrow('\\rightarrow'));
  c = c.replace(/\^(\s|$)/g, ' \\uparrow$1');
  c = c.replace(/\bv(\s|$)/g, ' \\downarrow$1');

  c = convertChemSpecies(c);
  return c.replace(/\uE000(\d+)\uE001/g, (_m, idx) => arrowTokens[Number(idx)] || '');
}

/**
 * Expand \ce{...} chemistry notation into standard KaTeX-compatible LaTeX.
 */
export function expandChemLatex(input) {
  let out = '';
  let i = 0;
  const s = String(input || '');
  while (i < s.length) {
    if (s.startsWith('\\ce{', i)) {
      let depth = 0;
      const start = i + 4;
      let j = start;
      while (j < s.length) {
        if (s[j] === '{') depth++;
        else if (s[j] === '}') {
          if (depth === 0) break;
          depth--;
        }
        j++;
      }
      const inner = s.slice(start, j);
      out += convertChemInnerToLatex(inner);
      i = j < s.length ? j + 1 : s.length;
    } else {
      out += s[i++];
    }
  }
  return out;
}

/**
 * Normalize real-world Vietnamese Word / MathType / OMML LaTeX quirks before passing to KaTeX.
 */
export function normalizeLatexForKatex(texInput) {
  let tex = expandChemLatex(String(texInput || '').trim());

  // Normalize typographic Unicode characters commonly emitted by Word OMML or PDF text
  tex = tex
    .replace(/\u2212|\u2013|\u2014/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/°/g, '^\\circ ')
    .replace(/×/g, '\\times ')
    .replace(/÷/g, '\\div ')
    .replace(/±/g, '\\pm ')
    .replace(/≤/g, '\\le ')
    .replace(/≥/g, '\\ge ')
    .replace(/≠/g, '\\ne ')
    .replace(/≈/g, '\\approx ')
    .replace(/∞/g, '\\infty ')
    .replace(/→/g, '\\rightarrow ')
    .replace(/⇌/g, '\\rightleftharpoons ')
    .replace(/⇒/g, '\\Rightarrow ')
    .replace(/⇔/g, '\\Leftrightarrow ')
    .replace(/↑/g, '\\uparrow ')
    .replace(/↓/g, '\\downarrow ')
    .replace(/∆|Δ/g, '\\Delta ')
    .replace(/α/g, '\\alpha ')
    .replace(/β/g, '\\beta ')
    .replace(/γ/g, '\\gamma ')
    .replace(/π/g, '\\pi ')
    .replace(/ω/g, '\\omega ')
    .replace(/Ω/g, '\\Omega ')
    .replace(/µ|μ/g, '\\mu ');

  // Normalize Vietnamese / legacy LaTeX macros unsupported in vanilla KaTeX
  tex = tex
    .replace(/\\tg\b/g, '\\tan')
    .replace(/\\cotg\b/g, '\\cot')
    .replace(/\\arctg\b/g, '\\arctan')
    .replace(/\\arccotg\b/g, '\\operatorname{arccot}')
    .replace(/\\degree\b/g, '^\\circ')
    .replace(/\\hdots\b/g, '\\dots')
    .replace(/\\dfr\b/g, '\\dfrac')
    .replace(/\\widevec\{/g, '\\overrightarrow{');

  // Escape unescaped % (KaTeX treats raw % as a comment, breaking "80%" from Word OMML!)
  tex = tex.replace(/(^|[^\\])%/g, '$1\\%');
  // Escape unescaped # outside macro definitions
  tex = tex.replace(/(^|[^\\])#/g, '$1\\#');

  // Collapse accidental double superscripts like x^\circ^\circ or a^2^3 -> a^{23}
  tex = tex.replace(/\^\\circ\s*\^\\circ/g, '^\\circ');

  // Balance mismatched curly braces conservatively so KaTeX does not crash on partial OMML
  let depth = 0;
  let balanced = '';
  for (let i = 0; i < tex.length; i++) {
    const ch = tex[i];
    if (ch === '\\' && i + 1 < tex.length) {
      balanced += ch + tex[i + 1];
      i++;
      continue;
    }
    if (ch === '{') {
      depth++;
      balanced += ch;
    } else if (ch === '}') {
      if (depth > 0) {
        depth--;
        balanced += ch;
      }
    } else {
      balanced += ch;
    }
  }
  while (depth > 0) {
    balanced += '}';
    depth--;
  }

  return balanced.trim();
}

function renderLatexFallback(tex) {
  return escapeHtml(
    normalizeLatexForKatex(tex)
      .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
      .replace(/\\dfrac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
      .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
      .replace(/\\rightarrow|\\to/g, '→')
      .replace(/\\rightleftharpoons/g, '⇌')
      .replace(/\\Rightarrow/g, '⇒')
      .replace(/\\Leftrightarrow/g, '⇔')
      .replace(/\\uparrow/g, '↑')
      .replace(/\\downarrow/g, '↓')
      .replace(/\\le\b|\\leq\b/g, '≤')
      .replace(/\\ge\b|\\geq\b/g, '≥')
      .replace(/\\ne\b|\\neq\b/g, '≠')
      .replace(/\\approx\b/g, '≈')
      .replace(/\\times\b/g, '×')
      .replace(/\\cdot\b/g, '·')
      .replace(/\\pm\b/g, '±')
      .replace(/\\Delta\b/g, 'Δ')
      .replace(/\^\\circ/g, '°')
      .replace(/\\%/g, '%')
      .replace(/\\(?:mathrm|text|mathbf|operatorname)\{([^{}]+)\}/g, '$1')
      .replace(/\\xrightarrow\{([^{}]+)\}/g, '→[$1]')
      .replace(/\\xrightleftharpoons\{([^{}]+)\}/g, '⇌[$1]')
  )
    .replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>')
    .replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>')
    .replace(/_(\d+)/g, '<sub>$1</sub>')
    .replace(/\^([0-9+-]+)/g, '<sup>$1</sup>');
}

function renderSingleMath(tex, displayMode = false) {
  const prepared = normalizeLatexForKatex(tex);
  if (!prepared) return '';
  const katex = katexModule || (typeof globalThis !== 'undefined' ? globalThis.katex : null);
  if (katex && typeof katex.renderToString === 'function') {
    try {
      return katex.renderToString(prepared, {
        displayMode,
        throwOnError: true,
        strict: false,
        trust: false
      });
    } catch {
      // Retry after stripping unrecognized control sequences so broken Word macros never show raw red errors
      const cleaned = prepared
        .replace(/\\(?:left|right)(?![\(\)\[\]\{\}\|\\.])/g, '')
        .replace(/\\text\{([^{}]*\\(?:mathrm|mathbf)[^{}]*)\}/g, '$1');
      try {
        return katex.renderToString(cleaned, {
          displayMode,
          throwOnError: true,
          strict: false,
          trust: false
        });
      } catch {
        // Graceful readable fallback — never leak .katex-error raw source
      }
    }
  }
  const inner = renderLatexFallback(prepared);
  return displayMode ? `<div class="math-fallback-block">${inner}</div>` : `<span class="math-fallback">${inner}</span>`;
}

function renderPlainSegment(seg) {
  // Support safe inline <sub>...</sub> and <sup>...</sup> tags produced by Word w:vertAlign or PDF baseline recovery,
  // while escaping all other HTML strictly.
  const tokens = [];
  const withStashedSubSup = String(seg)
    .replace(/<sub>([^<]{1,40})<\/sub>/gi, (_m, inner) => {
      const k = `\uE002${tokens.length}\uE003`;
      tokens.push(`<sub>${escapeHtml(inner)}</sub>`);
      return k;
    })
    .replace(/<sup>([^<]{1,40})<\/sup>/gi, (_m, inner) => {
      const k = `\uE002${tokens.length}\uE003`;
      tokens.push(`<sup>${escapeHtml(inner)}</sup>`);
      return k;
    });

  let safe = escapeHtml(withStashedSubSup);
  safe = safe.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\n/g, '<br>');
  safe = safe.replace(/\uE002(\d+)\uE003/g, (_m, idx) => tokens[Number(idx)] || '');
  return safe;
}

/**
 * Safely render exam prose containing $$...$$, \[...\], $...$, \(...\), bare \ce{...},
 * safe <sub>/<sup>, and **bold** into trusted HTML.
 */
export function renderExamText(rawText) {
  let text = String(rawText ?? '');
  if (!text) return '';

  // Normalize LaTeX \[...\] and \(...\) delimiters into $$...$$ and $...$
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner) => `$$${inner}$$`);
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner) => `$${inner}$`);

  // Wrap bare \ce{...} occurring outside $...$ so users don't lose chemistry rendering
  let normalized = '';
  let inMath = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '$' && text[i - 1] !== '\\') {
      inMath = !inMath;
      normalized += '$';
      continue;
    }
    if (!inMath && text.startsWith('\\ce{', i)) {
      let depth = 0;
      let j = i + 4;
      while (j < text.length) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') {
          if (depth === 0) break;
          depth--;
        }
        j++;
      }
      const chunk = text.slice(i, j + 1);
      normalized += `$${chunk}$`;
      i = j;
      continue;
    }
    normalized += text[i];
  }

  const pattern = /(\$\$[\s\S]+?\$\$|\$(?:\\.|[^$\n])+\$)/g;
  const parts = normalized.split(pattern);

  return parts
    .map((part) => {
      if (!part) return '';
      if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
        return renderSingleMath(part.slice(2, -2), true);
      }
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        return renderSingleMath(part.slice(1, -1), false);
      }
      return renderPlainSegment(part);
    })
    .join('');
}
