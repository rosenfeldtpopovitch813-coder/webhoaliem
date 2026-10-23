import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent, RefObject } from 'react';
import { Activity, Check, ChevronDown, Eraser, LoaderCircle, MousePointer2, PenLine, Plus, RotateCcw, Sparkles, X } from 'lucide-react';
import katex from 'katex';
import { InferenceEngine, isStrokeMeaningful, loadVocab, preprocessStrokes } from 'ink-on/core';
import { env as ortEnv } from 'onnxruntime-web';
import type { Stroke as InkStroke, Vocab } from 'ink-on/core';
import { buildGraphPath, buildImplicitContourPath, buildParametricPath, buildPolarPath, parseImplicitExpression, parseMathExpression, parseParametricExpression, parsePolarExpression } from './mathExpression';
import './graph-panel.css';

type Props = { onClose: () => void; onInsertGraph: (src: string, formula: string) => void };
type GraphModel = { formula: string; kind: 'explicit'|'implicit'|'parametric'|'polar'; fn: (x: number) => number; path: string; error: string | null };
const DEFAULT_FORMULAS = [
  { label: 'Parabol', value: 'y=x^2-4x+3' },
  { label: 'Đường thẳng', value: 'y=2x+1' },
  { label: 'Hàm sin', value: 'y=sin(x)' },
  { label: 'Căn thức', value: 'y=sqrt(x)' },
  { label: 'Hàm mũ', value: 'y=e^x' },
  { label: 'Phân thức', value: 'y=(x^2-1)/(x-1)' },
  { label: 'Đường tròn', value: 'x^2+y^2=9' },
  { label: 'Elip', value: 'x^2/4+y^2=1' },
  { label: 'Tham số', value: '(2cos(t), sin(2t))' },
  { label: 'Đường cực', value: 'r=2+cos(theta)' },
];
const MODEL_BASE = `${import.meta.env.BASE_URL}models/comer/`;

function isPolarFormula(formula: string) { return /^\s*r(?:\s*\(\s*(?:theta|θ)\s*\))?\s*=/i.test(formula); }
function isParametricFormula(formula: string) { return /^\s*x\s*=.+,\s*y\s*=/i.test(formula) || /^\s*\(.+,.+\)\s*$/.test(formula); }

function drawStrokes(canvas: HTMLCanvasElement | null, strokes: InkStroke[]) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    ctx.beginPath(); ctx.lineWidth = stroke.lineWidth || 4; ctx.strokeStyle = '#182230'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const point of stroke.points.slice(1)) ctx.lineTo(point.x, point.y);
    if (stroke.points.length === 1) { ctx.lineTo(stroke.points[0].x + .1, stroke.points[0].y + .1); }
    ctx.stroke();
  }
}

function makePlot(formula: string, xMin: number, xMax: number, yMin: number, yMax: number, tMin: number, tMax: number): GraphModel {
  try {
    if (![xMin, xMax, yMin, yMax].every(Number.isFinite) || xMin >= xMax || yMin >= yMax) throw new Error('Miền vẽ không hợp lệ: giá trị nhỏ nhất phải thấp hơn giá trị lớn nhất.');
    if (![tMin, tMax].every(Number.isFinite) || tMin >= tMax) throw new Error('Khoảng tham số phải có cận dưới nhỏ hơn cận trên.');
    if (isPolarFormula(formula)) {
      const fn = parsePolarExpression(formula);
      return { formula, kind: 'polar', fn: () => NaN, path: buildPolarPath(fn, tMin, tMax, xMin, xMax, yMin, yMax, 760, 390), error: null };
    }
    if (isParametricFormula(formula)) {
      const pair = parseParametricExpression(formula);
      return { formula, kind: 'parametric', fn: () => NaN, path: buildParametricPath(pair.x, pair.y, tMin, tMax, xMin, xMax, yMin, yMax, 760, 390), error: null };
    }
    const lhs = formula.split('=')[0]?.trim() || '';
    const implicit = formula.includes('=') && !/^(?:y|f\s*\(\s*x\s*\))$/i.test(lhs);
    if (implicit) {
      const fn2 = parseImplicitExpression(formula);
      return { formula, kind: 'implicit', fn: () => NaN, path: buildImplicitContourPath(fn2, xMin, xMax, yMin, yMax, 760, 390), error: null };
    }
    const fn = parseMathExpression(formula);
    return { formula, kind: 'explicit', fn, path: buildGraphPath(fn, xMin, xMax, yMin, yMax, 760, 390), error: null };
  } catch (error) {
    return { formula, kind: 'explicit', fn: () => NaN, path: '', error: error instanceof Error ? error.message : 'Không phân tích được công thức.' };
  }
}

function GraphSvg({ model, xMin, xMax, yMin, yMax, svgRef }: { model: GraphModel; xMin: number; xMax: number; yMin: number; yMax: number; svgRef: RefObject<SVGSVGElement | null> }) {
  const width = 760, height = 390;
  const yAxis = xMin <= 0 && xMax >= 0 ? (0 - xMin) / (xMax - xMin) * width : (xMin > 0 ? 0 : width);
  const xAxis = yMin <= 0 && yMax >= 0 ? height - (0 - yMin) / (yMax - yMin) * height : (yMin > 0 ? height : 0);
  const ticks = (min: number, max: number, count = 8) => Array.from({ length: count + 1 }, (_, i) => min + (max - min) * i / count);
  const fmt = (n: number) => Math.abs(n) < 1e-8 ? '0' : Number(n.toFixed(2)).toString();
  return <svg ref={svgRef} className="graph-svg" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Đồ thị ${model.formula}`}>
    <rect width={width} height={height} fill="#fffdf8" rx="10"/>
    {ticks(xMin, xMax).map((x, i) => { const px = (x - xMin) / (xMax - xMin) * width; return <g key={`gx${i}`}><line x1={px} x2={px} y1="0" y2={height} stroke="#dce3ea" strokeWidth="1"/><text x={px} y={Math.min(height - 5, Math.max(13, xAxis + 17))} textAnchor="middle" fontSize="10" fill="#667789">{fmt(x)}</text></g>; })}
    {ticks(yMin, yMax).map((y, i) => { const py = height - (y - yMin) / (yMax - yMin) * height; return <g key={`gy${i}`}><line x1="0" x2={width} y1={py} y2={py} stroke="#dce3ea" strokeWidth="1"/><text x={Math.min(width - 23, Math.max(4, yAxis + 7))} y={py - 4} fontSize="10" fill="#667789">{fmt(y)}</text></g>; })}
    <line x1="0" x2={width} y1={xAxis} y2={xAxis} stroke="#425366" strokeWidth="1.8"/>
    <line x1={yAxis} x2={yAxis} y1="0" y2={height} stroke="#425366" strokeWidth="1.8"/>
    <path d={model.path} fill="none" stroke="#137ee8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <text x={width - 11} y={Math.max(13, xAxis - 8)} textAnchor="end" fontWeight="700" fontSize="12" fill="#334155">x</text>
    <text x={Math.min(width - 12, Math.max(13, yAxis + 9))} y="14" fontWeight="700" fontSize="12" fill="#334155">y</text>
  </svg>;
}

export default function GraphPanel({ onClose, onInsertGraph }: Props) {
  const [formula, setFormula] = useState('y=x^2-4x+3');
  const [xMinText, setXMinText] = useState('-5'); const [xMaxText, setXMaxText] = useState('7');
  const [yMinText, setYMinText] = useState('-4'); const [yMaxText, setYMaxText] = useState('8');
  const [tMinText, setTMinText] = useState('0'); const [tMaxText, setTMaxText] = useState('6.2831853');
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState('Viết công thức vào vùng trắng rồi chọn “Nhận diện”.');
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null); const svgRef = useRef<SVGSVGElement>(null);
  const activeStroke = useRef<InkStroke | null>(null); const strokesRef = useRef<InkStroke[]>([]);
  const engineRef = useRef<InferenceEngine | null>(null); const vocabRef = useRef<Vocab | null>(null);
  const xMin = Number(xMinText), xMax = Number(xMaxText), yMin = Number(yMinText), yMax = Number(yMaxText);
  const tMin = Number(tMinText), tMax = Number(tMaxText);
  const model = useMemo(() => makePlot(formula, xMin, xMax, yMin, yMax, tMin, tMax), [formula, xMin, xMax, yMin, yMax, tMin, tMax]);
  const mathPreview = useMemo(() => { try { return katex.renderToString(formula.replace(/^\s*y\s*=/, ''), { throwOnError: false, strict: false, trust: false }); } catch { return formula; } }, [formula]);

  useEffect(() => { drawStrokes(canvasRef.current, strokes); }, [strokes]);
  useEffect(() => () => { engineRef.current?.dispose(); engineRef.current = null; }, []);

  const pointAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * event.currentTarget.width / rect.width, y: (event.clientY - rect.top) * event.currentTarget.height / rect.height };
  };
  const penDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    const next = { points: [pointAt(event)], lineWidth: 4 } satisfies InkStroke;
    activeStroke.current = next; const all = [...strokesRef.current, next]; strokesRef.current = all; setStrokes(all);
  };
  const penMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!activeStroke.current) return;
    const nextStroke = { ...activeStroke.current, points: [...activeStroke.current.points, pointAt(event)] };
    activeStroke.current = nextStroke;
    const all = [...strokesRef.current.slice(0, -1), nextStroke]; strokesRef.current = all; setStrokes(all);
  };
  const penUp = () => { activeStroke.current = null; };
  const clearInk = () => { activeStroke.current = null; strokesRef.current = []; setStrokes([]); setStatus('Đã xóa nét viết.'); };
  const undoInk = () => { activeStroke.current = null; const next = strokesRef.current.slice(0, -1); strokesRef.current = next; setStrokes(next); };

  const recognize = async () => {
    if (!isStrokeMeaningful(strokesRef.current)) { setStatus('Chưa có đủ nét để nhận diện. Hãy viết một công thức rõ ràng.'); return; }
    setBusy(true); setStatus('Đang chuẩn bị mô hình nhận diện cục bộ…');
    try {
      if (!engineRef.current || !vocabRef.current) {
        setModelStatus('loading');
        // Pin ONNX Runtime to assets packaged under /ort; the desktop app blocks network requests.
        ortEnv.wasm.wasmPaths = new URL('/ort/', window.location.href).toString();
        const encoderUrl = new URL(`${MODEL_BASE}encoder_int8.onnx`, window.location.href).toString();
        const decoderUrl = new URL(`${MODEL_BASE}decoder_int8.onnx`, window.location.href).toString();
        const vocabUrl = new URL(`${MODEL_BASE}vocab.json`, window.location.href).toString();
        const [vocab] = await Promise.all([loadVocab(vocabUrl)]);
        const engine = new InferenceEngine({ encoderUrl, decoderUrl, beamWidth: 2, executionProvider: 'wasm' });
        await engine.init(); engineRef.current = engine; vocabRef.current = vocab; setModelStatus('ready');
      }
      setStatus('Đang nhận diện nét viết…');
      const engine = engineRef.current; const vocab = vocabRef.current;
      if (!engine || !vocab) throw new Error('Mô hình nhận diện chưa sẵn sàng.');
      const result = await engine.recognize(preprocessStrokes(strokesRef.current), vocab, 'expression');
      if (!result.latex.trim()) throw new Error('Mô hình chưa đọc được công thức này. Hãy viết lại to, thoáng hơn.');
      setFormula(result.latex); setStatus(`Đã nhận diện trong ${(result.totalMs / 1000).toFixed(1)} giây. Kiểm tra công thức rồi chỉnh sửa nếu cần.`);
    } catch (error) {
      console.error('Math ink recognition failed', error); setModelStatus('error');
      const message = error instanceof Error ? error.message : String(error);
      setStatus(/fetch|404|network|failed to load|not found/i.test(message)
        ? 'Không tải được mô hình offline. Chạy BUILD-WINDOWS.bat hoặc BUILD-INSTALLER-WINDOWS.bat để tải model và đóng gói lại.'
        : `Nhận diện chưa thành công: ${message.slice(0, 160)}`);
    } finally { setBusy(false); }
  };

  const insertGraph = () => {
    if (model.error || !model.path || !svgRef.current) { setStatus(model.error || 'Chưa có đồ thị hợp lệ để chèn.'); return; }
    const svg = svgRef.current.cloneNode(true) as SVGSVGElement;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); svg.setAttribute('width', '1200'); svg.setAttribute('height', '615');
    const markup = new XMLSerializer().serializeToString(svg);
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    onInsertGraph(src, formula); onClose();
  };

  return <div className="graph-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="graph-panel" role="dialog" aria-modal="true" aria-label="Đồ thị và nhận diện công thức">
      <header className="graph-head"><div className="graph-title-icon"><Activity size={22}/></div><div className="graph-head-copy"><h2>Đồ thị & nhận diện viết tay</h2><p>Nhận công thức từ nét bút, xác nhận rồi dựng đồ thị explicit hoặc phương trình ẩn F(x,y)=0.</p></div><span className="offline-pill"><span/> Xử lý tại máy</span><button className="graph-close" onClick={onClose} title="Đóng"><X size={20}/></button></header>
      <div className="graph-content">
        <div className="ink-section">
          <div className="section-heading"><div><PenLine size={17}/><b>1. Viết công thức bằng bút</b></div><span>Chuột / bút cảm ứng / màn hình cảm ứng</span></div>
          <canvas ref={canvasRef} className="math-ink-canvas" width={900} height={190} onPointerDown={penDown} onPointerMove={penMove} onPointerUp={penUp} onPointerCancel={penUp} aria-label="Vùng viết công thức toán học" />
          <div className="ink-actions"><div className="recognition-status" aria-live="polite"><span className={`status-dot ${modelStatus}`}/>{status}</div><div className="ink-buttons"><button onClick={undoInk} disabled={!strokes.length} className="secondary-action"><RotateCcw size={15}/> Hoàn tác nét</button><button onClick={clearInk} disabled={!strokes.length} className="secondary-action"><Eraser size={15}/> Xóa nét</button><button onClick={recognize} disabled={busy || !strokes.length} className="recognize-action">{busy ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>} Nhận diện</button></div></div>
        </div>
        <div className="formula-section">
          <div className="section-heading"><div><Check size={17}/><b>2. Kiểm tra công thức</b></div><span>Nhận diện có thể nhầm; hãy sửa trước khi vẽ.</span></div>
          <input className="graph-formula-input" value={formula} onChange={event => setFormula(event.target.value)} aria-label="Công thức hàm số" spellCheck={false} />
          <div className="formula-preview" dangerouslySetInnerHTML={{ __html: mathPreview }} />
          <div className="example-row">{DEFAULT_FORMULAS.map(example => <button key={example.label} onClick={() => setFormula(example.value)}>{example.label}</button>)}</div>
          <div className="range-controls"><label>x min<input value={xMinText} onChange={e => setXMinText(e.target.value)} inputMode="decimal"/></label><label>x max<input value={xMaxText} onChange={e => setXMaxText(e.target.value)} inputMode="decimal"/></label><label>y min<input value={yMinText} onChange={e => setYMinText(e.target.value)} inputMode="decimal"/></label><label>y max<input value={yMaxText} onChange={e => setYMaxText(e.target.value)} inputMode="decimal"/></label>{(isParametricFormula(formula)||isPolarFormula(formula))&&<><label>{isPolarFormula(formula)?'θ min':'t min'}<input value={tMinText} onChange={e=>setTMinText(e.target.value)} inputMode="decimal"/></label><label>{isPolarFormula(formula)?'θ max':'t max'}<input value={tMaxText} onChange={e=>setTMaxText(e.target.value)} inputMode="decimal"/></label></>}</div>
        </div>
        <div className="plot-section">
          <div className="section-heading"><div><Activity size={17}/><b>3. Đồ thị</b></div><span>{model.error ? 'Cần sửa công thức' : 'Đồ thị cập nhật theo công thức'}</span></div>
          {model.error ? <div className="plot-error"><ChevronDown size={16}/>{model.error}<p>Dùng ^ để lũy thừa; hỗ trợ hàm sin/cos, phân thức, cùng phương trình ẩn như x^2+y^2=9 và x^2/4+y^2=1.</p></div> : <GraphSvg model={model} xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax} svgRef={svgRef}/>}
          <div className="plot-footnote">{model.kind==='implicit'?'Phương trình ẩn được vẽ bằng marching squares; độ chính xác phụ thuộc lưới lấy mẫu.':model.kind==='parametric'?'Đồ thị tham số được lấy mẫu theo t; tăng mật độ mẫu nếu đường cong có chi tiết nhỏ.':model.kind==='polar'?'Đồ thị cực dùng r(θ) và quy đổi x=r cos θ, y=r sin θ.':'Đường cong bị gián đoạn ở điểm hàm không xác định.'} Đây là đồ thị của công thức đã xác nhận, không phải ảnh chụp nét viết.</div>
        </div>
      </div>
      <footer className="graph-footer"><div className="graph-footer-note"><MousePointer2 size={16}/><span>Chèn vào trang hiện tại dưới dạng đối tượng hình ảnh có thể di chuyển và đổi kích thước.</span></div><button className="secondary-action" onClick={onClose}>Để sau</button><button className="insert-graph-action" onClick={insertGraph} disabled={!!model.error || !model.path}><Plus size={17}/> Chèn đồ thị vào trang</button></footer>
    </section>
  </div>;
}
