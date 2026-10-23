/** Small, dependency-free and non-eval mathematical expression parser and numerical analyzer for graphing. */
type Token = { kind: 'number' | 'name' | 'operator' | 'left' | 'right' | 'end'; value: string };
const FUNCTIONS: Record<string, (n: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: (n: number) => (Math.abs(Math.cos(n)) < 1e-12 ? NaN : Math.tan(n)),
  cot: (n: number) => (Math.abs(Math.sin(n)) < 1e-12 ? NaN : Math.cos(n) / Math.sin(n)),
  asin: (n: number) => (n < -1 || n > 1 ? NaN : Math.asin(n)),
  acos: (n: number) => (n < -1 || n > 1 ? NaN : Math.acos(n)),
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: (n: number) => (n < 0 ? NaN : Math.sqrt(n)),
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: (n: number) => (n <= 0 ? NaN : Math.log(n)),
  log: (n: number) => (n <= 0 ? NaN : Math.log10(n)),
  log2: (n: number) => (n <= 0 ? NaN : Math.log2(n)),
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  sign: Math.sign,
};

function readLatexGroup(source: string, from: number): { value: string; end: number } | null {
  let i = from;
  while (i < source.length && /\s/.test(source[i])) i++;
  if (source[i] !== '{') return null;
  const start = i + 1;
  let depth = 1;
  for (i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return { value: source.slice(start, i), end: i + 1 };
    }
  }
  return null;
}

function replaceLatexGroupedCommand(source: string, command: string, replacement: (...groups: string[]) => string): string {
  let out = '';
  let cursor = 0;
  while (cursor < source.length) {
    const at = source.indexOf(command, cursor);
    if (at < 0) { out += source.slice(cursor); break; }
    out += source.slice(cursor, at);
    const first = readLatexGroup(source, at + command.length);
    if (!first) { out += command; cursor = at + command.length; continue; }
    if (command === '\\sqrt') {
      out += replacement(first.value);
      cursor = first.end;
      continue;
    }
    const second = readLatexGroup(source, first.end);
    if (!second) { out += source.slice(at, first.end); cursor = first.end; continue; }
    out += replacement(first.value, second.value);
    cursor = second.end;
  }
  return out;
}

function normalizeLatex(raw: string): string {
  let s = raw.trim()
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\\left\b|\\right\b/g, '')
    .replace(/\\cdot\b|\\times\b/g, '*')
    .replace(/\\div\b/g, '/')
    .replace(/\\pi\b/g, 'pi')
    .replace(/\\infty\b/g, 'infty');

  for (let i = 0; i < 8; i++) {
    const next = replaceLatexGroupedCommand(s, '\\frac', (numerator, denominator) => `((${numerator})/(${denominator}))`);
    if (next === s) break;
    s = next;
  }
  for (let i = 0; i < 8; i++) {
    const next = replaceLatexGroupedCommand(s, '\\sqrt', argument => `sqrt(${argument})`);
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\\(?:sin|cos|tan|cot|asin|acos|atan|sinh|cosh|tanh|cbrt|abs|ln|log|log2|exp|floor|ceil|sign)\b/g, m => m.slice(1))
    .replace(/\\(?:,|;|!|quad|qquad)/g, ' ')
    .replace(/\\text\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\/g, '')
    .replace(/[{}]/g, m => (m === '{' ? '(' : ')'))
    .replace(/\s+/g, ' ')
    .trim();

  const equalAt = s.indexOf('=');
  if (equalAt >= 0) {
    const left = s.slice(0, equalAt).trim();
    if (/^(?:y|f\s*\(\s*x\s*\))$/i.test(left)) s = s.slice(equalAt + 1).trim();
    else if (/^[0-9a-zA-Z()+\-*/^ .]+$/.test(left)) s = s.slice(equalAt + 1).trim();
  }
  s = s.replace(/\b(sin|cos|tan|cot|asin|acos|atan|sinh|cosh|tanh|sqrt|cbrt|abs|ln|log|log2|exp|floor|ceil|sign)\s+([a-zA-Z0-9.]+)/g, '$1($2)');
  return s;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (/\s/.test(c)) { i++; continue; }
    const number = source.slice(i).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) { tokens.push({ kind: 'number', value: number[0] }); i += number[0].length; continue; }
    const name = source.slice(i).match(/^[a-zA-Z_][a-zA-Z_0-9]*/);
    if (name) { tokens.push({ kind: 'name', value: name[0].toLowerCase() }); i += name[0].length; continue; }
    if ('+-*/^'.includes(c)) { tokens.push({ kind: 'operator', value: c }); i++; continue; }
    if (c === '(') { tokens.push({ kind: 'left', value: c }); i++; continue; }
    if (c === ')') { tokens.push({ kind: 'right', value: c }); i++; continue; }
    throw new Error(`Ký hiệu chưa hỗ trợ: “${c}”`);
  }
  tokens.push({ kind: 'end', value: '' });
  return tokens;
}

export function parseMathExpression(raw: string, variableName = 'x'): (x: number) => number {
  const variable = variableName.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]*$/.test(variable)) throw new Error('Tên biến không hợp lệ.');
  const source = normalizeLatex(raw);
  if (!source) throw new Error('Hãy viết hoặc nhập công thức trước.');
  const tokens = tokenize(source);
  let at = 0;
  const peek = () => tokens[at];
  const take = () => tokens[at++];
  const expect = (kind: Token['kind'], value?: string) => {
    const token = take();
    if (token.kind !== kind || (value !== undefined && token.value !== value)) throw new Error('Công thức chưa đủ hoặc sai dấu ngoặc.');
    return token;
  };
  const startsAtom = (token: Token) => token.kind === 'number' || token.kind === 'name' || token.kind === 'left';

  const primary = (x: number): number => {
    const token = take();
    if (token.kind === 'number') return Number(token.value);
    if (token.kind === 'left') { const value = expression(x); expect('right'); return value; }
    if (token.kind === 'name') {
      if (token.value === variable) return x;
      if (token.value === 'pi') return Math.PI;
      if (token.value === 'e') return Math.E;
      if (token.value === 'infty') return Infinity;
      const fn = FUNCTIONS[token.value];
      if (fn) {
        let argument: number;
        if (peek().kind === 'left') { take(); argument = expression(x); expect('right'); }
        else argument = unary(x);
        return fn(argument);
      }
      throw new Error(`Chưa hỗ trợ biến/hàm “${token.value}”.`);
    }
    throw new Error('Thiếu số, x hoặc dấu ngoặc mở.');
  };
  const power = (x: number): number => {
    const left = primary(x);
    if (peek().kind === 'operator' && peek().value === '^') { take(); return Math.pow(left, unary(x)); }
    return left;
  };
  const unary = (x: number): number => {
    if (peek().kind === 'operator' && (peek().value === '+' || peek().value === '-')) {
      const op = take().value; const value = unary(x); return op === '-' ? -value : value;
    }
    return power(x);
  };
  const term = (x: number): number => {
    let value = unary(x);
    while (true) {
      if (peek().kind === 'operator' && (peek().value === '*' || peek().value === '/')) {
        const op = take().value;
        const right = unary(x);
        value = op === '*' ? value * right : (Math.abs(right) < 1e-15 ? NaN : value / right);
      } else if (startsAtom(peek())) {
        value *= unary(x);
      } else break;
    }
    return value;
  };
  const expression = (x: number): number => {
    let value = term(x);
    while (peek().kind === 'operator' && (peek().value === '+' || peek().value === '-')) {
      const op = take().value; const right = term(x); value = op === '+' ? value + right : value - right;
    }
    return value;
  };
  const evaluate = (x: number) => {
    at = 0;
    const value = expression(x);
    if (peek().kind !== 'end') throw new Error('Có ký hiệu thừa sau công thức. Hãy kiểm tra phép nhân và dấu ngoặc.');
    return value;
  };
  evaluate(0.731);
  return evaluate;
}

export type ParametricFunctions = { x: (t: number) => number; y: (t: number) => number };
function stripOuterParens(source: string): string {
  const s = source.trim();
  if (!s.startsWith('(') || !s.endsWith(')')) return s;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    if (depth === 0 && i < s.length - 1) return s;
  }
  return s.slice(1, -1).trim();
}
function splitAtTopLevelComma(source: string): [string, string] | null {
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') depth--;
    else if (source[i] === ',' && depth === 0) return [source.slice(0, i).trim(), source.slice(i + 1).trim()];
    if (depth < 0) throw new Error('Dấu ngoặc không cân bằng trong phương trình tham số.');
  }
  if (depth !== 0) throw new Error('Dấu ngoặc không cân bằng trong phương trình tham số.');
  return null;
}

export function parseParametricExpression(raw: string): ParametricFunctions {
  let source = raw.trim();
  if (!source) throw new Error('Nhập cặp phương trình tham số (x(t), y(t)).');
  source = stripOuterParens(source);
  const pair = splitAtTopLevelComma(source);
  if (!pair) throw new Error('Phương trình tham số cần hai biểu thức, ví dụ (cos(t), sin(t)).');
  let [xExpr, yExpr] = pair;
  if (/^x\s*=/i.test(xExpr)) xExpr = xExpr.slice(xExpr.indexOf('=') + 1).trim();
  if (/^y\s*=/i.test(yExpr)) yExpr = yExpr.slice(yExpr.indexOf('=') + 1).trim();
  const x = parseMathExpression(xExpr, 't');
  const y = parseMathExpression(yExpr, 't');
  x(0.37); y(0.37);
  return { x, y };
}

export function parsePolarExpression(raw: string): (theta: number) => number {
  const source = raw.trim().replace(/θ/g, 'theta');
  const match = source.match(/^r(?:\s*\(\s*theta\s*\))?\s*=\s*(.+)$/i);
  if (!match) throw new Error('Phương trình cực có dạng r=f(θ), ví dụ r=2+cos(theta).');
  const fn = parseMathExpression(match[1], 'theta');
  fn(0.37);
  return fn;
}

export function buildParametricPath(xFn: (t: number) => number, yFn: (t: number) => number, tMin: number, tMax: number, xMin: number, xMax: number, yMin: number, yMax: number, width: number, height: number, resolution = 1200): string {
  if (![tMin, tMax, xMin, xMax, yMin, yMax, width, height].every(Number.isFinite) || tMin >= tMax || xMin >= xMax || yMin >= yMax || width <= 0 || height <= 0) return '';
  const n = Math.max(100, Math.min(5000, Math.floor(resolution))), path: string[] = [];
  let down = false, lastX = 0, lastY = 0;
  for (let i = 0; i <= n; i++) {
    const t = tMin + (tMax - tMin) * i / n;
    let x = NaN, y = NaN;
    try { x = xFn(t); y = yFn(t); } catch { /* domain gaps break the path */ }
    const inside = Number.isFinite(x) && Number.isFinite(y) && x >= xMin - (xMax - xMin) * 0.15 && x <= xMax + (xMax - xMin) * 0.15 && y >= yMin - (yMax - yMin) * 0.15 && y <= yMax + (yMax - yMin) * 0.15;
    if (!inside) { down = false; continue; }
    const px = (x - xMin) / (xMax - xMin) * width, py = height - (y - yMin) / (yMax - yMin) * height;
    if (down && Math.hypot(px - lastX, py - lastY) > Math.max(width, height) * 0.28) down = false;
    path.push(`${down ? 'L' : 'M'}${px.toFixed(2)} ${py.toFixed(2)}`);
    down = true; lastX = px; lastY = py;
  }
  return path.join(' ');
}

export function buildPolarPath(rFn: (theta: number) => number, thetaMin: number, thetaMax: number, xMin: number, xMax: number, yMin: number, yMax: number, width: number, height: number, resolution = 1600): string {
  return buildParametricPath(theta => { const r = rFn(theta); return r * Math.cos(theta); }, theta => { const r = rFn(theta); return r * Math.sin(theta); }, thetaMin, thetaMax, xMin, xMax, yMin, yMax, width, height, resolution);
}

/**
 * Detect whether the step [x0, x1] crosses a vertical asymptote or jump discontinuity.
 * Uses 4-step bisection on the steeper half-interval: smooth curves shrink the jump by ~16x,
 * whereas poles grow larger and step discontinuities retain >=75% of the jump.
 */
export function hasDiscontinuityOrPole(fn: (x: number) => number, x0: number, y0: number, x1: number, y1: number): boolean {
  const initialJump = Math.abs(y1 - y0);
  if (initialJump < 1e-9) return false;
  let a = x0, fa = y0, b = x1, fb = y1;
  for (let step = 0; step < 5; step++) {
    const m = (a + b) / 2;
    let fm = NaN;
    try { fm = fn(m); } catch { return true; }
    if (!Number.isFinite(fm)) return true;
    // If midpoint escapes outside [min(fa,fb), max(fa,fb)] significantly, a pole or sharp spike lies inside [a, b]
    const lo = Math.min(fa, fb), hi = Math.max(fa, fb);
    if (fm < lo - initialJump * 0.25 || fm > hi + initialJump * 0.25) return true;
    if (Math.abs(fm - fa) >= Math.abs(fb - fm)) {
      b = m; fb = fm;
    } else {
      a = m; fa = fm;
    }
  }
  const finalJump = Math.abs(fb - fa);
  return finalJump >= initialJump * 0.72;
}

export function buildGraphPath(fn: (x: number) => number, xMin: number, xMax: number, yMin: number, yMax: number, width: number, height: number): string {
  const points = Math.max(800, Math.floor(width * 2));
  let path = '';
  let penDown = false;
  let prevX = xMin, prevY = NaN, prevPy = 0;
  for (let i = 0; i <= points; i++) {
    const x = xMin + (xMax - xMin) * i / points;
    let y = NaN;
    try { y = fn(x); } catch { y = NaN; }
    const visible = Number.isFinite(y) && y >= yMin - (yMax - yMin) * 0.1 && y <= yMax + (yMax - yMin) * 0.1;
    if (!visible) { penDown = false; prevX = x; prevY = NaN; continue; }
    const px = (x - xMin) / (xMax - xMin) * width;
    const py = height - (y - yMin) / (yMax - yMin) * height;
    if (penDown && Number.isFinite(prevY)) {
      if (Math.abs(py - prevPy) > 5 && hasDiscontinuityOrPole(fn, prevX, prevY, x, y)) {
        penDown = false;
      }
    }
    path += `${penDown ? ' L' : ' M'}${px.toFixed(2)} ${py.toFixed(2)}`;
    penDown = true;
    prevX = x; prevY = y; prevPy = py;
  }
  return path.trim();
}

/** Find real roots of fn(x)=0 on [xMin, xMax], handling both sign-change roots and even-multiplicity roots while rejecting poles. */
export function findFunctionRoots(fn: (x: number) => number, xMin: number, xMax: number, samples = 1200): number[] {
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin >= xMax) return [];
  const evalAt = (x: number) => {
    try { const y = fn(x); return Number.isFinite(y) ? y : NaN; } catch { return NaN; }
  };
  const step = (xMax - xMin) / samples;
  const roots: number[] = [];
  const addRoot = (r: number) => {
    if (!Number.isFinite(r) || r < xMin - 1e-7 || r > xMax + 1e-7) return;
    if (!roots.some(existing => Math.abs(existing - r) < 1e-4 * Math.max(1, Math.abs(r)))) {
      roots.push(Math.abs(r) < 1e-12 ? 0 : r);
    }
  };

  let x0 = xMin, y0 = evalAt(x0);
  if (Math.abs(y0) < 1e-9) addRoot(x0);
  for (let i = 1; i <= samples; i++) {
    const x1 = xMin + i * step, y1 = evalAt(x1);
    if (Number.isFinite(y1) && Math.abs(y1) < 1e-9) addRoot(x1);
    if (Number.isFinite(y0) && Number.isFinite(y1) && y0 !== 0 && y0 * y1 < 0) {
      if (!hasDiscontinuityOrPole(evalAt, x0, y0, x1, y1)) {
        let a = x0, b = x1, fa = y0;
        for (let iter = 0; iter < 60; iter++) {
          const m = (a + b) / 2, fm = evalAt(m);
          if (!Number.isFinite(fm)) break;
          if (Math.abs(fm) < 1e-12 || Math.abs(b - a) < 1e-12) { a = b = m; break; }
          if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
        }
        const candidate = (a + b) / 2, fc = evalAt(candidate);
        if (Number.isFinite(fc) && Math.abs(fc) <= 1e-4 * Math.max(1, Math.abs(y0), Math.abs(y1))) {
          addRoot(candidate);
        }
      }
    }
    x0 = x1; y0 = y1;
  }

  // Golden-section search for even-multiplicity tangent roots (e.g. (x-2)^2 = 0)
  const absAt = (x: number) => { const y = evalAt(x); return Number.isFinite(y) ? Math.abs(y) : Infinity; };
  const ratio = (Math.sqrt(5) - 1) / 2;
  for (let i = 1; i < samples; i++) {
    const x = xMin + i * step, left = absAt(x - step), mid = absAt(x), right = absAt(x + step);
    if (!Number.isFinite(mid) || mid > left || mid > right) continue;
    let a = x - step, b = x + step;
    let c = b - ratio * (b - a), d = a + ratio * (b - a), fc = absAt(c), fd = absAt(d);
    for (let iter = 0; iter < 56; iter++) {
      if (fc <= fd) { b = d; d = c; fd = fc; c = b - ratio * (b - a); fc = absAt(c); }
      else { a = c; c = d; fc = fd; d = a + ratio * (b - a); fd = absAt(d); }
    }
    const root = (a + b) / 2, val = absAt(root), scale = Math.max(1, Number.isFinite(left) ? left : 1, Number.isFinite(right) ? right : 1);
    if (Number.isFinite(val) && val <= 1e-7 * scale) addRoot(root);
  }
  return roots.sort((a, b) => a - b);
}

export type ExtremumPoint = { x: number; y: number; kind: 'CĐ' | 'CT' };

/** Find local extrema (local maxima CĐ and local minima CT) of fn on [xMin, xMax]. */
export function findFunctionExtrema(fn: (x: number) => number, xMin: number, xMax: number, samples = 900): ExtremumPoint[] {
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin >= xMax) return [];
  const evalAt = (x: number) => {
    try { const y = fn(x); return Number.isFinite(y) ? y : NaN; } catch { return NaN; }
  };
  const step = (xMax - xMin) / samples;
  const ratio = (Math.sqrt(5) - 1) / 2;
  const out: ExtremumPoint[] = [];

  for (let i = 1; i < samples; i++) {
    const x = xMin + i * step;
    const yL = evalAt(x - step), yM = evalAt(x), yR = evalAt(x + step);
    if (!Number.isFinite(yL) || !Number.isFinite(yM) || !Number.isFinite(yR)) continue;
    const isMax = yM > yL && yM >= yR && (yM - yL) + (yM - yR) > 1e-9;
    const isMin = yM < yL && yM <= yR && (yL - yM) + (yR - yM) > 1e-9;
    if (!isMax && !isMin) continue;
    if (hasDiscontinuityOrPole(evalAt, x - step, yL, x, yM) || hasDiscontinuityOrPole(evalAt, x, yM, x + step, yR)) continue;

    let a = x - step, b = x + step;
    let c = b - ratio * (b - a), d = a + ratio * (b - a);
    let fc = evalAt(c), fd = evalAt(d);
    for (let iter = 0; iter < 48; iter++) {
      const pickLeft = isMax ? fc >= fd : fc <= fd;
      if (pickLeft) { b = d; d = c; fd = fc; c = b - ratio * (b - a); fc = evalAt(c); }
      else { a = c; c = d; fc = fd; d = a + ratio * (b - a); fd = evalAt(d); }
    }
    const ex = (a + b) / 2, ey = evalAt(ex);
    if (!Number.isFinite(ey)) continue;
    // Reject flat constant segments
    if (Math.abs(ey - yL) < 1e-7 && Math.abs(ey - yR) < 1e-7) continue;
    if (!out.some(p => Math.abs(p.x - ex) < 1e-3 * Math.max(1, Math.abs(ex)))) {
      out.push({ x: Math.abs(ex) < 1e-10 ? 0 : ex, y: Math.abs(ey) < 1e-10 ? 0 : ey, kind: isMax ? 'CĐ' : 'CT' });
    }
  }
  return out;
}

export type AsymptoteInfo = {
  vertical: number[];
  horizontal: number[];
  oblique: { slope: number; intercept: number }[];
};

/** Estimate vertical, horizontal, and oblique asymptotes of fn. */
export function findFunctionAsymptotes(fn: (x: number) => number, xMin: number, xMax: number, samples = 900): AsymptoteInfo {
  const vertical: number[] = [];
  const horizontal: number[] = [];
  const oblique: { slope: number; intercept: number }[] = [];
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin >= xMax) return { vertical, horizontal, oblique };

  const evalAt = (x: number) => {
    try { const y = fn(x); return Number.isFinite(y) ? y : NaN; } catch { return NaN; }
  };
  const step = (xMax - xMin) / samples;
  const addVertical = (v: number) => {
    const clean = Math.abs(v - Math.round(v)) < 1e-4 ? Math.round(v) : v;
    if (!vertical.some(existing => Math.abs(existing - clean) < 1e-2)) vertical.push(clean);
  };

  for (let i = 0; i <= samples; i++) {
    const gx = xMin + i * step, fg = evalAt(gx);
    if (!Number.isFinite(fg)) {
      const nl = evalAt(gx - 1e-5), nr = evalAt(gx + 1e-5);
      if ((Number.isFinite(nl) && Math.abs(nl) > 50) || (Number.isFinite(nr) && Math.abs(nr) > 50)) {
        addVertical(gx);
      }
    }
  }
  for (let i = 0; i < samples; i++) {
    let a = xMin + i * step, b = a + step;
    const fa = evalAt(a), fb = evalAt(b);
    const mid = (a + b) / 2, fm = evalAt(mid);
    // Candidate pole if midpoint is non-finite while endpoints are finite, or if hasDiscontinuityOrPole with blowing-up magnitude
    const candidate = (!Number.isFinite(fm) && Number.isFinite(fa) && Number.isFinite(fb)) ||
      (Number.isFinite(fa) && Number.isFinite(fb) && Math.abs(fb - fa) > 2 && hasDiscontinuityOrPole(evalAt, a, fa, b, fb));
    if (!candidate) continue;

    // Bisect toward maximum magnitude to verify true divergence |f(x)| -> infinity
    let maxMag = Math.max(Math.abs(fa || 0), Math.abs(fb || 0));
    for (let iter = 0; iter < 36; iter++) {
      const m = (a + b) / 2;
      const q1 = (a + m) / 2, q2 = (m + b) / 2;
      const fq1 = Math.abs(evalAt(q1)), fq2 = Math.abs(evalAt(q2));
      if (!Number.isFinite(fq1) || fq1 >= (Number.isFinite(fq2) ? fq2 : 0)) {
        b = m;
        if (Number.isFinite(fq1)) maxMag = Math.max(maxMag, fq1);
        else maxMag = Infinity;
      } else {
        a = m;
        maxMag = Math.max(maxMag, fq2);
      }
    }
    const pole = (a + b) / 2;
    const nearLeft = evalAt(pole - 1e-5), nearRight = evalAt(pole + 1e-5);
    if (maxMag > 80 || Math.abs(nearLeft) > 80 || Math.abs(nearRight) > 80) {
      addVertical(pole);
    }
  }

  for (const sign of [1, -1]) {
    const x1 = sign * 500, x2 = sign * 1000, x3 = sign * 2000;
    const y1 = evalAt(x1), y2 = evalAt(x2), y3 = evalAt(x3);
    if (![y1, y2, y3].every(Number.isFinite)) continue;
    const slope = (y2 - y1) / (x2 - x1);
    const intercept = y2 - slope * x2;
    const pred3 = slope * x3 + intercept;
    if (Math.abs(y3 - pred3) < 1e-2 * Math.max(1, Math.abs(intercept))) {
      const cleanSlope = Math.abs(slope) < 1e-4 ? 0 : Math.abs(slope - Math.round(slope)) < 1e-4 ? Math.round(slope) : slope;
      const cleanInt = Math.abs(intercept) < 1e-4 ? 0 : Math.abs(intercept - Math.round(intercept)) < 1e-4 ? Math.round(intercept) : intercept;
      if (cleanSlope === 0) {
        if (!horizontal.some(h => Math.abs(h - cleanInt) < 1e-3)) horizontal.push(cleanInt);
      } else if (Math.abs(cleanSlope) < 100) {
        if (!oblique.some(o => Math.abs(o.slope - cleanSlope) < 1e-3 && Math.abs(o.intercept - cleanInt) < 1e-3)) {
          oblique.push({ slope: cleanSlope, intercept: cleanInt });
        }
      }
    }
  }
  return { vertical: vertical.sort((a, b) => a - b), horizontal, oblique };
}

/** Approximate the area between two curves ∫ |f(x) - g(x)| dx on [a, b] with an error estimate via grid refinement. */
export function approximateAreaBetweenCurves(
  fn1: (x: number) => number,
  fn2: (x: number) => number,
  a: number,
  b: number,
  segments = 400,
): { area: number; errorEstimate: number } {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) return { area: NaN, errorEstimate: NaN };
  const diffAbs = (x: number) => {
    try {
      const v = Math.abs(fn1(x) - fn2(x));
      return Number.isFinite(v) ? v : NaN;
    } catch { return NaN; }
  };
  const integrate = (n: number) => {
    const h = (b - a) / n;
    let sum = 0, valid = 0;
    for (let i = 0; i < n; i++) {
      const x0 = a + i * h, xm = x0 + h / 2, x1 = x0 + h;
      const y0 = diffAbs(x0), ym = diffAbs(xm), y1 = diffAbs(x1);
      if (Number.isFinite(y0) && Number.isFinite(ym) && Number.isFinite(y1)) {
        // Composite Simpson's rule on [x0, x1]
        sum += (h / 6) * (y0 + 4 * ym + y1);
        valid++;
      }
    }
    return valid > 0 ? sum : NaN;
  };
  const n = Math.max(50, Math.min(2000, Math.floor(segments)));
  const s1 = integrate(n);
  const s2 = integrate(n * 2);
  if (!Number.isFinite(s1) || !Number.isFinite(s2)) return { area: NaN, errorEstimate: NaN };
  return { area: s2, errorEstimate: Math.max(1e-8, Math.abs(s2 - s1)) };
}

/** Compile an implicit curve F(x,y)=0 or an equation such as x^2+y^2=9 without dynamic code execution. */
export function parseImplicitExpression(raw: string): (x: number, y: number) => number {
  const source = raw.trim();
  if (!source) throw new Error('Hãy nhập phương trình đường cong.');
  const eq = source.indexOf('=');
  const left = (eq >= 0 ? source.slice(0, eq) : source).trim();
  const right = (eq >= 0 ? source.slice(eq + 1) : '0').trim();
  if (!left || !right) throw new Error('Phương trình ẩn cần có biểu thức ở hai vế.');
  const cache = new Map<string, (x: number) => number>();
  const atY = (y: number) => {
    const key = Number(y.toPrecision(13)).toString();
    const existing = cache.get(key); if (existing) return existing;
    const subst = (expr: string) => expr.replace(/\by\b/gi, `(${key})`);
    const leftFn = parseMathExpression(subst(left)), rightFn = parseMathExpression(subst(right));
    const fn = (x: number) => leftFn(x) - rightFn(x);
    if (cache.size > 256) cache.clear();
    cache.set(key, fn); return fn;
  };
  atY(0.371)(0.619);
  return (x, y) => atY(y)(x);
}

/** Marching-squares contour renderer for implicit equations. */
export function buildImplicitContourPath(fn: (x: number, y: number) => number, xMin: number, xMax: number, yMin: number, yMax: number, width: number, height: number, resolution = 120): string {
  if (![xMin, xMax, yMin, yMax, width, height].every(Number.isFinite) || xMin >= xMax || yMin >= yMax || width <= 0 || height <= 0) return '';
  const n = Math.max(24, Math.min(240, Math.floor(resolution))), gx = (x: number) => (x - xMin) / (xMax - xMin) * width, gy = (y: number) => height - (y - yMin) / (yMax - yMin) * height;
  const values = Array.from({ length: n + 1 }, (_, j) => Array.from({ length: n + 1 }, (_, i) => {
    const x = xMin + (xMax - xMin) * i / n, y = yMin + (yMax - yMin) * j / n;
    try { const v = fn(x, y); return Number.isFinite(v) ? v : NaN; } catch { return NaN; }
  }));
  const segs: string[] = [];
  const interp = (a: { x: number; y: number; v: number }, b: { x: number; y: number; v: number }) => {
    const den = a.v - b.v, t = Math.abs(den) < 1e-14 ? 0.5 : Math.max(0, Math.min(1, a.v / den));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  const addSeg = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-7) segs.push(`M${gx(a.x).toFixed(2)} ${gy(a.y).toFixed(2)} L${gx(b.x).toFixed(2)} ${gy(b.y).toFixed(2)}`);
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x0 = xMin + (xMax - xMin) * i / n, x1 = xMin + (xMax - xMin) * (i + 1) / n, y0 = yMin + (yMax - yMin) * j / n, y1 = yMin + (yMax - yMin) * (j + 1) / n;
      const c = [{ x: x0, y: y0, v: values[j][i] }, { x: x1, y: y0, v: values[j][i + 1] }, { x: x1, y: y1, v: values[j + 1][i + 1] }, { x: x0, y: y1, v: values[j + 1][i] }];
      if (c.some(p => !Number.isFinite(p.v))) continue;
      const crossings: { x: number; y: number }[] = [];
      for (let e = 0; e < 4; e++) {
        const a = c[e], b = c[(e + 1) % 4];
        if (a.v === 0) crossings.push({ x: a.x, y: a.y });
        if (a.v * b.v < 0) crossings.push(interp(a, b));
      }
      const unique = crossings.filter((p, k) => crossings.findIndex(q => Math.hypot(p.x - q.x, p.y - q.y) < 1e-8) === k);
      if (unique.length === 2) addSeg(unique[0], unique[1]);
      else if (unique.length === 4) {
        const center = fn((x0 + x1) / 2, (y0 + y1) / 2);
        if (Number.isFinite(center) && Math.sign(center) === Math.sign(c[0].v)) { addSeg(unique[0], unique[3]); addSeg(unique[1], unique[2]); }
        else { addSeg(unique[0], unique[1]); addSeg(unique[2], unique[3]); }
      }
    }
  }
  return segs.join(' ');
}
