import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Activity, Axis3D, Compass, Eye, EyeOff, GitBranch, Lock, PenTool, RotateCcw, Ruler, Unlock } from 'lucide-react';
import { fmt, svgUri, type MathHubProps } from './mathHubUtils';
import {
  angleDegrees,
  computePlaneLocus,
  polygonArea,
  removePlanePointCascade,
  resolvePlaneGeometry,
  segmentLength,
  type PlaneConstraint,
  type PlaneLinearObject,
  type PlanePoint,
} from './geometry2dEngine';

type P2 = { x: number; y: number };
type Vertex = 'A' | 'B' | 'C';
type CustomKind =
  | 'free'
  | 'midpoint'
  | 'segment'
  | 'ray-point'
  | 'perpendicular-foot'
  | 'intersection'
  | 'circle-intersection'
  | 'reflect'
  | 'rotate'
  | 'translate'
  | 'dilate'
  | 'parallel-point'
  | 'perpendicular-point'
  | 'perpendicular-bisector-point'
  | 'angle-bisector-point'
  | 'circle-point'
  | 'tangent-point'
  | 'circle-tangent-from-point';

type CustomPrimitive =
  | { kind: 'line'; a: P2; b: P2; dash: string }
  | { kind: 'circle'; center: P2; r: number };

type Saved2DState = {
  pts: Record<Vertex, P2>;
  customPoints: PlanePoint[];
  linearObjects: PlaneLinearObject[];
};

const STORAGE_KEY_2D = 'muc-geometry2d-state-v1';
const DEFAULT_TRIANGLE: Record<Vertex, P2> = { A: { x: 225, y: 48 }, B: { x: 80, y: 285 }, C: { x: 410, y: 285 } };

const add = (a: P2, b: P2): P2 => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: P2, b: P2): P2 => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (p: P2, k: number): P2 => ({ x: p.x * k, y: p.y * k });
const len = (p: P2) => Math.hypot(p.x, p.y);
const mid = (a: P2, b: P2): P2 => mul(add(a, b), 0.5);
const project = (p: P2, a: P2, b: P2): P2 => {
  const d = sub(b, a), dd = d.x * d.x + d.y * d.y;
  if (dd < 1e-8) return a;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / dd));
  return add(a, mul(d, t));
};
const bisector = (v: P2, a: P2, b: P2): P2 => {
  const la = len(sub(a, v)), lb = len(sub(b, v));
  return la + lb < 1e-8 ? v : mul(add(mul(a, lb), mul(b, la)), 1 / (la + lb));
};
const ps = (p: P2) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

function lineAcrossCanvas(origin: P2, direction: P2): [P2, P2] {
  const hits: P2[] = [];
  const addHit = (p: P2) => {
    if (p.x >= -1e-4 && p.x <= 480.0001 && p.y >= -1e-4 && p.y <= 350.0001 && !hits.some(q => len(sub(p, q)) < 0.05)) {
      hits.push({ x: Math.max(0, Math.min(480, p.x)), y: Math.max(0, Math.min(350, p.y)) });
    }
  };
  if (Math.abs(direction.x) > 1e-8) {
    for (const x of [0, 480]) {
      const t = (x - origin.x) / direction.x;
      addHit({ x, y: origin.y + t * direction.y });
    }
  }
  if (Math.abs(direction.y) > 1e-8) {
    for (const y of [0, 350]) {
      const t = (y - origin.y) / direction.y;
      addHit({ x: origin.x + t * direction.x, y });
    }
  }
  hits.sort((a, b) => len(sub(a, origin)) - len(sub(b, origin)));
  return hits.length >= 2 ? [hits[0], hits[hits.length - 1]] : [origin, origin];
}

function rayToCanvasEdge(origin: P2, through: P2): [P2, P2] {
  const dir = sub(through, origin);
  if (len(dir) < 1e-8) return [origin, through];
  const [p0, p1] = lineAcrossCanvas(origin, dir);
  const dot0 = (p0.x - origin.x) * dir.x + (p0.y - origin.y) * dir.y;
  return [origin, dot0 >= 0 ? p0 : p1];
}

function circumcenter2(a: P2, b: P2, c: P2): P2 | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-7) return null;
  const aa = a.x * a.x + a.y * a.y, bb = b.x * b.x + b.y * b.y, cc = c.x * c.x + c.y * c.y;
  return { x: (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d, y: (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d };
}

const safeUnit = (p: P2): P2 => { const n = len(p); return n < 1e-8 ? { x: 0, y: 0 } : mul(p, 1 / n); };

function loadSaved2DState(): Saved2DState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_2D);
    if (!raw) return { pts: DEFAULT_TRIANGLE, customPoints: [], linearObjects: [] };
    const parsed = JSON.parse(raw) as Partial<Saved2DState>;
    const pts = parsed.pts && parsed.pts.A && parsed.pts.B && parsed.pts.C ? parsed.pts : DEFAULT_TRIANGLE;
    const customPoints = Array.isArray(parsed.customPoints) ? parsed.customPoints : [];
    const linearObjects = Array.isArray(parsed.linearObjects) ? parsed.linearObjects : [];
    return { pts, customPoints, linearObjects };
  } catch {
    return { pts: DEFAULT_TRIANGLE, customPoints: [], linearObjects: [] };
  }
}

function describeConstraint(c?: PlaneConstraint): string {
  if (!c) return 'điểm tự do';
  switch (c.type) {
    case 'midpoint': return 'trung điểm';
    case 'segment': return `điểm trên đoạn (t=${fmt(c.t, 2)})`;
    case 'ray-point': return `điểm trên tia (t=${fmt(c.t, 2)})`;
    case 'perpendicular-foot': return 'chân đường vuông góc';
    case 'intersection': return 'giao hai đường';
    case 'circle-intersection-point': return 'giao hai đường tròn';
    case 'reflect': return 'đối xứng trục';
    case 'rotate': return `quay ${fmt(c.angleDeg, 0)}°`;
    case 'translate': return 'tịnh tiến';
    case 'dilate': return `vị tự (k=${fmt(c.factor, 2)})`;
    case 'parallel-point': return 'song song';
    case 'perpendicular-point': return 'vuông góc';
    case 'perpendicular-bisector-point': return 'trung trực';
    case 'angle-bisector-point': return 'phân giác';
    case 'circle-point': return `trên đường tròn (${fmt(c.angleDeg, 0)}°)`;
    case 'tangent-point': return 'tiếp tuyến tại điểm';
    case 'circle-tangent-from-point': return 'tiếp điểm từ điểm ngoài';
  }
}

export default function DynamicGeometry({ onInsert, openLibrary, open3D }: { onInsert: MathHubProps['onInsert']; openLibrary: () => void; open3D: () => void }) {
  const initial = useRef<Saved2DState>(loadSaved2DState());
  const [pts, setPts] = useState<Record<Vertex, P2>>(initial.current.pts);
  const [lockedVertices, setLockedVertices] = useState<Record<Vertex, boolean>>({ A: false, B: false, C: false });
  const [show, setShow] = useState({ medians: true, altitudes: true, bisectors: false, perp: true, lengths: true, labels: true, centers: true, circles: false, eulerLine: false, angles: true, locus: true });
  const [dragging, setDragging] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [customPoints, setCustomPoints] = useState<PlanePoint[]>(initial.current.customPoints);
  const [linearObjects, setLinearObjects] = useState<PlaneLinearObject[]>(initial.current.linearObjects);
  const [history, setHistory] = useState<Saved2DState[]>([]);

  const [customName, setCustomName] = useState('D');
  const [customKind, setCustomKind] = useState<CustomKind>('midpoint');
  const [customRefA, setCustomRefA] = useState('A');
  const [customRefB, setCustomRefB] = useState('B');
  const [customRefC, setCustomRefC] = useState('B');
  const [customRefD, setCustomRefD] = useState('C');
  const [customT, setCustomT] = useState('0.5');
  const [customAngle, setCustomAngle] = useState('60');
  const [customFactor, setCustomFactor] = useState('1.5');
  const [customDist, setCustomDist] = useState('60');
  const [customBranch, setCustomBranch] = useState<1 | -1>(1);
  const [customError, setCustomError] = useState('');

  const [objectKind, setObjectKind] = useState<PlaneLinearObject['kind']>('segment');
  const [objectRefA, setObjectRefA] = useState('A');
  const [objectRefB, setObjectRefB] = useState('B');
  const [objectRefC, setObjectRefC] = useState('C');

  const [locusDriverId, setLocusDriverId] = useState('');
  const [locusTracerId, setLocusTracerId] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_2D, JSON.stringify({ pts, customPoints, linearObjects }));
    } catch { /* ignore storage quota errors */ }
  }, [pts, customPoints, linearObjects]);

  const pushHistory = () => {
    setHistory(old => [...old.slice(-29), { pts, customPoints, linearObjects }]);
  };

  const undoConstruction = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setPts(last.pts);
    setCustomPoints(last.customPoints);
    setLinearObjects(last.linearObjects);
    setHistory(old => old.slice(0, -1));
  };

  const { A, B, C } = pts;
  const planeBase: PlanePoint[] = [{ id: 'A', name: 'A', p: A }, { id: 'B', name: 'B', p: B }, { id: 'C', name: 'C', p: C }];
  const dependent = resolvePlaneGeometry(planeBase, [
    { id: 'M_A', name: 'M_A', p: mid(B, C), constraint: { type: 'midpoint', from: 'B', to: 'C' } },
    { id: 'M_B', name: 'M_B', p: mid(A, C), constraint: { type: 'midpoint', from: 'A', to: 'C' } },
    { id: 'M_C', name: 'M_C', p: mid(A, B), constraint: { type: 'midpoint', from: 'A', to: 'B' } },
    { id: 'H_A', name: 'H_A', p: project(A, B, C), constraint: { type: 'perpendicular-foot', point: 'A', lineFrom: 'B', lineTo: 'C' } },
    { id: 'H_B', name: 'H_B', p: project(B, A, C), constraint: { type: 'perpendicular-foot', point: 'B', lineFrom: 'A', lineTo: 'C' } },
    { id: 'H_C', name: 'H_C', p: project(C, A, B), constraint: { type: 'perpendicular-foot', point: 'C', lineFrom: 'A', lineTo: 'B' } },
    ...customPoints,
  ]);

  const unresolvedSet = new Set(dependent.unresolvedIds);
  const depById = Object.fromEntries(dependent.points.map(p => [p.id, p.p]));
  const constructionOptions = dependent.points.map(p => ({ id: p.id, name: p.name }));
  const visibleCustomPoints = customPoints.filter(p => !p.hidden && !unresolvedSet.has(p.id));

  const customPrimitives: CustomPrimitive[] = customPoints.flatMap<CustomPrimitive>((point): CustomPrimitive[] => {
    if (point.hidden || unresolvedSet.has(point.id)) return [];
    const c = point.constraint;
    if (!c) return [];
    const get = (id: string) => (unresolvedSet.has(id) ? undefined : (depById[id] as P2 | undefined));
    if (c.type === 'midpoint' || c.type === 'segment') {
      const a = get(c.from), b = get(c.to);
      return a && b ? [{ kind: 'line' as const, a, b, dash: '5 4' }] : [];
    }
    if (c.type === 'ray-point') {
      const a = get(c.from), b = get(c.through);
      if (!a || !b) return [];
      const [r0, r1] = rayToCanvasEdge(a, b);
      return [{ kind: 'line' as const, a: r0, b: r1, dash: '5 4' }];
    }
    if (c.type === 'intersection') {
      const a = get(c.a), b = get(c.b), d = get(c.c), e = get(c.d);
      return a && b && d && e
        ? [
            { kind: 'line' as const, a: lineAcrossCanvas(a, sub(b, a))[0], b: lineAcrossCanvas(a, sub(b, a))[1], dash: '3 4' },
            { kind: 'line' as const, a: lineAcrossCanvas(d, sub(e, d))[0], b: lineAcrossCanvas(d, sub(e, d))[1], dash: '3 4' },
          ]
        : [];
    }
    if (c.type === 'parallel-point' || c.type === 'perpendicular-point') {
      const tPt = get(c.through), pPt = get(point.id);
      if (!tPt || !pPt) return [];
      const [l0, l1] = lineAcrossCanvas(tPt, sub(pPt, tPt));
      return [{ kind: 'line' as const, a: l0, b: l1, dash: '4 4' }];
    }
    if (c.type === 'circle-point') {
      const center = get(c.center), rPt = get(c.radiusPoint);
      return center && rPt ? [{ kind: 'circle' as const, center, r: len(sub(center, rPt)) }] : [];
    }
    if (c.type === 'circle-intersection-point') {
      const a = get(c.centerA), b = get(c.radiusPointA), d = get(c.centerB), e = get(c.radiusPointB);
      return a && b && d && e
        ? [
            { kind: 'circle' as const, center: a, r: len(sub(a, b)) },
            { kind: 'circle' as const, center: d, r: len(sub(d, e)) },
          ]
        : [];
    }
    if (c.type === 'tangent-point' || c.type === 'circle-tangent-from-point') {
      const center = get(c.center), rPt = get(c.type === 'tangent-point' ? c.onCircle : c.radiusPoint);
      const pPt = get(point.id);
      const refPt = c.type === 'tangent-point' ? rPt : get(c.externalPoint);
      const out: CustomPrimitive[] = [];
      if (center && rPt) out.push({ kind: 'circle' as const, center, r: len(sub(center, rPt)) });
      if (refPt && pPt) {
        const [l0, l1] = lineAcrossCanvas(refPt, sub(pPt, refPt));
        out.push({ kind: 'line' as const, a: l0, b: l1, dash: '4 3' });
      }
      return out;
    }
    return [];
  });

  const driverCandidates = customPoints.filter(p => p.constraint?.type === 'segment' || p.constraint?.type === 'circle-point');
  const activeDriverId = driverCandidates.some(p => p.id === locusDriverId) ? locusDriverId : (driverCandidates[0]?.id || '');
  const activeTracerId = customPoints.some(p => p.id === locusTracerId) ? locusTracerId : (customPoints[customPoints.length - 1]?.id || '');
  const locusPoints = show.locus && activeDriverId && activeTracerId
    ? computePlaneLocus(planeBase, [
        { id: 'M_A', name: 'M_A', p: mid(B, C), constraint: { type: 'midpoint', from: 'B', to: 'C' } },
        { id: 'M_B', name: 'M_B', p: mid(A, C), constraint: { type: 'midpoint', from: 'A', to: 'C' } },
        { id: 'M_C', name: 'M_C', p: mid(A, B), constraint: { type: 'midpoint', from: 'A', to: 'B' } },
        { id: 'H_A', name: 'H_A', p: project(A, B, C), constraint: { type: 'perpendicular-foot', point: 'A', lineFrom: 'B', lineTo: 'C' } },
        { id: 'H_B', name: 'H_B', p: project(B, A, C), constraint: { type: 'perpendicular-foot', point: 'B', lineFrom: 'A', lineTo: 'C' } },
        { id: 'H_C', name: 'H_C', p: project(C, A, B), constraint: { type: 'perpendicular-foot', point: 'C', lineFrom: 'A', lineTo: 'B' } },
        ...customPoints,
      ], activeDriverId, activeTracerId, 80)
    : [];
  const locusPath = locusPoints.length >= 2 ? `M${locusPoints.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')}` : '';

  const sideA = segmentLength(B, C), sideB = segmentLength(A, C), sideC = segmentLength(A, B);
  const maxSide = Math.max(sideA, sideB, sideC), minSide = Math.min(sideA, sideB, sideC);
  const area = polygonArea([A, B, C]);
  const type = maxSide - minSide < 1 ? 'Đều' : Math.abs(sideA - sideB) < 1 || Math.abs(sideB - sideC) < 1 || Math.abs(sideC - sideA) < 1 ? 'Cân' : Math.abs(maxSide ** 2 - (sideA ** 2 + sideB ** 2 + sideC ** 2 - maxSide ** 2)) < 2 ? 'Vuông' : 'Thường';

  const medians: [Vertex, P2, P2][] = [['A', A, depById.M_A], ['B', B, depById.M_B], ['C', C, depById.M_C]];
  const altitudes: [Vertex, P2, P2][] = [['A', A, depById.H_A], ['B', B, depById.H_B], ['C', C, depById.H_C]];
  const bisectors: [Vertex, P2, P2][] = [['A', A, bisector(A, B, C)], ['B', B, bisector(B, A, C)], ['C', C, bisector(C, A, B)]];
  const perpendiculars: [Vertex, P2, P2][] = [
    ['A', ...lineAcrossCanvas(mid(B, C), { x: -(C.y - B.y), y: C.x - B.x })],
    ['B', ...lineAcrossCanvas(mid(A, C), { x: -(C.y - A.y), y: C.x - A.x })],
    ['C', ...lineAcrossCanvas(mid(A, B), { x: -(B.y - A.y), y: B.x - A.x })],
  ];
  const centroid = mul(add(add(A, B), C), 1 / 3), circumcenter = circumcenter2(A, B, C), orthocenter = circumcenter ? sub(add(add(A, B), C), mul(circumcenter, 2)) : null;
  const perimeter = sideA + sideB + sideC;
  const incenter = perimeter > 1e-8 ? mul(add(add(mul(A, sideA), mul(B, sideB)), mul(C, sideC)), 1 / perimeter) : null;
  const circumradius = circumcenter ? len(sub(circumcenter, A)) : 0, inradius = perimeter > 1e-8 ? area * 2 / perimeter : 0;
  const angles = { A: angleDegrees(A, B, C), B: angleDegrees(B, A, C), C: angleDegrees(C, A, B) };
  const eulerLine = circumcenter && orthocenter ? lineAcrossCanvas(circumcenter, sub(orthocenter, circumcenter)) : null;
  const angleLabelPoint = (v: P2, p: P2, q: P2) => add(v, mul(add(safeUnit(sub(p, v)), safeUnit(sub(q, v))), 23));

  const startDrag = (e: ReactPointerEvent<SVGGElement>, id: string) => {
    if (id === 'A' || id === 'B' || id === 'C') {
      if (lockedVertices[id]) return;
    } else {
      const target = customPoints.find(p => p.id === id);
      if (!target || target.locked || target.constraint) return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    pushHistory();
    setDragging(id);
  };

  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragging || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const x = Math.max(20, Math.min(460, (e.clientX - r.left) * 480 / r.width));
    const y = Math.max(20, Math.min(330, (e.clientY - r.top) * 350 / r.height));
    if (dragging === 'A' || dragging === 'B' || dragging === 'C') {
      setPts(old => ({ ...old, [dragging]: { x, y } }));
    } else {
      setCustomPoints(old => old.map(p => (p.id === dragging ? { ...p, p: { x, y } } : p)));
    }
  };

  const addCustomPoint = () => {
    const name = customName.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{0,7}$/.test(name)) {
      setCustomError('Tên điểm phải bắt đầu bằng chữ cái, tối đa 8 ký tự.');
      return;
    }
    if (constructionOptions.some(p => p.name.toUpperCase() === name)) {
      setCustomError(`Tên ${name} đã được dùng; hãy chọn tên khác.`);
      return;
    }
    let constraint: PlaneConstraint | undefined;
    const tVal = Number.isFinite(Number(customT)) ? Number(customT) : 0.5;
    const angVal = Number.isFinite(Number(customAngle)) ? Number(customAngle) : 60;
    const facVal = Number.isFinite(Number(customFactor)) ? Number(customFactor) : 1.5;
    const distVal = Number.isFinite(Number(customDist)) ? Number(customDist) : 60;

    if (customKind === 'free') constraint = undefined;
    else if (customKind === 'midpoint') constraint = { type: 'midpoint', from: customRefA, to: customRefB };
    else if (customKind === 'segment') constraint = { type: 'segment', from: customRefA, to: customRefB, t: Math.max(0, Math.min(1, tVal)) };
    else if (customKind === 'ray-point') constraint = { type: 'ray-point', from: customRefA, through: customRefB, t: Math.max(0, tVal) };
    else if (customKind === 'perpendicular-foot') constraint = { type: 'perpendicular-foot', point: customRefA, lineFrom: customRefB, lineTo: customRefC };
    else if (customKind === 'intersection') constraint = { type: 'intersection', a: customRefA, b: customRefB, c: customRefC, d: customRefD };
    else if (customKind === 'circle-intersection') constraint = { type: 'circle-intersection-point', centerA: customRefA, radiusPointA: customRefB, centerB: customRefC, radiusPointB: customRefD, branch: customBranch };
    else if (customKind === 'reflect') constraint = { type: 'reflect', point: customRefA, lineFrom: customRefB, lineTo: customRefC };
    else if (customKind === 'rotate') constraint = { type: 'rotate', point: customRefA, center: customRefB, angleDeg: angVal };
    else if (customKind === 'translate') constraint = { type: 'translate', point: customRefA, vectorFrom: customRefB, vectorTo: customRefC };
    else if (customKind === 'dilate') constraint = { type: 'dilate', point: customRefA, center: customRefB, factor: facVal };
    else if (customKind === 'parallel-point') constraint = { type: 'parallel-point', through: customRefA, lineFrom: customRefB, lineTo: customRefC, factor: facVal };
    else if (customKind === 'perpendicular-point') constraint = { type: 'perpendicular-point', through: customRefA, lineFrom: customRefB, lineTo: customRefC, factor: facVal };
    else if (customKind === 'perpendicular-bisector-point') constraint = { type: 'perpendicular-bisector-point', from: customRefA, to: customRefB, distance: distVal };
    else if (customKind === 'angle-bisector-point') constraint = { type: 'angle-bisector-point', vertex: customRefA, rayA: customRefB, rayB: customRefC, distance: distVal };
    else if (customKind === 'circle-point') constraint = { type: 'circle-point', center: customRefA, radiusPoint: customRefB, angleDeg: angVal };
    else if (customKind === 'tangent-point') constraint = { type: 'tangent-point', center: customRefA, onCircle: customRefB, distance: distVal };
    else constraint = { type: 'circle-tangent-from-point', externalPoint: customRefA, center: customRefB, radiusPoint: customRefC, branch: customBranch };

    pushHistory();
    const point: PlanePoint = { id: `user-${name}-${Date.now()}`, name, p: { x: 240, y: 175 }, ...(constraint ? { constraint } : {}) };
    setCustomPoints(old => [...old, point]);
    setCustomError('');
    const used = new Set([...constructionOptions.map(p => p.name.toUpperCase()), name]);
    const next = 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(letter => !used.has(letter));
    if (next) setCustomName(next);
  };

  const removeCustomPoint = (id: string) => {
    pushHistory();
    const cascaded = removePlanePointCascade(customPoints, id, linearObjects);
    setCustomPoints(cascaded.remainingPoints);
    setLinearObjects(cascaded.remainingObjects);
  };

  const renameCustomPoint = (id: string, currentName: string) => {
    const raw = window.prompt('Nhập tên điểm mới (bắt đầu bằng chữ cái, tối đa 8 ký tự):', currentName);
    if (!raw) return;
    const nextName = raw.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{0,7}$/.test(nextName)) {
      setCustomError('Tên điểm không hợp lệ.');
      return;
    }
    if (constructionOptions.some(p => p.id !== id && p.name.toUpperCase() === nextName)) {
      setCustomError(`Tên ${nextName} đã tồn tại.`);
      return;
    }
    pushHistory();
    setCustomPoints(old => old.map(p => (p.id === id ? { ...p, name: nextName } : p)));
    setCustomError('');
  };

  const toggleHidePoint = (id: string) => {
    pushHistory();
    setCustomPoints(old => old.map(p => (p.id === id ? { ...p, hidden: !p.hidden } : p)));
  };

  const toggleLockPoint = (id: string) => {
    pushHistory();
    setCustomPoints(old => old.map(p => (p.id === id ? { ...p, locked: !p.locked } : p)));
  };

  const addLinearObject = () => {
    const ids = objectKind === 'polygon' ? [objectRefA, objectRefB, objectRefC] : [objectRefA, objectRefB];
    if (new Set(ids).size !== ids.length) return;
    pushHistory();
    setLinearObjects(old => [...old, { id: `obj-${Date.now()}`, kind: objectKind, pointIds: ids }]);
  };

  const renderLinearObjectsSvg = () => {
    return linearObjects.map(obj => {
      if (obj.hidden || obj.pointIds.some(id => unresolvedSet.has(id) || !depById[id])) return '';
      const ptsList = obj.pointIds.map(id => depById[id]);
      if (obj.kind === 'polygon' && ptsList.length >= 3) {
        return `<polygon points="${ptsList.map(ps).join(' ')}" fill="#c7d2fe" fill-opacity="0.28" stroke="#4f46e5" stroke-width="2"/>`;
      }
      const [a, b] = ptsList;
      if (!a || !b) return '';
      if (obj.kind === 'segment') return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#0f766e" stroke-width="2.2"/>`;
      if (obj.kind === 'vector') return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#dc2626" stroke-width="2.2" marker-end="url(#mh-arrow)"/>`;
      if (obj.kind === 'ray') {
        const [r0, r1] = rayToCanvasEdge(a, b);
        return `<line x1="${r0.x}" y1="${r0.y}" x2="${r1.x}" y2="${r1.y}" stroke="#0284c7" stroke-width="1.8" stroke-dasharray="6 3"/>`;
      }
      const [l0, l1] = lineAcrossCanvas(a, sub(b, a));
      return `<line x1="${l0.x}" y1="${l0.y}" x2="${l1.x}" y2="${l1.y}" stroke="#0284c7" stroke-width="1.8" stroke-dasharray="4 4"/>`;
    }).join('');
  };

  const insert = () => {
    const line = (p: P2, q: P2, color: string, dash = '') => `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="${color}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
    let extra = customPrimitives.map(item => item.kind === 'line'
      ? `<line x1="${item.a.x}" y1="${item.a.y}" x2="${item.b.x}" y2="${item.b.y}" stroke="#0891b2" stroke-width="1.5" stroke-dasharray="${item.dash}"/>`
      : `<circle cx="${item.center.x}" cy="${item.center.y}" r="${item.r}" fill="none" stroke="#0891b2" stroke-width="1.5" stroke-dasharray="5 4"/>`
    ).join('');
    extra += renderLinearObjectsSvg();
    if (locusPath) extra += `<path d="${locusPath}" fill="none" stroke="#e11d48" stroke-width="2" stroke-dasharray="4 3"/>`;
    if (show.medians) medians.forEach(([, p, q]) => { extra += line(p, q, '#2878e8', '6 4'); });
    if (show.altitudes) altitudes.forEach(([, p, q]) => { extra += line(p, q, '#ef4444', '6 4'); });
    if (show.bisectors) bisectors.forEach(([, p, q]) => { extra += line(p, q, '#8b5cf6', '3 4'); });
    if (show.perp) perpendiculars.forEach(([, p, q]) => { extra += line(p, q, '#0f9f87', '3 4'); });
    if (show.eulerLine && eulerLine) extra += line(eulerLine[0], eulerLine[1], '#b45309', '8 4');
    if (show.circles && circumcenter) extra += `<circle cx="${circumcenter.x}" cy="${circumcenter.y}" r="${circumradius}" fill="none" stroke="#0e7490" stroke-width="1.8"/>`;
    if (show.circles && incenter) extra += `<circle cx="${incenter.x}" cy="${incenter.y}" r="${inradius}" fill="none" stroke="#db2777" stroke-width="1.8"/>`;
    if (show.centers) {
      const centers: [string, P2, string][] = [
        ['G', centroid, '#2563eb'],
        ...(circumcenter ? [['O', circumcenter, '#0e7490'] as [string, P2, string]] : []),
        ...(orthocenter ? [['H', orthocenter, '#b45309'] as [string, P2, string]] : []),
        ...(incenter ? [['I', incenter, '#db2777'] as [string, P2, string]] : []),
      ];
      extra += centers.map(([name, p, color]) => `<circle cx="${p.x}" cy="${p.y}" r="4.2" fill="${color}" stroke="#fff" stroke-width="1.5"/><text x="${p.x + 7}" y="${p.y - 7}" font-size="13" font-weight="800" fill="${color}" stroke="#fff" stroke-width="3" paint-order="stroke">${name}</text>`).join('');
    }
    const labels = show.labels ? (['A', 'B', 'C'] as Vertex[]).map(v => `<text x="${pts[v].x + 9}" y="${pts[v].y - 10}" font-size="15" font-weight="700" fill="#1e293b">${v}</text>`).join('') : '';
    const lens = show.lengths ? `<text x="240" y="342" text-anchor="middle" font-size="12" fill="#475569">AB = ${fmt(sideC, 1)} · AC = ${fmt(sideB, 1)} · BC = ${fmt(sideA, 1)}</text>` : '';
    const angleText = show.angles ? (['A', 'B', 'C'] as Vertex[]).map(v => {
      const p = angleLabelPoint(pts[v], pts[v === 'A' ? 'B' : 'A'], pts[v === 'C' ? 'B' : 'C']);
      return `<text x="${p.x}" y="${p.y}" font-size="11" font-weight="700" fill="#7c3aed" stroke="#fff" stroke-width="3" paint-order="stroke">${v}=${fmt(angles[v], 1)}°</text>`;
    }).join('') : '';
    const contents = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="700" viewBox="0 0 480 350"><defs><marker id="mh-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#dc2626"/></marker></defs><rect width="480" height="350" fill="#fff"/><path d="M0 35H480 M0 70H480 M0 105H480 M0 140H480 M0 175H480 M0 210H480 M0 245H480 M0 280H480 M0 315H480 M35 0V350 M70 0V350 M105 0V350 M140 0V350 M175 0V350 M210 0V350 M245 0V350 M280 0V350 M315 0V350 M350 0V350 M385 0V350 M420 0V350 M455 0V350" stroke="#e2e8f0" stroke-width=".6"/><path d="M${ps(A)} L${ps(B)} L${ps(C)} Z" fill="#e8f2ff" stroke="#2563eb" stroke-width="2.4"/>${extra}${visibleCustomPoints.map(point => {
      const p = depById[point.id] || point.p;
      return `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#0f766e" stroke="#fff" stroke-width="1.5"/><text x="${p.x + 7}" y="${p.y - 7}" font-size="13" font-weight="800" fill="#0f766e" stroke="#fff" stroke-width="3" paint-order="stroke">${point.name}</text>`;
    }).join('')}${angleText}${(['A', 'B', 'C'] as Vertex[]).map(v => `<circle cx="${pts[v].x}" cy="${pts[v].y}" r="5" fill="#fff" stroke="#1d4ed8" stroke-width="2.5"/>`).join('')}${labels}${lens}</svg>`;
    onInsert(svgUri(contents), 'Tam giác động và các đường phụ', 480 / 350);
  };

  const refCount = customKind === 'free' ? 0
    : customKind === 'midpoint' || customKind === 'segment' || customKind === 'ray-point' || customKind === 'rotate' || customKind === 'dilate' || customKind === 'perpendicular-bisector-point' || customKind === 'circle-point' || customKind === 'tangent-point' ? 2
    : customKind === 'intersection' || customKind === 'circle-intersection' ? 4
    : 3;

  return <div className="mh-page"><div className="mh-page-heading"><div><span className="mh-kicker">HÌNH HỌC PHẲNG</span><h1>Dựng hình động</h1><p>Kéo các đỉnh A, B, C hoặc điểm tự do. Các đối tượng phụ thuộc, quỹ tích và số đo cập nhật theo đồ thị phụ thuộc.</p></div><span className="mh-page-badge"><PenTool size={15}/> GeoGebra-inspired</span></div>
    <div className="mh-geometry-layout"><div className="mh-geometry-canvas"><svg ref={svgRef} viewBox="0 0 480 350" onPointerMove={move} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)} className="mh-triangle-svg"><defs><pattern id="mh-grid" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M35 0H0V35" fill="none" stroke="#e2e8f0" strokeWidth=".8"/></pattern><marker id="mh-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#dc2626"/></marker></defs><rect width="480" height="350" fill="url(#mh-grid)"/><polygon points={`${ps(A)} ${ps(B)} ${ps(C)}`} fill="#eaf3ff" stroke="#2563eb" strokeWidth="2.4"/>
      {customPrimitives.map((item, i) => item.kind === 'line'
        ? <line key={`cp-line-${i}`} x1={item.a.x} y1={item.a.y} x2={item.b.x} y2={item.b.y} stroke="#0891b2" strokeWidth="1.5" strokeDasharray={item.dash}/>
        : <circle key={`cp-circle-${i}`} cx={item.center.x} cy={item.center.y} r={item.r} fill="none" stroke="#0891b2" strokeWidth="1.5" strokeDasharray="5 4"/>
      )}
      {linearObjects.map(obj => {
        if (obj.hidden || obj.pointIds.some(id => unresolvedSet.has(id) || !depById[id])) return null;
        const ptsList = obj.pointIds.map(id => depById[id]);
        if (obj.kind === 'polygon' && ptsList.length >= 3) return <polygon key={obj.id} points={ptsList.map(ps).join(' ')} fill="#c7d2fe" fillOpacity="0.28" stroke="#4f46e5" strokeWidth="2"/>;
        const [a, b] = ptsList;
        if (!a || !b) return null;
        if (obj.kind === 'segment') return <line key={obj.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0f766e" strokeWidth="2.2"/>;
        if (obj.kind === 'vector') return <line key={obj.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#dc2626" strokeWidth="2.2" markerEnd="url(#mh-arrow)"/>;
        if (obj.kind === 'ray') {
          const [r0, r1] = rayToCanvasEdge(a, b);
          return <line key={obj.id} x1={r0.x} y1={r0.y} x2={r1.x} y2={r1.y} stroke="#0284c7" strokeWidth="1.8" strokeDasharray="6 3"/>;
        }
        const [l0, l1] = lineAcrossCanvas(a, sub(b, a));
        return <line key={obj.id} x1={l0.x} y1={l0.y} x2={l1.x} y2={l1.y} stroke="#0284c7" strokeWidth="1.8" strokeDasharray="4 4"/>;
      })}
      {locusPath && <path d={locusPath} fill="none" stroke="#e11d48" strokeWidth="2" strokeDasharray="4 3"/>}
      {visibleCustomPoints.map(point => {
        const p = depById[point.id] || point.p;
        const canDrag = !point.constraint && !point.locked;
        return <g key={point.id} onPointerDown={canDrag ? e => startDrag(e, point.id) : undefined} style={canDrag ? { cursor: 'grab' } : undefined}><circle cx={p.x} cy={p.y} r="4.5" fill={point.constraint ? '#0f766e' : '#0284c7'} stroke="#fff" strokeWidth="1.5"/><text x={p.x + 7} y={p.y - 7} fontSize="13" fontWeight="800" fill="#0f766e" stroke="#fff" strokeWidth="3" paintOrder="stroke">{point.name}</text></g>;
      })}
      {show.medians && medians.map(([v, p, q]) => <line key={`m${v}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#2878e8" strokeWidth="1.8" strokeDasharray="6 4"/>)}
      {show.altitudes && altitudes.map(([v, p, q]) => <line key={`a${v}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#ef4444" strokeWidth="1.8" strokeDasharray="6 4"/>)}
      {show.bisectors && bisectors.map(([v, p, q]) => <line key={`b${v}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#8b5cf6" strokeWidth="1.8" strokeDasharray="3 4"/>)}
      {show.perp && perpendiculars.map(([v, p, q]) => <line key={`p${v}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#0f9f87" strokeWidth="1.8" strokeDasharray="3 4"/>)}
      {show.eulerLine && eulerLine && <line x1={eulerLine[0].x} y1={eulerLine[0].y} x2={eulerLine[1].x} y2={eulerLine[1].y} stroke="#b45309" strokeWidth="1.8" strokeDasharray="8 4"/>}
      {show.circles && circumcenter && <circle cx={circumcenter.x} cy={circumcenter.y} r={circumradius} fill="none" stroke="#0e7490" strokeWidth="1.8"/>}
      {show.circles && incenter && <circle cx={incenter.x} cy={incenter.y} r={inradius} fill="none" stroke="#db2777" strokeWidth="1.8"/>}
      {show.centers && <g>{([['G', centroid, '#2563eb'], ...(circumcenter ? [['O', circumcenter, '#0e7490']] : []), ...(orthocenter ? [['H', orthocenter, '#b45309']] : []), ...(incenter ? [['I', incenter, '#db2777']] : [])] as [string, P2, string][]).map(([name, p, color]) => <g key={name}><circle cx={p.x} cy={p.y} r="4.2" fill={color} stroke="#fff" strokeWidth="1.5"/><text x={p.x + 7} y={p.y - 7} fontSize="13" fontWeight="800" fill={color} stroke="#fff" strokeWidth="3" paintOrder="stroke">{name}</text></g>)}</g>}
      {show.angles && (['A', 'B', 'C'] as Vertex[]).map(v => {
        const p = angleLabelPoint(pts[v], pts[v === 'A' ? 'B' : 'A'], pts[v === 'C' ? 'B' : 'C']);
        return <text key={`ang${v}`} x={p.x} y={p.y} fontSize="11" fontWeight="700" fill="#7c3aed" stroke="#fff" strokeWidth="3" paintOrder="stroke">{v}={fmt(angles[v], 1)}°</text>;
      })}
      {(['A', 'B', 'C'] as Vertex[]).map(v => <g key={v} onPointerDown={e => startDrag(e, v)} style={{ cursor: lockedVertices[v] ? 'not-allowed' : 'grab' }}><circle cx={pts[v].x} cy={pts[v].y} r="13" fill="transparent"/><circle cx={pts[v].x} cy={pts[v].y} r="5" fill={lockedVertices[v] ? '#fde68a' : '#fff'} stroke="#1d4ed8" strokeWidth="2.5"/><text x={pts[v].x + 9} y={pts[v].y - 10} fill="#0f172a" fontSize="15" fontWeight="700" pointerEvents="none">{show.labels ? v : ''}</text></g>)}
      {show.lengths && <g fontSize="12" fill="#334155"><text x="14" y="334">AB = {fmt(sideC, 1)}</text><text x="175" y="334">AC = {fmt(sideB, 1)}</text><text x="338" y="334">BC = {fmt(sideA, 1)}</text></g>}
    </svg>
    <div className="mh-geometry-measures"><span><small>Diện tích</small><b>{fmt(area, 1)} px²</b></span><span><small>Chu vi</small><b>{fmt(perimeter, 1)} px</b></span><span><small>Loại tam giác</small><b>{type}</b></span><span><small>Tổng ba góc</small><b>{fmt(angles.A + angles.B + angles.C, 2)}°</b></span></div></div>

    <aside className="mh-tool-card">
      <h3><Compass size={17}/> Đường phụ và dựng hình</h3>
      <div className="mh-custom-construction">
        <h4>1. Dựng điểm tự do / phụ thuộc</h4>
        <label className="mh-field"><span>Kiểu dựng</span><select value={customKind} onChange={e => setCustomKind(e.target.value as CustomKind)}>
          <option value="midpoint">Trung điểm</option>
          <option value="segment">Điểm trên đoạn thẳng</option>
          <option value="ray-point">Điểm trên tia</option>
          <option value="free">Điểm tự do (kéo được)</option>
          <option value="perpendicular-foot">Chân đường cao / vuông góc</option>
          <option value="intersection">Giao điểm hai đường thẳng</option>
          <option value="circle-intersection">Giao điểm hai đường tròn</option>
          <option value="circle-point">Điểm trên đường tròn</option>
          <option value="tangent-point">Tiếp tuyến tại điểm trên đường tròn</option>
          <option value="circle-tangent-from-point">Tiếp điểm từ điểm ngoài đường tròn</option>
          <option value="parallel-point">Đường thẳng song song</option>
          <option value="perpendicular-point">Đường thẳng vuông góc</option>
          <option value="perpendicular-bisector-point">Điểm trên trung trực</option>
          <option value="angle-bisector-point">Điểm trên phân giác</option>
          <option value="reflect">Phép đối xứng trục</option>
          <option value="rotate">Phép quay quanh tâm</option>
          <option value="translate">Phép tịnh tiến theo vectơ</option>
          <option value="dilate">Phép vị tự</option>
        </select></label>
        <label className="mh-field"><span>Tên điểm</span><input value={customName} onChange={e => setCustomName(e.target.value)} maxLength={8}/></label>
        {refCount > 0 && <div className="mh-point-ref-grid">{([['A', customRefA, setCustomRefA], ['B', customRefB, setCustomRefB], ['C', customRefC, setCustomRefC], ['D', customRefD, setCustomRefD]] as const).slice(0, refCount).map(([label, value, setter]) => <label className="mh-field" key={label}><span>{
          customKind === 'circle-intersection' ? (label === 'A' ? 'Tâm 1' : label === 'B' ? 'Điểm bán kính 1' : label === 'C' ? 'Tâm 2' : 'Điểm bán kính 2')
          : customKind === 'intersection' ? (label === 'A' ? 'Đường 1: điểm A' : label === 'B' ? 'Đường 1: điểm B' : label === 'C' ? 'Đường 2: điểm C' : 'Đường 2: điểm D')
          : customKind === 'rotate' || customKind === 'dilate' ? (label === 'A' ? 'Điểm gốc' : 'Tâm biến hình')
          : customKind === 'translate' ? (label === 'A' ? 'Điểm gốc' : label === 'B' ? 'Gốc vectơ' : 'Ngọn vectơ')
          : customKind === 'circle-point' || customKind === 'tangent-point' ? (label === 'A' ? 'Tâm đường tròn' : 'Điểm trên đường tròn')
          : customKind === 'circle-tangent-from-point' ? (label === 'A' ? 'Điểm ngoài P' : label === 'B' ? 'Tâm O' : 'Điểm bán kính')
          : `Điểm ${label}`
        }</span><select value={value} onChange={e => setter(e.target.value)}>{constructionOptions.map(point => <option key={point.id} value={point.id}>{point.name}</option>)}</select></label>)}</div>}
        {(customKind === 'segment' || customKind === 'ray-point') && <label className="mh-field"><span>Tham số t</span><input type="number" min="0" max={customKind === 'segment' ? '1' : '5'} step="0.05" value={customT} onChange={e => setCustomT(e.target.value)}/></label>}
        {(customKind === 'rotate' || customKind === 'circle-point') && <label className="mh-field"><span>Góc (độ)</span><input type="range" min="0" max="360" step="1" value={customAngle} onChange={e => setCustomAngle(e.target.value)}/><input type="number" value={customAngle} onChange={e => setCustomAngle(e.target.value)}/></label>}
        {(customKind === 'dilate' || customKind === 'parallel-point' || customKind === 'perpendicular-point') && <label className="mh-field"><span>Hệ số tỉ lệ k</span><input type="number" step="0.25" value={customFactor} onChange={e => setCustomFactor(e.target.value)}/></label>}
        {(customKind === 'perpendicular-bisector-point' || customKind === 'angle-bisector-point' || customKind === 'tangent-point') && <label className="mh-field"><span>Khoảng cách (px)</span><input type="number" step="10" value={customDist} onChange={e => setCustomDist(e.target.value)}/></label>}
        {(customKind === 'circle-intersection' || customKind === 'circle-tangent-from-point') && <label className="mh-field"><span>Nhánh nghiệm</span><select value={customBranch} onChange={e => setCustomBranch(Number(e.target.value) as 1 | -1)}><option value={1}>Nhánh +1 (trái / trên)</option><option value={-1}>Nhánh −1 (phải / dưới)</option></select></label>}
        <button className="mh-primary-button" onClick={addCustomPoint}>+ Dựng điểm</button>
        {customError && <div className="mh-error">{customError}</div>}

        <h4 style={{ marginTop: 10 }}>2. Nối đoạn, đường, tia, vectơ, đa giác</h4>
        <div className="mh-point-ref-grid">
          <label className="mh-field"><span>Loại</span><select value={objectKind} onChange={e => setObjectKind(e.target.value as PlaneLinearObject['kind'])}><option value="segment">Đoạn thẳng</option><option value="line">Đường thẳng</option><option value="ray">Tia</option><option value="vector">Vectơ</option><option value="polygon">Đa giác 3 đỉnh</option></select></label>
          <label className="mh-field"><span>Điểm 1</span><select value={objectRefA} onChange={e => setObjectRefA(e.target.value)}>{constructionOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="mh-field"><span>Điểm 2</span><select value={objectRefB} onChange={e => setObjectRefB(e.target.value)}>{constructionOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          {objectKind === 'polygon' && <label className="mh-field"><span>Điểm 3</span><select value={objectRefC} onChange={e => setObjectRefC(e.target.value)}>{constructionOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        </div>
        <button className="mh-secondary-button" onClick={addLinearObject}>+ Thêm đối tượng nối</button>

        {driverCandidates.length > 0 && customPoints.length > 0 && <div style={{ marginTop: 8 }}>
          <h4>3. Quỹ tích & thanh trượt tham số</h4>
          <div className="mh-point-ref-grid">
            <label className="mh-field"><span>Điểm chạy</span><select value={activeDriverId} onChange={e => setLocusDriverId(e.target.value)}>{driverCandidates.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="mh-field"><span>Điểm vẽ quỹ tích</span><select value={activeTracerId} onChange={e => setLocusTracerId(e.target.value)}>{customPoints.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          </div>
          {(() => {
            const drv = customPoints.find(p => p.id === activeDriverId);
            if (!drv?.constraint) return null;
            if (drv.constraint.type === 'segment') {
              const cur = drv.constraint.t;
              return <label className="mh-field"><span>Thanh trượt t ({drv.name}): {fmt(cur, 2)}</span><input type="range" min="0" max="1" step="0.02" value={cur} onChange={e => { const val = Number(e.target.value); setCustomPoints(old => old.map(p => p.id === drv.id && p.constraint?.type === 'segment' ? { ...p, constraint: { ...p.constraint, t: val } } : p)); }}/></label>;
            }
            if (drv.constraint.type === 'circle-point') {
              const cur = drv.constraint.angleDeg;
              return <label className="mh-field"><span>Thanh trượt góc ({drv.name}): {fmt(cur, 0)}°</span><input type="range" min="0" max="360" step="2" value={cur} onChange={e => { const val = Number(e.target.value); setCustomPoints(old => old.map(p => p.id === drv.id && p.constraint?.type === 'circle-point' ? { ...p, constraint: { ...p.constraint, angleDeg: val } } : p)); }}/></label>;
            }
            return null;
          })()}
        </div>}

        <div className="mh-custom-point-row" style={{ marginTop: 8 }}>
          <span>Khóa đỉnh gốc:</span>
          {(['A', 'B', 'C'] as Vertex[]).map(v => <button key={v} type="button" onClick={() => setLockedVertices(old => ({ ...old, [v]: !old[v] }))} title={lockedVertices[v] ? `Mở khóa ${v}` : `Khóa ${v}`}>{lockedVertices[v] ? <Lock size={12}/> : <Unlock size={12}/>} {v}</button>)}
          <button type="button" onClick={undoConstruction} disabled={!history.length} title="Hoàn tác bước dựng"><RotateCcw size={12}/> Hoàn tác ({history.length})</button>
        </div>

        {customPoints.map(point => <div className="mh-custom-point-row" key={point.id}>
          <span><b>{point.name}</b> · {describeConstraint(point.constraint)}{unresolvedSet.has(point.id) ? ' (suy biến/chưa xác định)' : ''}</span>
          <div>
            <button type="button" onClick={() => renameCustomPoint(point.id, point.name)} title="Đổi tên">Tên</button>
            <button type="button" onClick={() => toggleHidePoint(point.id)} title={point.hidden ? 'Hiện điểm' : 'Ẩn điểm'}>{point.hidden ? <EyeOff size={12}/> : <Eye size={12}/>}</button>
            {!point.constraint && <button type="button" onClick={() => toggleLockPoint(point.id)} title={point.locked ? 'Mở khóa' : 'Khóa'}>{point.locked ? <Lock size={12}/> : <Unlock size={12}/>}</button>}
            <button type="button" onClick={() => removeCustomPoint(point.id)} aria-label={`Xóa điểm ${point.name}`} title="Xóa điểm và các đối tượng phụ thuộc">×</button>
          </div>
        </div>)}
        {linearObjects.map(obj => <div className="mh-custom-point-row" key={obj.id}>
          <span>{obj.kind === 'segment' ? 'Đoạn' : obj.kind === 'line' ? 'Đường' : obj.kind === 'ray' ? 'Tia' : obj.kind === 'vector' ? 'Vectơ' : 'Đa giác'} ({obj.pointIds.map(id => constructionOptions.find(o => o.id === id)?.name || id).join('–')})</span>
          <button type="button" onClick={() => { pushHistory(); setLinearObjects(old => old.filter(o => o.id !== obj.id)); }}>×</button>
        </div>)}
        {dependent.unresolvedIds.some(id => customPoints.some(p => p.id === id)) && <p className="mh-error">Một số điểm chưa xác định được do dữ liệu suy biến (song song, không giao nhau) hoặc quan hệ vòng.</p>}
      </div>

      {([['medians', 'Đường trung tuyến', '#2878e8'], ['altitudes', 'Đường cao', '#ef4444'], ['bisectors', 'Đường phân giác', '#8b5cf6'], ['perp', 'Đường trung trực', '#0f9f87'], ['centers', 'Trọng tâm / trực tâm / tâm nội, ngoại tiếp', '#2563eb'], ['circles', 'Đường tròn nội tiếp và ngoại tiếp', '#db2777'], ['eulerLine', 'Đường thẳng Euler', '#b45309'], ['locus', 'Đường quỹ tích (khi có điểm chạy)', '#e11d48'], ['angles', 'Số đo các góc', ''], ['lengths', 'Độ dài ba cạnh', ''], ['labels', 'Nhãn đỉnh', '']] as const).map(([id, label, color]) => <label className="mh-check-row" key={id}><input type="checkbox" checked={show[id]} onChange={e => setShow(s => ({ ...s, [id]: e.target.checked }))}/><i style={{ background: color || '#94a3b8' }}/><span>{label}</span></label>)}
      <div className="mh-tip">Kéo đỉnh để quan sát các đường phụ và sự thay đổi của chu vi, diện tích. Dữ liệu dựng hình được tự động lưu.</div>
      <button className="mh-primary-button" onClick={insert}>Chèn hình hiện tại lên trang</button>
      <button className="mh-secondary-button" onClick={() => { pushHistory(); setPts(DEFAULT_TRIANGLE); setCustomPoints([]); setLinearObjects([]); setDragging(null); }}>Khôi phục tam giác mẫu</button>
      <button className="mh-secondary-button" onClick={openLibrary}>Mở thư viện hình</button>
      <button className="mh-secondary-button" onClick={open3D}>Dựng hình không gian 3D</button>
    </aside></div></div>;
}

export function TrigPanel() {
  const [angle, setAngle] = useState(42);
  const [func, setFunc] = useState<'sin' | 'cos' | 'tan' | 'cot'>('sin');
  const [value, setValue] = useState('0.5');
  const [degree, setDegree] = useState(true);
  const [excluded, setExcluded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const rad = angle * Math.PI / 180, px = 180 + 112 * Math.cos(rad), py = 180 - 112 * Math.sin(rad), s = Math.sin(rad), c = Math.cos(rad), t = Math.abs(c) < 1e-9 ? NaN : s / c, cot = Math.abs(s) < 1e-9 ? NaN : c / s;
  const drag = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) * 360 / r.width - 180, y = 180 - (e.clientY - r.top) * 360 / r.height;
    setAngle((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
  };
  type Solution = { valid: false; text: string } | { valid: true; text: string; roots: number[] };
  const solution = (): Solution => {
    const v = Number(value);
    if (!Number.isFinite(v)) return { valid: false, text: 'Nhập số hợp lệ.' };
    let first = 0, second = 0, periodDeg = 360;
    const pair = func === 'sin' || func === 'cos';
    if (func === 'sin') {
      if (Math.abs(v) > 1) return { valid: false, text: 'sin α phải thuộc [-1; 1].' };
      first = Math.asin(v) * 180 / Math.PI; second = 180 - first;
    } else if (func === 'cos') {
      if (Math.abs(v) > 1) return { valid: false, text: 'cos α phải thuộc [-1; 1].' };
      first = Math.acos(v) * 180 / Math.PI; second = 360 - first;
    } else if (func === 'tan') {
      first = Math.atan(v) * 180 / Math.PI; second = first; periodDeg = 180;
    } else {
      first = v === 0 ? 90 : Math.atan(1 / v) * 180 / Math.PI; second = first; periodDeg = 180;
    }
    const norm = (a: number) => ((a % periodDeg) + periodDeg) % periodDeg;
    const rawRoots = pair ? [norm(first), norm(second)] : [norm(first)];
    const roots = rawRoots.filter((root, index) => rawRoots.findIndex(other => Math.abs(other - root) < 1e-7) === index);
    const text = roots.map(root => degree ? `α ≈ ${fmt(root, 3)}° + ${periodDeg}°k` : `α ≈ ${fmt(root * Math.PI / 180, 4)} rad + ${periodDeg === 360 ? '2π' : 'π'}k`).join(' hoặc ');
    return { valid: true, text, roots };
  };
  const sol = solution();
  return <div className="mh-page"><div className="mh-page-heading"><div><span className="mh-kicker">LƯỢNG GIÁC</span><h1>Đường tròn lượng giác động</h1><p>Kéo điểm M trên đường tròn để cập nhật góc và các giá trị lượng giác.</p></div></div><div className="mh-trig-layout"><section className="mh-tool-card mh-trig-card"><svg viewBox="0 0 360 360" className="mh-trig-svg" onPointerMove={drag} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) * 360 / r.width - 180, y = 180 - (e.clientY - r.top) * 360 / r.height; setAngle((Math.atan2(y, x) * 180 / Math.PI + 360) % 360); }} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}><rect width="360" height="360" rx="16" fill="#fff"/><circle cx="180" cy="180" r="112" fill="#eff6ff" stroke="#94a3b8" strokeWidth="1.5"/><path d="M34 180H326 M180 34V326" stroke="#475569" strokeWidth="1.4"/><path d={`M180 180 L${px} ${py}`} stroke="#2563eb" strokeWidth="3"/><path d={`M${px} 180 V${py}`} stroke="#f59e0b" strokeWidth="2" strokeDasharray="5 4"/><path d={`M180 ${py} H${px}`} stroke="#0d9488" strokeWidth="1.4" strokeDasharray="3 4"/><circle cx={px} cy={py} r="7" fill="#2563eb" stroke="#fff" strokeWidth="2"/><text x={px + 9} y={py - 8} fill="#1d4ed8" fontSize="14" fontWeight="700">M</text><text x="325" y="169" fill="#334155" fontSize="12">x</text><text x="189" y="32" fill="#334155" fontSize="12">y</text><text x="186" y="196" fill="#334155" fontSize="11">O</text><text x="252" y="195" fill="#0f766e" fontSize="12">cos α</text><text x="187" y={Math.min(325, py + 14)} fill="#b45309" fontSize="12">sin α</text><path d={`M218 180 A38 38 0 ${angle > 180 ? 1 : 0} 0 ${180 + 38 * Math.cos(-rad)} ${180 + 38 * Math.sin(-rad)}`} fill="none" stroke="#8b5cf6" strokeWidth="2"/></svg><div className="mh-angle-control"><label>α</label><input type="range" min="0" max="359.9" step="0.1" value={angle} onChange={e => setAngle(Number(e.target.value))}/><input type="number" min="0" max="359.9" step="0.1" value={angle.toFixed(1)} onChange={e => setAngle((Number(e.target.value) % 360 + 360) % 360)}/><span>°</span></div></section>
    <section className="mh-tool-card"><h3><Activity size={17}/> Giá trị hiện tại</h3><div className="mh-trig-values">{[['sin α', s], ['cos α', c], ['tan α', t], ['cot α', cot]].map(([label, val]) => <div key={label as string}><small>{label as string}</small><b>{fmt(val as number, 5)}</b></div>)}</div><div className="mh-field"><span>Góc ở dạng</span><div className="mh-segment"><button className={degree ? 'active' : ''} onClick={() => setDegree(true)}>Độ</button><button className={!degree ? 'active' : ''} onClick={() => setDegree(false)}>Radian</button></div></div><div className="mh-trig-angle-readout">α = {degree ? `${fmt(angle, 3)}°` : `${fmt(rad / Math.PI, 4)}π rad`}</div><h3 style={{ marginTop: 16 }}><GitBranch size={17}/> Họ nghiệm lượng giác</h3><div className="mh-field"><span>Phương trình</span><select value={func} onChange={e => setFunc(e.target.value as typeof func)}><option value="sin">sin α = c</option><option value="cos">cos α = c</option><option value="tan">tan α = c</option><option value="cot">cot α = c</option></select></div><div className="mh-field"><span>Giá trị c</span><input value={value} onChange={e => setValue(e.target.value)} type="number" step="0.1"/></div><div className={sol.valid ? 'mh-solution' : 'mh-error'}>{sol.text}</div><label className="mh-check-row"><input type="checkbox" checked={excluded} onChange={e => setExcluded(e.target.checked)}/><i style={{ background: excluded ? '#ef4444' : '#2563eb' }}/><span>Hiện nghiệm dạng điểm loại ×</span></label><div className="mh-solution-points">{sol.valid && sol.roots.map((r, i) => <span key={i} className={excluded ? 'excluded' : ''}>{excluded ? '×' : '○'} {degree ? `${fmt(r, 2)}° + ${(func === 'tan' || func === 'cot') ? '180' : '360'}°k` : `${fmt(r * Math.PI / 180, 4)} rad + ${(func === 'tan' || func === 'cot') ? 'π' : '2π'}k`}</span>)}</div><p className="mh-subtle">k ∈ ℤ. Chu kỳ được đổi theo đơn vị góc đang chọn; các nghiệm trùng tại sin/cos = ±1 đã được gộp.</p></section></div></div>;
}

export function OxyzPanel({ open3D, onInsert }: { open3D: () => void; onInsert: MathHubProps['onInsert'] }) {
  const [A, setA] = useState([1, 2, 3]);
  const [B, setB] = useState([4, 0, -1]);
  const [C, setC] = useState([2, -1, 5]);
  const [showLine, setShowLine] = useState(true);
  const vecAB = B.map((v, i) => v - A[i]);
  const vecAC = C.map((v, i) => v - A[i]);
  const crossABAC = [
    vecAB[1] * vecAC[2] - vecAB[2] * vecAC[1],
    vecAB[2] * vecAC[0] - vecAB[0] * vecAC[2],
    vecAB[0] * vecAC[1] - vecAB[1] * vecAC[0],
  ];
  const crossNorm = Math.hypot(...crossABAC);
  const distance = Math.hypot(...vecAB);
  const midpoint = A.map((v, i) => (v + B[i]) / 2);
  const centroid = A.map((v, i) => (v + B[i] + C[i]) / 3);
  const directionCosines = distance > 1e-9 ? vecAB.map(v => v / distance) : null;
  const distCtoLineAB = distance > 1e-9 ? crossNorm / distance : NaN;
  const planeD = crossABAC[0] * A[0] + crossABAC[1] * A[1] + crossABAC[2] * A[2];
  const setCoord = (set: (v: number[]) => void, arr: number[], i: number, value: string) => set(arr.map((v, j) => (i === j ? (Number(value) || 0) : v)));
  const insert = () => {
    const ax = 330 + A[0] * 26 - A[1] * 10, ay = 300 - A[2] * 25 - A[1] * 10;
    const bx = 330 + B[0] * 26 - B[1] * 10, by = 300 - B[2] * 25 - B[1] * 10;
    const cx = 330 + C[0] * 26 - C[1] * 10, cy = 300 - C[2] * 25 - C[1] * 10;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="430" viewBox="0 0 760 430"><rect width="100%" height="100%" fill="#fff"/><g stroke="#e2e8f0" stroke-width="1">${Array.from({ length: 21 }, (_, i) => `<path d="M${60 + i * 30} 30V380 M60 ${35 + i * 17}H690"/>`).join('')}</g><path d="M100 320L650 320 M100 320L100 45 M100 320L50 370" stroke="#475569" stroke-width="2"/><text x="655" y="324" font-size="16">x</text><text x="95" y="38" font-size="16">z</text><text x="38" y="386" font-size="16">y</text><circle cx="${ax}" cy="${ay}" r="6" fill="#2563eb"/><circle cx="${bx}" cy="${by}" r="6" fill="#e11d48"/><circle cx="${cx}" cy="${cy}" r="6" fill="#0d9488"/><text x="${ax + 8}" y="${ay - 9}" font-size="13" fill="#1d4ed8">A(${A.join('; ')})</text><text x="${bx + 8}" y="${by - 9}" font-size="13" fill="#be123c">B(${B.join('; ')})</text><text x="${cx + 8}" y="${cy - 9}" font-size="13" fill="#0f766e">C(${C.join('; ')})</text><circle cx="${(ax + bx) / 2}" cy="${(ay + by) / 2}" r="4" fill="#16a34a"/><text x="${(ax + bx) / 2 + 7}" y="${(ay + by) / 2 - 7}" font-size="12" fill="#15803d">M</text>${showLine ? `<path d="M${ax} ${ay}L${bx} ${by}L${cx} ${cy}Z" fill="#ede9fe" fill-opacity="0.35" stroke="#7c3aed" stroke-width="2.2"/>` : ''}</svg>`;
    onInsert(svgUri(svg), 'Hệ tọa độ Oxyz (A, B, C)', 760 / 430);
  };
  return <div className="mh-page"><div className="mh-page-heading"><div><span className="mh-kicker">HÌNH HỌC GIẢI TÍCH</span><h1>Hệ tọa độ không gian Oxyz</h1><p>Nhập tọa độ A, B, C để tính vectơ, tích có hướng, khoảng cách, diện tích tam giác, mặt phẳng (ABC) và mặt cầu.</p></div><button className="mh-primary-button mh-inline" onClick={open3D}><Axis3D size={16}/> Mở trình dựng 3D</button></div><div className="mh-oxyz-layout"><section className="mh-tool-card"><h3><Axis3D size={17}/> Nhập tọa độ</h3>{[['A', A, setA], ['B', B, setB], ['C', C, setC]].map(([name, arr, set]) => <div className="mh-point-editor" key={name as string}><b>{name as string}</b>{(arr as number[]).map((v, i) => <label key={i}>{['x', 'y', 'z'][i]}<input type="number" value={v} onChange={e => setCoord(set as (v: number[]) => void, arr as number[], i, e.target.value)}/></label>)}</div>)}<label className="mh-check-row"><input type="checkbox" checked={showLine} onChange={e => setShowLine(e.target.checked)}/><i style={{ background: '#7c3aed' }}/><span>Hiện tam giác ABC trên hình chiếu minh họa</span></label><button className="mh-primary-button" onClick={insert}>Chèn minh họa lên trang</button></section><section className="mh-tool-card"><h3><Ruler size={17}/> Kết quả</h3><div className="mh-formula-block"><small>Vectơ AB và AC</small><b>AB = ({vecAB.map(v => fmt(v, 4)).join('; ')}) · AC = ({vecAC.map(v => fmt(v, 4)).join('; ')})</b></div><div className="mh-formula-block"><small>Độ dài AB & Trung điểm M</small><b>|AB| = {fmt(distance, 5)} · M({midpoint.map(v => fmt(v, 4)).join('; ')}) · Trọng tâm G({centroid.map(v => fmt(v, 4)).join('; ')})</b></div><div className="mh-formula-block"><small>Tích có hướng [AB, AC] & Diện tích ΔABC</small><b>[AB, AC] = ({crossABAC.map(v => fmt(v, 4)).join('; ')}) · S(ABC) = {fmt(crossNorm / 2, 5)}</b></div><div className="mh-formula-block"><small>Phương trình mặt phẳng (ABC) & Khoảng cách từ C đến AB</small><b>{crossNorm < 1e-9 ? 'A, B, C thẳng hàng nên không xác định mặt phẳng (ABC) duy nhất.' : `(${fmt(crossABAC[0], 3)})x + (${fmt(crossABAC[1], 3)})y + (${fmt(crossABAC[2], 3)})z = ${fmt(planeD, 3)} · d(C, AB) = ${fmt(distCtoLineAB, 5)}`}</b></div><div className="mh-formula-block"><small>Cosin chỉ phương của AB</small><b>{directionCosines ? `(cos α; cos β; cos γ) = (${directionCosines.map(v => fmt(v, 5)).join('; ')})` : 'Không xác định vì A trùng B.'}</b></div><div className="mh-formula-block"><small>Phương trình tham số đường thẳng AB</small>{distance < 1e-9 ? <b>Không xác định duy nhất vì A = B.</b> : <><b>x = {A[0]} {vecAB[0] >= 0 ? '+' : '−'} {fmt(Math.abs(vecAB[0]), 4)}t</b><b>y = {A[1]} {vecAB[1] >= 0 ? '+' : '−'} {fmt(Math.abs(vecAB[1]), 4)}t</b><b>z = {A[2]} {vecAB[2] >= 0 ? '+' : '−'} {fmt(Math.abs(vecAB[2]), 4)}t</b></>}</div><div className="mh-formula-block"><small>Mặt cầu đường kính AB</small><b>Tâm I({midpoint.map(v => fmt(v, 3)).join('; ')}), bán kính R = {fmt(distance / 2, 5)}</b></div></section></div></div>;
}
