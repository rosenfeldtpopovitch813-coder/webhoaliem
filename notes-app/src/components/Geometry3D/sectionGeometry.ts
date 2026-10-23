export type Vec3 = [number, number, number];
export type Plane3 = { a: number; b: number; c: number; d: number };
export type NamedEdge = { a: number; b: number; label?: string };
export type SectionResult = {
  plane: Plane3 | null;
  points: Vec3[];
  crossingEdges: string[];
  coplanarEdges: string[];
  touchingEdges: string[];
  steps: string[];
  error?: string;
};

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

export function planeFromThreePoints(p: Vec3, q: Vec3, r: Vec3, eps = 1e-8): Plane3 | null {
  const n = cross(sub(q, p), sub(r, p));
  if (norm(n) < eps) return null;
  return { a: n[0], b: n[1], c: n[2], d: dot(n, p) };
}

export function sortSectionPolygon(points: Vec3[], normal: Vec3): Vec3[] {
  if (points.length < 3 || norm(normal) < 1e-10) return [];
  const center: Vec3 = [0, 1, 2].map(k => points.reduce((sum, p) => sum + p[k], 0) / points.length) as Vec3;
  const n = normal.map(v => v / norm(normal)) as Vec3;
  const axis: Vec3 = Math.abs(n[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
  const uRaw = cross(n, axis);
  const u = uRaw.map(v => v / Math.max(norm(uRaw), 1e-12)) as Vec3;
  const v = cross(n, u);
  const sorted = [...points].sort((p, q) => {
    const dp = sub(p, center), dq = sub(q, center);
    return Math.atan2(dot(dp, v), dot(dp, u)) - Math.atan2(dot(dq, v), dot(dq, u));
  });
  // Verify the sorted points are not collinear (non-zero 3D polygon area)
  let areaVec: Vec3 = [0, 0, 0];
  for (let i = 1; i < sorted.length - 1; i++) {
    const c = cross(sub(sorted[i], sorted[0]), sub(sorted[i + 1], sorted[0]));
    areaVec = [areaVec[0] + c[0], areaVec[1] + c[1], areaVec[2] + c[2]];
  }
  if (norm(areaVec) * 0.5 <= 1e-7) return [];
  return sorted;
}

export function intersectPlaneEdges(
  points: Vec3[],
  edges: NamedEdge[],
  plane: Plane3,
  eps = 1e-8,
): { points: Vec3[]; crossingEdges: string[]; coplanarEdges: string[]; touchingEdges: string[] } {
  if (norm([plane.a, plane.b, plane.c]) < eps) {
    return { points: [], crossingEdges: [], coplanarEdges: [], touchingEdges: [] };
  }
  const values = points.map(p => plane.a * p[0] + plane.b * p[1] + plane.c * p[2] - plane.d);
  const out: Vec3[] = [];
  const crossingEdges: string[] = [];
  const coplanarEdges: string[] = [];
  const touchingEdges: string[] = [];
  const add = (p: Vec3) => {
    if (!out.some(q => norm(sub(p, q)) < 1e-6)) out.push(p);
  };
  for (const [index, e] of edges.entries()) {
    const p = points[e.a], q = points[e.b], fp = values[e.a], fq = values[e.b];
    if (!p || !q || !Number.isFinite(fp) || !Number.isFinite(fq)) continue;
    const label = e.label || `Cạnh ${index + 1}`;
    const pOn = Math.abs(fp) <= eps, qOn = Math.abs(fq) <= eps;
    if (pOn) add(p);
    if (qOn) add(q);
    if (pOn && qOn) {
      coplanarEdges.push(label);
      continue;
    }
    if (pOn || qOn) touchingEdges.push(label);
    if ((fp > eps && fq < -eps) || (fp < -eps && fq > eps)) {
      const t = fp / (fp - fq);
      add([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
      crossingEdges.push(label);
    }
  }
  const polygon = out.length >= 3 ? sortSectionPolygon(out, [plane.a, plane.b, plane.c]) : [];
  return {
    points: polygon.length >= 3 ? polygon : out,
    crossingEdges,
    coplanarEdges,
    touchingEdges,
  };
}

export function buildSectionResult(
  points: Vec3[],
  names: string[],
  edges: NamedEdge[],
  chosen: [number, number, number],
): SectionResult {
  const [ia, ib, ic] = chosen;
  const a = points[ia], b = points[ib], c = points[ic];
  if (!a || !b || !c) {
    return { plane: null, points: [], crossingEdges: [], coplanarEdges: [], touchingEdges: [], steps: [], error: 'Không tìm đủ ba điểm đã chọn.' };
  }
  const plane = planeFromThreePoints(a, b, c);
  if (!plane) {
    return { plane: null, points: [], crossingEdges: [], coplanarEdges: [], touchingEdges: [], steps: [], error: 'Ba điểm thẳng hàng hoặc quá gần nhau; không xác định được mặt phẳng duy nhất.' };
  }
  const hit = intersectPlaneEdges(points, edges, plane);
  const fmt = (n: number) => (Math.abs(n) < 1e-8 ? '0' : Number(n.toFixed(3)).toString());
  const eq = `(${fmt(plane.a)})x + (${fmt(plane.b)})y + (${fmt(plane.c)})z = ${fmt(plane.d)}`;
  const steps = [
    `Bước 1. Chọn ba điểm ${names[ia] || 'P'}, ${names[ib] || 'Q'}, ${names[ic] || 'R'} không thẳng hàng.`,
    `Bước 2. Lập vectơ pháp tuyến n = (Q − P) × (R − P) = (${fmt(plane.a)}; ${fmt(plane.b)}; ${fmt(plane.c)}).`,
    `Bước 3. Phương trình mặt phẳng: ${eq}.`,
    `Bước 4. Xét lần lượt các cạnh của khối; nội suy cạnh cắt, giữ đỉnh nằm trên mặt phẳng và nhận diện cạnh đồng phẳng.`,
    `Bước 5. Có ${hit.crossingEdges.length} cạnh cắt xuyên qua, ${hit.touchingEdges.length} cạnh chạm tại đỉnh và ${hit.coplanarEdges.length} cạnh nằm trong mặt phẳng cắt.`,
    `Bước 6. Thu được ${hit.points.length} đỉnh thiết diện${hit.points.length >= 3 ? ', sắp xếp theo thứ tự quanh mặt phẳng để nối thành đa giác.' : '. Chưa đủ ba đỉnh không thẳng hàng để tạo đa giác thiết diện.'}`,
  ];
  return { plane, points: hit.points, crossingEdges: hit.crossingEdges, coplanarEdges: hit.coplanarEdges, touchingEdges: hit.touchingEdges, steps };
}
