export type FoldVec3 = [number, number, number];
export type FaceTreeResult = {
  facePoints: FoldVec3[][];
  connectedFaces: boolean[];
  foldAngles: number[];
  hingeEdges: string[];
  faceComponents: number[][];
  overlappingFaces: [number, number][];
};
type Rotation = { a: FoldVec3; b: FoldVec3; angle: number };

const sub = (a: FoldVec3, b: FoldVec3): FoldVec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: FoldVec3, b: FoldVec3): FoldVec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: FoldVec3, k: number): FoldVec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: FoldVec3, b: FoldVec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: FoldVec3, b: FoldVec3): FoldVec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: FoldVec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: FoldVec3): FoldVec3 => mul(a, 1 / Math.max(norm(a), 1e-12));
const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

function faceNormal(face: number[], points: FoldVec3[]): FoldVec3 {
  if (face.length < 3) return [0, 0, 1];
  return unit(cross(sub(points[face[1]], points[face[0]]), sub(points[face[2]], points[face[0]])));
}

function centroid(face: number[], points: FoldVec3[]): FoldVec3 {
  return mul(
    face.reduce((s, i) => add(s, points[i]), [0, 0, 0] as FoldVec3),
    1 / Math.max(1, face.length),
  );
}

function rotateAround(point: FoldVec3, rotation: Rotation): FoldVec3 {
  const axis = unit(sub(rotation.b, rotation.a)), v = sub(point, rotation.a);
  const c = Math.cos(rotation.angle), s = Math.sin(rotation.angle);
  // Rodrigues' formula: preserves all lengths and internal face angles up to floating-point error.
  const rotated = add(add(mul(v, c), mul(cross(axis, v), s)), mul(axis, dot(axis, v) * (1 - c)));
  return add(rotation.a, rotated);
}

function applyOps(point: FoldVec3, ops: Rotation[]): FoldVec3 {
  return ops.reduce((p, r) => rotateAround(p, r), point);
}

/**
 * Winding-independent local flatten angle: rotates the child face around the shared hinge (edgeA -> edgeB)
 * so that the child face's perpendicular offset from the hinge lies in the parent face's plane and points
 * directly away from the parent face's centroid (uOut = -uIn).
 */
function localFlattenAngle(
  parent: number,
  child: number,
  edgeA: number,
  edgeB: number,
  faces: number[][],
  points: FoldVec3[],
): number {
  const edgeDir = unit(sub(points[edgeB], points[edgeA]));
  const a = points[edgeA];
  const vParent = sub(centroid(faces[parent], points), a);
  const vChild = sub(centroid(faces[child], points), a);
  const uIn = unit(sub(vParent, mul(edgeDir, dot(vParent, edgeDir))));
  const uOut = mul(uIn, -1);
  const uChild = unit(sub(vChild, mul(edgeDir, dot(vChild, edgeDir))));
  return Math.atan2(dot(edgeDir, cross(uChild, uOut)), dot(uChild, uOut));
}

type Vec2D = [number, number];

function polygonsOverlap2D(polyA: Vec2D[], polyB: Vec2D[], margin = 1e-3): boolean {
  if (polyA.length < 3 || polyB.length < 3) return false;
  // Shrink each polygon slightly toward its centroid so shared boundary hinges/vertices do not trigger overlap.
  const shrink = (poly: Vec2D[]): Vec2D[] => {
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    return poly.map(([x, y]) => [cx + (x - cx) * (1 - margin), cy + (y - cy) * (1 - margin)]);
  };
  const a = shrink(polyA);
  const b = shrink(polyB);
  const axes: Vec2D[] = [];
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
      const len = Math.hypot(dx, dy);
      if (len > 1e-9) axes.push([-dy / len, dx / len]);
    }
  }
  for (const [ax, ay] of axes) {
    let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
    for (const [x, y] of a) { const proj = x * ax + y * ay; if (proj < minA) minA = proj; if (proj > maxA) maxA = proj; }
    for (const [x, y] of b) { const proj = x * ax + y * ay; if (proj < minB) minB = proj; if (proj > maxB) maxB = proj; }
    if (maxA <= minB + 1e-6 || maxB <= minA + 1e-6) return false;
  }
  return true;
}

function detectOverlappingUnfoldedFaces(
  facePoints: FoldVec3[][],
  connected: boolean[],
  rootFaceIndex: number,
): [number, number][] {
  const rootPts = facePoints[rootFaceIndex];
  if (!rootPts || rootPts.length < 3) return [];
  const origin = rootPts[0];
  const n = faceNormal([0, 1, 2], rootPts);
  const u = unit(sub(rootPts[1], origin));
  const v = unit(cross(n, u));
  const project2D = (poly: FoldVec3[]): Vec2D[] => poly.map(p => {
    const d = sub(p, origin);
    return [dot(d, u), dot(d, v)];
  });
  const projected = facePoints.map((fp, fi) => (connected[fi] ? project2D(fp) : []));
  const overlaps: [number, number][] = [];
  for (let i = 0; i < facePoints.length; i++) {
    if (!connected[i]) continue;
    for (let j = i + 1; j < facePoints.length; j++) {
      if (!connected[j]) continue;
      if (polygonsOverlap2D(projected[i], projected[j])) {
        overlaps.push([i, j]);
      }
    }
  }
  return overlaps;
}

/**
 * Folds/unfolds polygon faces with rigid rotations around shared edges.
 * progress=0 is the original solid; progress=1 is fully unfolded. Cut edges stop propagation,
 * allowing the face graph to separate into multiple components.
 */
export function rigidFoldFacePositions(
  points: FoldVec3[],
  faces: number[][],
  rootFaceIndex = 0,
  progress = 0,
  cutEdges: string[] = [],
): FaceTreeResult {
  const t = Math.max(0, Math.min(1, progress));
  const root = Math.max(0, Math.min(Math.max(0, faces.length - 1), rootFaceIndex));
  const edgeOwners = new Map<string, { a: number; b: number; owners: number[] }>();
  faces.forEach((face, fi) => {
    for (let i = 0; i < face.length; i++) {
      const a = face[i], b = face[(i + 1) % face.length], key = edgeKey(a, b), old = edgeOwners.get(key);
      if (old) old.owners.push(fi);
      else edgeOwners.set(key, { a, b, owners: [fi] });
    }
  });
  const graph = new Map<number, { face: number; a: number; b: number; key: string }[]>();
  faces.forEach((_, i) => graph.set(i, []));
  for (const [key, e] of edgeOwners) {
    if (e.owners.length !== 2 || cutEdges.includes(key)) continue;
    const [a, b] = e.owners;
    graph.get(a)?.push({ face: b, a: e.a, b: e.b, key });
    graph.get(b)?.push({ face: a, a: e.a, b: e.b, key });
  }
  const connected = faces.map(() => false);
  const ops: (Rotation[] | null)[] = faces.map(() => null);
  const angles = faces.map(() => 0);
  const queue = [root];
  const hingeEdges: string[] = [];
  connected[root] = true;
  ops[root] = [];

  while (queue.length) {
    const parent = queue.shift()!, parentOps = ops[parent] || [];
    const transformedPoints = points.map(point => applyOps(point, parentOps));
    for (const link of graph.get(parent) || []) {
      if (connected[link.face]) continue;
      const angle = localFlattenAngle(parent, link.face, link.a, link.b, faces, transformedPoints) * t;
      angles[link.face] = angle;
      ops[link.face] = [...parentOps, { a: transformedPoints[link.a], b: transformedPoints[link.b], angle }];
      hingeEdges.push(link.key);
      connected[link.face] = true;
      queue.push(link.face);
    }
  }

  const facePoints = faces.map((face, fi) => face.map(idx => applyOps(points[idx], ops[fi] || [])));
  const overlappingFaces = t >= 0.99 ? detectOverlappingUnfoldedFaces(facePoints, connected, root) : [];
  return {
    facePoints,
    connectedFaces: connected,
    foldAngles: angles,
    hingeEdges,
    faceComponents: connectedFaceComponents(faces, cutEdges),
    overlappingFaces,
  };
}

export function modelEdgeKeyByName(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Connected face groups after the selected hinges are cut. A group is a physically separate net piece. */
export function connectedFaceComponents(faces: number[][], cutEdges: string[] = []): number[][] {
  const owners = new Map<string, number[]>();
  faces.forEach((face, fi) => {
    for (let i = 0; i < face.length; i++) {
      const key = edgeKey(face[i], face[(i + 1) % face.length]), list = owners.get(key) || [];
      list.push(fi);
      owners.set(key, list);
    }
  });
  const adjacency = faces.map(() => new Set<number>());
  for (const [key, list] of owners) {
    if (cutEdges.includes(key) || list.length < 2) continue;
    for (const a of list) for (const b of list) if (a !== b) adjacency[a].add(b);
  }
  const seen = new Set<number>(), components: number[][] = [];
  for (let start = 0; start < faces.length; start++) {
    if (seen.has(start)) continue;
    const group: number[] = [], queue = [start];
    seen.add(start);
    while (queue.length) {
      const face = queue.shift()!;
      group.push(face);
      for (const next of adjacency[face]) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    components.push(group.sort((a, b) => a - b));
  }
  return components;
}
