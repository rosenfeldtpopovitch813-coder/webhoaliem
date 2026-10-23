type Poly = number[]; // coefficients in ascending powers
const EPS = 1e-10;
const trim = (p: Poly): Poly => { const out = p.slice(); while (out.length > 1 && Math.abs(out[out.length - 1]) < EPS) out.pop(); return out.length ? out : [0]; };
const add = (a: Poly, b: Poly): Poly => trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] || 0) + (b[i] || 0)));
const neg = (a: Poly): Poly => a.map(v => -v);
const mul = (a: Poly, b: Poly): Poly => { const out = Array.from({ length: a.length + b.length - 1 }, () => 0); a.forEach((v, i) => b.forEach((w, j) => { out[i + j] += v * w; })); return trim(out); };
const scale = (a: Poly, k: number): Poly => trim(a.map(v => v * k));
const isConst = (p: Poly) => trim(p).length === 1;

export function parsePolynomial(raw: string, variable = 'm'): Poly {
  const source = raw.replace(/[−–]/g, '-').replace(/[×·⋅]/g, '*').replace(/\s+/g, '');
  if (!source) throw new Error('Ô ma trận không được để trống.');
  const tokens: string[] = [];
  for (let i = 0; i < source.length;) {
    const rest = source.slice(i);
    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) { tokens.push(number[0]); i += number[0].length; continue; }
    const name = rest.match(/^[a-zA-Z][a-zA-Z0-9_]*/);
    if (name) { tokens.push(name[0].toLowerCase()); i += name[0].length; continue; }
    const c = source[i];
    if ('+-*/^()'.includes(c)) { tokens.push(c); i++; continue; }
    throw new Error(`Ký hiệu không hỗ trợ trong đa thức: “${c}”.`);
  }
  let at = 0;
  const peek = () => tokens[at] || '';
  const take = () => tokens[at++] || '';
  const primaryStarts = (t: string) => t === '(' || /^[\da-z]/i.test(t);
  const expression = (): Poly => {
    let value = term();
    while (peek() === '+' || peek() === '-') { const op = take(); const right = term(); value = op === '+' ? add(value, right) : add(value, neg(right)); }
    return value;
  };
  const term = (): Poly => {
    let value = unary();
    while (true) {
      if (peek() === '*') { take(); value = mul(value, unary()); }
      else if (peek() === '/') {
        take(); const divisor = unary();
        if (!isConst(divisor) || Math.abs(divisor[0]) < EPS) throw new Error('Trong định thức ký hiệu, mẫu số phải là hằng số khác 0.');
        value = scale(value, 1 / divisor[0]);
      } else if (primaryStarts(peek())) value = mul(value, unary());
      else break;
    }
    return value;
  };
  const unary = (): Poly => { if (peek() === '+') { take(); return unary(); } if (peek() === '-') { take(); return neg(unary()); } return power(); };
  const power = (): Poly => {
    let value = primary();
    if (peek() === '^') {
      take(); const exponentToken = take();
      if (!/^\d+$/.test(exponentToken)) throw new Error('Số mũ của đa thức phải là số nguyên không âm.');
      const exponent = Number(exponentToken); if (exponent > 12) throw new Error('Số mũ tối đa là 12.');
      let result: Poly = [1]; for (let i = 0; i < exponent; i++) result = mul(result, value); value = result;
    }
    return value;
  };
  const primary = (): Poly => {
    const t = take();
    if (t === '(') { const value = expression(); if (take() !== ')') throw new Error('Thiếu dấu đóng ngoặc trong đa thức.'); return value; }
    if (/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(t)) { const n = Number(t); if (!Number.isFinite(n)) throw new Error('Hệ số phải hữu hạn.'); return [n]; }
    if (/^[a-z][a-z0-9_]*$/i.test(t)) { if (t === variable.toLowerCase()) return [0, 1]; throw new Error(`Chỉ hỗ trợ tham số ${variable}; không nhận ra “${t}”.`); }
    throw new Error('Sai cú pháp đa thức: kiểm tra toán tử và dấu ngoặc.');
  };
  const result = expression();
  if (at !== tokens.length) throw new Error(`Không đọc hết biểu thức tại “${peek()}”.`);
  return trim(result);
}

export function formatPolynomial(coefficients: number[], variable = 'm'): string {
  const p = trim(coefficients); const terms: string[] = [];
  for (let power = p.length - 1; power >= 0; power--) {
    const c = p[power]; if (Math.abs(c) < EPS) continue;
    const abs = Math.abs(c); const coefficient = power === 0 || Math.abs(abs - 1) > EPS ? String(Number(abs.toPrecision(10))) : '';
    const monomial = power === 0 ? coefficient : `${coefficient}${variable}${power === 1 ? '' : `^${power}`}`;
    if (!terms.length) terms.push(`${c < 0 ? '-' : ''}${monomial}`); else terms.push(`${c < 0 ? ' − ' : ' + '}${monomial}`);
  }
  return terms.join('') || '0';
}

function determinantPolynomial(matrix: Poly[][]): Poly {
  const n = matrix.length;
  if (n === 1) return matrix[0][0];
  let result: Poly = [0];
  for (let col = 0; col < n; col++) {
    const minor = matrix.slice(1).map(row => row.filter((_, j) => j !== col));
    const term = mul(matrix[0][col], determinantPolynomial(minor));
    result = col % 2 === 0 ? add(result, term) : add(result, neg(term));
  }
  return trim(result);
}

export function symbolicDeterminant(raw: string, variable = 'm'): { coefficients: number[]; expression: string; size: number } {
  const rows = raw.trim().split(/\n|;/).map(r => r.trim()).filter(Boolean);
  if (!rows.length) throw new Error('Nhập ma trận trước khi tính.');
  const cells = rows.map(row => row.includes(',') ? row.split(',').map(s => s.trim()) : row.split(/\s+/).filter(Boolean));
  if (!cells.every(row => row.length === cells.length)) throw new Error('Định thức ký hiệu cần ma trận vuông; dùng dấu phẩy để phân cách các ô.');
  if (cells.length > 4) throw new Error('Định thức đa thức ký hiệu hiện giới hạn ma trận 4 × 4 để tránh bùng nổ tính toán.');
  const matrix = cells.map(row => row.map(cell => parsePolynomial(cell, variable)));
  const coefficients = determinantPolynomial(matrix);
  return { coefficients, expression: formatPolynomial(coefficients, variable), size: cells.length };
}

export function evaluatePolynomial(coefficients: number[], x: number): number { return coefficients.reduceRight((sum, coefficient) => sum * x + coefficient, 0); }

function polynomialDerivative(coefficients: number[]): number[] {
  if (coefficients.length <= 1) return [0];
  return trim(coefficients.slice(1).map((value, index) => value * (index + 1)));
}

/** Isolate real polynomial roots, including even-multiplicity roots, using derivative recursion. */
export function findPolynomialRealRoots(coefficients: number[], tolerance = 1e-8): number[] {
  const p = trim(coefficients), degree = p.length - 1;
  if (degree <= 0) return [];
  if (degree === 1) return [-p[0] / p[1]].filter(Number.isFinite);
  const lead = Math.abs(p[degree]);
  const bound = 1 + Math.max(0, ...p.slice(0, -1).map(v => Math.abs(v) / lead));
  if (!Number.isFinite(bound) || bound > 1e8) throw new Error('Tham số có miền nghiệm quá rộng; không thể cô lập nghiệm ổn định.');
  const critical = findPolynomialRealRoots(polynomialDerivative(p), tolerance).filter(x => x > -bound && x < bound).sort((a, b) => a - b);
  const knots = [-bound, ...critical, bound];
  const scaleAt = (x: number) => Math.max(1, p.reduce((sum, c, i) => sum + Math.abs(c) * Math.pow(Math.abs(x), i), 0));
  const isZero = (x: number) => Math.abs(evaluatePolynomial(p, x)) <= tolerance * scaleAt(x);
  const roots: number[] = [];
  const addRoot = (x: number) => { if (Number.isFinite(x) && !roots.some(r => Math.abs(r - x) <= tolerance * 20 * Math.max(1, Math.abs(x)))) roots.push(x); };
  for (const x of critical) if (isZero(x)) addRoot(x);
  for (let i = 0; i < knots.length - 1; i++) {
    let lo = knots[i], hi = knots[i + 1], flo = evaluatePolynomial(p, lo), fhi = evaluatePolynomial(p, hi);
    if (isZero(lo)) addRoot(lo);
    if (isZero(hi)) addRoot(hi);
    if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo === 0 || fhi === 0 || Math.sign(flo) === Math.sign(fhi)) continue;
    for (let k = 0; k < 100 && hi - lo > tolerance * Math.max(1, Math.abs(lo), Math.abs(hi)); k++) {
      const mid = (lo + hi) / 2, fm = evaluatePolynomial(p, mid);
      if (fm === 0) { lo = hi = mid; break; }
      if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else { hi = mid; fhi = fm; }
    }
    addRoot((lo + hi) / 2);
  }
  return roots.sort((a, b) => a - b);
}

export type SymbolicRankCase = { parameter: number; rank: 0 | 1 | 2 };
export type SymbolicRankResult = { size: 2; determinant: string; genericRank: 0 | 1 | 2; singularCases: SymbolicRankCase[]; note: string };

/** Exact determinant polynomial plus numeric isolation of exceptional m values for a 2×2 matrix. */
export function symbolicRank2x2(raw: string, variable = 'm'): SymbolicRankResult {
  const rows = raw.trim().split(/\n|;/).map(r => r.trim()).filter(Boolean);
  if (rows.length !== 2) throw new Error('Biện luận hạng theo tham số hiện hỗ trợ ma trận 2 × 2.');
  const cells = rows.map(row => row.includes(',') ? row.split(',').map(s => s.trim()) : row.split(/\s+/).filter(Boolean));
  if (cells.some(row => row.length !== 2)) throw new Error('Ma trận cần đúng 2 hàng và 2 cột.');
  const matrix = cells.map(row => row.map(cell => parsePolynomial(cell, variable)));
  const det = add(mul(matrix[0][0], matrix[1][1]), neg(mul(matrix[0][1], matrix[1][0])));
  const detTrimmed = trim(det), detIsZero = detTrimmed.length === 1 && Math.abs(detTrimmed[0]) < EPS;
  const allZero = matrix.flat().every(poly => trim(poly).every(c => Math.abs(c) < EPS));
  const genericRank: 0 | 1 | 2 = allZero ? 0 : detIsZero ? 1 : 2;
  const candidates = detIsZero ? matrix.flat().flatMap(poly => findPolynomialRealRoots(poly)) : findPolynomialRealRoots(detTrimmed);
  const singularCases: SymbolicRankCase[] = [];
  for (const parameter of candidates) {
    const values = matrix.flat().map(poly => evaluatePolynomial(poly, parameter));
    const scaleAt = matrix.flat().reduce((sum, poly) => sum + poly.reduce((s, c, i) => s + Math.abs(c) * Math.pow(Math.abs(parameter), i), 0), 0);
    const zeroAt = values.every(value => Math.abs(value) <= 1e-7 * Math.max(1, scaleAt));
    if (detIsZero && !zeroAt) continue; // Rank does not drop at a root of only one entry when det ≡ 0.
    const rank: 0 | 1 | 2 = zeroAt ? 0 : Math.abs(evaluatePolynomial(detTrimmed, parameter)) <= 1e-6 * Math.max(1, scaleAt * scaleAt) ? 1 : 2;
    if (rank < genericRank && !singularCases.some(item => Math.abs(item.parameter - parameter) < 1e-6)) singularCases.push({ parameter, rank });
  }
  const note = detIsZero
    ? (allZero ? 'Mọi phần tử đều bằng 0; hạng bằng 0 với mọi m.' : 'det(A) đồng nhất bằng 0; hạng tổng quát bằng 1 và hạng giảm tại nghiệm chung của các phần tử.')
    : 'Ngoài các giá trị m được liệt kê, det(A) khác 0 nên hạng bằng 2. Các nghiệm m được cô lập bằng thuật toán số và cần hiểu là giá trị gần đúng.';
  return { size: 2, determinant: formatPolynomial(detTrimmed, variable), genericRank, singularCases: singularCases.sort((a, b) => a.parameter - b.parameter), note };
}
