import type { GeometryPoint3D } from '../../types/board';

/** Resolve free and dependent geometry points from their persistent definitions. */
export function resolveGeometryPoints(
  basePoints: GeometryPoint3D[],
  constructionPoints: GeometryPoint3D[],
): GeometryPoint3D[] {
  const resolved = new Map<string, GeometryPoint3D>(basePoints.map(point => [point.id, point]));
  const pending = new Map<string, GeometryPoint3D>(constructionPoints.map(point => [point.id, point]));

  // Repeated passes permit a saved dependent point to refer to another dependent point
  // that appears later in the array. If a reference was deleted, retain the last saved
  // coordinate rather than generating NaN coordinates.
  let progressed = true;
  let passes = 0;
  while (progressed && pending.size && passes++ <= constructionPoints.length + 1) {
    progressed = false;
    for (const [id, point] of [...pending]) {
      const constraint = point.constraint;
      if (!constraint) {
        resolved.set(id, point);
        pending.delete(id);
        progressed = true;
        continue;
      }

      const from = resolved.get(constraint.from);
      const to = resolved.get(constraint.to);
      if (!from || !to) continue;

      const t = constraint.type === 'midpoint'
        ? 0.5
        : Math.max(0, Math.min(1, Number.isFinite(constraint.t) ? (constraint.t as number) : 0.5));
      const p: [number, number, number] = [
        from.p[0] + (to.p[0] - from.p[0]) * t,
        from.p[1] + (to.p[1] - from.p[1]) * t,
        from.p[2] + (to.p[2] - from.p[2]) * t,
      ];
      resolved.set(id, { ...point, p });
      pending.delete(id);
      progressed = true;
    }
  }

  return [...basePoints, ...constructionPoints.map(point => resolved.get(point.id) || point)];
}
