import { useMemo, useState } from 'react';
import { Clipboard, Delete, ArrowLeftRight, Search, Calculator as CalcIcon, History, Database, Monitor, Plus } from 'lucide-react';
import { AngleMode, decimalToFraction, evaluateScientificExpression, findRealRoots, formatNumber } from './calcEngine';
import { buildCalculatorKeySequence } from './keySequence';
import './scientific-calculator.css';

type Layout = '570' | '580' | '880';
type CalcTab = 'COMP' | 'TABLE' | 'SOLVE' | 'STAT' | 'CALC';
type HistoryEntry = { expression: string; value: number; result: string };
const KEYS_570 = [
  ['AC', 'DEL', '(', ')', '%', '÷', '√'],
  ['sin', 'cos', 'tan', 'x²', 'xʸ', '!', '×'],
  ['asin', 'acos', 'atan', 'log', 'ln', 'π', '−'],
  ['7', '8', '9', 'nCr', 'nPr', 'e', '+'],
  ['4', '5', '6', '10ˣ', 'Ans', 'S⇔D', '−'],
  ['1', '2', '3', '0', '.', '='],
];
const KEYS_580 = [
  ['AC', 'DEL', '(', ')', '%', '÷', '√'],
  ['sin', 'cos', 'tan', 'x²', 'xʸ', '!', '×'],
  ['asin', 'acos', 'atan', 'log', 'ln', 'π', '−'],
  ['7', '8', '9', 'nCr', 'nPr', 'e', '+'],
  ['4', '5', '6', '10ˣ', 'Ans', 'S⇔D', '−'],
  ['1', '2', '3', '0', '.', '='],
];
const KEYS_880 = [
  ['AC', 'DEL', '(', ')', '%', '÷', '√'],
  ['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', '×'],
  ['asin', 'acos', 'atan', 'asinh', 'acosh', 'atanh', '−'],
  ['7', '8', '9', 'x²', 'xʸ', '!', '+'],
  ['4', '5', '6', 'log', 'ln', 'log₂', '−'],
  ['1', '2', '3', '0', '.', '='],
];
function factorialInsertKey(key: string) {
  if (['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'log', 'ln', 'log₂', 'nCr', 'nPr', '√'].includes(key)) {
    return key === '√' ? 'sqrt(' : key === 'log₂' ? 'log2(' : `${key.toLowerCase()}(`;
  }
  if (key === 'π') return 'pi';
  if (key === 'Ans') return 'ans';
  if (key === '×') return '*';
  if (key === '÷') return '/';
  if (key === '−') return '-';
  if (key === 'x²') return '^2';
  if (key === 'xʸ') return '^';
  if (key === '10ˣ') return '10^';
  return key;
}
function calculateStats(raw: string) {
  const values = raw.split(/[\s,;]+/).filter(Boolean).map(Number);
  if (values.length === 0 || values.some(n => !Number.isFinite(n))) throw new Error('Nhập dãy số, ngăn cách bằng dấu phẩy hoặc khoảng trắng.');
  const sorted = [...values].sort((a, b) => a - b), sum = values.reduce((a, b) => a + b, 0), mean = sum / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { count: values.length, sum, mean, median: sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2, min: sorted[0], max: sorted[sorted.length - 1], sd: Math.sqrt(variance), sampleSd: values.length > 1 ? Math.sqrt(variance * values.length / (values.length - 1)) : 0 };
}
function parseVariableAssignments(raw: string, angleMode: AngleMode, ans: number): Record<string, number> {
  const variables: Record<string, number> = {};
  const entries = raw.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  if (!entries.length) throw new Error('Nhập các biến theo dạng A=2, B=3.');
  for (const entry of entries) {
    const match = entry.match(/^([A-F])\s*=\s*(.+)$/i);
    if (!match) throw new Error(`Cú pháp biến chưa đúng: “${entry}”. Dùng A=2, B=3, ...`);
    const name = match[1].toLowerCase();
    const value = evaluateScientificExpression(match[2], { angleMode, ans, variables });
    if (!Number.isFinite(value)) throw new Error(`Giá trị ${match[1].toUpperCase()} phải hữu hạn.`);
    variables[name] = value;
  }
  return variables;
}

export default function ScientificCalculator({ onInsertToPage }: { onInsertToPage?: (text: string) => void } = {}) {
  const [layout, setLayout] = useState<Layout>('580');
  const [tab, setTab] = useState<CalcTab>('COMP');
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const [resultValue, setResultValue] = useState<number | null>(null);
  const [angleMode, setAngleMode] = useState<AngleMode>('DEG');
  const [fractionMode, setFractionMode] = useState(false);
  const [answer, setAnswer] = useState(0);
  const [memory, setMemory] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState('');
  const [variableAssignments, setVariableAssignments] = useState('');
  const [tableStart, setTableStart] = useState('-3');
  const [tableEnd, setTableEnd] = useState('3');
  const [tableStep, setTableStep] = useState('1');
  const [solveLow, setSolveLow] = useState('-20');
  const [solveHigh, setSolveHigh] = useState('20');
  const [roots, setRoots] = useState<number[] | null>(null);
  const [statsInput, setStatsInput] = useState('');
  const [stats, setStats] = useState<ReturnType<typeof calculateStats> | null>(null);
  const activeKeys = layout === '570' ? KEYS_570 : layout === '580' ? KEYS_580 : KEYS_880;
  const tableRows = useMemo(() => {
    if (tab !== 'TABLE' || !expression.trim()) return [] as { x: number; y: number | string }[];
    const start = Number(tableStart), end = Number(tableEnd), step = Number(tableStep);
    if (![start, end, step].every(Number.isFinite) || step === 0 || ((end - start) * step < 0)) return [] as { x: number; y: number | string }[];
    const count = Math.min(80, Math.floor((end - start) / step + 1e-9) + 1);
    const rows: { x: number; y: number | string }[] = [];
    for (let i = 0; i < count; i++) {
      const x = start + i * step;
      try {
        const y = evaluateScientificExpression(expression, { angleMode, ans: answer, x });
        rows.push({ x, y: Number.isFinite(y) ? formatNumber(y) : 'Math Error' });
      } catch {
        rows.push({ x, y: 'Math Error' });
      }
    }
    return rows;
  }, [tab, expression, tableStart, tableEnd, tableStep, angleMode, answer]);

  const showResult = (value: number, expr = expression) => {
    if (!Number.isFinite(value)) throw new Error('Math Error: kết quả không hữu hạn.');
    const pretty = formatNumber(value);
    setResultValue(value); setResult(pretty); setAnswer(value); setFractionMode(false); setError('');
    setHistory(old => [{ expression: expr, value, result: pretty }, ...old.filter(h => h.expression !== expr)].slice(0, 16));
  };
  const compute = () => {
    try {
      const variables = tab === 'CALC' ? parseVariableAssignments(variableAssignments, angleMode, answer) : undefined;
      showResult(evaluateScientificExpression(expression, { angleMode, ans: answer, variables }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tính được biểu thức.');
      setResult(''); setResultValue(null);
    }
  };
  const insert = (key: string) => {
    if (key === 'AC') { setExpression(''); setResult(''); setResultValue(null); setError(''); return; }
    if (key === 'DEL') { setExpression(s => s.slice(0, -1)); setError(''); return; }
    if (key === '=') { compute(); return; }
    if (key === 'S⇔D') { if (resultValue !== null) { setFractionMode(v => !v); setError(''); } return; }
    const token = factorialInsertKey(key);
    setExpression(s => s + token); setResult(''); setResultValue(null); setError('');
  };
  const fractionResult = resultValue === null ? null : decimalToFraction(resultValue);
  const displayedResult = fractionMode && fractionResult ? fractionResult : result;
  const memoryStore = (mode: 'add' | 'subtract' | 'recall' | 'clear') => {
    if (mode === 'clear') { setMemory(null); return; }
    if (mode === 'recall') { if (memory !== null) setExpression(s => s + formatNumber(memory)); return; }
    const current = resultValue ?? answer;
    setMemory((memory ?? 0) + (mode === 'add' ? current : -current));
  };
  const copyResult = async () => {
    const value = displayedResult || result;
    if (!value) return;
    try { await navigator.clipboard.writeText(value); setError('Đã sao chép kết quả.'); }
    catch { setError('Không truy cập được clipboard của hệ thống.'); }
  };
  const buildSequenceReport = () => {
    if (!expression.trim()) throw new Error('Nhập biểu thức trước khi xuất chuỗi phím.');
    const sequence = buildCalculatorKeySequence(expression).join(' → ');
    return `LỚP HỌC MỰC · CHUỖI PHÍM MINH HỌA\nBố cục: ${layout}\nBiểu thức: ${expression}\nChuỗi phím: ${sequence} → =\nKết quả: ${displayedResult || '(chưa tính)'}\nLưu ý: đây là chuỗi phím gợi ý được suy ra từ biểu thức, không phải bản ghi thao tác thời gian thực hoặc firmware Casio.`;
  };
  const exportSequence = async () => {
    try {
      const text = buildSequenceReport();
      await navigator.clipboard.writeText(text);
      setError('Đã sao chép chuỗi phím minh họa vào clipboard.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tạo hoặc sao chép chuỗi phím.');
    }
  };
  const insertResultToPage = () => {
    if (!onInsertToPage) return;
    if (tab === 'SOLVE' && roots && roots.length) {
      onInsertToPage(`${expression} = 0  ⇒  ${roots.map((r, i) => `x${i + 1} ≈ ${formatNumber(r)}`).join('; ')}`);
      return;
    }
    if (tab === 'STAT' && stats) {
      onInsertToPage(`Thống kê (n=${stats.count}): x̄ = ${formatNumber(stats.mean)}, Mₑ = ${formatNumber(stats.median)}, σ = ${formatNumber(stats.sd)}, s = ${formatNumber(stats.sampleSd)}`);
      return;
    }
    const val = displayedResult || result;
    if (!expression.trim() && !val) {
      setError('Hãy tính một biểu thức trước khi chèn lên trang.');
      return;
    }
    const assignNote = tab === 'CALC' && variableAssignments.trim() ? ` (với ${variableAssignments.trim()})` : '';
    onInsertToPage(val ? `${expression}${assignNote} = ${val}` : expression);
  };
  const insertSequenceToPage = () => {
    if (!onInsertToPage) return;
    try {
      const sequence = buildCalculatorKeySequence(expression).join(' → ');
      const val = displayedResult || result;
      onInsertToPage(`Biểu thức: ${expression}\nBấm phím (${layout}): ${sequence} → =${val ? `\nKết quả: ${val}` : ''}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tạo chuỗi phím.');
    }
  };
  const solve = () => {
    try {
      const low = Number(solveLow), high = Number(solveHigh);
      const found = findRealRoots(expression, low, high, angleMode, answer);
      setRoots(found);
      setError(found.length ? '' : 'Không tìm thấy nghiệm thực trong khoảng đã chọn.');
    } catch (e) {
      setRoots(null);
      setError(e instanceof Error ? e.message : 'Không giải được biểu thức.');
    }
  };
  const runStats = () => {
    try { setStats(calculateStats(statsInput)); setError(''); }
    catch (e) { setStats(null); setError(e instanceof Error ? e.message : 'Không tính được thống kê.'); }
  };
  const runButton = (key: string) => {
    if (key === 'S⇔D') { if (resultValue !== null) { setFractionMode(v => !v); } else setExpression(s => s); return; }
    if (key === '=') { compute(); return; }
    insert(key);
  };

  return <div className="scientific-calculator">
    <div className="sci-topline"><div className="sci-brand"><span className="sci-brand-mark"><CalcIcon size={17}/></span><div><b>Mực Scientific</b><small>Máy tính khoa học · dùng offline</small></div></div><div className="sci-layout-switch" role="group" aria-label="Bố cục phím"><button className={layout === '570' ? 'active' : ''} onClick={() => setLayout('570')}>570 · Plus</button><button className={layout === '580' ? 'active' : ''} onClick={() => setLayout('580')}>580 · THPT</button><button className={layout === '880' ? 'active' : ''} onClick={() => setLayout('880')}>880 · Nâng cao</button></div></div>
    <div className="sci-embedded-notice"><Monitor size={16}/><span><b>Máy tính tích hợp · offline</b><small>Dùng ngay bên dưới, không cần cài thêm phần mềm. Hỗ trợ tính khoa học, bảng giá trị, giải số và thống kê.</small></span></div>
    <div className="sci-screen"><div className="sci-screen-status"><span>{tab}</span><span>{angleMode}</span><span>{memory !== null ? 'M' : ''}</span><span>{`Ans ${formatNumber(answer)}`}</span></div>
      {tab === 'STAT' ? <textarea className="sci-expression sci-expression-multi" value={statsInput} onChange={e => setStatsInput(e.target.value)} placeholder="Dãy số: 12, 15, 18, 21, 24" aria-label="Dãy số thống kê"/> : <input className="sci-expression" value={expression} onChange={e => { setExpression(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (tab === 'SOLVE') solve(); else compute(); } if (e.key === 'Escape') { setExpression(''); setResult(''); setError(''); } }} placeholder={tab === 'SOLVE' ? 'f(x) = x^2 − 4' : tab === 'TABLE' ? 'f(x) = sin(x) + x' : 'Nhập biểu thức…'} aria-label="Biểu thức toán học"/>}
      <div className="sci-result-row"><span>{error || 'Kết quả'}</span><strong>{tab === 'SOLVE' && roots ? roots.map(formatNumber).join('  ·  ') : tab === 'STAT' && stats ? formatNumber(stats.mean) : displayedResult}</strong></div>
    </div>
    <div className="sci-tabs">{(['COMP', 'TABLE', 'SOLVE', 'STAT', 'CALC'] as CalcTab[]).map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => { setTab(t); setError(''); }}>{t === 'COMP' ? 'Tính' : t === 'TABLE' ? 'Bảng giá trị' : t === 'SOLVE' ? 'Giải x' : t === 'STAT' ? 'Thống kê' : 'Thay A–F'}</button>)}</div>
    {tab === 'COMP' && <>
      <div className="sci-actions"><button onClick={() => setAngleMode(v => (v === 'DEG' ? 'RAD' : 'DEG'))}>{angleMode === 'DEG' ? 'Độ (DEG)' : 'Radian (RAD)'}</button><button onClick={() => memoryStore('recall')} disabled={memory === null}>MR</button><button onClick={() => memoryStore('add')}>M+</button><button onClick={() => memoryStore('subtract')}>M−</button><button onClick={() => memoryStore('clear')}>MC</button><button onClick={() => setHistory([])}><History size={13}/> Xóa lịch sử</button></div>
      <div className={'sci-keypad ' + (layout === '880' ? 'advanced-layout' : '')}>{activeKeys.flat().map((key, i) => <button key={`${key}-${i}`} className={`sci-key ${key === '=' ? 'equals' : key === 'AC' ? 'clear' : /^[0-9.]$/.test(key) ? 'number' : (['+', '−', '×', '÷', '^', 'x²', 'xʸ', '!', '%'].includes(key) ? 'operator' : 'function')}`} onClick={() => runButton(key)}>{key}</button>)}</div>
      <div className="sci-extra-keys"><button onClick={() => insert('abs(')}>abs</button><button onClick={() => insert('exp(')}>eˣ</button><button onClick={() => insert('log2(')}>log₂</button><button onClick={() => insert('min(')}>min</button><button onClick={() => insert('max(')}>max</button><button onClick={() => insert('gcd(')}>gcd</button><button onClick={() => insert('lcm(')}>lcm</button><button onClick={() => insert('mod(')}>mod</button><button onClick={() => insert('floor(')}>⌊x⌋</button><button onClick={() => insert('ceil(')}>⌈x⌉</button><button onClick={() => insert('frac(')}>frac</button><button onClick={() => insert('log(')}>log</button></div>
      <div className="sci-bottom-actions">
        <button onClick={copyResult} disabled={!result}><Clipboard size={14}/> Sao chép</button>
        <button onClick={exportSequence} disabled={!expression.trim()}><Clipboard size={14}/> Xuất chuỗi phím</button>
        {onInsertToPage && <button onClick={insertResultToPage} disabled={!result && !expression.trim()}><Plus size={14}/> Chèn KQ lên trang</button>}
        {onInsertToPage && <button onClick={insertSequenceToPage} disabled={!expression.trim()}><Plus size={14}/> Chèn phím lên trang</button>}
        <button onClick={() => { if (resultValue !== null) { setExpression(formatNumber(resultValue)); setResult(''); setResultValue(null); } }} disabled={resultValue === null}><ArrowLeftRight size={14}/> Thay bằng kết quả</button>
        <button onClick={() => setExpression('')}><Delete size={14}/> Xóa biểu thức</button>
      </div>
      {!!history.length && <div className="sci-history"><div className="sci-section-title"><History size={14}/> Lịch sử gần đây <span>Chọn một dòng để tính lại</span></div>{history.slice(0, 5).map((h, i) => <button key={`${h.expression}-${i}`} onClick={() => { setExpression(h.expression); setResult(h.result); setResultValue(h.value); setAnswer(h.value); setTab('COMP'); }}><span>{h.expression}</span><b>{h.result}</b></button>)}</div>}
    </>}
    {tab === 'CALC' && <div className="sci-mode-panel"><p className="sci-help">Thay giá trị biến như chế độ CALC: nhập A=2, B=3, C=4 rồi tính biểu thức có chứa A–F. Có thể dùng biểu thức trước đó, ví dụ A=2, B=sqrt(9).</p><label className="sci-variable-field">Giá trị biến A–F<textarea value={variableAssignments} onChange={e => setVariableAssignments(e.target.value)} placeholder="A=2, B=3, C=4" rows={3}/></label><button className="sci-run" onClick={compute}><CalcIcon size={15}/> Tính với giá trị biến</button>{onInsertToPage && <button className="sci-run" style={{ marginTop: 6 }} onClick={insertResultToPage} disabled={!result}><Plus size={15}/> Chèn kết quả CALC lên trang</button>}<p className="sci-help">Ví dụ: nhập biểu thức <code>2A+B^2</code> ở màn hình trên. Với A=2, B=3, kết quả là 13.</p></div>}
    {tab === 'TABLE' && <div className="sci-mode-panel"><p className="sci-help">Nhập hàm theo biến x ở tab Tính rồi tạo bảng giá trị.</p><div className="sci-range-grid"><label>Từ x<input value={tableStart} onChange={e => setTableStart(e.target.value)}/></label><label>Đến<input value={tableEnd} onChange={e => setTableEnd(e.target.value)}/></label><label>Bước<input value={tableStep} onChange={e => setTableStep(e.target.value)}/></label></div><div className="sci-table-scroll"><table><thead><tr><th>x</th><th>f(x)</th></tr></thead><tbody>{tableRows.map((r, i) => <tr key={i}><td>{formatNumber(r.x)}</td><td>{r.y}</td></tr>)}</tbody></table>{!tableRows.length && <p className="sci-empty">Nhập hàm ở tab Tính, ví dụ <code>sin(x)+x²</code>.</p>}</div></div>}
    {tab === 'SOLVE' && <div className="sci-mode-panel"><p className="sci-help">Tìm nghiệm thực của f(x) = 0 trong khoảng (hỗ trợ cả nghiệm đổi dấu và nghiệm bội tiếp xúc).</p><div className="sci-range-grid"><label>x nhỏ nhất<input type="number" value={solveLow} onChange={e => setSolveLow(e.target.value)}/></label><label>x lớn nhất<input type="number" value={solveHigh} onChange={e => setSolveHigh(e.target.value)}/></label></div><button className="sci-run" onClick={solve}><Search size={15}/> Tìm nghiệm của f(x) = 0</button>{roots && <div className="sci-root-list">{roots.length ? roots.map((r, i) => <div key={i}><span>x{i + 1}</span><b>{formatNumber(r)}</b></div>) : 'Không tìm thấy nghiệm trong khoảng đã chọn.'}</div>}{onInsertToPage && roots && roots.length > 0 && <button className="sci-run" style={{ marginTop: 6 }} onClick={insertResultToPage}><Plus size={15}/> Chèn nghiệm lên trang</button>}</div>}
    {tab === 'STAT' && <div className="sci-mode-panel"><p className="sci-help">Nhập số liệu, ngăn cách bởi dấu phẩy hoặc khoảng trắng.</p><button className="sci-run" onClick={runStats}>Tính thống kê</button>{stats && <div className="sci-stats-grid">{[['n', stats.count], ['Σx', formatNumber(stats.sum)], ['Trung bình', formatNumber(stats.mean)], ['Trung vị', formatNumber(stats.median)], ['Nhỏ nhất', formatNumber(stats.min)], ['Lớn nhất', formatNumber(stats.max)], ['Độ lệch chuẩn σ', formatNumber(stats.sd)], ['Độ lệch mẫu s', formatNumber(stats.sampleSd)]].map(([label, value]) => <div key={String(label)}><span>{label}</span><b>{value}</b></div>)}</div>}{onInsertToPage && stats && <button className="sci-run" style={{ marginTop: 6 }} onClick={insertResultToPage}><Plus size={15}/> Chèn kết quả thống kê lên trang</button>}</div>}
    <div className="sci-footnote"><Database size={13}/> Độ được đặt mặc định · giao diện Mực độc lập, không phải firmware giả lập của hãng</div>
  </div>;
}
