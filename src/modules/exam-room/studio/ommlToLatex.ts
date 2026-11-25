/**
 * Pure TypeScript Microsoft Word OMML (<m:oMath> / <m:oMathPara>) -> LaTeX converter.
 * Runs 100% client-side in browser DOMParser with zero server dependency.
 */

const UNICODE_MATH_MAP: Record<string, string> = {
  '×': '\\times ',
  '÷': '\\div ',
  '±': '\\pm ',
  '∓': '\\mp ',
  '≤': '\\le ',
  '≥': '\\ge ',
  '≠': '\\ne ',
  '≈': '\\approx ',
  '≡': '\\equiv ',
  '∞': '\\infty ',
  '√': '\\sqrt{}',
  '∑': '\\sum ',
  '∏': '\\prod ',
  '∫': '\\int ',
  '∬': '\\iint ',
  '∮': '\\oint ',
  '∂': '\\partial ',
  '∇': '\\nabla ',
  '∈': '\\in ',
  '∉': '\\notin ',
  '⊂': '\\subset ',
  '⊆': '\\subseteq ',
  '⊃': '\\supset ',
  '⊇': '\\supseteq ',
  '∪': '\\cup ',
  '∩': '\\cap ',
  '∅': '\\emptyset ',
  '∀': '\\forall ',
  '∃': '\\exists ',
  '⇒': '\\Rightarrow ',
  '⇔': '\\Leftrightarrow ',
  '→': '\\to ',
  '←': '\\leftarrow ',
  '↔': '\\leftrightarrow ',
  '°': '^\\circ ',
  '·': '\\cdot ',
  '⋅': '\\cdot ',
  '…': '\\dots ',
  '⋯': '\\cdots ',
  '⊥': '\\perp ',
  '∥': '\\parallel ',
  '∠': '\\angle ',
  '△': '\\triangle ',
  'α': '\\alpha ',
  'β': '\\beta ',
  'γ': '\\gamma ',
  'δ': '\\delta ',
  'ε': '\\varepsilon ',
  'ζ': '\\zeta ',
  'η': '\\eta ',
  'θ': '\\theta ',
  'λ': '\\lambda ',
  'μ': '\\mu ',
  'ν': '\\nu ',
  'ξ': '\\xi ',
  'π': '\\pi ',
  'ρ': '\\rho ',
  'σ': '\\sigma ',
  'τ': '\\tau ',
  'φ': '\\varphi ',
  'ϕ': '\\phi ',
  'χ': '\\chi ',
  'ψ': '\\psi ',
  'ω': '\\omega ',
  'Γ': '\\Gamma ',
  'Δ': '\\Delta ',
  'Θ': '\\Theta ',
  'Λ': '\\Lambda ',
  'Π': '\\Pi ',
  'Σ': '\\Sigma ',
  'Φ': '\\Phi ',
  'Ψ': '\\Psi ',
  'Ω': '\\Omega ',
  'ℝ': '\\mathbb{R}',
  'ℤ': '\\mathbb{Z}',
  'ℕ': '\\mathbb{N}',
  'ℚ': '\\mathbb{Q}',
  'ℂ': '\\mathbb{C}',
  '−': '-',
  '–': '-',
};

function mapMathText(raw: string): string {
  let out = '';
  for (const ch of raw) {
    if (UNICODE_MATH_MAP[ch]) {
      out += UNICODE_MATH_MAP[ch];
    } else if (ch === '{' || ch === '}') {
      out += '\\' + ch;
    } else if (ch === '%') {
      out += '\\%';
    } else {
      out += ch;
    }
  }
  return out;
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

function getValAttr(el: Element | undefined): string | undefined {
  if (!el) return undefined;
  return (
    el.getAttribute('m:val') ??
    el.getAttribute('w:val') ??
    el.getAttribute('val') ??
    undefined
  );
}

function convertChildren(el: Element): string {
  return childElements(el)
    .map((c) => convertOmmlNode(c))
    .join('');
}

function mapDelimiter(chr: string, isLeft: boolean): string {
  if (!chr) return '.';
  if (chr === '{') return '\\{';
  if (chr === '}') return '\\}';
  if (chr === '|') return '|';
  if (chr === '‖' || chr === '∥') return '\\|';
  if (chr === '⟨' || chr === '〈') return '\\langle';
  if (chr === '⟩' || chr === '〉') return '\\rangle';
  if (chr === '⌊') return '\\lfloor';
  if (chr === '⌋') return '\\rfloor';
  if (chr === '⌈') return '\\lceil';
  if (chr === '⌉') return '\\rceil';
  if ('()[]'.includes(chr)) return chr;
  return isLeft ? '(' : ')';
}

function mapAccent(chr: string | undefined): string {
  switch (chr) {
    case '→':
    case '\u20D7':
      return '\\vec';
    case '¯':
    case '\u0304':
    case '‾':
      return '\\overline';
    case '^':
    case '\u0302':
      return '\\widehat';
    case '~':
    case '\u0303':
      return '\\widetilde';
    case '˙':
    case '\u0307':
      return '\\dot';
    case '¨':
    case '\u0308':
      return '\\ddot';
    default:
      return '\\vec';
  }
}

function mapNaryOperator(chr: string | undefined): string {
  switch (chr) {
    case '∑':
      return '\\sum';
    case '∏':
      return '\\prod';
    case '∫':
    case undefined:
      return '\\int';
    case '∬':
      return '\\iint';
    case '∭':
      return '\\iiint';
    case '∮':
      return '\\oint';
    case '⋃':
    case '∪':
      return '\\bigcup';
    case '⋂':
    case '∩':
      return '\\bigcap';
    default:
      return mapMathText(chr).trim() || '\\int';
  }
}

export function convertOmmlNode(el: Element): string {
  const tag = localName(el);

  switch (tag) {
    case 'oMathPara': {
      return childElements(el)
        .filter((c) => localName(c) === 'oMath')
        .map((c) => convertOmmlNode(c))
        .join(' \\\\ ');
    }

    case 'oMath':
    case 'e':
    case 'num':
    case 'den':
    case 'deg':
    case 'sub':
    case 'sup':
    case 'lim':
    case 'fName':
    case 'box':
    case 'borderBox':
      return convertChildren(el);

    case 'r': {
      const rPr = findChild(el, 'rPr');
      const isNor = rPr && findChild(rPr, 'nor');
      const text = childElements(el)
        .filter((c) => localName(c) === 't')
        .map((c) => c.textContent ?? '')
        .join('');
      if (!text) return '';
      if (isNor && /^[A-Za-zÀ-ỹ\s]+$/.test(text.trim()) && text.trim().length > 1) {
        return `\\text{${text}}`;
      }
      return mapMathText(text);
    }

    case 't':
      return mapMathText(el.textContent ?? '');

    case 'f': {
      const fPr = findChild(el, 'fPr');
      const type = getValAttr(fPr ? findChild(fPr, 'type') : undefined);
      const num = findChild(el, 'num');
      const den = findChild(el, 'den');
      const nStr = num ? convertOmmlNode(num) : '';
      const dStr = den ? convertOmmlNode(den) : '';
      if (type === 'noBar') return `\\binom{${nStr}}{${dStr}}`;
      if (type === 'lin') return `${nStr}/${dStr}`;
      return `\\frac{${nStr}}{${dStr}}`;
    }

    case 'rad': {
      const deg = findChild(el, 'deg');
      const e = findChild(el, 'e');
      const degStr = deg ? convertOmmlNode(deg).trim() : '';
      const eStr = e ? convertOmmlNode(e) : '';
      return degStr ? `\\sqrt[${degStr}]{${eStr}}` : `\\sqrt{${eStr}}`;
    }

    case 'sSup': {
      const e = findChild(el, 'e');
      const sup = findChild(el, 'sup');
      return `{${e ? convertOmmlNode(e) : ''}}^{${sup ? convertOmmlNode(sup) : ''}}`;
    }

    case 'sSub': {
      const e = findChild(el, 'e');
      const sub = findChild(el, 'sub');
      return `{${e ? convertOmmlNode(e) : ''}}_{${sub ? convertOmmlNode(sub) : ''}}`;
    }

    case 'sSubSup': {
      const e = findChild(el, 'e');
      const sub = findChild(el, 'sub');
      const sup = findChild(el, 'sup');
      return `{${e ? convertOmmlNode(e) : ''}}_{${sub ? convertOmmlNode(sub) : ''}}^{${sup ? convertOmmlNode(sup) : ''}}`;
    }

    case 'sPre': {
      const e = findChild(el, 'e');
      const sub = findChild(el, 'sub');
      const sup = findChild(el, 'sup');
      return `{}_{${sub ? convertOmmlNode(sub) : ''}}^{${sup ? convertOmmlNode(sup) : ''}}{${e ? convertOmmlNode(e) : ''}}`;
    }

    case 'nary': {
      const naryPr = findChild(el, 'naryPr');
      const chr = getValAttr(naryPr ? findChild(naryPr, 'chr') : undefined);
      const op = mapNaryOperator(chr);
      const sub = findChild(el, 'sub');
      const sup = findChild(el, 'sup');
      const e = findChild(el, 'e');
      const subStr = sub ? convertOmmlNode(sub).trim() : '';
      const supStr = sup ? convertOmmlNode(sup).trim() : '';
      const eStr = e ? convertOmmlNode(e) : '';
      return `${op}${subStr ? `_{${subStr}}` : ''}${supStr ? `^{${supStr}}` : ''} ${eStr}`;
    }

    case 'd': {
      const dPr = findChild(el, 'dPr');
      const beg = getValAttr(dPr ? findChild(dPr, 'begChr') : undefined) ?? '(';
      const end = getValAttr(dPr ? findChild(dPr, 'endChr') : undefined) ?? ')';
      const sep = getValAttr(dPr ? findChild(dPr, 'sepChr') : undefined) ?? ',';
      const items = childElements(el)
        .filter((c) => localName(c) === 'e')
        .map((c) => convertOmmlNode(c));

      if (beg === '{' && (!end || end === '') && items.length === 1) {
        const innerEqArr = findChild(childElements(el).find((c) => localName(c) === 'e')!, 'eqArr');
        if (innerEqArr) {
          const rows = childElements(innerEqArr)
            .filter((c) => localName(c) === 'e')
            .map((r) => convertOmmlNode(r));
          return `\\begin{cases} ${rows.join(' \\\\ ')} \\end{cases}`;
        }
      }

      const leftDelim = mapDelimiter(beg, true);
      const rightDelim = mapDelimiter(end, false);
      return `\\left${leftDelim}${items.join(sep)}\\right${rightDelim}`;
    }

    case 'func': {
      const fName = findChild(el, 'fName');
      const e = findChild(el, 'e');
      const fn = (fName ? convertOmmlNode(fName) : '').trim();
      const standardFns = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'lim', 'max', 'min', 'arcsin', 'arccos', 'arctan', 'det'];
      const cleaned = fn.replace(/\\text\{([^}]+)\}/g, '$1').trim();
      const fnLatex = standardFns.includes(cleaned) ? `\\${cleaned}` : fn;
      return `${fnLatex} ${e ? convertOmmlNode(e) : ''}`;
    }

    case 'limLow': {
      const e = findChild(el, 'e');
      const lim = findChild(el, 'lim');
      const base = (e ? convertOmmlNode(e) : '').trim().replace(/\\text\{lim\}/g, '\\lim');
      const finalBase = base === 'lim' ? '\\lim' : base;
      return `${finalBase}_{${lim ? convertOmmlNode(lim) : ''}}`;
    }

    case 'limUpp': {
      const e = findChild(el, 'e');
      const lim = findChild(el, 'lim');
      return `\\overset{${lim ? convertOmmlNode(lim) : ''}}{${e ? convertOmmlNode(e) : ''}}`;
    }

    case 'acc': {
      const accPr = findChild(el, 'accPr');
      const chr = getValAttr(accPr ? findChild(accPr, 'chr') : undefined);
      const e = findChild(el, 'e');
      return `${mapAccent(chr)}{${e ? convertOmmlNode(e) : ''}}`;
    }

    case 'bar': {
      const barPr = findChild(el, 'barPr');
      const pos = getValAttr(barPr ? findChild(barPr, 'pos') : undefined);
      const e = findChild(el, 'e');
      return pos === 'bot'
        ? `\\underline{${e ? convertOmmlNode(e) : ''}}`
        : `\\overline{${e ? convertOmmlNode(e) : ''}}`;
    }

    case 'groupChr': {
      const pr = findChild(el, 'groupChrPr');
      const pos = getValAttr(pr ? findChild(pr, 'pos') : undefined);
      const e = findChild(el, 'e');
      return pos === 'top'
        ? `\\overbrace{${e ? convertOmmlNode(e) : ''}}`
        : `\\underbrace{${e ? convertOmmlNode(e) : ''}}`;
    }

    case 'm': {
      const rows = childElements(el)
        .filter((c) => localName(c) === 'mr')
        .map((mr) =>
          childElements(mr)
            .filter((c) => localName(c) === 'e')
            .map((cell) => convertOmmlNode(cell))
            .join(' & ')
        );
      return `\\begin{matrix} ${rows.join(' \\\\ ')} \\end{matrix}`;
    }

    case 'eqArr': {
      const rows = childElements(el)
        .filter((c) => localName(c) === 'e')
        .map((r) => convertOmmlNode(r));
      return `\\begin{aligned} ${rows.join(' \\\\ ')} \\end{aligned}`;
    }

    case 'rPr':
    case 'fPr':
    case 'dPr':
    case 'naryPr':
    case 'radPr':
    case 'sSupPr':
    case 'sSubPr':
    case 'sSubSupPr':
    case 'accPr':
    case 'barPr':
    case 'ctrlPr':
    case 'mPr':
    case 'oMathParaPr':
      return '';

    default:
      return convertChildren(el);
  }
}

export function ommlElementToLatex(el: Element): string {
  return convertOmmlNode(el)
    .replace(/\s+/g, ' ')
    .trim();
}
