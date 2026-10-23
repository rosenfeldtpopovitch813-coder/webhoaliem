import { useMemo, useState } from 'react';
import { Activity, BarChart3, ClipboardList, LineChart, Table2 } from 'lucide-react';
import {
  approximateAreaBetweenCurves,
  buildGraphPath,
  findFunctionAsymptotes,
  findFunctionExtrema,
  findFunctionRoots,
  parseMathExpression,
  type AsymptoteInfo,
} from './Graphing/mathExpression';
import { fmt, svgUri, type MathHubProps } from './mathHubUtils';
import { solveAugmentedLinearSystem } from './linearSystemSolver';
import { symbolicDeterminant, symbolicRank2x2 } from './symbolicPolynomial';
import { computeDescriptiveStatistics, groupHistogramBins } from './statisticsEngine';

// ---------- Multi-function plotter ----------
type Pt = { x: number; y: number; label: string };
type PlotModel = {
  paths: string[];
  roots: Pt[];
  yIntercepts: Pt[];
  crosses: Pt[];
  extrema: Pt[];
  asymptotes: AsymptoteInfo;
  areaInfo: { area: number; errorEstimate: number; label: string } | null;
  shade: string;
  error: string;
  fns: Array<((x: number) => number) | null>;
};

function sampleFunction(raw: string, params: { a: string; b: string; m: string }) {
  const prepared = raw.replace(/\b([abm])\b/gi, (_match, v: string) => `(${params[v.toLowerCase() as 'a' | 'b' | 'm'] || '1'})`);
  return parseMathExpression(prepared);
}

export default function FunctionPanel({ onOpenFull, onInsert }: { onOpenFull: () => void; onInsert: MathHubProps['onInsert'] }) {
  const [formulas, setFormulas] = useState(['x^2-4x+3', '2x-1']);
  const [a, setA] = useState('1');
  const [b, setB] = useState('0');
  const [m, setM] = useState('1');
  const [xmin, setXmin] = useState('-5');
  const [xmax, setXmax] = useState('5');
  const [ymin, setYmin] = useState('-5');
  const [ymax, setYmax] = useState('8');
  const [ineq, setIneq] = useState<'none' | 'ge' | 'le' | 'f1_ge_f2' | 'f1_le_f2'>('none');

  const xr: [number, number] = [Number(xmin), Number(xmax)], yr: [number, number] = [Number(ymin), Number(ymax)];
  const valid = Number.isFinite(xr[0]) && Number.isFinite(xr[1]) && Number.isFinite(yr[0]) && Number.isFinite(yr[1]) && xr[0] < xr[1] && yr[0] < yr[1];

  const model = useMemo<PlotModel>(() => {
    if (!valid) {
      return {
        paths: [], roots: [], yIntercepts: [], crosses: [], extrema: [],
        asymptotes: { vertical: [], horizontal: [], oblique: [] },
        areaInfo: null, shade: '', error: 'Khoảng tọa độ không hợp lệ.', fns: [],
      };
    }
    const params = { a, b, m };
    const fns = formulas.map(raw => {
      if (!raw.trim()) return null;
      try { return sampleFunction(raw, params); } catch { return null; }
    });
    const ev = (i: number, x: number) => {
      try { const y = fns[i]?.(x); return typeof y === 'number' && Number.isFinite(y) ? y : NaN; } catch { return NaN; }
    };
    const W = 760, H = 380, tx = (x: number) => (x - xr[0]) / (xr[1] - xr[0]) * W, ty = (y: number) => H - (y - yr[0]) / (yr[1] - yr[0]) * H;
    const paths = fns.map(fn => (fn ? buildGraphPath(fn, xr[0], xr[1], yr[0], yr[1], W, H) : ''));

    const roots: Pt[] = [];
    const yIntercepts: Pt[] = [];
    const extrema: Pt[] = [];
    const crosses: Pt[] = [];

    fns.forEach((fn, i) => {
      if (!fn) return;
      for (const r of findFunctionRoots(fn, xr[0], xr[1], 1000)) {
        roots.push({ x: r, y: 0, label: `f${i + 1}` });
      }
      if (xr[0] <= 0 && xr[1] >= 0) {
        const y0 = ev(i, 0);
        if (Number.isFinite(y0)) yIntercepts.push({ x: 0, y: y0, label: `f${i + 1}(0)` });
      }
      for (const ex of findFunctionExtrema(fn, xr[0], xr[1], 800)) {
        extrema.push({ x: ex.x, y: ex.y, label: `${ex.kind}(f${i + 1})` });
      }
    });

    for (let i = 0; i < fns.length; i++) {
      for (let j = i + 1; j < fns.length; j++) {
        const fi = fns[i], fj = fns[j];
        if (!fi || !fj) continue;
        const diffRoots = findFunctionRoots(x => fi(x) - fj(x), xr[0], xr[1], 900);
        for (const xx of diffRoots) {
          const yy = (ev(i, xx) + ev(j, xx)) / 2;
          if (Number.isFinite(yy) && !crosses.some(p => Math.abs(p.x - xx) < 0.01 && Math.abs(p.y - yy) < 0.05)) {
            crosses.push({ x: xx, y: yy, label: `I${crosses.length + 1}` });
          }
        }
      }
    }

    const asymptotes = fns[0] ? findFunctionAsymptotes(fns[0], xr[0], xr[1], 800) : { vertical: [], horizontal: [], oblique: [] };

    let areaInfo: PlotModel['areaInfo'] = null;
    if (fns[0]) {
      const secondFn = fns[1] || (() => 0);
      const label = fns[1] ? `∫ |f₁(x) − f₂(x)| dx trên [${fmt(xr[0], 2)}; ${fmt(xr[1], 2)}]` : `∫ |f₁(x)| dx trên [${fmt(xr[0], 2)}; ${fmt(xr[1], 2)}]`;
      const { area, errorEstimate } = approximateAreaBetweenCurves(fns[0], secondFn, xr[0], xr[1], 300);
      if (Number.isFinite(area)) areaInfo = { area, errorEstimate, label };
    }

    let shade = '';
    if (ineq !== 'none' && fns[0]) {
      const baseFn = (ineq === 'f1_ge_f2' || ineq === 'f1_le_f2') && fns[1] ? (x: number) => ev(1, x) : () => 0;
      let d = '', active = false, startX = xr[0];
      const basePts: [number, number][] = [];
      const topPts: [number, number][] = [];
      const flushPolygon = () => {
        if (topPts.length >= 2) {
          const poly = [...topPts, ...basePts.reverse()];
          d += ` M${poly[0][0].toFixed(2)} ${poly[0][1].toFixed(2)} ` + poly.slice(1).map(p => `L${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') + ' Z';
        }
        topPts.length = 0;
        basePts.length = 0;
      };
      for (let k = 0; k <= 600; k++) {
        const x = xr[0] + (xr[1] - xr[0]) * k / 600;
        const y1 = ev(0, x), yBase = baseFn(x);
        const ok = Number.isFinite(y1) && Number.isFinite(yBase) && (
          ineq === 'ge' || ineq === 'f1_ge_f2' ? y1 >= yBase : y1 <= yBase
        );
        if (ok) {
          if (!active) { active = true; startX = x; }
          void startX;
          topPts.push([tx(x), ty(Math.max(yr[0], Math.min(yr[1], y1)))]);
          basePts.push([tx(x), ty(Math.max(yr[0], Math.min(yr[1], yBase)))]);
        } else if (active) {
          flushPolygon();
          active = false;
        }
      }
      if (active) flushPolygon();
      shade = d.trim();
    }

    const error = formulas.some((f, i) => f.trim() && !fns[i])
      ? 'Có công thức chưa hỗ trợ hoặc sai cú pháp. Hỗ trợ đa thức, phân thức, căn, mũ, logarit và lượng giác.'
      : '';
    return { paths, roots, yIntercepts, crosses, extrema, asymptotes, areaInfo, shade, error, fns };
  }, [formulas, a, b, m, xmin, xmax, ymin, ymax, ineq, valid]);

  const W = 760, H = 380, tx = (x: number) => (x - xr[0]) / (xr[1] - xr[0]) * W, ty = (y: number) => H - (y - yr[0]) / (yr[1] - yr[0]) * H;

  const insert = () => {
    if (!model.paths.some(p => p)) return;
    const inside = (x: number, y: number) => x >= 0 && x <= W && y >= 0 && y <= H;
    const rootMarks = model.roots.filter(p => inside(tx(p.x), ty(0))).map(p => `<circle cx="${tx(p.x)}" cy="${ty(0)}" r="4" fill="#fff" stroke="#0f172a" stroke-width="1.6"/><text x="${tx(p.x) + 5}" y="${ty(0) - 7}" font-size="11" fill="#334155">${fmt(p.x, 2)}</text>`).join('');
    const crossMarks = model.crosses.filter(p => inside(tx(p.x), ty(p.y))).map(p => `<circle cx="${tx(p.x)}" cy="${ty(p.y)}" r="4.5" fill="#f59e0b" stroke="#fff" stroke-width="1.6"/><text x="${tx(p.x) + 7}" y="${ty(p.y) - 8}" font-size="11" fill="#92400e">${p.label} (${fmt(p.x, 2)}; ${fmt(p.y, 2)})</text>`).join('');
    const extremumMarks = model.extrema.filter(p => inside(tx(p.x), ty(p.y))).map(p => `<path d="M${tx(p.x)} ${ty(p.y) - 5} l5 5 -5 5 -5 -5 Z" fill="#16a34a" stroke="#fff" stroke-width="1.2"/><text x="${tx(p.x) + 7}" y="${ty(p.y) - 7}" font-size="10" fill="#166534">${p.label} ${fmt(p.x, 2)}</text>`).join('');
    const asympSvg = [
      ...model.asymptotes.vertical.map(vx => `<line x1="${tx(vx)}" y1="0" x2="${tx(vx)}" y2="${H}" stroke="#dc2626" stroke-width="1.4" stroke-dasharray="6 4"/>`),
      ...model.asymptotes.horizontal.map(hy => `<line x1="0" y1="${ty(hy)}" x2="${W}" y2="${ty(hy)}" stroke="#dc2626" stroke-width="1.4" stroke-dasharray="6 4"/>`),
    ].join('');
    const src = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="380" viewBox="0 0 760 380"><rect width="760" height="380" fill="#fff"/>${model.shade ? `<path d="${model.shade}" fill="#93c5fd" fill-opacity=".30"/>` : ''}${Array.from({ length: 11 }, (_, i) => `<path d="M${i * 76} 0V380 M0 ${i * 38}H760" stroke="#e7edf5" fill="none"/>`).join('')}<path d="M0 ${ty(0)}H760 M${tx(0)} 0V380" stroke="#64748b" stroke-width="1.4"/>${asympSvg}${model.paths.map((d, i) => `<path d="${d}" fill="none" stroke="${['#2563eb', '#e11d48', '#16a34a', '#9333ea'][i % 4]}" stroke-width="2.5"/>`).join('')}${rootMarks}${crossMarks}${extremumMarks}</svg>`;
    onInsert(svgUri(src), 'Đồ thị nhiều hàm số', 2);
  };

  return <div className="mh-page"><div className="mh-page-heading"><div><span className="mh-kicker">GIẢI TÍCH</span><h1>Đồ thị nhiều hàm số & miền nghiệm</h1><p>Vẽ đồng thời nhiều hàm; tự động ngắt nhánh qua tiệm cận, dò nghiệm (gồm nghiệm bội), giao điểm, cực trị, tiệm cận và tích phân diện tích.</p></div><button className="mh-secondary-button mh-inline" onClick={onOpenFull}>Nhận diện công thức viết tay ↗</button></div>
    <div className="mh-function-layout"><section className="mh-tool-card"><h3><LineChart size={17}/> Biểu thức</h3>{formulas.map((f, i) => <label className="mh-field" key={i}><span style={{ color: ['#2563eb', '#e11d48', '#16a34a', '#9333ea'][i % 4] }}>f{i + 1}(x) =</span><input value={f} onChange={e => setFormulas(old => old.map((v, j) => (j === i ? e.target.value : v)))} placeholder="Nhập công thức theo x"/></label>)}<button className="mh-secondary-button" disabled={formulas.length >= 4} onClick={() => setFormulas(v => [...v, ''])}>+ Thêm hàm</button><div className="mh-param-grid">{[['a', a, setA], ['b', b, setB], ['m', m, setM]].map(([label, val, setter]) => <label key={label as string}>{label as string}<input value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)} type="number" step="0.1"/></label>)}</div><p className="mh-subtle">Các ký hiệu a, b, m trong biểu thức được thay bằng giá trị tham số bên trên.</p><h3><Activity size={17}/> Khoảng tọa độ</h3><div className="mh-range-grid">{[['x min', xmin, setXmin], ['x max', xmax, setXmax], ['y min', ymin, setYmin], ['y max', ymax, setYmax]].map(([label, val, setter]) => <label key={label as string}>{label as string}<input value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)} type="number"/></label>)}</div><label className="mh-field"><span>Miền nghiệm bất phương trình</span><select value={ineq} onChange={e => setIneq(e.target.value as typeof ineq)}><option value="none">Không tô miền</option><option value="ge">f₁(x) ≥ 0</option><option value="le">f₁(x) ≤ 0</option><option value="f1_ge_f2">f₁(x) ≥ f₂(x)</option><option value="f1_le_f2">f₁(x) ≤ f₂(x)</option></select></label><button className="mh-primary-button" onClick={insert} disabled={!valid || !model.paths.some(p => p)}>Chèn đồ thị lên trang</button></section>
      <section className="mh-plot-area"><div className="mh-plot-top"><b>Hệ trục Oxy</b><span>Tự động ngắt đường nối giả qua tiệm cận đứng và điểm gián đoạn</span></div>{!valid || model.error ? <div className="mh-error">{!valid ? 'Khoảng tọa độ không hợp lệ.' : model.error}</div> : <svg className="mh-multi-plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Đồ thị nhiều hàm số"><rect width={W} height={H} rx="12" fill="#fff"/>{Array.from({ length: 11 }, (_, i) => <g key={i}><line x1={i * W / 10} y1="0" x2={i * W / 10} y2={H} stroke="#e7edf5"/><line x1="0" y1={i * H / 10} x2={W} y2={i * H / 10} stroke="#e7edf5"/></g>)}{model.shade && <path d={model.shade} fill="#93c5fd" fillOpacity=".34"/>}<path d={`M0 ${ty(0)}H${W} M${tx(0)} 0V${H}`} stroke="#64748b" strokeWidth="1.6"/>{model.asymptotes.vertical.map((vx, i) => <line key={`av${i}`} x1={tx(vx)} y1="0" x2={tx(vx)} y2={H} stroke="#dc2626" strokeWidth="1.3" strokeDasharray="6 4"/>)}{model.asymptotes.horizontal.map((hy, i) => <line key={`ah${i}`} x1="0" y1={ty(hy)} x2={W} y2={ty(hy)} stroke="#dc2626" strokeWidth="1.3" strokeDasharray="6 4"/>)}{model.paths.map((d, i) => <path key={i} d={d} fill="none" stroke={['#2563eb', '#e11d48', '#16a34a', '#9333ea'][i % 4]} strokeWidth="2.8"/>)}{model.roots.map((p, i) => <g key={`r${i}`}><circle cx={tx(p.x)} cy={ty(0)} r="4" fill="#fff" stroke="#0f172a" strokeWidth="1.6"/><text x={tx(p.x) + 5} y={ty(0) - 7} fontSize="11" fill="#334155">{fmt(p.x, 2)}</text></g>)}{model.crosses.map((p, i) => <g key={`c${i}`}><circle cx={tx(p.x)} cy={ty(p.y)} r="4.5" fill="#f59e0b" stroke="#fff" strokeWidth="1.6"/><text x={tx(p.x) + 7} y={ty(p.y) - 8} fontSize="11" fill="#92400e">{p.label} ({fmt(p.x, 2)}; {fmt(p.y, 2)})</text></g>)}{model.extrema.map((p, i) => <g key={`ex${i}`}><circle cx={tx(p.x)} cy={ty(p.y)} r="4" fill="#16a34a" stroke="#fff" strokeWidth="1.4"/></g>)}</svg>}
        <div className="mh-result-grid">
          <div><b>Giao trục Ox & Oy</b>{model.roots.length ? model.roots.slice(0, 8).map((p, i) => <span key={`rx${i}`}>{p.label}: x ≈ {fmt(p.x, 4)}</span>) : <span>Không có nghiệm trên đoạn.</span>}{model.yIntercepts.map((p, i) => <span key={`ry${i}`}>{p.label} = {fmt(p.y, 4)}</span>)}</div>
          <div><b>Giao điểm hai đồ thị</b>{model.crosses.length ? model.crosses.slice(0, 8).map((p, i) => <span key={i}>{p.label}: ({fmt(p.x, 4)}; {fmt(p.y, 4)})</span>) : <span>Không có giao điểm trên đoạn.</span>}</div>
          <div><b>Cực trị & Tiệm cận (f₁)</b>{model.extrema.length ? model.extrema.slice(0, 6).map((p, i) => <span key={`e${i}`}>{p.label}: ({fmt(p.x, 3)}; {fmt(p.y, 3)})</span>) : <span>Chưa phát hiện cực trị.</span>}{model.asymptotes.vertical.map((v, i) => <span key={`v${i}`}>TCĐ: x ≈ {fmt(v, 3)}</span>)}{model.asymptotes.horizontal.map((h, i) => <span key={`h${i}`}>TCN: y ≈ {fmt(h, 3)}</span>)}{model.asymptotes.oblique.map((o, i) => <span key={`o${i}`}>TCX: y ≈ {fmt(o.slope, 3)}x {o.intercept >= 0 ? '+' : '−'} {fmt(Math.abs(o.intercept), 3)}</span>)}</div>
        </div>
        {model.areaInfo && <p className="mh-subtle"><b>Diện tích phẳng gần đúng:</b> {model.areaInfo.label} ≈ <b>{fmt(model.areaInfo.area, 5)}</b> (sai số ước lượng Simpson ΔS ≈ ±{model.areaInfo.errorEstimate.toExponential(1)}; sai số nghiệm/giao điểm ≈ ±10⁻⁵, cực trị ≈ ±10⁻⁴).</p>}
      </section></div></div>;
}

// ---------- Matrix operations ----------
function parseMatrix(raw: string): number[][] {
  const rows = raw.trim().split(/\n|;/).map(r => r.trim()).filter(Boolean).map(r => r.split(/[\s,]+/).filter(Boolean).map(Number));
  if (!rows.length || !rows.every(r => r.length === rows[0].length && r.length > 0 && r.every(Number.isFinite))) {
    throw new Error('Ma trận phải gồm số hữu hạn, các hàng có cùng số cột.');
  }
  if (rows.length > 8 || rows[0].length > 8) throw new Error('Tối đa ma trận 8 × 8.');
  return rows;
}
function rref(matrix: number[][]) {
  const a = matrix.map(r => r.slice());
  let row = 0;
  const pivots: number[] = [];
  for (let col = 0; col < a[0].length && row < a.length; col++) {
    let best = row;
    for (let r = row + 1; r < a.length; r++) if (Math.abs(a[r][col]) > Math.abs(a[best][col])) best = r;
    if (Math.abs(a[best][col]) < 1e-10) continue;
    [a[row], a[best]] = [a[best], a[row]];
    const pivot = a[row][col];
    for (let c = col; c < a[row].length; c++) a[row][c] /= pivot;
    for (let r = 0; r < a.length; r++) {
      if (r !== row) {
        const k = a[r][col];
        for (let c = col; c < a[r].length; c++) a[r][c] -= k * a[row][c];
      }
    }
    pivots.push(col);
    row++;
  }
  return { a, pivots };
}
function determinant(matrix: number[][]) {
  if (matrix.length !== matrix[0].length) throw new Error('Định thức cần ma trận vuông.');
  const a = matrix.map(r => r.slice());
  let d = 1;
  for (let c = 0; c < a.length; c++) {
    let p = c;
    for (let r = c + 1; r < a.length; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-10) return 0;
    if (p !== c) { [a[p], a[c]] = [a[c], a[p]]; d *= -1; }
    const pivot = a[c][c];
    d *= pivot;
    for (let r = c + 1; r < a.length; r++) {
      const k = a[r][c] / pivot;
      for (let j = c + 1; j < a.length; j++) a[r][j] -= k * a[c][j];
    }
  }
  return d;
}
function invert(matrix: number[][]) {
  if (matrix.length !== matrix[0].length) throw new Error('Nghịch đảo cần ma trận vuông.');
  const n = matrix.length, { a, pivots } = rref(matrix.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]));
  if (pivots.filter(p => p < n).length < n) throw new Error('Ma trận suy biến, không có nghịch đảo.');
  return a.map(r => r.slice(n));
}
function solveLinearSystem(matrix: number[][]): string {
  const result = solveAugmentedLinearSystem(matrix);
  const { rref: a, pivotColumns: pivots, freeColumns, variables } = result;
  const rrefText = a.map(row => row.map(v => (Math.abs(v) < 1e-9 ? '0' : Number(v.toFixed(5)).toString())).join('\t')).join('\n');
  if (result.kind === 'none') return `Hệ vô nghiệm: xuất hiện hàng 0 … 0 | c với c ≠ 0.\n\nMa trận bậc thang rút gọn:\n${rrefText}`;
  if (result.kind === 'unique') {
    const values = Array.from({ length: variables }, (_, col) => { const row = pivots.indexOf(col); return row < 0 ? 0 : a[row][variables]; });
    return `Hệ có nghiệm duy nhất:\n${values.map((v, i) => `x${i + 1} = ${fmt(v, 6)}`).join('\n')}\n\nMa trận bậc thang rút gọn:\n${rrefText}`;
  }
  const equations = Array.from({ length: variables }, (_, col) => {
    if (freeColumns.includes(col)) return `x${col + 1} = t${freeColumns.indexOf(col) + 1}`;
    const row = pivots.indexOf(col);
    let text = `x${col + 1} = ${fmt(a[row][variables], 5)}`;
    freeColumns.forEach((free, j) => {
      const c = a[row][free];
      if (Math.abs(c) > 1e-8) text += `${c > 0 ? ' − ' : ' + '}${fmt(Math.abs(c), 5)}t${j + 1}`;
    });
    return text;
  });
  return `Hệ có vô số nghiệm; đặt ${freeColumns.map((col, i) => `x${col + 1} = t${i + 1}`).join(', ')}.\n${equations.join('\n')}\n\nMa trận bậc thang rút gọn:\n${rrefText}`;
}

export function MatrixPanel() {
  const [raw, setRaw] = useState('1, 2, 3\n0, 1, 4\n5, 6, 0');
  const [op, setOp] = useState<'rref' | 'det' | 'rank' | 'inverse' | 'eigen' | 'solve' | 'symdet' | 'symrank'>('rref');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const run = () => {
    try {
      let out = '';
      if (op === 'symdet') {
        const symbolic = symbolicDeterminant(raw, 'm');
        out = `[PHÉP TOÁN KÝ HIỆU THEO THAM SỐ m]\ndet(A) = ${symbolic.expression}\n\nĐa thức theo m (hệ số từ bậc 0 trở lên): ${symbolic.coefficients.join(', ')}\nKích thước ma trận: ${symbolic.size} × ${symbolic.size}\n\nThay giá trị cụ thể của m vào biểu thức trên để xét dấu hoặc tìm trường hợp det(A)=0.`;
        setResult(out); setError(''); return;
      }
      if (op === 'symrank') {
        const symbolic = symbolicRank2x2(raw, 'm');
        out = `[BIỆN LUẬN KÝ HIỆU THEO THAM SỐ m]\ndet(A) = ${symbolic.determinant}\nHạng tổng quát: ${symbolic.genericRank}\n\nCác trường hợp đặc biệt:\n${symbolic.singularCases.length ? symbolic.singularCases.map(c => `m ≈ ${fmt(c.parameter, 8)}: rank(A) = ${c.rank}`).join('\n') : 'Không tìm được giá trị thực đặc biệt trong miền cô lập nghiệm.'}\n\n${symbolic.note}`;
        setResult(out); setError(''); return;
      }
      const M = parseMatrix(raw), n = M.length, m = M[0].length;
      if (op === 'det') out = `[PHÉP TOÁN SỐ HỌC]\ndet(A) = ${fmt(determinant(M), 6)}`;
      else if (op === 'rank') out = `[PHÉP TOÁN SỐ HỌC]\nrank(A) = ${rref(M).pivots.length}`;
      else if (op === 'rref') {
        const { a, pivots } = rref(M);
        out = `[PHÉP TOÁN SỐ HỌC — Khử Gauss–Jordan]\nDạng bậc thang rút gọn:\n${a.map(r => r.map(v => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(4))).join('\t')).join('\n')}\n\nCột trụ: ${pivots.map(v => v + 1).join(', ') || 'không có'} · Hạng = ${pivots.length}`;
      } else if (op === 'inverse') {
        out = `[PHÉP TOÁN SỐ HỌC]\nA⁻¹ =\n${invert(M).map(r => r.map(v => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(5))).join('\t')).join('\n')}`;
      } else if (op === 'solve') {
        out = `[GIẢI HỆ PHƯƠNG TRÌNH TUYẾN TÍNH SỐ HỌC]\n${solveLinearSystem(M)}`;
      } else {
        if (n !== 2 || m !== 2) throw new Error('Bản này tính trị riêng chính xác cho ma trận 2 × 2.');
        const tr = M[0][0] + M[1][1], d = determinant(M), disc = tr * tr - 4 * d;
        out = disc >= 0 ? `λ₁ = ${fmt((tr + Math.sqrt(disc)) / 2, 6)}\nλ₂ = ${fmt((tr - Math.sqrt(disc)) / 2, 6)}` : `λ = ${fmt(tr / 2, 5)} ± ${fmt(Math.sqrt(-disc) / 2, 5)}i`;
      }
      setResult(out); setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setResult('');
    }
  };
  return <div className="mh-page"><div className="mh-page-heading"><div><span className="mh-kicker">ĐẠI SỐ TUYẾN TÍNH</span><h1>Ma trận và định thức</h1><p>Phân biệt rõ phép toán ma trận số học (Gauss–Jordan, nghịch đảo, hệ tuyến tính) và biện luận đa thức ký hiệu theo tham số m.</p></div></div><div className="mh-matrix-layout"><section className="mh-tool-card"><h3><Table2 size={17}/> Ma trận đầu vào A</h3><textarea className="mh-matrix-input" value={raw} onChange={e => setRaw(e.target.value)} spellCheck={false}/><p className="mh-subtle">Mỗi dòng là một hàng; dùng dấu phẩy hoặc khoảng trắng ngăn cột. Tối đa 8 × 8 cho số học, 4 × 4 cho det(m), 2 × 2 cho hạng theo m.</p><div className="mh-choice-grid">{([['rref', 'Dạng bậc thang'], ['det', 'Định thức (số)'], ['symdet', 'Biện luận det(m)'], ['symrank', 'Biện luận hạng 2×2 (m)'], ['rank', 'Hạng ma trận (số)'], ['inverse', 'Ma trận nghịch đảo'], ['eigen', 'Giá trị riêng 2×2'], ['solve', 'Giải hệ tuyến tính']] as const).map(([id, label]) => <button key={id} className={op === id ? 'active' : ''} onClick={() => setOp(id)}>{label}</button>)}</div><button className="mh-primary-button" onClick={run}>Tính toán</button><div className="mh-example-buttons"><button onClick={() => setRaw('1, 2\n3, 4')}>Ví dụ 2×2</button><button onClick={() => setRaw('1, 2, 3\n0, 1, 4\n5, 6, 0')}>Ví dụ 3×3</button><button onClick={() => setRaw('1, 1, 2\n2, -1, 1')}>Hệ 2 ẩn</button><button onClick={() => { setRaw('m, 0\n0, 1'); setOp('symrank'); }}>Ví dụ hạng theo m</button><button onClick={() => setRaw('1, 2, 3\n2, 4, 6\n1, 1, 1')}>Ma trận suy biến</button></div></section><section className="mh-tool-card"><h3><ClipboardList size={17}/> Kết quả</h3>{error ? <div className="mh-error">{error}</div> : <pre className="mh-matrix-result">{result || 'Kết quả sẽ hiển thị tại đây sau khi bấm Tính toán.'}</pre>}<div className="mh-tip">Đã hỗ trợ khử Gauss–Jordan, hạng, định thức, nghịch đảo, giải hệ số và định thức đa thức theo m. Chế độ Biện luận hạng theo m hiện giới hạn ma trận 2 × 2; nghiệm tham số được cô lập gần đúng bằng số.</div></section></div></div>;
}

// ---------- Descriptive statistics ----------
export function StatisticsPanel({ onInsert }: { onInsert: MathHubProps['onInsert'] }) {
  const [raw, setRaw] = useState('12, 15, 16, 16, 18, 20, 21, 23, 24, 25, 25, 28, 30');
  const [sample, setSample] = useState(false);
  const [chart, setChart] = useState<'bar' | 'box' | 'histogram'>('bar');
  const [blank, setBlank] = useState(false);
  const [binsText, setBinsText] = useState('5');

  const computed = useMemo(() => {
    try {
      return { stats: computeDescriptiveStatistics(raw, { sample }), error: '' };
    } catch (e) {
      return { stats: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [raw, sample]);

  const valid = Boolean(computed.stats && !computed.error);
  const stats = computed.stats;
  const histogramValid = chart !== 'histogram' || (Number.isInteger(Number(binsText)) && Number(binsText) >= 2 && Number(binsText) <= 20);

  const insert = () => {
    if (!stats || !histogramValid) return;
    const x = (v: number) => 45 + (v - stats.min) / (stats.max - stats.min || 1) * 670;
    let svg = '';
    if (chart === 'box') {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="300" viewBox="0 0 760 300"><rect width="100%" height="100%" fill="#fff"/><path d="M${x(stats.min)} 140H${x(stats.q1)} M${x(stats.q3)} 140H${x(stats.max)} M${x(stats.min)} 120V160 M${x(stats.max)} 120V160 M${x(stats.median)} 105V175" stroke="#2563eb" stroke-width="2.5"/><rect x="${x(stats.q1)}" y="100" width="${Math.max(2, x(stats.q3) - x(stats.q1))}" height="80" fill="#bfdbfe" stroke="#2563eb" stroke-width="2.5"/><path d="M45 220H715" stroke="#64748b"/>${[stats.min, stats.q1, stats.median, stats.q3, stats.max].map(v => `<text x="${x(v)}" y="245" text-anchor="middle" font-size="13">${fmt(v, 2)}</text>`).join('')}</svg>`;
    } else if (chart === 'histogram') {
      const bins = groupHistogramBins(stats.data, Number(binsText)), maxCount = Math.max(1, ...bins.map(b => b.count)), plotLeft = 55, plotWidth = 670, barW = plotWidth / bins.length;
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="340" viewBox="0 0 760 340"><rect width="100%" height="100%" fill="#fff"/><path d="M${plotLeft} 25V280H725" stroke="#64748b" stroke-width="1.5"/>${bins.map((bin, i) => { const bx = plotLeft + i * barW, h = bin.count / maxCount * 225, label = `${fmt(bin.from, 2)}–${fmt(bin.to, 2)}`; return `<rect x="${bx}" y="${280 - h}" width="${Math.max(1, barW - 0.7)}" height="${h}" fill="#60a5fa" stroke="#fff" stroke-width=".7"/><text x="${bx + barW / 2}" y="300" font-size="${bins.length > 8 ? 9 : 11}" text-anchor="middle">${blank ? '…' : label}</text><text x="${bx + barW / 2}" y="${270 - h}" font-size="11" text-anchor="middle">${blank ? '…' : bin.count}</text>`; }).join('')}</svg>`;
    } else {
      const max = Math.max(...stats.freq.map(([, f]) => f)), barW = Math.max(8, 600 / stats.freq.length);
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="340" viewBox="0 0 760 340"><rect width="100%" height="100%" fill="#fff"/><path d="M55 25V280H725" stroke="#64748b" stroke-width="1.5"/>${stats.freq.map(([v, f], i) => { const bx = 70 + i * 600 / stats.freq.length, h = f / max * 225; return `<rect x="${bx}" y="${280 - h}" width="${Math.max(4, barW - 7)}" height="${h}" fill="#60a5fa"/><text x="${bx + barW / 2 - 3}" y="300" font-size="12" text-anchor="middle">${blank ? '…' : v}</text><text x="${bx + barW / 2 - 3}" y="${270 - h}" font-size="11" text-anchor="middle">${blank ? '…' : f}</text>`; }).join('')}</svg>`;
    }
    onInsert(svgUri(svg), chart === 'box' ? 'Biểu đồ hộp thống kê' : chart === 'histogram' ? 'Histogram tần số ghép nhóm' : 'Biểu đồ tần số', chart === 'box' ? 760 / 300 : 760 / 340);
  };

  return <div className="mh-page"><div className="mh-page-heading"><div><span className="mh-kicker">THỐNG KÊ</span><h1>Khảo sát dữ liệu</h1><p>Nhập số liệu thô để tính các đặc trưng (tổng thể σ² hoặc mẫu s²) và trực quan hóa phân phối.</p></div></div><div className="mh-stats-layout"><section className="mh-tool-card"><h3><BarChart3 size={17}/> Dãy số liệu</h3><textarea className="mh-stats-input" value={raw} onChange={e => setRaw(e.target.value)}/><label className="mh-check-row"><input type="checkbox" checked={sample} onChange={e => setSample(e.target.checked)}/><i/><span>Dùng phương sai mẫu hiệu chỉnh s² (mẫu số n − 1) thay vì σ² (mẫu số n)</span></label><div className="mh-segment"><button className={chart === 'bar' ? 'active' : ''} onClick={() => setChart('bar')}>Biểu đồ tần số</button><button className={chart === 'box' ? 'active' : ''} onClick={() => setChart('box')}>Biểu đồ hộp</button><button className={chart === 'histogram' ? 'active' : ''} onClick={() => setChart('histogram')}>Histogram</button></div>{chart === 'histogram' && <label className="mh-field"><span>Số lớp ghép nhóm (2–20)</span><input type="number" min="2" max="20" step="1" value={binsText} onChange={e => setBinsText(e.target.value)}/></label>}<label className="mh-check-row"><input type="checkbox" checked={blank} onChange={e => setBlank(e.target.checked)}/><i/><span>Bỏ trống số liệu trên phiếu bài tập</span></label><button className="mh-primary-button" onClick={insert} disabled={!valid || !histogramValid}>Chèn biểu đồ lên trang</button>{!histogramValid && <div className="mh-error">Số lớp histogram phải là số nguyên từ 2 đến 20.</div>}{computed.error && <div className="mh-error" style={{ marginTop: 10 }}>{computed.error}</div>}</section><section className="mh-tool-card"><h3><ClipboardList size={17}/> Kết quả thống kê</h3>{stats && <><div className="mh-stat-grid">{[['Số quan sát n', String(stats.n)], ['Trung bình x̄', fmt(stats.mean, 4)], ['Trung vị Mₑ', fmt(stats.median, 4)], ['Mốt M₀', stats.modes.map(v => fmt(v, 3)).join(', ')], ['Min – Max', `${fmt(stats.min, 3)} – ${fmt(stats.max, 3)}`], ['Q₁ – Q₃', `${fmt(stats.q1, 3)} – ${fmt(stats.q3, 3)}`], [sample ? 'Phương sai mẫu s²' : 'Phương sai tổng thể σ²', fmt(stats.variance, 4)], [sample ? 'Độ lệch chuẩn mẫu s' : 'Độ lệch chuẩn σ', fmt(stats.sd, 4)], ['Khoảng biến thiên R', fmt(stats.range, 4)], ['Khoảng tứ phân vị ΔQ', fmt(stats.iqr, 4)]].map(([k, v]) => <div key={k}><small>{k}</small><b>{blank ? '…………' : v}</b></div>)}</div><p className="mh-subtle">Quy ước hiện hành: <b>{stats.varianceConvention}</b> (σ² = {fmt(stats.populationVariance, 4)}, s² = {fmt(stats.sampleVariance, 4)}).</p><h4>Bảng tần số</h4><div className="mh-frequency-table"><table><thead><tr><th>Giá trị xᵢ</th><th>Tần số nᵢ</th><th>Tần suất fᵢ</th></tr></thead><tbody>{stats.freq.map(([x, n]) => <tr key={x}><td>{blank ? '……' : x}</td><td>{blank ? '……' : n}</td><td>{blank ? '……' : `${fmt(100 * n / stats.n, 2)}%`}</td></tr>)}</tbody></table></div></>}</section></div></div>;
}
