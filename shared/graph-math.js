// Safe math-expression parser: intentionally avoids eval(), Function(), and global access.
const UNARY = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, abs: Math.abs, sqrt: Math.sqrt, cbrt: Math.cbrt,
  ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
  sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x)
};
const MULTI = { min: Math.min, max: Math.max, pow: Math.pow, atan2: Math.atan2 };
const isNumber = token => token != null && /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token);
const endsValue = token => isNumber(token) || /^[a-z]+$/i.test(token) && !Object.hasOwn(UNARY, token.toLowerCase()) && !Object.hasOwn(MULTI, token.toLowerCase()) || token === ')';
const startsValue = token => isNumber(token) || /^[a-z]+$/i.test(token) || token === '(';
export function compileExpression(source) {
  if (typeof source !== 'string' || source.length > 400) throw Error('Biểu thức quá dài hoặc không hợp lệ.');
  source = source.trim().replace(/^\s*y\s*=\s*/i, '').replace(/π/g, 'pi').replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  if (!source) throw Error('Nhập biểu thức trước khi vẽ.');
  const raw = source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-zA-Z]+|[+*/^(),-]/gi) || [];
  const compact = source.replace(/\s+/g, '').toLowerCase();
  if (raw.join('').toLowerCase() !== compact) throw Error('Có ký tự chưa được hỗ trợ. Dùng x, số, ngoặc và phép toán.');
  const tokens = [];
  for (let j = 0; j < raw.length; j++) {
    const curr = raw[j], prev = tokens.at(-1);
    if (prev && endsValue(prev) && startsValue(curr)) {
      // Do not split a recognized function name from its opening parenthesis.
      const isFunctionCall = /^[a-z]+$/i.test(prev) && (Object.hasOwn(UNARY, prev.toLowerCase()) || Object.hasOwn(MULTI, prev.toLowerCase())) && curr === '(';
      if (!isFunctionCall) tokens.push('*');
    }
    tokens.push(curr);
  }
  let i = 0, depth = 0;
  const peek = () => tokens[i];
  const take = token => { if (peek() === token) { i++; return true; } return false; };
  const expr = () => { let a = term(); while (peek() === '+' || peek() === '-') { const op = tokens[i++], b = term(), old = a; a = x => op === '+' ? old(x) + b(x) : old(x) - b(x); } return a; };
  const term = () => { let a = unary(); while (peek() === '*' || peek() === '/') { const op = tokens[i++], b = unary(), old = a; a = x => op === '*' ? old(x) * b(x) : old(x) / b(x); } return a; };
  const unary = () => { if (take('+')) return unary(); if (take('-')) { const a = unary(); return x => -a(x); } return power(); };
  const power = () => { const a = primary(); if (take('^')) { const b = unary(); return x => Math.pow(a(x), b(x)); } return a; };
  const primary = () => {
    if (++depth > 100) throw Error('Biểu thức quá phức tạp.');
    try {
      if (take('(')) { const a = expr(); if (!take(')')) throw Error('Thiếu dấu đóng ngoặc.'); return a; }
      const token = tokens[i++]; if (token === undefined) throw Error('Thiếu toán hạng.');
      if (isNumber(token)) { const value = Number(token); return () => value; }
      const name = token.toLowerCase();
      if (name === 'x') return x => x;
      if (name === 'pi') return () => Math.PI;
      if (name === 'e') return () => Math.E;
      if (Object.hasOwn(UNARY, name)) { if (!take('(')) throw Error(`Hàm ${name} cần ngoặc, ví dụ ${name}(x).`); const arg = expr(); if (!take(')')) throw Error('Thiếu dấu đóng ngoặc.'); return x => UNARY[name](arg(x)); }
      if (Object.hasOwn(MULTI, name)) {
        if (!take('(')) throw Error(`Hàm ${name} cần ngoặc.`);
        const args = [expr()]; while (take(',')) args.push(expr());
        if (!take(')')) throw Error('Thiếu dấu đóng ngoặc.');
        if (args.length < 2) throw Error(`Hàm ${name} cần ít nhất hai đối số.`);
        return x => MULTI[name](...args.map(fn => fn(x)));
      }
      throw Error('Không hỗ trợ biến hoặc hàm: ' + token);
    } finally { depth--; }
  };
  const fn = expr();
  if (i !== tokens.length) throw Error('Biểu thức chưa hoàn chỉnh gần vị trí: ' + tokens.slice(i, i + 3).join(' '));
  return fn;
}
// Samples many x-values and splits gaps around non-finite values / asymptotes.
export function sampleGraph(fn, { minX = -10, maxX = 10, minY = -10, maxY = 10, width = 800, height = 420, steps = 3600 } = {}) {
  if (![minX, maxX, minY, maxY, width, height].every(Number.isFinite) || !(maxX > minX && maxY > minY)) throw Error('Giới hạn trục không hợp lệ.');
  steps = Math.max(64, Math.min(12000, Math.round(steps)));
  const paths = []; let path = [], previous = null;
  for (let i = 0; i <= steps; i++) {
    const x = minX + (maxX - minX) * i / steps;
    let y; try { y = fn(x); } catch { y = NaN; }
    const px = width * i / steps, py = (maxY - y) * height / (maxY - minY);
    const valid = Number.isFinite(y) && Number.isFinite(py) && py > -height * 3 && py < height * 4;
    const jump = previous && valid && Math.abs(py - previous.py) > height * 0.35;
    if (!valid || jump) { if (path.length > 1) paths.push(path); path = []; }
    if (valid) { path.push([px, py]); previous = { px, py }; } else previous = null;
  }
  if (path.length > 1) paths.push(path);
  return paths;
}
