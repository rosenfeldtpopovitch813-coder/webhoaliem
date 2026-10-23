import { useMemo, useState } from 'react';
import { Activity, BookOpen, Dices, ListTree, Network } from 'lucide-react';
import katex from 'katex';
import { fmt, svgUri, type MathHubProps } from './mathHubUtils';

export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) return NaN;
  let x = 1;
  for (let i = 2; i <= n; i++) x *= i;
  return x;
}

export function arrangement(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || r < 0 || n < r || n > 170) return NaN;
  let x = 1;
  for (let i = n - r + 1; i <= n; i++) x *= i;
  return x;
}

export function combination(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || r < 0 || n < r || n > 170) return NaN;
  const k = Math.min(r, n - r);
  let x = 1;
  for (let i = 1; i <= k; i++) x = x * (n - k + i) / i;
  return Math.round(x);
}

export function circularPermutation(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 171) return NaN;
  return factorial(n - 1);
}

export function binomialProbability(n: number, k: number, p: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || k > n || !Number.isFinite(p) || p < 0 || p > 1) return NaN;
  const c = combination(n, k);
  if (!Number.isFinite(c)) return NaN;
  return c * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

export function ProbabilityPanel() {
  const [n, setN] = useState(6);
  const [r, setR] = useState(2);
  const [mode, setMode] = useState<'perm' | 'arrange' | 'combine' | 'circular'>('combine');
  const [coin, setCoin] = useState({ h: 0, t: 0 });
  const [dice, setDice] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [venn, setVenn] = useState([8, 3, 5]);
  const [rows, setRows] = useState(6);
  const [binN, setBinN] = useState(10);
  const [binK, setBinK] = useState(3);
  const [binP, setBinP] = useState('0.5');

  const answer = mode === 'perm' ? factorial(n) : mode === 'arrange' ? arrangement(n, r) : mode === 'combine' ? combination(n, r) : circularPermutation(n);
  const toss = () => { const h = Math.random() < 0.5; setCoin(s => (h ? { h: s.h + 1, t: s.t } : { h: s.h, t: s.t + 1 })); };
  const roll = () => { const v = Math.floor(Math.random() * 6); setDice(s => s.map((x, i) => (i === v ? x + 1 : x))); };
  const pascal = Array.from({ length: Math.max(1, Math.min(10, rows)) }, (_, i) => Array.from({ length: i + 1 }, (_, j) => combination(i, j)));
  const pVal = Number(binP);
  const binProb = binomialProbability(binN, binK, pVal);

  return <div className="mh-page"><div className="mh-page-heading"><div><span className="mh-kicker">TỔ HỢP – XÁC SUẤT</span><h1>Đếm và mô phỏng xác suất</h1><p>Tính toán hoán vị, chỉnh hợp, tổ hợp, phân phối nhị thức Bernoulli và mô phỏng tần suất thực nghiệm.</p></div></div><div className="mh-prob-grid"><section className="mh-tool-card"><h3><Dices size={17}/> Công thức đếm</h3><div className="mh-param-grid"><label>n<input type="number" min="0" max="170" value={n} onChange={e => setN(Number(e.target.value))}/></label><label>r<input type="number" min="0" max={n} value={r} onChange={e => setR(Number(e.target.value))}/></label></div><div className="mh-choice-grid">{([['perm', 'Hoán vị n!'], ['arrange', 'Chỉnh hợp A(n,r)'], ['combine', 'Tổ hợp C(n,r)'], ['circular', 'Hoán vị vòng tròn']] as const).map(([id, label]) => <button key={id} className={mode === id ? 'active' : ''} onClick={() => setMode(id)}>{label}</button>)}</div><div className="mh-big-answer">{Number.isFinite(answer) ? fmt(answer, 0) : 'Không hợp lệ (cần số nguyên 0 ≤ r ≤ n)'}<small>{mode === 'perm' ? `P_${n} = ${n}!` : mode === 'arrange' ? `A_${n}^${r} = ${n}! / (${n}−${r})!` : mode === 'combine' ? `C_${n}^${r} = ${n}! / [${r}!(${n}−${r})!]` : `Q_${n} = (${n}−1)! (với n ≥ 1)`}</small></div>
    <h4>Xác suất nhị thức Bernoulli P(X = k)</h4>
    <div className="mh-param-grid">
      <label>Số phép thử n<input type="number" min="1" max="170" value={binN} onChange={e => setBinN(Number(e.target.value))}/></label>
      <label>Số lần thành công k<input type="number" min="0" max={binN} value={binK} onChange={e => setBinK(Number(e.target.value))}/></label>
      <label>Xác suất p (0–1)<input type="number" min="0" max="1" step="0.05" value={binP} onChange={e => setBinP(e.target.value)}/></label>
    </div>
    <p className="mh-subtle">{Number.isFinite(binProb) ? `P(X = ${binK}) = C(${binN}, ${binK}) · ${pVal}^${binK} · (1 − ${pVal})^${binN - binK} ≈ ${fmt(binProb, 6)} (${fmt(binProb * 100, 3)}%) · Kỳ vọng E(X) = np = ${fmt(binN * pVal, 3)} · Phương sai V(X) = np(1−p) = ${fmt(binN * pVal * (1 - pVal), 4)}` : 'Kiểm tra điều kiện 0 ≤ k ≤ n nguyên và 0 ≤ p ≤ 1.'}</p>
    <h4>Tam giác Pascal</h4><label className="mh-field"><span>Số hàng</span><input type="number" min="1" max="10" value={rows} onChange={e => setRows(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}/></label><div className="mh-pascal">{pascal.map((row, i) => <div key={i}>{row.map((v, j) => <span key={j}>{Number.isFinite(v) ? fmt(v, 0) : '—'}</span>)}</div>)}</div></section>
    <section className="mh-tool-card"><h3><Activity size={17}/> Mô phỏng thực nghiệm</h3><div className="mh-sim-row"><div><small>Đồng xu</small><b>{coin.h + coin.t} lần</b><p>Mặt ngửa: {coin.h} ({coin.h + coin.t ? fmt(100 * coin.h / (coin.h + coin.t), 1) : '0'}%)<br/>Mặt sấp: {coin.t} ({coin.h + coin.t ? fmt(100 * coin.t / (coin.h + coin.t), 1) : '0'}%)</p></div><button className="mh-primary-button" onClick={toss}>Tung xu</button><button className="mh-secondary-button" onClick={() => setCoin({ h: 0, t: 0 })}>Đặt lại</button></div><div className="mh-sim-row"><div><small>Xúc xắc 6 mặt</small><b>{dice.reduce((a, b) => a + b, 0)} lần</b><p>{dice.map((v, i) => `${i + 1}: ${v}`).join(' · ')}</p><div className="mh-dice-bars">{dice.map((v, i) => <span key={i} title={`${i + 1}: ${v}`} style={{ height: `${Math.max(5, v / Math.max(1, ...dice) * 48)}px` }}><small>{i + 1}</small></span>)}</div></div><button className="mh-primary-button" onClick={roll}>Tung xúc xắc</button><button className="mh-secondary-button" onClick={() => setDice([0, 0, 0, 0, 0, 0])}>Đặt lại</button></div><h4>Giản đồ Venn (số phần tử)</h4><div className="mh-venn"><svg viewBox="0 0 320 180"><circle cx="115" cy="88" r="68" fill="#60a5fa" fillOpacity=".45" stroke="#2563eb" strokeWidth="2"/><circle cx="205" cy="88" r="68" fill="#f472b6" fillOpacity=".42" stroke="#db2777" strokeWidth="2"/><text x="85" y="86" fontSize="17" textAnchor="middle">{venn[0]}</text><text x="160" y="86" fontSize="17" textAnchor="middle">{venn[1]}</text><text x="235" y="86" fontSize="17" textAnchor="middle">{venn[2]}</text><text x="65" y="20" fontSize="14">A</text><text x="250" y="20" fontSize="14">B</text></svg></div><div className="mh-param-grid">{['A riêng', 'A∩B', 'B riêng'].map((lab, i) => <label key={lab}>{lab}<input type="number" min="0" value={venn[i]} onChange={e => setVenn(old => old.map((v, j) => (i === j ? Math.max(0, Number(e.target.value) || 0) : v)))}/></label>)}</div><p className="mh-subtle">|A∪B| = {venn.reduce((s, v) => s + v, 0)} · P(A|B) = {venn[1] + venn[2] > 0 ? fmt(venn[1] / (venn[1] + venn[2]), 4) : '—'}.</p></section></div></div>;
}

export type Edge = { u: string; v: string; w: number };
export type GraphData = { nodes: string[]; edges: Edge[]; error: string };

export function parseEdges(raw: string): GraphData {
  const edges: Edge[] = [];
  for (const token of raw.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)) {
    const m = token.match(/^([A-Za-z0-9_]+)\s*[-–>]\s*([A-Za-z0-9_]+)(?:\s*:\s*(-?\d+(?:\.\d+)?))?$/);
    if (!m) return { nodes: [], edges: [], error: `Không đọc được cạnh “${token}”. Dùng dạng A-B:4.` };
    const e = { u: m[1], v: m[2], w: m[3] === undefined ? 1 : Number(m[3]) };
    if (!Number.isFinite(e.w) || e.w < 0) return { nodes: [], edges: [], error: 'Trọng số phải là số hữu hạn không âm.' };
    edges.push(e);
  }
  const nodes = [...new Set(edges.flatMap(e => [e.u, e.v]))].sort();
  if (nodes.length > 18) return { nodes: [], edges: [], error: 'Tối đa 18 đỉnh trong công cụ này.' };
  if (!nodes.length) return { nodes: [], edges: [], error: 'Nhập ít nhất một cạnh.' };
  return { nodes, edges, error: '' };
}

export function runGraphAlgorithms(nodes: string[], edges: Edge[], source: string) {
  const startNode = nodes.includes(source) ? source : (nodes[0] || '');
  const dist: Record<string, number> = Object.fromEntries(nodes.map(n => [n, Infinity]));
  const prev: Record<string, string | null> = Object.fromEntries(nodes.map(n => [n, null]));
  if (startNode in dist) dist[startNode] = 0;
  const visited = new Set<string>();
  while (visited.size < nodes.length) {
    const u = nodes.filter(n => !visited.has(n)).sort((a, b) => dist[a] - dist[b])[0];
    if (!u || !Number.isFinite(dist[u])) break;
    visited.add(u);
    for (const e of edges) {
      const v = e.u === u ? e.v : e.v === u ? e.u : null;
      if (!v || visited.has(v)) continue;
      if (dist[u] + e.w < dist[v]) {
        dist[v] = dist[u] + e.w;
        prev[v] = u;
      }
    }
  }
  const paths: Record<string, string[]> = {};
  for (const n of nodes) {
    if (!Number.isFinite(dist[n])) { paths[n] = []; continue; }
    const chain: string[] = [];
    let cur: string | null = n;
    while (cur) { chain.unshift(cur); cur = prev[cur]; }
    paths[n] = chain;
  }

  const parent: Record<string, string> = Object.fromEntries(nodes.map(n => [n, n]));
  const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const mst: Edge[] = [];
  for (const e of [...edges].sort((a, b) => a.w - b.w)) {
    const x = find(e.u), y = find(e.v);
    if (x !== y) {
      parent[x] = y;
      mst.push(e);
      if (mst.length === nodes.length - 1) break;
    }
  }

  const compMap = new Map<string, string[]>();
  for (const n of nodes) {
    const root = find(n);
    const list = compMap.get(root) || [];
    list.push(n);
    compMap.set(root, list);
  }
  const components = [...compMap.values()];

  const prim: Edge[] = [];
  if (startNode) {
    const inside = new Set([startNode]);
    while (inside.size < nodes.length) {
      const candidates = edges.filter(e => inside.has(e.u) !== inside.has(e.v)).sort((a, b) => a.w - b.w);
      if (!candidates.length) break;
      const e = candidates[0];
      prim.push(e);
      inside.add(inside.has(e.u) ? e.v : e.u);
    }
  }

  const matrix = nodes.map(u => nodes.map(v => {
    const matching = edges.filter(e => (e.u === u && e.v === v) || (e.u === v && e.v === u));
    if (!matching.length) return 0;
    return Math.min(...matching.map(e => e.w));
  }));

  return { dist, prev, paths, mst, prim, matrix, components, isConnected: components.length <= 1 };
}

export function GraphTheoryPanel() {
  const [raw, setRaw] = useState('A-B:4, A-C:2, B-C:1, B-D:5, C-D:8, C-E:10, D-E:2, D-F:6, E-F:3');
  const [source, setSource] = useState('A');
  const [algorithm, setAlgorithm] = useState<'dijkstra' | 'kruskal' | 'prim' | 'matrix'>('dijkstra');
  const graph = useMemo(() => parseEdges(raw), [raw]);
  const activeSource = graph.nodes.includes(source) ? source : (graph.nodes[0] || '');
  const calc = useMemo(() => (graph.nodes.length ? runGraphAlgorithms(graph.nodes, graph.edges, activeSource) : null), [graph, activeSource]);

  const result = () => {
    if (!calc) return '';
    const compInfo = `Số thành phần liên thông: ${calc.components.length} (${calc.components.map(c => `{${c.join(', ')}}`).join(', ')})\n`;
    if (algorithm === 'dijkstra') {
      return compInfo + graph.nodes.map(n => `${activeSource} → ${n}: ${Number.isFinite(calc.dist[n]) ? `${fmt(calc.dist[n], 3)} [đường đi: ${calc.paths[n].join(' → ')}]` : 'không tới được (khác thành phần liên thông)'}`).join('\n');
    }
    if (algorithm === 'kruskal' || algorithm === 'prim') {
      const edges = algorithm === 'kruskal' ? calc.mst : calc.prim;
      return compInfo + `${algorithm === 'kruskal' ? 'Kruskal' : `Prim (từ ${activeSource})`} chọn ${edges.length} cạnh:\n${edges.map(e => `${e.u} — ${e.v} (${e.w})`).join('\n')}\nTổng trọng số = ${fmt(edges.reduce((s, e) => s + e.w, 0), 3)}${!calc.isConnected ? '\nLưu ý: Đồ thị không liên thông; Kruskal tạo rừng khung nhỏ nhất, còn Prim tạo cây khung của thành phần chứa đỉnh xuất phát.' : ''}`;
    }
    return compInfo + `\t${graph.nodes.join('\t')}\n` + calc.matrix.map((r, i) => `${graph.nodes[i]}\t${r.join('\t')}`).join('\n');
  };

  const coords = graph.nodes.map((name, i) => ({
    name,
    x: 280 + 190 * Math.cos(-Math.PI / 2 + 2 * Math.PI * i / Math.max(1, graph.nodes.length)),
    y: 175 + 125 * Math.sin(-Math.PI / 2 + 2 * Math.PI * i / Math.max(1, graph.nodes.length)),
  }));

  return <div className="mh-page"><div className="mh-page-heading"><div><span className="mh-kicker">TOÁN RỜI RẠC</span><h1>Lý thuyết đồ thị</h1><p>Nhập cạnh có trọng số, kiểm tra tính liên thông, xem ma trận kề và chạy Dijkstra, Prim, Kruskal.</p></div></div><div className="mh-graph-layout"><section className="mh-tool-card"><h3><Network size={17}/> Danh sách cạnh</h3><textarea className="mh-graph-input" value={raw} onChange={e => setRaw(e.target.value)} spellCheck={false}/><p className="mh-subtle">Dạng mỗi cạnh: A-B:4; bỏ trọng số thì mặc định là 1. Cạnh vô hướng, trọng số không âm.</p><div className="mh-field"><span>Đỉnh xuất phát</span><select value={activeSource} onChange={e => setSource(e.target.value)}>{graph.nodes.map(n => <option key={n} value={n}>{n}</option>)}</select></div><div className="mh-choice-grid">{([['dijkstra', 'Dijkstra'], ['kruskal', 'Kruskal'], ['prim', 'Prim'], ['matrix', 'Ma trận kề']] as const).map(([id, label]) => <button key={id} className={algorithm === id ? 'active' : ''} onClick={() => setAlgorithm(id)}>{label}</button>)}</div><div className="mh-example-buttons"><button onClick={() => setRaw('A-B:1, A-C:4, B-C:2, B-D:5, C-D:1')}>Mẫu 4 đỉnh</button><button onClick={() => setRaw('A-B:4, A-C:2, B-C:1, B-D:5, C-D:8, C-E:10, D-E:2, D-F:6, E-F:3')}>Mẫu 6 đỉnh</button><button onClick={() => setRaw('A-B:2, C-D:1')}>Đồ thị rời rạc</button></div>{graph.error && <div className="mh-error" style={{ marginTop: 10 }}>{graph.error}</div>}</section><section className="mh-tool-card"><div className="mh-graph-viz"><svg viewBox="0 0 560 350" role="img" aria-label="Đồ thị có trọng số"><rect width="560" height="350" rx="12" fill="#f8fafc"/>{graph.edges.map((e, i) => { const p = coords.find(c => c.name === e.u), q = coords.find(c => c.name === e.v); if (!p || !q) return null; const active = algorithm === 'kruskal' ? calc?.mst.some(m => (m.u === e.u && m.v === e.v) || (m.u === e.v && m.v === e.u)) : algorithm === 'prim' ? calc?.prim.some(m => (m.u === e.u && m.v === e.v) || (m.u === e.v && m.v === e.u)) : false; return <g key={i}><line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={active ? '#16a34a' : '#94a3b8'} strokeWidth={active ? 4 : 2}/><rect x={(p.x + q.x) / 2 - 15} y={(p.y + q.y) / 2 - 12} width="30" height="20" rx="7" fill="#fff" stroke="#e2e8f0"/><text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 + 3} textAnchor="middle" fontSize="12" fill="#334155">{e.w}</text></g>; })}{coords.map(p => <g key={p.name}><circle cx={p.x} cy={p.y} r="18" fill={p.name === activeSource ? '#dbeafe' : '#fff'} stroke={p.name === activeSource ? '#2563eb' : '#475569'} strokeWidth="2.3"/><text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">{p.name}</text></g>)}</svg></div><h3><ListTree size={17}/> Kết quả thuật toán</h3><pre className="mh-algorithm-result">{graph.error ? 'Sửa danh sách cạnh để tiếp tục.' : result() || 'Nhập danh sách cạnh để xem kết quả.'}</pre>{algorithm === 'dijkstra' && calc && <p className="mh-subtle">d[v] là khoảng cách ngắn nhất từ {activeSource}; hiển thị cả đường đi ngắn nhất và cảnh báo khi đỉnh thuộc thành phần liên thông khác.</p>}</section></div></div>;
}

const FORMULA_LIBRARY: { category: string; title: string; latex: string; plain: string }[] = [
  { category: 'Đại số', title: 'Công thức nghiệm bậc hai', latex: 'x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}, \\quad \\Delta = b^2 - 4ac', plain: 'x = (−b ± √Δ) / (2a),  Δ = b² − 4ac' },
  { category: 'Đại số', title: 'Nhị thức Newton', latex: '(a+b)^n = \\sum_{k=0}^{n} C_n^k a^{n-k} b^k', plain: '(a + b)ⁿ = Σ C(n,k) · aⁿ⁻ᵏ · bᵏ' },
  { category: 'Giải tích', title: 'Đạo hàm & Tích phân Newton–Leibniz', latex: '\\int_a^b f(x)\\,dx = F(b) - F(a)', plain: '∫[a→b] f(x)dx = F(b) − F(a)' },
  { category: 'Lượng giác', title: 'Công thức cộng & hạ bậc', latex: '\\cos^2\\alpha = \\frac{1+\\cos 2\\alpha}{2}, \\quad \\sin 2\\alpha = 2\\sin\\alpha\\cos\\alpha', plain: 'cos²α = (1 + cos 2α)/2,  sin 2α = 2 sin α cos α' },
  { category: 'Hình học', title: 'Định lý Cosin & Sin trong tam giác', latex: 'a^2 = b^2 + c^2 - 2bc\\cos A, \\quad \\frac{a}{\\sin A} = 2R', plain: 'a² = b² + c² − 2bc·cos A,  a/sin A = 2R' },
  { category: 'Oxyz', title: 'Khoảng cách từ điểm đến mặt phẳng', latex: 'd(M_0, (P)) = \\frac{|Ax_0 + By_0 + Cz_0 + D|}{\\sqrt{A^2+B^2+C^2}}', plain: 'd(M₀,(P)) = |Ax₀ + By₀ + Cz₀ + D| / √(A² + B² + C²)' },
  { category: 'Xác suất', title: 'Công thức xác suất toàn phần & Bayes', latex: 'P(A|B) = \\frac{P(A \\cap B)}{P(B)}', plain: 'P(A|B) = P(A ∩ B) / P(B)' },
];

const QUICK_SYMBOLS = ['∀', '∃', '∈', '∉', '⊂', '∪', '∩', '∅', 'ℕ', 'ℤ', 'ℚ', 'ℝ', '∞', '±', '≈', '≠', '≤', '≥', '⇒', '⇔', '∑', '∏', '∫', '√', 'π', 'α', 'β', 'γ', 'Δ', 'φ', 'ω', '⊥', '∥', '∠', '△'];

export function FormulaSymbolsPanel({ onInsert }: { onInsert: MathHubProps['onInsert'] }) {
  const [latex, setLatex] = useState('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
  const [plain, setPlain] = useState('x = (−b ± √(b² − 4ac)) / (2a)');
  const preview = useMemo(() => {
    try { return katex.renderToString(latex, { throwOnError: false, trust: false }); }
    catch { return latex; }
  }, [latex]);

  const insertCard = () => {
    const escapedPlain = plain.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escapedLatex = latex.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="160" viewBox="0 0 720 160"><rect width="720" height="160" rx="14" fill="#fff" stroke="#2563eb" stroke-width="2.2"/><text x="24" y="42" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#1d4ed8">CÔNG THỨC TOÁN HỌC · LỚP HỌC MỰC</text><text x="24" y="88" font-family="Cambria Math,Times New Roman,serif" font-size="26" font-weight="700" fill="#0f172a">${escapedPlain}</text><text x="24" y="132" font-family="Consolas,monospace" font-size="13" fill="#64748b">LaTeX: ${escapedLatex}</text></svg>`;
    onInsert(svgUri(svg), 'Thẻ công thức toán học', 720 / 160);
  };

  return <div className="mh-page"><div className="mh-page-heading"><div><span className="mh-kicker">CÔNG THỨC & KÝ HIỆU</span><h1>Thư viện công thức và ký hiệu Toán THPT</h1><p>Tra cứu nhanh công thức trọng tâm, chèn ký hiệu toán học Unicode/LaTeX và xuất thẻ công thức lên trang bài giảng.</p></div></div>
    <div className="mh-prob-grid">
      <section className="mh-tool-card">
        <h3><BookOpen size={17}/> Soạn công thức & ký hiệu nhanh</h3>
        <label className="mh-field"><span>Biểu thức LaTeX</span><input value={latex} onChange={e => setLatex(e.target.value)} spellCheck={false}/></label>
        <label className="mh-field"><span>Dạng hiển thị Unicode trên thẻ</span><input value={plain} onChange={e => setPlain(e.target.value)} spellCheck={false}/></label>
        <div className="mh-solution" dangerouslySetInnerHTML={{ __html: preview }}/>
        <h4>Chèn nhanh ký hiệu toán</h4>
        <div className="mh-example-buttons">{QUICK_SYMBOLS.map(sym => <button key={sym} type="button" onClick={() => setPlain(s => s + sym)}>{sym}</button>)}</div>
        <button className="mh-primary-button" style={{ marginTop: 10 }} onClick={insertCard}>Chèn thẻ công thức lên trang</button>
      </section>
      <section className="mh-tool-card">
        <h3><ListTree size={17}/> Công thức Toán THPT chuẩn</h3>
        {FORMULA_LIBRARY.map((item, i) => <div key={i} className="mh-formula-block" style={{ cursor: 'pointer' }} onClick={() => { setLatex(item.latex); setPlain(item.plain); }}>
          <small>{item.category} · {item.title}</small>
          <b>{item.plain}</b>
        </div>)}
      </section>
    </div>
  </div>;
}
