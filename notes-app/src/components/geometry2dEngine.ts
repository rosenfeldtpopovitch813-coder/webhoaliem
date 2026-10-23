export type Vec2 = { x: number; y: number };
export type PlaneConstraint =
  | { type: 'midpoint'; from: string; to: string }
  | { type: 'segment'; from: string; to: string; t: number }
  | { type: 'ray-point'; from: string; through: string; t: number }
  | { type: 'perpendicular-foot'; point: string; lineFrom: string; lineTo: string }
  | { type: 'intersection'; a: string; b: string; c: string; d: string }
  | { type: 'reflect'; point: string; lineFrom: string; lineTo: string }
  | { type: 'rotate'; point: string; center: string; angleDeg: number }
  | { type: 'translate'; point: string; vectorFrom: string; vectorTo: string }
  | { type: 'dilate'; point: string; center: string; factor: number }
  | { type: 'parallel-point'; through: string; lineFrom: string; lineTo: string; factor?: number }
  | { type: 'perpendicular-point'; through: string; lineFrom: string; lineTo: string; factor?: number }
  | { type: 'perpendicular-bisector-point'; from: string; to: string; distance: number }
  | { type: 'angle-bisector-point'; vertex: string; rayA: string; rayB: string; distance: number }
  | { type: 'circle-point'; center: string; radiusPoint: string; angleDeg: number }
  | { type: 'circle-intersection-point'; centerA: string; radiusPointA: string; centerB: string; radiusPointB: string; branch: 1 | -1 }
  | { type: 'tangent-point'; center: string; onCircle: string; distance: number }
  | { type: 'circle-tangent-from-point'; externalPoint: string; center: string; radiusPoint: string; branch: 1 | -1 };

export type PlanePoint = {
  id: string;
  name: string;
  p: Vec2;
  constraint?: PlaneConstraint;
  hidden?: boolean;
  locked?: boolean;
};

export type PlaneLinearObject = {
  id: string;
  kind: 'segment' | 'line' | 'ray' | 'vector' | 'polygon';
  pointIds: string[];
  hidden?: boolean;
};

export type ResolvePlaneResult = {
  points: PlanePoint[];
  unresolvedIds: string[];
  cycleIds: string[];
  degenerateIds: string[];
};

const EPS = 1e-9;
const len2 = (v: Vec2) => v.x * v.x + v.y * v.y;
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x;

function foot(p: Vec2, a: Vec2, b: Vec2): Vec2 | null {
  const d = sub(b, a), den = d.x * d.x + d.y * d.y;
  if (den < EPS) return null;
  return add(a, mul(d, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / den));
}

function intersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
  const r = sub(b, a), s = sub(d, c);
  if (len2(r) < EPS || len2(s) < EPS) return null;
  const den = cross(r, s);
  if (Math.abs(den) < EPS) return null;
  const t = cross(sub(c, a), s) / den;
  return add(a, mul(r, t));
}

/** Extract all point IDs directly referenced by a constraint. */
export function getConstraintDependencies(constraint?: PlaneConstraint): string[] {
  if (!constraint) return [];
  switch (constraint.type) {
    case 'midpoint':
    case 'segment':
    case 'perpendicular-bisector-point':
      return [constraint.from, constraint.to];
    case 'ray-point':
      return [constraint.from, constraint.through];
    case 'perpendicular-foot':
    case 'reflect':
      return [constraint.point, constraint.lineFrom, constraint.lineTo];
    case 'intersection':
      return [constraint.a, constraint.b, constraint.c, constraint.d];
    case 'rotate':
    case 'dilate':
      return [constraint.point, constraint.center];
    case 'translate':
      return [constraint.point, constraint.vectorFrom, constraint.vectorTo];
    case 'parallel-point':
    case 'perpendicular-point':
      return [constraint.through, constraint.lineFrom, constraint.lineTo];
    case 'angle-bisector-point':
      return [constraint.vertex, constraint.rayA, constraint.rayB];
    case 'circle-point':
      return [constraint.center, constraint.radiusPoint];
    case 'circle-intersection-point':
      return [constraint.centerA, constraint.radiusPointA, constraint.centerB, constraint.radiusPointB];
    case 'tangent-point':
      return [constraint.center, constraint.onCircle];
    case 'circle-tangent-from-point':
      return [constraint.externalPoint, constraint.center, constraint.radiusPoint];
  }
}

function compute(constraint: PlaneConstraint, get: (id: string) => PlanePoint | undefined): Vec2 | null {
  const p = (...ids: string[]) => ids.map(id => get(id)?.p);
  if (constraint.type === 'midpoint' || constraint.type === 'segment') {
    const [a, b] = p(constraint.from, constraint.to);
    if (!a || !b) return null;
    const t = constraint.type === 'midpoint' ? 0.5 : Math.max(0, Math.min(1, Number.isFinite(constraint.t) ? constraint.t : 0.5));
    return add(a, mul(sub(b, a), t));
  }
  if (constraint.type === 'ray-point') {
    const [a, b] = p(constraint.from, constraint.through);
    if (!a || !b || len2(sub(b, a)) < EPS || !Number.isFinite(constraint.t)) return null;
    const t = Math.max(0, constraint.t);
    return add(a, mul(sub(b, a), t));
  }
  if (constraint.type === 'perpendicular-foot') {
    const [q, a, b] = p(constraint.point, constraint.lineFrom, constraint.lineTo);
    return q && a && b ? foot(q, a, b) : null;
  }
  if (constraint.type === 'intersection') {
    const [a, b, c, d] = p(constraint.a, constraint.b, constraint.c, constraint.d);
    return a && b && c && d ? intersect(a, b, c, d) : null;
  }
  if (constraint.type === 'reflect') {
    const [q, a, b] = p(constraint.point, constraint.lineFrom, constraint.lineTo);
    if (!q || !a || !b) return null;
    const h = foot(q, a, b);
    return h ? add(h, sub(h, q)) : null;
  }
  if (constraint.type === 'rotate') {
    const [q, center] = p(constraint.point, constraint.center);
    if (!q || !center || !Number.isFinite(constraint.angleDeg)) return null;
    const angle = constraint.angleDeg * Math.PI / 180, v = sub(q, center), c = Math.cos(angle), s = Math.sin(angle);
    return add(center, { x: v.x * c - v.y * s, y: v.x * s + v.y * c });
  }
  if (constraint.type === 'translate') {
    const [q, a, b] = p(constraint.point, constraint.vectorFrom, constraint.vectorTo);
    if (!q || !a || !b) return null;
    return add(q, sub(b, a));
  }
  if (constraint.type === 'dilate') {
    const [q, center] = p(constraint.point, constraint.center);
    if (!q || !center || !Number.isFinite(constraint.factor)) return null;
    return add(center, mul(sub(q, center), constraint.factor));
  }
  if (constraint.type === 'parallel-point' || constraint.type === 'perpendicular-point') {
    const [through, a, b] = p(constraint.through, constraint.lineFrom, constraint.lineTo);
    if (!through || !a || !b) return null;
    const d = sub(b, a);
    if (len2(d) < EPS) return null;
    const direction = constraint.type === 'parallel-point' ? d : { x: -d.y, y: d.x };
    const factor = constraint.factor ?? 1;
    if (!Number.isFinite(factor)) return null;
    return add(through, mul(direction, factor));
  }
  if (constraint.type === 'perpendicular-bisector-point') {
    const [a, b] = p(constraint.from, constraint.to);
    if (!a || !b || !Number.isFinite(constraint.distance)) return null;
    const d = sub(b, a), magnitude = Math.hypot(d.x, d.y);
    if (magnitude < EPS) return null;
    return add(mul(add(a, b), 0.5), { x: -d.y / magnitude * constraint.distance, y: d.x / magnitude * constraint.distance });
  }
  if (constraint.type === 'angle-bisector-point') {
    const [v, a, b] = p(constraint.vertex, constraint.rayA, constraint.rayB);
    if (!v || !a || !b || !Number.isFinite(constraint.distance)) return null;
    const va = sub(a, v), vb = sub(b, v), na = Math.hypot(va.x, va.y), nb = Math.hypot(vb.x, vb.y);
    if (na < EPS || nb < EPS) return null;
    const direction = { x: va.x / na + vb.x / nb, y: va.y / na + vb.y / nb }, dn = Math.hypot(direction.x, direction.y);
    if (dn < EPS) return null;
    return add(v, { x: direction.x / dn * constraint.distance, y: direction.y / dn * constraint.distance });
  }
  if (constraint.type === 'circle-point') {
    const [center, radiusPoint] = p(constraint.center, constraint.radiusPoint);
    if (!center || !radiusPoint || !Number.isFinite(constraint.angleDeg)) return null;
    const v = sub(radiusPoint, center);
    if (len2(v) < EPS) return null;
    const angle = constraint.angleDeg * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    return add(center, { x: v.x * c - v.y * s, y: v.x * s + v.y * c });
  }
  if (constraint.type === 'circle-intersection-point') {
    const [centerA, radiusA, centerB, radiusB] = p(constraint.centerA, constraint.radiusPointA, constraint.centerB, constraint.radiusPointB);
    if (!centerA || !radiusA || !centerB || !radiusB) return null;
    const rA = Math.hypot(radiusA.x - centerA.x, radiusA.y - centerA.y);
    const rB = Math.hypot(radiusB.x - centerB.x, radiusB.y - centerB.y);
    const delta = sub(centerB, centerA), d = Math.hypot(delta.x, delta.y);
    if (![rA, rB, d].every(Number.isFinite) || rA < EPS || rB < EPS || d < EPS || d > rA + rB + EPS || d < Math.abs(rA - rB) - EPS) return null;
    const along = (rA * rA - rB * rB + d * d) / (2 * d);
    const height2 = rA * rA - along * along;
    if (height2 < -EPS) return null;
    const base = add(centerA, mul(delta, along / d));
    const offset = Math.sqrt(Math.max(0, height2)) * (constraint.branch === -1 ? -1 : 1);
    return add(base, { x: -delta.y / d * offset, y: delta.x / d * offset });
  }
  if (constraint.type === 'tangent-point') {
    const [center, onCircle] = p(constraint.center, constraint.onCircle);
    if (!center || !onCircle || !Number.isFinite(constraint.distance)) return null;
    const radius = sub(onCircle, center), magnitude = Math.hypot(radius.x, radius.y);
    if (magnitude < EPS) return null;
    return add(onCircle, { x: -radius.y / magnitude * constraint.distance, y: radius.x / magnitude * constraint.distance });
  }
  if (constraint.type === 'circle-tangent-from-point') {
    const [ext, center, radiusPoint] = p(constraint.externalPoint, constraint.center, constraint.radiusPoint);
    if (!ext || !center || !radiusPoint) return null;
    const r = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y);
    const delta = sub(ext, center), d = Math.hypot(delta.x, delta.y);
    if (r < EPS || d < r - EPS) return null;
    if (Math.abs(d - r) <= EPS) return { x: ext.x, y: ext.y };
    const u = { x: delta.x / d, y: delta.y / d };
    const n = { x: -u.y, y: u.x };
    const cosA = r / d;
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA)) * (constraint.branch === -1 ? -1 : 1);
    return {
      x: center.x + r * (u.x * cosA + n.x * sinA),
      y: center.y + r * (u.y * cosA + n.y * sinA),
    };
  }
  return null;
}

/** Resolve a construction DAG in dependency order. Invalid/circular constraints retain their last valid coordinates and are reported. */
export function resolvePlaneGeometry(basePoints: PlanePoint[], dependentPoints: PlanePoint[]): ResolvePlaneResult {
  const resolved = new Map<string, PlanePoint>();
  for (const point of basePoints) resolved.set(point.id, point);
  const pending = new Map<string, PlanePoint>();
  for (const point of dependentPoints) {
    if (resolved.has(point.id) || pending.has(point.id)) throw new Error(`ID điểm bị trùng: ${point.id}`);
    pending.set(point.id, point);
  }
  let progressed = true, passes = 0;
  while (progressed && pending.size && passes++ <= dependentPoints.length + 1) {
    progressed = false;
    for (const [id, point] of [...pending]) {
      if (!point.constraint) {
        resolved.set(id, point);
        pending.delete(id);
        progressed = true;
        continue;
      }
      const deps = getConstraintDependencies(point.constraint);
      if (deps.some(depId => !resolved.has(depId))) continue;
      const next = compute(point.constraint, key => resolved.get(key));
      if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.y)) continue;
      resolved.set(id, { ...point, p: next });
      pending.delete(id);
      progressed = true;
    }
  }
  const unresolvedIds = [...pending.keys()];
  const cycleIds: string[] = [];
  const degenerateIds: string[] = [];
  const pendingSet = new Set(unresolvedIds);

  for (const id of unresolvedIds) {
    const pt = pending.get(id);
    const deps = getConstraintDependencies(pt?.constraint);
    // Walk dependency graph within pending nodes to see if this node is part of or depends on a cycle
    const visited = new Set<string>();
    const stack = [...deps.filter(d => pendingSet.has(d))];
    let inCycle = false;
    while (stack.length) {
      const curr = stack.pop()!;
      if (curr === id) { inCycle = true; break; }
      if (visited.has(curr)) continue;
      visited.add(curr);
      const nextDeps = getConstraintDependencies(pending.get(curr)?.constraint);
      for (const nd of nextDeps) {
        if (nd === id) { inCycle = true; break; }
        if (pendingSet.has(nd) && !visited.has(nd)) stack.push(nd);
      }
      if (inCycle) break;
    }
    if (inCycle) cycleIds.push(id);
    else degenerateIds.push(id);
  }

  return {
    points: [...basePoints, ...dependentPoints.map(p => resolved.get(p.id) || p)],
    unresolvedIds,
    cycleIds,
    degenerateIds,
  };
}

/** Remove a point and all points/objects that transitively depend on it so no dangling references remain. */
export function removePlanePointCascade(
  dependentPoints: PlanePoint[],
  targetId: string,
  linearObjects: PlaneLinearObject[] = [],
): { remainingPoints: PlanePoint[]; removedIds: string[]; remainingObjects: PlaneLinearObject[] } {
  const removed = new Set<string>([targetId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const point of dependentPoints) {
      if (removed.has(point.id)) continue;
      const deps = getConstraintDependencies(point.constraint);
      if (deps.some(depId => removed.has(depId))) {
        removed.add(point.id);
        changed = true;
      }
    }
  }
  return {
    remainingPoints: dependentPoints.filter(p => !removed.has(p.id)),
    removedIds: [...removed],
    remainingObjects: linearObjects.filter(obj => !obj.pointIds.some(pid => removed.has(pid))),
  };
}

/** Sample the locus of `tracerPointId` as `driverPointId` varies along its segment or circle constraint. */
export function computePlaneLocus(
  basePoints: PlanePoint[],
  dependentPoints: PlanePoint[],
  driverPointId: string,
  tracerPointId: string,
  steps = 72,
): Vec2[] {
  const driver = dependentPoints.find(p => p.id === driverPointId);
  if (!driver?.constraint) return [];
  const c = driver.constraint;
  if (c.type !== 'segment' && c.type !== 'circle-point') return [];
  const count = Math.max(8, Math.min(360, Math.floor(steps)));
  const trace: Vec2[] = [];
  for (let i = 0; i <= count; i++) {
    const ratio = i / count;
    const updatedDriver: PlanePoint = c.type === 'segment'
      ? { ...driver, constraint: { ...c, t: ratio } }
      : { ...driver, constraint: { ...c, angleDeg: ratio * 360 } };
    const list = dependentPoints.map(p => p.id === driverPointId ? updatedDriver : p);
    const res = resolvePlaneGeometry(basePoints, list);
    if (res.unresolvedIds.includes(tracerPointId)) continue;
    const found = res.points.find(p => p.id === tracerPointId);
    if (found && Number.isFinite(found.p.x) && Number.isFinite(found.p.y)) {
      trace.push(found.p);
    }
  }
  return trace;
}

export function segmentLength(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function angleDegrees(vertex: Vec2, rayA: Vec2, rayB: Vec2): number {
  const u = sub(rayA, vertex), w = sub(rayB, vertex);
  const den = Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y);
  if (den < EPS) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, (u.x * w.x + u.y * w.y) / den))) * 180 / Math.PI;
}

export function polygonArea(vertices: Vec2[]): number {
  if (vertices.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}
