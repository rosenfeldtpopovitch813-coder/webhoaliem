export type AngleMode = 'DEG' | 'RAD';
export type EvalOptions = { angleMode?: AngleMode; ans?: number; x?: number; variables?: Record<string, number> };

type TokenKind = 'number' | 'name' | 'operator' | 'left' | 'right' | 'comma' | 'end';
type Token = { kind: TokenKind; value: string };

const FUNCTION_NAMES = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'sqrt', 'cbrt', 'abs', 'ln', 'log', 'log2', 'exp', 'floor', 'ceil', 'round', 'sign', 'min', 'max',
  'ncr', 'npr', 'gcd', 'lcm', 'mod', 'remainder', 'int', 'frac', 'deg', 'rad',
]);

function normalizeExpression(input: string): string {
  return input
    .replace(/[−–]/g, '-')
    .replace(/[×·⋅]/g, '*')
    .replace(/[÷／]/g, '/')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/Ans/gi, 'ans')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(source: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    if (/^\s/.test(source[i])) { i++; continue; }
    const number = rest.match(/^(?:(?:\d+\.?\d*)|(?:\.\d+))(?:e[+-]?\d+)?/i);
    if (number) { out.push({ kind: 'number', value: number[0] }); i += number[0].length; continue; }
    const name = rest.match(/^[a-zA-Z_][a-zA-Z_0-9]*/);
    if (name) { out.push({ kind: 'name', value: name[0].toLowerCase() }); i += name[0].length; continue; }
    const char = source[i];
    if ('+-*/^!%'.includes(char)) { out.push({ kind: 'operator', value: char }); i++; continue; }
    if (char === '(') { out.push({ kind: 'left', value: char }); i++; continue; }
    if (char === ')') { out.push({ kind: 'right', value: char }); i++; continue; }
    if (char === ',') { out.push({ kind: 'comma', value: char }); i++; continue; }
    throw new Error(`Ký hiệu chưa hỗ trợ: “${char}”`);
  }
  out.push({ kind: 'end', value: '' });
  return out;
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new Error('Giai thừa cần số nguyên từ 0 đến 170.');
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}
function gcd(a: number, b: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b)) throw new Error('ƯCLN cần hai số nguyên.');
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
function nPr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n || n > 170) throw new Error('nPr cần số nguyên với 0 ≤ r ≤ n ≤ 170.');
  let result = 1; for (let i = n - r + 1; i <= n; i++) result *= i; return result;
}
function nCr(n: number, r: number): number { return nPr(n, r) / factorial(r); }

function applyFunction(name: string, args: number[], angleMode: AngleMode): number {
  const a = args[0];
  const need = (count: number) => { if (args.length !== count) throw new Error(`${name} cần ${count} đối số.`); };
  const angleToRad = (v: number) => (angleMode === 'DEG' ? v * Math.PI / 180 : v);
  const radToAngle = (v: number) => (angleMode === 'DEG' ? v * 180 / Math.PI : v);
  switch (name) {
    case 'sin': {
      need(1);
      if (angleMode === 'DEG' && Math.abs(((a % 180) + 180) % 180) < 1e-12) return 0;
      return Math.sin(angleToRad(a));
    }
    case 'cos': {
      need(1);
      if (angleMode === 'DEG' && Math.abs((((a - 90) % 180) + 180) % 180) < 1e-12) return 0;
      return Math.cos(angleToRad(a));
    }
    case 'tan': {
      need(1);
      const rad = angleToRad(a);
      if ((angleMode === 'DEG' && Math.abs((((a - 90) % 180) + 180) % 180) < 1e-9) || Math.abs(Math.cos(rad)) < 1e-12) {
        throw new Error('tan không xác định tại góc 90° + k·180° (hoặc π/2 + kπ).');
      }
      if (angleMode === 'DEG' && Math.abs(((a % 180) + 180) % 180) < 1e-12) return 0;
      return Math.tan(rad);
    }
    case 'asin': need(1); if (a < -1 || a > 1) throw new Error('asin cần đối số trong đoạn [-1; 1].'); return radToAngle(Math.asin(a));
    case 'acos': need(1); if (a < -1 || a > 1) throw new Error('acos cần đối số trong đoạn [-1; 1].'); return radToAngle(Math.acos(a));
    case 'atan': need(1); return radToAngle(Math.atan(a));
    case 'sinh': need(1); return Math.sinh(a);
    case 'cosh': need(1); return Math.cosh(a);
    case 'tanh': need(1); return Math.tanh(a);
    case 'asinh': need(1); return Math.asinh(a);
    case 'acosh': need(1); if (a < 1) throw new Error('acosh cần đối số ≥ 1.'); return Math.acosh(a);
    case 'atanh': need(1); if (a <= -1 || a >= 1) throw new Error('atanh cần đối số trong khoảng (-1; 1).'); return Math.atanh(a);
    case 'sqrt': need(1); if (a < 0) throw new Error('Căn bậc hai của số âm không thuộc miền số thực.'); return Math.sqrt(a);
    case 'cbrt': need(1); return Math.cbrt(a);
    case 'abs': need(1); return Math.abs(a);
    case 'ln': need(1); if (a <= 0) throw new Error('Logarit tự nhiên ln cần đối số dương (> 0).'); return Math.log(a);
    case 'log': {
      if (args.length === 1) {
        if (a <= 0) throw new Error('Logarit thập phân log cần đối số dương (> 0).');
        return Math.log10(a);
      }
      if (args.length === 2) {
        if (a <= 0) throw new Error('Đối số trong log(x, cơ_số) phải dương (> 0).');
        if (args[1] <= 0 || Math.abs(args[1] - 1) < 1e-12) throw new Error('Cơ số logarit phải dương và khác 1.');
        return Math.log(a) / Math.log(args[1]);
      }
      throw new Error('log cần một hoặc hai đối số.');
    }
    case 'log2': need(1); if (a <= 0) throw new Error('log2 cần đối số dương (> 0).'); return Math.log2(a);
    case 'exp': need(1); return Math.exp(a);
    case 'floor': need(1); return Math.floor(a);
    case 'ceil': need(1); return Math.ceil(a);
    case 'round': need(1); return Math.round(a);
    case 'sign': need(1); return Math.sign(a);
    case 'min': if (!args.length) throw new Error('min cần ít nhất một đối số.'); return Math.min(...args);
    case 'max': if (!args.length) throw new Error('max cần ít nhất một đối số.'); return Math.max(...args);
    case 'ncr': need(2); return nCr(args[0], args[1]);
    case 'npr': need(2); return nPr(args[0], args[1]);
    case 'gcd': need(2); return gcd(args[0], args[1]);
    case 'lcm': need(2); return args[0] === 0 || args[1] === 0 ? 0 : Math.abs(args[0] * args[1]) / gcd(args[0], args[1]);
    case 'mod':
    case 'remainder':
      need(2);
      if (Math.abs(args[1]) < 1e-15) throw new Error('Lỗi chia lấy dư cho 0.');
      return args[0] % args[1];
    case 'int': need(1); return Math.trunc(a);
    case 'frac': need(1); return a - Math.trunc(a);
    case 'deg': need(1); return a * 180 / Math.PI;
    case 'rad': need(1); return a * Math.PI / 180;
    default: throw new Error(`Hàm “${name}” chưa được hỗ trợ.`);
  }
}

export function evaluateScientificExpression(raw: string, options: EvalOptions = {}): number {
  const source = normalizeExpression(raw);
  if (!source) throw new Error('Nhập biểu thức cần tính.');
  const tokens = tokenize(source);
  let at = 0;
  const angleMode = options.angleMode || 'DEG';
  const peek = () => tokens[at];
  const take = () => tokens[at++];
  const expect = (kind: TokenKind) => { const t = take(); if (t.kind !== kind) throw new Error('Thiếu dấu ngoặc hoặc đối số.'); return t; };
  const startsPrimary = (t: Token) => t.kind === 'number' || t.kind === 'name' || t.kind === 'left';

  const parseExpression = (): number => {
    let value = parseTerm();
    while (peek().kind === 'operator' && (peek().value === '+' || peek().value === '-')) {
      const op = take().value; const right = parseTerm(); value = op === '+' ? value + right : value - right;
    }
    return value;
  };
  const parseTerm = (): number => {
    let value = parseUnary();
    while (true) {
      if (peek().kind === 'operator' && (peek().value === '*' || peek().value === '/')) {
        const op = take().value;
        const right = parseUnary();
        if (op === '/') {
          if (Math.abs(right) < 1e-15) throw new Error('Lỗi chia cho 0.');
          value /= right;
        } else {
          value *= right;
        }
      } else if (startsPrimary(peek())) {
        value *= parseUnary();
      } else break;
    }
    return value;
  };
  const parseUnary = (): number => {
    if (peek().kind === 'operator' && (peek().value === '+' || peek().value === '-')) {
      const op = take().value; const v = parseUnary(); return op === '-' ? -v : v;
    }
    return parsePower();
  };
  const parsePower = (): number => {
    let value = parsePostfix();
    if (peek().kind === 'operator' && peek().value === '^') {
      take();
      const exp = parseUnary();
      if (value === 0 && exp < 0) throw new Error('Lỗi chia cho 0 (0 lũy thừa số mũ âm).');
      if (value < 0 && !Number.isInteger(exp)) throw new Error('Lũy thừa với cơ số âm cần số mũ nguyên.');
      value = Math.pow(value, exp);
    }
    return value;
  };
  const parsePostfix = (): number => {
    let value = parsePrimary();
    while (peek().kind === 'operator' && (peek().value === '!' || peek().value === '%')) {
      const op = take().value; value = op === '!' ? factorial(value) : value / 100;
    }
    return value;
  };
  const parsePrimary = (): number => {
    const token = take();
    if (token.kind === 'number') return Number(token.value);
    if (token.kind === 'left') { const value = parseExpression(); expect('right'); return value; }
    if (token.kind !== 'name') throw new Error('Thiếu số hoặc dấu ngoặc mở.');
    if (FUNCTION_NAMES.has(token.value)) {
      let args: number[];
      if (peek().kind === 'left') {
        take(); args = [];
        if (peek().kind !== 'right') {
          args.push(parseExpression());
          while (peek().kind === 'comma') { take(); args.push(parseExpression()); }
        }
        expect('right');
      } else args = [parseUnary()];
      return applyFunction(token.value, args, angleMode);
    }
    if (token.value === 'pi') return Math.PI;
    if (token.value === 'e') return Math.E;
    if (token.value === 'ans') return options.ans ?? 0;
    if (token.value === 'x') {
      if (options.x === undefined) throw new Error('Biến x chỉ dùng trong chế độ SOLVE/TABLE.');
      return options.x;
    }
    if (Object.prototype.hasOwnProperty.call(options.variables || {}, token.value)) {
      const value = (options.variables || {})[token.value];
      if (!Number.isFinite(value)) throw new Error(`Giá trị biến “${token.value.toUpperCase()}” không hữu hạn.`);
      return value;
    }
    throw new Error(`Biến “${token.value}” chưa được định nghĩa.`);
  };
  const result = parseExpression();
  if (peek().kind !== 'end') throw new Error('Còn ký hiệu chưa được đọc hết; kiểm tra dấu ngoặc và phép nhân.');
  return result;
}

export function formatNumber(value: number, digits = 12): string {
  if (Number.isNaN(value)) return 'Math Error';
  if (value === Infinity) return '∞';
  if (value === -Infinity) return '−∞';
  if (Object.is(value, -0)) value = 0;
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value);
  return Number(value.toPrecision(digits)).toString().replace(/e\+?(-?)0*(\d+)/i, '×10^$1$2').replace('-', '−');
}

export function decimalToFraction(value: number, maxDenominator = 10000): string | null {
  if (!Number.isFinite(value)) return null;
  if (Math.abs(value) < 1e-12) return '0';
  const sign = value < 0 ? '−' : '';
  const target = Math.abs(value);
  const whole = Math.floor(target);
  let x = target - whole;
  if (x < 1e-10) return `${sign}${whole}`;
  let h0 = 0, h1 = 1, k0 = 1, k1 = 0, bestN = whole, bestD = 1;
  for (let i = 0; i < 32; i++) {
    const a = Math.floor(x); const h2 = a * h1 + h0; const k2 = a * k1 + k0;
    if (k2 > maxDenominator) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2; bestN = h1; bestD = k1;
    const frac = x - a; if (frac < 1e-12) break; x = 1 / frac;
  }
  const approx = bestN / bestD;
  if (Math.abs(approx - (target - whole)) > 1e-9 * Math.max(1, target)) return null;
  const numerator = whole * bestD + bestN;
  return `${sign}${numerator}/${bestD}`;
}

export function findRealRoots(expression: string, low = -100, high = 100, angleMode: AngleMode = 'DEG', ans = 0): number[] {
  if (!Number.isFinite(low) || !Number.isFinite(high) || low >= high) throw new Error('Khoảng tìm nghiệm không hợp lệ.');
  // Validate syntax once with a generic x value so undeclared variables or bad syntax throw immediately
  try {
    evaluateScientificExpression(expression, { angleMode, ans, x: (low + high) / 2 });
  } catch (err) {
    if (err instanceof Error && /chưa được định nghĩa|Ký hiệu chưa hỗ trợ|Thiếu|Còn ký hiệu|Hàm|Nhập biểu thức/.test(err.message)) {
      throw err;
    }
  }
  const evalAt = (x: number) => {
    try { const y = evaluateScientificExpression(expression, { angleMode, ans, x }); return Number.isFinite(y) ? y : NaN; }
    catch { return NaN; }
  };
  const n = 1600, step = (high - low) / n, roots: number[] = [];
  let x0 = low, y0 = evalAt(x0);
  const addRoot = (root: number) => {
    const clean = Math.abs(root) < 1e-11 ? 0 : root;
    if (!roots.some(x => Math.abs(x - clean) < 1e-5 * Math.max(1, Math.abs(clean)))) roots.push(clean);
  };
  if (Math.abs(y0) < 1e-9) addRoot(x0);
  for (let i = 1; i <= n; i++) {
    const x1 = low + i * step, y1 = evalAt(x1);
    if (Number.isFinite(y1) && Math.abs(y1) < 1e-9) addRoot(x1);
    if (Number.isFinite(y0) && Number.isFinite(y1) && y0 !== 0 && y0 * y1 < 0) {
      let a = x0, b = x1, fa = y0;
      let validBracket = true;
      for (let iter = 0; iter < 70; iter++) {
        const m = (a + b) / 2, fm = evalAt(m);
        if (!Number.isFinite(fm)) { validBracket = false; break; }
        if (Math.abs(fm) < 1e-12 || Math.abs(b - a) < 1e-12) { a = b = m; break; }
        if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
      }
      if (validBracket) {
        const candidate = (a + b) / 2, fc = evalAt(candidate);
        // Reject vertical asymptotes where |f(m)| grows instead of approaching 0
        if (Number.isFinite(fc) && Math.abs(fc) <= Math.min(Math.abs(y0), Math.abs(y1)) && Math.abs(fc) <= 1e-4 * Math.max(1, Math.abs(y0), Math.abs(y1))) {
          addRoot(candidate);
        }
      }
    }
    x0 = x1; y0 = y1;
  }
  const absAt = (x: number) => { const y = evalAt(x); return Number.isFinite(y) ? Math.abs(y) : Infinity; };
  for (let i = 1; i < n; i++) {
    const x = low + i * step, left = absAt(x - step), middle = absAt(x), right = absAt(x + step);
    if (!Number.isFinite(middle) || middle > left || middle > right) continue;
    let a = x - step, b = x + step;
    const ratio = (Math.sqrt(5) - 1) / 2;
    let c = b - ratio * (b - a), d = a + ratio * (b - a), fc = absAt(c), fd = absAt(d);
    for (let iter = 0; iter < 64; iter++) {
      if (fc <= fd) { b = d; d = c; fd = fc; c = b - ratio * (b - a); fc = absAt(c); }
      else { a = c; c = d; fc = fd; d = a + ratio * (b - a); fd = absAt(d); }
    }
    const root = (a + b) / 2, value = absAt(root), scale = Math.max(1, Number.isFinite(left) ? left : 1, Number.isFinite(right) ? right : 1);
    if (Number.isFinite(value) && value <= 1e-8 * scale) addRoot(root);
  }
  return roots.sort((a, b) => a - b);
}
