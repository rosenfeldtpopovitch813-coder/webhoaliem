/** Converts an expression into a readable calculator-key sequence (not vendor firmware input). */
const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'sqrt', 'cbrt', 'ln', 'log', 'log2', 'exp', 'abs', 'floor', 'ceil', 'round', 'sign', 'min', 'max',
  'ncr', 'npr', 'gcd', 'lcm', 'mod', 'remainder', 'frac', 'int', 'deg', 'rad',
]);

export function buildCalculatorKeySequence(expression: string): string[] {
  const source = expression
    .replace(/[−–]/g, '-')
    .replace(/[×·⋅]/g, '*')
    .replace(/[÷／]/g, '/')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3');
  const tokens: string[] = [];
  for (let i = 0; i < source.length;) {
    const rest = source.slice(i);
    if (/^\s/.test(source[i])) { i++; continue; }
    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) { tokens.push(number[0]); i += number[0].length; continue; }
    const name = rest.match(/^[a-zA-Z_][a-zA-Z_0-9]*/);
    if (name) { tokens.push(name[0]); i += name[0].length; continue; }
    const char = source[i];
    if ('+-*/^!%(),'.includes(char)) { tokens.push(char); i++; continue; }
    throw new Error(`Không thể tạo chuỗi phím cho ký hiệu “${char}”.`);
  }
  const keys: string[] = [];
  for (const token of tokens) {
    if (/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(token)) {
      for (const ch of token) {
        if (/\d/.test(ch)) keys.push(ch);
        else if (ch === '.') keys.push('.');
        else if (/[eE]/.test(ch)) keys.push('×10ˣ');
        else if (ch === '-') keys.push('−');
        else if (ch === '+') keys.push('+');
      }
      continue;
    }
    const name = token.toLowerCase();
    if (FUNCTIONS.has(name)) {
      keys.push(
        ({
          sqrt: '√',
          cbrt: '∛',
          ln: 'ln',
          log: 'log',
          log2: 'log₂',
          ncr: 'nCr',
          npr: 'nPr',
          gcd: 'gcd',
          lcm: 'lcm',
          mod: 'mod',
          remainder: 'mod',
        } as Record<string, string>)[name] || name,
      );
      continue;
    }
    if (/^[a-f]$/i.test(token)) { keys.push('ALPHA', token.toUpperCase()); continue; }
    if (name === 'x') { keys.push('X'); continue; }
    if (name === 'pi') { keys.push('π'); continue; }
    if (name === 'ans') { keys.push('Ans'); continue; }
    if (name === 'e') { keys.push('e'); continue; }
    switch (token) {
      case '+': keys.push('+'); break;
      case '-': keys.push('−'); break;
      case '*': keys.push('×'); break;
      case '/': keys.push('÷'); break;
      case '^': keys.push('xʸ'); break;
      case '!': keys.push('x!'); break;
      case '%': keys.push('%'); break;
      case '(': keys.push('('); break;
      case ')': keys.push(')'); break;
      case ',': keys.push(','); break;
      default: throw new Error(`Tên hoặc phím “${token}” chưa được hỗ trợ.`);
    }
  }
  return keys;
}
