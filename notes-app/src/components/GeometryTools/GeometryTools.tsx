import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  type ChangeEvent as ReactChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { LinePattern, Point, Stroke, W, H } from '../../types/board';
import './geometry-tools.css';

// Khổ giấy A4 chuẩn: 210 mm × 297 mm ứng với 794 × 1123 px
export const PX_PER_CM = W / 21; // ~37.8095238 px / cm
export const PX_PER_MM = PX_PER_CM / 10;

export type GeometryToolKind = 'ruler' | 'setSquare' | 'protractor' | 'compass';
export type SetSquareVariant = '45' | '30-60';
export type QuickGeometryAction = 'primary' | 'secondary' | 'markCenter';

export type SnapTargetId =
  | 'ruler-top'
  | 'ruler-bottom'
  | 'square-bottom'
  | 'square-left'
  | 'square-hyp'
  | 'protractor-arc'
  | 'protractor-base'
  | 'protractor-ray'
  | 'compass-arc';

export interface GeometryToolState {
  open: boolean;
  kind: GeometryToolKind;
  x: number;
  y: number;
  angle: number;
  rulerCm: number;
  squareCm: number;
  squareVariant: SetSquareVariant;
  squareFlipX: boolean;
  protractorRadius: number;
  protractorRayDeg: number;
  compassRadius: number;
  compassAngle: number;
  snapEnabled: boolean;
  snapAngleStep: boolean;
}

export interface LiveSnapFeedback {
  targetId: SnapTargetId;
  label: string;
  subLabel?: string;
  worldStart: { x: number; y: number };
  worldEnd: { x: number; y: number };
  startAngleDeg?: number;
  endAngleDeg?: number;
  sweepDeg?: number;
}

export interface SnapSession {
  targetId: SnapTargetId;
  initialTargetId: SnapTargetId;
  startLocal: { x: number; y: number };
  lastLocal: { x: number; y: number };
  startWorld: { x: number; y: number };
  lastWorld: { x: number; y: number };
  startAngleRad?: number;
  lastAngleRad?: number;
  accumulatedSweepRad?: number;
  cornerPassed?: boolean;
  feedback: LiveSnapFeedback;
}

export type GeometryStateUpdater =
  | GeometryToolState
  | ((prev: GeometryToolState) => GeometryToolState);

export const DEFAULT_GEOMETRY_TOOL_STATE: GeometryToolState = {
  open: false,
  kind: 'ruler',
  x: Math.round(W / 2),
  y: 340,
  angle: 0,
  rulerCm: 15,
  squareCm: 11,
  squareVariant: '30-60',
  squareFlipX: false,
  protractorRadius: 175,
  protractorRayDeg: 60,
  compassRadius: Math.round(3.5 * PX_PER_CM),
  compassAngle: 0,
  snapEnabled: true,
  snapAngleStep: false,
};

let currentGeoState: GeometryToolState = { ...DEFAULT_GEOMETRY_TOOL_STATE };
const geoListeners = new Set<() => void>();
const quickActionListeners = new Set<(action: QuickGeometryAction) => void>();

export function getGeometryToolState(): GeometryToolState {
  return currentGeoState;
}

export function updateGeometryToolState(updater: GeometryStateUpdater): void {
  currentGeoState =
    typeof updater === 'function' ? updater(currentGeoState) : updater;
  geoListeners.forEach((fn: () => void) => fn());
}

export function useGeometryToolState(): [
  GeometryToolState,
  (updater: GeometryStateUpdater) => void
] {
  const [state, setState] = useState<GeometryToolState>(() => currentGeoState);
  useEffect(() => {
    const listener = (): void => setState(currentGeoState);
    geoListeners.add(listener);
    listener();
    return () => {
      geoListeners.delete(listener);
    };
  }, []);
  return [state, updateGeometryToolState];
}

export function subscribeQuickGeometryAction(
  cb: (action: QuickGeometryAction) => void
): () => void {
  quickActionListeners.add(cb);
  return () => {
    quickActionListeners.delete(cb);
  };
}

function triggerQuickGeometryAction(action: QuickGeometryAction): void {
  quickActionListeners.forEach((cb: (a: QuickGeometryAction) => void) =>
    cb(action)
  );
}

export function formatCm(px: number, digits: number = 1): string {
  return `${(px / PX_PER_CM).toFixed(digits)} cm`;
}

export function normalizeDeg(deg: number): number {
  let d = (((deg + 180) % 360) + 360) % 360 - 180;
  if (Object.is(d, -0)) d = 0;
  return Math.round(d * 10) / 10;
}

export function snapAngleIfNeeded(
  deg: number,
  snapStep: boolean,
  shiftKey: boolean = false
): number {
  const norm = normalizeDeg(deg);
  if (snapStep || shiftKey) {
    const step = 15;
    return normalizeDeg(Math.round(norm / step) * step);
  }
  const specials = [
    -180, -150, -135, -120, -90, -60, -45, -30, 0, 30, 45, 60, 90, 120, 135,
    150, 180,
  ];
  for (const s of specials) {
    if (Math.abs(norm - s) <= 1.15) return s === -180 ? 180 : s;
  }
  return norm;
}

export function localToWorld(
  lx: number,
  ly: number,
  tx: number,
  ty: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: tx + lx * cos - ly * sin,
    y: ty + lx * sin + ly * cos,
  };
}

export function worldToLocal(
  wx: number,
  wy: number,
  tx: number,
  ty: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = wx - tx;
  const dy = wy - ty;
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos,
  };
}

export function getSetSquareDimensions(state: GeometryToolState): {
  lx: number;
  ly: number;
  sx: number;
} {
  const lx = state.squareCm * PX_PER_CM;
  const ly = state.squareVariant === '45' ? lx : lx * Math.tan(Math.PI / 6);
  const sx = state.squareFlipX ? -1 : 1;
  return { lx, ly, sx };
}

function projectToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): {
  x: number;
  y: number;
  t: number;
  dist: number;
  along: number;
  totalLen: number;
} {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy || 1;
  const totalLen = Math.sqrt(lenSq);
  const rawT = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  const t = Math.max(0, Math.min(1, rawT));
  const x = ax + dx * t;
  const y = ay + dy * t;
  const dist = Math.hypot(px - x, py - y);
  return { x, y, t, dist, along: t * totalLen, totalLen };
}

function getEdgeDefinitionLocal(
  targetId: SnapTargetId,
  state: GeometryToolState
): {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  nx: number;
  ny: number;
} | null {
  const EDGE_OFFSET = 1.5;
  if (targetId === 'ruler-top') {
    const half = (state.rulerCm * PX_PER_CM) / 2;
    const h = 36 + EDGE_OFFSET;
    return { ax: -half, ay: -h, bx: half, by: -h, nx: 0, ny: -1 };
  }
  if (targetId === 'ruler-bottom') {
    const half = (state.rulerCm * PX_PER_CM) / 2;
    const h = 36 + EDGE_OFFSET;
    return { ax: -half, ay: h, bx: half, by: h, nx: 0, ny: 1 };
  }
  if (
    targetId === 'square-bottom' ||
    targetId === 'square-left' ||
    targetId === 'square-hyp'
  ) {
    const { lx, ly, sx } = getSetSquareDimensions(state);
    if (targetId === 'square-bottom') {
      return {
        ax: 0,
        ay: EDGE_OFFSET,
        bx: sx * lx,
        by: EDGE_OFFSET,
        nx: 0,
        ny: 1,
      };
    }
    if (targetId === 'square-left') {
      return {
        ax: -sx * EDGE_OFFSET,
        ay: 0,
        bx: -sx * EDGE_OFFSET,
        by: -ly,
        nx: -sx,
        ny: 0,
      };
    }
    const dx = sx * lx;
    const dy = ly;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (sx * ly) / len;
    const ny = -lx / len;
    return {
      ax: nx * EDGE_OFFSET,
      ay: -ly + ny * EDGE_OFFSET,
      bx: sx * lx + nx * EDGE_OFFSET,
      by: ny * EDGE_OFFSET,
      nx,
      ny,
    };
  }
  if (targetId === 'protractor-base') {
    const r = state.protractorRadius;
    return {
      ax: -r,
      ay: 12 + EDGE_OFFSET,
      bx: r,
      by: 12 + EDGE_OFFSET,
      nx: 0,
      ny: 1,
    };
  }
  if (targetId === 'protractor-ray') {
    const r = state.protractorRadius;
    const rad = (state.protractorRayDeg * Math.PI) / 180;
    return {
      ax: 0,
      ay: 0,
      bx: r * Math.cos(rad),
      by: -r * Math.sin(rad),
      nx: 0,
      ny: 0,
    };
  }
  return null;
}

export function findSnapTarget(
  p: { x: number; y: number },
  state: GeometryToolState,
  snapRadius: number = 28
): SnapTargetId | null {
  if (!state.open || !state.snapEnabled) return null;
  const local = worldToLocal(p.x, p.y, state.x, state.y, state.angle);

  if (state.kind === 'ruler') {
    const half = (state.rulerCm * PX_PER_CM) / 2;
    if (local.x < -half - 22 || local.x > half + 22) return null;
    const dTop = Math.abs(local.y - -36);
    const dBot = Math.abs(local.y - 36);
    const canTop = local.y <= -14 && dTop <= snapRadius;
    const canBot = local.y >= 14 && dBot <= snapRadius;
    if (canTop && canBot) return dTop <= dBot ? 'ruler-top' : 'ruler-bottom';
    if (canTop) return 'ruler-top';
    if (canBot) return 'ruler-bottom';
    return null;
  }

  if (state.kind === 'setSquare') {
    const candidates: SnapTargetId[] = [
      'square-bottom',
      'square-left',
      'square-hyp',
    ];
    let best: SnapTargetId | null = null;
    let bestDist = snapRadius;
    for (const id of candidates) {
      const def = getEdgeDefinitionLocal(id, state);
      if (!def) continue;
      const proj = projectToSegment(
        local.x,
        local.y,
        def.ax,
        def.ay,
        def.bx,
        def.by
      );
      if (proj.dist <= bestDist) {
        bestDist = proj.dist;
        best = id;
      }
    }
    return best;
  }

  if (state.kind === 'protractor') {
    const r = state.protractorRadius;
    const distOrigin = Math.hypot(local.x, local.y);
    if (local.y <= 10 && Math.abs(distOrigin - r) <= snapRadius) {
      return 'protractor-arc';
    }
    const rayDef = getEdgeDefinitionLocal('protractor-ray', state);
    if (rayDef) {
      const rayProj = projectToSegment(
        local.x,
        local.y,
        rayDef.ax,
        rayDef.ay,
        rayDef.bx,
        rayDef.by
      );
      if (rayProj.dist <= 20 && distOrigin >= 18) {
        return 'protractor-ray';
      }
    }
    const baseDef = getEdgeDefinitionLocal('protractor-base', state);
    if (baseDef) {
      const baseProj = projectToSegment(
        local.x,
        local.y,
        baseDef.ax,
        baseDef.ay,
        baseDef.bx,
        baseDef.by
      );
      if (baseProj.dist <= snapRadius && local.y >= -6) {
        return 'protractor-base';
      }
    }
    return null;
  }

  if (state.kind === 'compass') {
    const dist = Math.hypot(p.x - state.x, p.y - state.y);
    if (Math.abs(dist - state.compassRadius) <= snapRadius) {
      return 'compass-arc';
    }
    return null;
  }

  return null;
}

function unwrapAngle(prevRad: number, nextRawRad: number): number {
  let delta = nextRawRad - prevRad;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return prevRad + delta;
}

export function startSnapSession(
  p: Point,
  targetId: SnapTargetId,
  state: GeometryToolState
): { session: SnapSession; snappedPoint: Point } {
  const local = worldToLocal(p.x, p.y, state.x, state.y, state.angle);

  if (targetId === 'protractor-arc') {
    const r = state.protractorRadius + 1.5;
    let theta = Math.atan2(-local.y, local.x);
    if (theta < 0) theta = theta > -Math.PI / 2 ? 0 : Math.PI;
    theta = Math.max(0, Math.min(Math.PI, theta));
    const slx = r * Math.cos(theta);
    const sly = -r * Math.sin(theta);
    const sw = localToWorld(slx, sly, state.x, state.y, state.angle);
    const deg = Math.round((theta * 180) / Math.PI);
    const feedback: LiveSnapFeedback = {
      targetId,
      label: `0.0°`,
      subLabel: `Vạch ${deg}° / ${180 - deg}°`,
      worldStart: sw,
      worldEnd: sw,
      startAngleDeg: deg,
      endAngleDeg: deg,
      sweepDeg: 0,
    };
    return {
      session: {
        targetId,
        initialTargetId: targetId,
        startLocal: { x: slx, y: sly },
        lastLocal: { x: slx, y: sly },
        startWorld: sw,
        lastWorld: sw,
        startAngleRad: theta,
        lastAngleRad: theta,
        accumulatedSweepRad: 0,
        feedback,
      },
      snappedPoint: { ...p, x: sw.x, y: sw.y },
    };
  }

  if (targetId === 'compass-arc') {
    const r = state.compassRadius;
    const theta = Math.atan2(p.y - state.y, p.x - state.x);
    const sw = {
      x: state.x + r * Math.cos(theta),
      y: state.y + r * Math.sin(theta),
    };
    const deg = Math.round((theta * 180) / Math.PI);
    const feedback: LiveSnapFeedback = {
      targetId,
      label: `0° · R = ${formatCm(r)}`,
      subLabel: `Quay compa quanh tâm O`,
      worldStart: sw,
      worldEnd: sw,
      startAngleDeg: deg,
      endAngleDeg: deg,
      sweepDeg: 0,
    };
    return {
      session: {
        targetId,
        initialTargetId: targetId,
        startLocal: { x: sw.x - state.x, y: sw.y - state.y },
        lastLocal: { x: sw.x - state.x, y: sw.y - state.y },
        startWorld: sw,
        lastWorld: sw,
        startAngleRad: theta,
        lastAngleRad: theta,
        accumulatedSweepRad: 0,
        feedback,
      },
      snappedPoint: { ...p, x: sw.x, y: sw.y },
    };
  }

  const def = getEdgeDefinitionLocal(targetId, state)!;
  const proj = projectToSegment(
    local.x,
    local.y,
    def.ax,
    def.ay,
    def.bx,
    def.by
  );
  const sw = localToWorld(proj.x, proj.y, state.x, state.y, state.angle);
  const feedback: LiveSnapFeedback = {
    targetId,
    label: `0.0 cm`,
    subLabel: targetId.startsWith('ruler')
      ? `Vạch ${(proj.along / PX_PER_CM).toFixed(1)} cm`
      : targetId === 'protractor-ray'
      ? `Tia góc ${state.protractorRayDeg}°`
      : `Cạnh chuẩn`,
    worldStart: sw,
    worldEnd: sw,
  };
  return {
    session: {
      targetId,
      initialTargetId: targetId,
      startLocal: { x: proj.x, y: proj.y },
      lastLocal: { x: proj.x, y: proj.y },
      startWorld: sw,
      lastWorld: sw,
      feedback,
    },
    snappedPoint: { ...p, x: sw.x, y: sw.y },
  };
}

export function appendSnappedPoint(
  p: Point,
  session: SnapSession,
  state: GeometryToolState
): { session: SnapSession; points: Point[] } {
  const local = worldToLocal(p.x, p.y, state.x, state.y, state.angle);

  if (session.targetId === 'protractor-arc') {
    const r = state.protractorRadius + 1.5;
    let theta = Math.atan2(-local.y, local.x);
    if (theta < 0) theta = theta > -Math.PI / 2 ? 0 : Math.PI;
    theta = Math.max(0, Math.min(Math.PI, theta));

    const prevTheta = session.lastAngleRad ?? theta;
    const diff = theta - prevTheta;
    const steps = Math.max(
      1,
      Math.min(48, Math.ceil(Math.abs(diff) / (Math.PI / 120)))
    );
    const out: Point[] = [];
    for (let i = 1; i <= steps; i++) {
      const a = prevTheta + (diff * i) / steps;
      const lx = r * Math.cos(a);
      const ly = -r * Math.sin(a);
      const w = localToWorld(lx, ly, state.x, state.y, state.angle);
      out.push({ ...p, x: w.x, y: w.y });
    }
    const lastW = out[out.length - 1];
    const startDeg = ((session.startAngleRad ?? theta) * 180) / Math.PI;
    const endDeg = (theta * 180) / Math.PI;
    const sweepDeg = Math.abs(endDeg - startDeg);
    const arcLenCm =
      (r * Math.abs(theta - (session.startAngleRad ?? theta))) / PX_PER_CM;
    const nextSession: SnapSession = {
      ...session,
      lastLocal: { x: r * Math.cos(theta), y: -r * Math.sin(theta) },
      lastWorld: { x: lastW.x, y: lastW.y },
      lastAngleRad: theta,
      feedback: {
        targetId: session.targetId,
        label: `∠ ${sweepDeg.toFixed(1)}°`,
        subLabel: `${Math.round(startDeg)}° → ${Math.round(
          endDeg
        )}° (${arcLenCm.toFixed(1)} cm)`,
        worldStart: session.startWorld,
        worldEnd: { x: lastW.x, y: lastW.y },
        startAngleDeg: startDeg,
        endAngleDeg: endDeg,
        sweepDeg,
      },
    };
    return { session: nextSession, points: out };
  }

  if (session.targetId === 'compass-arc') {
    const r = state.compassRadius;
    const rawTheta = Math.atan2(p.y - state.y, p.x - state.x);
    const prevTheta = session.lastAngleRad ?? rawTheta;
    const nextTheta = unwrapAngle(prevTheta, rawTheta);
    const stepRad = nextTheta - prevTheta;
    const startTheta = session.startAngleRad ?? nextTheta;
    let totalSweep = nextTheta - startTheta;
    if (Math.abs(totalSweep) >= (354 * Math.PI) / 180) {
      totalSweep = Math.sign(totalSweep || 1) * Math.PI * 2;
    }
    const steps = Math.max(
      1,
      Math.min(64, Math.ceil(Math.abs(stepRad) / (Math.PI / 90)))
    );
    const out: Point[] = [];
    for (let i = 1; i <= steps; i++) {
      const a = prevTheta + (stepRad * i) / steps;
      out.push({
        ...p,
        x: state.x + r * Math.cos(a),
        y: state.y + r * Math.sin(a),
      });
    }
    const lastW = out[out.length - 1];
    const sweepDeg = Math.min(360, Math.abs((totalSweep * 180) / Math.PI));
    const nextSession: SnapSession = {
      ...session,
      lastLocal: { x: lastW.x - state.x, y: lastW.y - state.y },
      lastWorld: { x: lastW.x, y: lastW.y },
      lastAngleRad: nextTheta,
      accumulatedSweepRad: totalSweep,
      feedback: {
        targetId: session.targetId,
        label: `${Math.round(sweepDeg)}° · R = ${formatCm(r)}`,
        subLabel:
          sweepDeg >= 359
            ? 'Đường tròn kín 360°'
            : `Cung tròn ${Math.round(sweepDeg)}°`,
        worldStart: session.startWorld,
        worldEnd: { x: lastW.x, y: lastW.y },
        startAngleDeg: (startTheta * 180) / Math.PI,
        endAngleDeg: (nextTheta * 180) / Math.PI,
        sweepDeg,
      },
    };
    return { session: nextSession, points: out };
  }

  let activeTarget = session.targetId;
  const out: Point[] = [];
  if (
    state.kind === 'setSquare' &&
    !session.cornerPassed &&
    (session.targetId === 'square-bottom' || session.targetId === 'square-left')
  ) {
    const otherId: SnapTargetId =
      session.targetId === 'square-bottom' ? 'square-left' : 'square-bottom';
    const curDef = getEdgeDefinitionLocal(session.targetId, state)!;
    const otherDef = getEdgeDefinitionLocal(otherId, state)!;
    const curProj = projectToSegment(
      local.x,
      local.y,
      curDef.ax,
      curDef.ay,
      curDef.bx,
      curDef.by
    );
    const otherProj = projectToSegment(
      local.x,
      local.y,
      otherDef.ax,
      otherDef.ay,
      otherDef.bx,
      otherDef.by
    );
    if (curProj.along < 12 && otherProj.along > 14 && otherProj.dist <= 28) {
      const cornerLocal = { x: otherDef.ax, y: otherDef.ay };
      const cornerWorld = localToWorld(
        cornerLocal.x,
        cornerLocal.y,
        state.x,
        state.y,
        state.angle
      );
      out.push({ ...p, x: cornerWorld.x, y: cornerWorld.y });
      activeTarget = otherId;
      session = {
        ...session,
        targetId: otherId,
        lastLocal: cornerLocal,
        lastWorld: cornerWorld,
        cornerPassed: true,
      };
    }
  }

  const def = getEdgeDefinitionLocal(activeTarget, state)!;
  const proj = projectToSegment(
    local.x,
    local.y,
    def.ax,
    def.ay,
    def.bx,
    def.by
  );
  const targetWorld = localToWorld(
    proj.x,
    proj.y,
    state.x,
    state.y,
    state.angle
  );

  const distMove = Math.hypot(
    targetWorld.x - session.lastWorld.x,
    targetWorld.y - session.lastWorld.y
  );
  const steps = Math.max(1, Math.min(36, Math.ceil(distMove / 3.5)));
  for (let i = 1; i <= steps; i++) {
    const ratio = i / steps;
    out.push({
      ...p,
      x: session.lastWorld.x + (targetWorld.x - session.lastWorld.x) * ratio,
      y: session.lastWorld.y + (targetWorld.y - session.lastWorld.y) * ratio,
    });
  }

  const totalDistPx = Math.hypot(
    targetWorld.x - session.startWorld.x,
    targetWorld.y - session.startWorld.y
  );
  const lengthCm = totalDistPx / PX_PER_CM;
  const lengthMm = Math.round(lengthCm * 10);

  let subLabel = `${lengthMm} mm`;
  if (activeTarget.startsWith('ruler')) {
    const startMark =
      Math.hypot(session.startLocal.x - def.ax, session.startLocal.y - def.ay) /
      PX_PER_CM;
    const endMark = proj.along / PX_PER_CM;
    subLabel = `${startMark.toFixed(1)} cm → ${endMark.toFixed(
      1
    )} cm (${lengthMm} mm)`;
  } else if (session.cornerPassed) {
    subLabel = `Góc vuông 90° · Cạnh 2: ${(proj.along / PX_PER_CM).toFixed(
      1
    )} cm`;
  } else if (activeTarget === 'protractor-ray') {
    subLabel = `Theo tia góc ${state.protractorRayDeg}°`;
  }

  const nextSession: SnapSession = {
    ...session,
    targetId: activeTarget,
    lastLocal: { x: proj.x, y: proj.y },
    lastWorld: targetWorld,
    feedback: {
      targetId: activeTarget,
      label: `${lengthCm.toFixed(1)} cm`,
      subLabel,
      worldStart: session.startWorld,
      worldEnd: targetWorld,
    },
  };

  return { session: nextSession, points: out };
}

export function buildCompassArcStroke(
  centerX: number,
  centerY: number,
  radius: number,
  startRad: number,
  endRad: number,
  settings: {
    color: string;
    width: number;
    opacity: number;
    style: string;
    dash?: LinePattern;
  }
): Stroke {
  let sweep = endRad - startRad;
  if (Math.abs(sweep) >= (354 * Math.PI) / 180) {
    sweep = Math.sign(sweep || 1) * Math.PI * 2;
  }
  const steps = Math.max(
    24,
    Math.min(240, Math.ceil((Math.abs(sweep) * radius) / 3))
  );
  const now = performance.now();
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = startRad + (sweep * i) / steps;
    points.push({
      x: centerX + radius * Math.cos(a),
      y: centerY + radius * Math.sin(a),
      p: 0.62,
      t: now + i * 4,
    });
  }
  return {
    id: crypto.randomUUID(),
    kind: 'stroke',
    points,
    color: settings.color,
    width: Math.max(1.5, settings.width),
    opacity: settings.opacity,
    style: settings.style.startsWith('highlighter')
      ? 'ballpoint'
      : settings.style,
    dash: settings.dash,
    ignorePressure: true,
  };
}

export function buildQuickGeometryStrokes(
  state: GeometryToolState,
  action: QuickGeometryAction,
  settings: {
    color: string;
    width: number;
    opacity: number;
    style: string;
    dash?: LinePattern;
  }
): Stroke[] {
  const makeStroke = (pts: { x: number; y: number }[]): Stroke => {
    const sampled: Point[] = [];
    const now = performance.now();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(2, Math.min(96, Math.ceil(dist / 4)));
      for (let s = 0; s <= steps; s++) {
        if (i > 0 && s === 0) continue;
        const t = s / steps;
        sampled.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          p: 0.62,
          t: now + sampled.length * 4,
        });
      }
    }
    return {
      id: crypto.randomUUID(),
      kind: 'stroke',
      points: sampled,
      color: settings.color,
      width: Math.max(1.5, settings.width),
      opacity: settings.opacity,
      style: settings.style.startsWith('highlighter')
        ? 'ballpoint'
        : settings.style,
      dash: settings.dash,
      ignorePressure: true,
    };
  };

  if (action === 'markCenter') {
    const c = { x: state.x, y: state.y };
    const r = 4.5;
    return [
      makeStroke([
        { x: c.x - r, y: c.y },
        { x: c.x + r, y: c.y },
      ]),
      makeStroke([
        { x: c.x, y: c.y - r },
        { x: c.x, y: c.y + r },
      ]),
    ];
  }

  if (state.kind === 'ruler') {
    const half = (state.rulerCm * PX_PER_CM) / 2;
    const y = action === 'secondary' ? 37.5 : -37.5;
    return [
      makeStroke([
        localToWorld(-half, y, state.x, state.y, state.angle),
        localToWorld(half, y, state.x, state.y, state.angle),
      ]),
    ];
  }

  if (state.kind === 'setSquare') {
    const { lx, ly, sx } = getSetSquareDimensions(state);
    const p0 = localToWorld(0, 0, state.x, state.y, state.angle);
    const px = localToWorld(sx * lx, 0, state.x, state.y, state.angle);
    const py = localToWorld(0, -ly, state.x, state.y, state.angle);
    if (action === 'secondary') {
      return [makeStroke([py, p0, px, py])];
    }
    return [makeStroke([py, p0, px])];
  }

  if (state.kind === 'protractor') {
    const r = state.protractorRadius;
    const rad = (state.protractorRayDeg * Math.PI) / 180;
    if (action === 'secondary') {
      const pts: { x: number; y: number }[] = [];
      const steps = Math.max(16, Math.ceil(state.protractorRayDeg / 2));
      for (let i = 0; i <= steps; i++) {
        const a = (rad * i) / steps;
        pts.push(
          localToWorld(
            (r + 1.5) * Math.cos(a),
            -(r + 1.5) * Math.sin(a),
            state.x,
            state.y,
            state.angle
          )
        );
      }
      return [makeStroke(pts)];
    }
    const pOrigin = localToWorld(0, 0, state.x, state.y, state.angle);
    const pBase = localToWorld(r * 0.82, 0, state.x, state.y, state.angle);
    const pRay = localToWorld(
      r * 0.82 * Math.cos(rad),
      -r * 0.82 * Math.sin(rad),
      state.x,
      state.y,
      state.angle
    );
    const arcPts: { x: number; y: number }[] = [];
    const arcR = 38;
    const steps = Math.max(12, Math.ceil(state.protractorRayDeg / 4));
    for (let i = 0; i <= steps; i++) {
      const a = (rad * i) / steps;
      arcPts.push(
        localToWorld(
          arcR * Math.cos(a),
          -arcR * Math.sin(a),
          state.x,
          state.y,
          state.angle
        )
      );
    }
    return [makeStroke([pBase, pOrigin, pRay]), makeStroke(arcPts)];
  }

  return [
    buildCompassArcStroke(
      state.x,
      state.y,
      state.compassRadius,
      0,
      Math.PI * 2,
      settings
    ),
  ];
}

function computeVisibleSheetCenterY(): number {
  const area = document.querySelector<HTMLElement>('.interactive-board-area');
  const sheet =
    document.querySelector<HTMLElement>('.active-sheet') ||
    document.querySelector<HTMLElement>('.continuous-sheet');
  if (!area || !sheet) return 340;
  const areaRect = area.getBoundingClientRect();
  const sheetRect = sheet.getBoundingClientRect();
  const scale = sheetRect.width / W || 1;
  const top = Math.max(areaRect.top, sheetRect.top);
  const bottom = Math.min(areaRect.bottom, sheetRect.bottom);
  const midY = bottom > top ? (top + bottom) / 2 : sheetRect.top + 340 * scale;
  const localY = (midY - sheetRect.top) / Math.max(0.25, scale);
  return Math.round(
    Math.max(150, Math.min(H - 160, Number.isFinite(localY) ? localY : 340))
  );
}

const TOOL_NAMES: Record<GeometryToolKind, string> = {
  ruler: 'Thước thẳng',
  setSquare: 'Ê ke',
  protractor: 'Đo góc 180°',
  compass: 'Compa',
};

type Props = {
  onClose: () => void;
  onDraw?: (
    kind: GeometryToolKind,
    angle: number,
    length: number,
    radius: number
  ) => void;
};

export default function GeometryTools({ onClose, onDraw: _onDraw }: Props) {
  const [state, setState] = useGeometryToolState();
  const [barOffset, setBarOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const dragRef = useRef<{
    sx: number;
    sy: number;
    ox: number;
    oy: number;
  } | null>(null);

  useEffect(() => {
    updateGeometryToolState((prev: GeometryToolState) => ({
      ...prev,
      open: true,
      x: Math.round(W / 2),
      y: computeVisibleSheetCenterY(),
    }));
    return () => {
      updateGeometryToolState((prev: GeometryToolState) => ({
        ...prev,
        open: false,
      }));
    };
  }, []);

  const setKind = (kind: GeometryToolKind): void => {
    setState((prev: GeometryToolState) => ({ ...prev, kind }));
  };

  const setAngle = (angle: number): void => {
    setState((prev: GeometryToolState) => ({
      ...prev,
      angle: normalizeDeg(angle),
    }));
  };

  return (
    <div
      className="scrble-geo-hud"
      style={{
        transform: `translate(calc(-50% + ${barOffset.x}px), ${barOffset.y}px)`,
      }}
      role="toolbar"
      aria-label="Thanh công cụ hình học Scrble Ink"
    >
      <div
        className="scrble-geo-hud-grip"
        title="Kéo để di chuyển thanh điều khiển"
        onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
          e.preventDefault();
          dragRef.current = {
            sx: e.clientX,
            sy: e.clientY,
            ox: barOffset.x,
            oy: barOffset.y,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e: ReactPointerEvent<HTMLDivElement>) => {
          if (!dragRef.current) return;
          setBarOffset({
            x: dragRef.current.ox + (e.clientX - dragRef.current.sx),
            y: dragRef.current.oy + (e.clientY - dragRef.current.sy),
          });
        }}
        onPointerUp={(e: ReactPointerEvent<HTMLDivElement>) => {
          dragRef.current = null;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {}
        }}
      >
        ⋮⋮
      </div>

      <div className="scrble-geo-tabs">
        {(
          ['ruler', 'setSquare', 'protractor', 'compass'] as GeometryToolKind[]
        ).map((k: GeometryToolKind) => (
          <button
            key={k}
            type="button"
            className={'scrble-geo-tab ' + (state.kind === k ? 'active' : '')}
            onClick={() => setKind(k)}
          >
            {k === 'ruler' && '📏 '}
            {k === 'setSquare' && '📐 '}
            {k === 'protractor' && '⌓ '}
            {k === 'compass' && '🧭 '}
            <span>{TOOL_NAMES[k]}</span>
          </button>
        ))}
      </div>

      <span className="scrble-geo-sep" />

      <button
        type="button"
        className={'scrble-geo-chip ' + (state.snapEnabled ? 'on' : '')}
        title="Tự động hút nét bút vào mép thước / vòm đo góc / compa khi rê bút gần cạnh"
        onClick={() =>
          setState((prev: GeometryToolState) => ({
            ...prev,
            snapEnabled: !prev.snapEnabled,
          }))
        }
      >
        🧲 Bám cạnh: {state.snapEnabled ? 'Bật' : 'Tắt'}
      </button>

      {state.kind !== 'compass' && (
        <div
          className="scrble-geo-angles"
          title="Chọn nhanh góc nghiêng của dụng cụ"
        >
          {[0, 30, 45, 60, 90].map((a: number) => (
            <button
              key={a}
              type="button"
              className={Math.round(Math.abs(state.angle)) === a ? 'on' : ''}
              onClick={() =>
                setAngle(state.angle < 0 && a !== 0 && a !== 90 ? -a : a)
              }
            >
              {a}°
            </button>
          ))}
        </div>
      )}

      {state.kind === 'setSquare' && (
        <>
          <button
            type="button"
            className="scrble-geo-chip"
            title="Đổi loại ê ke vuông cân 45°-45°-90° hoặc 30°-60°-90°"
            onClick={() =>
              setState((prev: GeometryToolState) => ({
                ...prev,
                squareVariant: prev.squareVariant === '45' ? '30-60' : '45',
              }))
            }
          >
            Loại: <b>{state.squareVariant === '45' ? '45°–45°' : '30°–60°'}</b>
          </button>
          <button
            type="button"
            className="scrble-geo-chip"
            title="Lật ngang ê ke"
            onClick={() =>
              setState((prev: GeometryToolState) => ({
                ...prev,
                squareFlipX: !prev.squareFlipX,
              }))
            }
          >
            ⇄ Lật
          </button>
        </>
      )}

      {state.kind === 'protractor' && (
        <label
          className="scrble-geo-inline-input"
          title="Góc của tia ngắm trên thước đo góc"
        >
          Tia góc:
          <input
            type="number"
            min={0}
            max={180}
            step={1}
            value={Math.round(state.protractorRayDeg)}
            onChange={(e: ReactChangeEvent<HTMLInputElement>) =>
              setState((prev: GeometryToolState) => ({
                ...prev,
                protractorRayDeg: Math.max(
                  0,
                  Math.min(180, Number(e.target.value) || 0)
                ),
              }))
            }
          />
          <span>°</span>
        </label>
      )}

      {state.kind === 'compass' && (
        <label
          className="scrble-geo-inline-input"
          title="Bán kính mở của compa (cm trên giấy A4)"
        >
          R =
          <input
            type="number"
            min={0.7}
            max={9.0}
            step={0.1}
            value={Number((state.compassRadius / PX_PER_CM).toFixed(1))}
            onChange={(e: ReactChangeEvent<HTMLInputElement>) => {
              const cm = Math.max(
                0.7,
                Math.min(9.0, Number(e.target.value) || 1)
              );
              setState((prev: GeometryToolState) => ({
                ...prev,
                compassRadius: Math.round(cm * PX_PER_CM),
              }));
            }}
          />
          <span>cm</span>
        </label>
      )}

      <span className="scrble-geo-sep" />

      <div className="scrble-geo-quick-actions">
        {(state.kind === 'protractor' || state.kind === 'compass') && (
          <button
            type="button"
            className="scrble-geo-action-btn"
            title="Đánh dấu tâm O trên giấy"
            onClick={() => triggerQuickGeometryAction('markCenter')}
          >
            ⊹ Chấm tâm
          </button>
        )}
        <button
          type="button"
          className="scrble-geo-action-btn primary"
          title="Dựng nét nhanh theo vị trí dụng cụ hiện tại"
          onClick={() => triggerQuickGeometryAction('primary')}
        >
          {state.kind === 'ruler' && '✏️ Kẻ mép trên'}
          {state.kind === 'setSquare' && '✏️ Kẻ góc vuông'}
          {state.kind === 'protractor' &&
            `✏️ Kẻ góc ${Math.round(state.protractorRayDeg)}°`}
          {state.kind === 'compass' && '✏️ Quay 360°'}
        </button>
        {state.kind === 'protractor' && (
          <button
            type="button"
            className="scrble-geo-action-btn"
            title="Vẽ cung tròn theo góc tia ngắm"
            onClick={() => triggerQuickGeometryAction('secondary')}
          >
            ⌒ Vẽ cung
          </button>
        )}
        {state.kind === 'setSquare' && (
          <button
            type="button"
            className="scrble-geo-action-btn"
            title="Kẻ khép kín 3 cạnh tam giác"
            onClick={() => triggerQuickGeometryAction('secondary')}
          >
            △ Kẻ 3 cạnh
          </button>
        )}
      </div>

      <button
        type="button"
        className="scrble-geo-icon-btn"
        title="Đưa dụng cụ về giữa khung nhìn trang giấy"
        onClick={() =>
          setState((prev: GeometryToolState) => ({
            ...prev,
            x: Math.round(W / 2),
            y: computeVisibleSheetCenterY(),
          }))
        }
      >
        ⌖
      </button>
      <button
        type="button"
        className="scrble-geo-icon-btn close"
        title="Đóng dụng cụ hình học"
        aria-label="Đóng dụng cụ hình học"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}

type OverlayProps = {
  state: GeometryToolState;
  onChange: (updater: GeometryStateUpdater) => void;
  penColor: string;
  penWidth: number;
  penOpacity: number;
  penStyle: string;
  penDash?: LinePattern;
  hoveredSnap: SnapTargetId | null;
  liveFeedback: LiveSnapFeedback | null;
  onCommitStroke: (stroke: Stroke) => void;
};

type DragGesture =
  | {
      mode: 'move';
      startWorld: { x: number; y: number };
      origX: number;
      origY: number;
    }
  | {
      mode: 'rotate';
      pivotWorld: { x: number; y: number };
      localPivot: { x: number; y: number };
      lastAngleRad: number;
      accumAngleDeg: number;
    }
  | {
      mode: 'resize-ruler';
      side: 1 | -1;
    }
  | {
      mode: 'resize-square';
    }
  | {
      mode: 'resize-protractor';
    }
  | {
      mode: 'protractor-ray';
    }
  | {
      mode: 'compass-radius';
    }
  | {
      mode: 'compass-rotate-idle';
    }
  | {
      mode: 'compass-draw';
      startRad: number;
      lastRad: number;
      currentRad: number;
    };

export function GeometryCanvasOverlay({
  state,
  onChange,
  penColor,
  penWidth,
  penOpacity,
  penStyle,
  penDash,
  hoveredSnap,
  liveFeedback,
  onCommitStroke,
}: OverlayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gestureRef = useRef<DragGesture | null>(null);
  const [compassSweep, setCompassSweep] = useState<{
    startRad: number;
    currentRad: number;
  } | null>(null);

  if (!state.open) return null;

  const clientToWorld = (
    clientX: number,
    clientY: number
  ): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: state.x, y: state.y };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * W) / Math.max(1, rect.width),
      y: ((clientY - rect.top) * H) / Math.max(1, rect.height),
    };
  };

  const beginMove = (e: ReactPointerEvent<SVGElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    const w = clientToWorld(e.clientX, e.clientY);
    gestureRef.current = {
      mode: 'move',
      startWorld: w,
      origX: state.x,
      origY: state.y,
    };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const beginRotate = (
    e: ReactPointerEvent<SVGElement>,
    localPivot: { x: number; y: number } = { x: 0, y: 0 }
  ): void => {
    e.preventDefault();
    e.stopPropagation();
    const pivotWorld = localToWorld(
      localPivot.x,
      localPivot.y,
      state.x,
      state.y,
      state.angle
    );
    const w = clientToWorld(e.clientX, e.clientY);
    const a = Math.atan2(w.y - pivotWorld.y, w.x - pivotWorld.x);
    gestureRef.current = {
      mode: 'rotate',
      pivotWorld,
      localPivot,
      lastAngleRad: a,
      accumAngleDeg: state.angle,
    };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>): void => {
    const g = gestureRef.current;
    if (!g) return;
    e.preventDefault();
    e.stopPropagation();
    const w = clientToWorld(e.clientX, e.clientY);

    if (g.mode === 'move') {
      const nx = Math.max(
        -120,
        Math.min(W + 120, g.origX + (w.x - g.startWorld.x))
      );
      const ny = Math.max(
        -120,
        Math.min(H + 120, g.origY + (w.y - g.startWorld.y))
      );
      onChange((prev: GeometryToolState) => ({ ...prev, x: nx, y: ny }));
      return;
    }

    if (g.mode === 'rotate') {
      const curAngle = Math.atan2(w.y - g.pivotWorld.y, w.x - g.pivotWorld.x);
      let delta = curAngle - g.lastAngleRad;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      g.lastAngleRad = curAngle;
      g.accumAngleDeg += (delta * 180) / Math.PI;
      const snappedDeg = snapAngleIfNeeded(
        g.accumAngleDeg,
        state.snapAngleStep,
        e.shiftKey
      );
      const rad = (snappedDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const nextX =
        g.pivotWorld.x - (g.localPivot.x * cos - g.localPivot.y * sin);
      const nextY =
        g.pivotWorld.y - (g.localPivot.x * sin + g.localPivot.y * cos);
      onChange((prev: GeometryToolState) => ({
        ...prev,
        angle: snappedDeg,
        x: nextX,
        y: nextY,
      }));
      return;
    }

    if (g.mode === 'resize-ruler') {
      const local = worldToLocal(w.x, w.y, state.x, state.y, state.angle);
      const halfPx = Math.max(
        4 * PX_PER_CM,
        Math.min(11 * PX_PER_CM, Math.abs(local.x))
      );
      const cm = Math.round(((halfPx * 2) / PX_PER_CM) * 2) / 2;
      onChange((prev: GeometryToolState) => ({
        ...prev,
        rulerCm: Math.max(8, Math.min(22, cm)),
      }));
      return;
    }

    if (g.mode === 'resize-square') {
      const local = worldToLocal(w.x, w.y, state.x, state.y, state.angle);
      const rawCm = Math.abs(local.x) / PX_PER_CM;
      const cm = Math.round(rawCm * 2) / 2;
      onChange((prev: GeometryToolState) => ({
        ...prev,
        squareCm: Math.max(6, Math.min(16, cm)),
      }));
      return;
    }

    if (g.mode === 'resize-protractor') {
      const local = worldToLocal(w.x, w.y, state.x, state.y, state.angle);
      const r = Math.round(
        Math.max(110, Math.min(260, Math.hypot(local.x, local.y)))
      );
      onChange((prev: GeometryToolState) => ({
        ...prev,
        protractorRadius: r,
      }));
      return;
    }

    if (g.mode === 'protractor-ray') {
      const local = worldToLocal(w.x, w.y, state.x, state.y, state.angle);
      let thetaDeg = (Math.atan2(-local.y, local.x) * 180) / Math.PI;
      if (thetaDeg < 0) thetaDeg = thetaDeg > -90 ? 0 : 180;
      thetaDeg = Math.max(0, Math.min(180, thetaDeg));
      const finalDeg = e.shiftKey
        ? Math.round(thetaDeg / 15) * 15
        : Math.round(thetaDeg);
      onChange((prev: GeometryToolState) => ({
        ...prev,
        protractorRayDeg: finalDeg,
      }));
      return;
    }

    if (g.mode === 'compass-radius') {
      const dist = Math.hypot(w.x - state.x, w.y - state.y);
      const r = Math.round(Math.max(24, Math.min(340, dist)));
      const ang = (Math.atan2(w.y - state.y, w.x - state.x) * 180) / Math.PI;
      onChange((prev: GeometryToolState) => ({
        ...prev,
        compassRadius: r,
        compassAngle: normalizeDeg(ang),
      }));
      return;
    }

    if (g.mode === 'compass-rotate-idle') {
      const ang = (Math.atan2(w.y - state.y, w.x - state.x) * 180) / Math.PI;
      onChange((prev: GeometryToolState) => ({
        ...prev,
        compassAngle: snapAngleIfNeeded(ang, state.snapAngleStep, e.shiftKey),
      }));
      return;
    }

    if (g.mode === 'compass-draw') {
      const rawRad = Math.atan2(w.y - state.y, w.x - state.x);
      let delta = rawRad - g.lastRad;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      g.lastRad = rawRad;
      g.currentRad += delta;
      const maxSweep = Math.PI * 2;
      if (g.currentRad - g.startRad > maxSweep)
        g.currentRad = g.startRad + maxSweep;
      if (g.currentRad - g.startRad < -maxSweep)
        g.currentRad = g.startRad - maxSweep;

      setCompassSweep({ startRad: g.startRad, currentRad: g.currentRad });
      onChange((prev: GeometryToolState) => ({
        ...prev,
        compassAngle: normalizeDeg((rawRad * 180) / Math.PI),
      }));
      return;
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<SVGSVGElement>): void => {
    const g = gestureRef.current;
    gestureRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (g?.mode === 'compass-draw') {
      const sweep = Math.abs(g.currentRad - g.startRad);
      setCompassSweep(null);
      if (sweep >= (2 * Math.PI) / 180) {
        const stroke = buildCompassArcStroke(
          state.x,
          state.y,
          state.compassRadius,
          g.startRad,
          g.currentRad,
          {
            color: penColor,
            width: penWidth,
            opacity: penOpacity,
            style: penStyle,
            dash: penDash,
          }
        );
        onCommitStroke(stroke);
      }
    }
  };

  const handleWheel = (e: ReactWheelEvent<SVGGElement>): void => {
    if (e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();
    const step = e.shiftKey ? 5 : 1;
    const dir = e.deltaY > 0 ? 1 : -1;
    if (state.kind === 'compass') {
      onChange((prev: GeometryToolState) => ({
        ...prev,
        compassAngle: normalizeDeg(prev.compassAngle + dir * step),
      }));
    } else if (state.kind === 'setSquare') {
      const { lx, ly, sx } = getSetSquareDimensions(state);
      const localPivot = { x: sx * lx * 0.28, y: -ly * 0.28 };
      const pivotWorld = localToWorld(
        localPivot.x,
        localPivot.y,
        state.x,
        state.y,
        state.angle
      );
      const nextAngle = normalizeDeg(state.angle + dir * step);
      const rad = (nextAngle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      onChange((prev: GeometryToolState) => ({
        ...prev,
        angle: nextAngle,
        x: pivotWorld.x - (localPivot.x * cos - localPivot.y * sin),
        y: pivotWorld.y - (localPivot.x * sin + localPivot.y * cos),
      }));
    } else {
      onChange((prev: GeometryToolState) => ({
        ...prev,
        angle: normalizeDeg(prev.angle + dir * step),
      }));
    }
  };

  const renderRuler = () => {
    const totalPx = state.rulerCm * PX_PER_CM;
    const half = totalPx / 2;
    const totalMm = Math.round(state.rulerCm * 10);
    const activeEdge = liveFeedback?.targetId || hoveredSnap;

    return (
      <g
        transform={`translate(${state.x} ${state.y}) rotate(${state.angle})`}
        onWheel={handleWheel}
      >
        {activeEdge === 'ruler-top' && (
          <line
            x1={-half}
            y1={-37.5}
            x2={half}
            y2={-37.5}
            className="scrble-snap-edge-glow"
          />
        )}
        {activeEdge === 'ruler-bottom' && (
          <line
            x1={-half}
            y1={37.5}
            x2={half}
            y2={37.5}
            className="scrble-snap-edge-glow"
          />
        )}

        <rect
          x={-half}
          y={-36}
          width={totalPx}
          height={72}
          rx={7}
          className="scrble-stencil-body ruler-body"
          style={{ pointerEvents: 'none' }}
        />

        <line
          x1={-half + 8}
          y1={-14}
          x2={half - 8}
          y2={-14}
          className="scrble-grid-guide"
        />
        <line
          x1={-half + 8}
          y1={0}
          x2={half - 8}
          y2={0}
          className="scrble-grid-guide center"
        />
        <line
          x1={-half + 8}
          y1={14}
          x2={half - 8}
          y2={14}
          className="scrble-grid-guide"
        />

        <rect
          x={-half + 14}
          y={-21}
          width={Math.max(40, totalPx - 28)}
          height={42}
          rx={5}
          fill="transparent"
          className="scrble-grip-zone"
          onPointerDown={beginMove}
        />

        <g style={{ pointerEvents: 'none' }}>
          {Array.from({ length: totalMm + 1 }, (_: unknown, mm: number) => {
            const x = -half + mm * PX_PER_MM;
            const isCm = mm % 10 === 0;
            const isHalfCm = mm % 5 === 0 && !isCm;
            const topLen = isCm ? 13 : isHalfCm ? 8.5 : 5;
            const botLen = isCm ? 11 : isHalfCm ? 7.5 : 4.5;
            return (
              <g key={mm}>
                <line
                  x1={x}
                  y1={-36}
                  x2={x}
                  y2={-36 + topLen}
                  className={
                    isCm
                      ? 'scrble-tick major'
                      : isHalfCm
                      ? 'scrble-tick medium'
                      : 'scrble-tick minor'
                  }
                />
                <line
                  x1={x}
                  y1={36}
                  x2={x}
                  y2={36 - botLen}
                  className={
                    isCm
                      ? 'scrble-tick major'
                      : isHalfCm
                      ? 'scrble-tick medium'
                      : 'scrble-tick minor'
                  }
                />
                {isCm && (
                  <text
                    x={mm === 0 ? x + 4 : mm === totalMm ? x - 4 : x}
                    y={-15.5}
                    textAnchor={
                      mm === 0 ? 'start' : mm === totalMm ? 'end' : 'middle'
                    }
                    className="scrble-scale-text"
                  >
                    {mm / 10}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        <g className="scrble-dial-group">
          <circle
            cx={0}
            cy={0}
            r={26}
            className="scrble-rotate-ring"
            onPointerDown={(e: ReactPointerEvent<SVGCircleElement>) =>
              beginRotate(e, { x: 0, y: 0 })
            }
          >
            <title>
              Kéo vòng ngoài hoặc lăn chuột để xoay thước (Giữ Shift để khóa mỗi
              15°)
            </title>
          </circle>
          <circle
            cx={0}
            cy={0}
            r={18}
            className="scrble-dial-core"
            onPointerDown={beginMove}
            onDoubleClick={(e: ReactMouseEvent<SVGCircleElement>) => {
              e.stopPropagation();
              onChange((prev: GeometryToolState) => ({ ...prev, angle: 0 }));
            }}
          >
            <title>
              Kéo để di chuyển thước · Nhấp đúp để đặt lại góc 0°
            </title>
          </circle>
          <text
            x={0}
            y={4}
            textAnchor="middle"
            className="scrble-dial-text"
            style={{ pointerEvents: 'none' }}
          >
            {Math.round(state.angle)}°
          </text>
        </g>

        <g
          transform={`translate(${half - 10} 0)`}
          className="scrble-resize-handle"
          onPointerDown={(e: ReactPointerEvent<SVGGElement>) => {
            e.preventDefault();
            e.stopPropagation();
            gestureRef.current = { mode: 'resize-ruler', side: 1 };
            svgRef.current?.setPointerCapture(e.pointerId);
          }}
        >
          <title>
            Kéo để thay đổi chiều dài thước ({state.rulerCm} cm)
          </title>
          <rect x={-7} y={-14} width={14} height={28} rx={4} />
          <line x1={-2} y1={-7} x2={-2} y2={7} />
          <line x1={2} y1={-7} x2={2} y2={7} />
        </g>
      </g>
    );
  };

  const renderSetSquare = () => {
    const { lx, ly, sx } = getSetSquareDimensions(state);
    const activeEdge = liveFeedback?.targetId || hoveredSnap;
    const dialLocal = { x: sx * lx * 0.27, y: -ly * 0.27 };

    const insetX1 = sx * Math.min(48, lx * 0.14);
    const insetY1 = -Math.min(48, ly * 0.14);
    const insetX2 = sx * lx * 0.62;
    const insetY2 = -ly * 0.62;

    const outerPath = `M 0 0 L ${sx * lx} 0 L 0 ${-ly} Z`;
    const holePath = `M ${insetX1} ${insetY1} L ${insetX2} ${insetY1} L ${insetX1} ${insetY2} Z`;
    const compoundPath = `${outerPath} ${holePath}`;

    const cmX = Math.floor(state.squareCm * 10);
    const cmY = Math.floor((ly / PX_PER_CM) * 10);

    return (
      <g
        transform={`translate(${state.x} ${state.y}) rotate(${state.angle})`}
        onWheel={handleWheel}
      >
        {activeEdge === 'square-bottom' && (
          <line
            x1={0}
            y1={1.5}
            x2={sx * lx}
            y2={1.5}
            className="scrble-snap-edge-glow"
          />
        )}
        {activeEdge === 'square-left' && (
          <line
            x1={-sx * 1.5}
            y1={0}
            x2={-sx * 1.5}
            y2={-ly}
            className="scrble-snap-edge-glow"
          />
        )}
        {activeEdge === 'square-hyp' && (
          <line
            x1={0}
            y1={-ly}
            x2={sx * lx}
            y2={0}
            className="scrble-snap-edge-glow"
          />
        )}

        <path
          d={compoundPath}
          fillRule="evenodd"
          className="scrble-stencil-body square-body"
          style={{ pointerEvents: 'none' }}
        />

        <path
          d={`M ${sx * 14} -14 L ${sx * (lx - 26)} -14 L ${sx * 14} ${-(
            ly - 26
          )} Z`}
          fill="transparent"
          className="scrble-grip-zone"
          onPointerDown={beginMove}
        />

        <path
          d={`M ${sx * 18} 0 L ${sx * 18} -18 L 0 -18`}
          fill="none"
          className="scrble-right-angle-mark"
          style={{ pointerEvents: 'none' }}
        />

        <g style={{ pointerEvents: 'none' }}>
          {Array.from({ length: cmX + 1 }, (_: unknown, mm: number) => {
            const x = sx * mm * PX_PER_MM;
            if (Math.abs(x) > lx - 10) return null;
            const isCm = mm % 10 === 0;
            const isHalf = mm % 5 === 0 && !isCm;
            const len = isCm ? 12 : isHalf ? 8 : 4.5;
            return (
              <g key={`x-${mm}`}>
                <line
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={-len}
                  className={
                    isCm
                      ? 'scrble-tick major'
                      : isHalf
                      ? 'scrble-tick medium'
                      : 'scrble-tick minor'
                  }
                />
                {isCm && mm > 0 && (
                  <text
                    x={x}
                    y={-15}
                    textAnchor="middle"
                    className="scrble-scale-text"
                  >
                    {mm / 10}
                  </text>
                )}
              </g>
            );
          })}

          {Array.from({ length: cmY + 1 }, (_: unknown, mm: number) => {
            const y = -mm * PX_PER_MM;
            if (Math.abs(y) > ly - 10) return null;
            const isCm = mm % 10 === 0;
            const isHalf = mm % 5 === 0 && !isCm;
            const len = isCm ? 12 : isHalf ? 8 : 4.5;
            return (
              <g key={`y-${mm}`}>
                <line
                  x1={0}
                  y1={y}
                  x2={sx * len}
                  y2={y}
                  className={
                    isCm
                      ? 'scrble-tick major'
                      : isHalf
                      ? 'scrble-tick medium'
                      : 'scrble-tick minor'
                  }
                />
                {isCm && mm > 0 && (
                  <text
                    x={sx * 18}
                    y={y + 3.5}
                    textAnchor={sx > 0 ? 'start' : 'end'}
                    className="scrble-scale-text"
                  >
                    {mm / 10}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        <text
          x={sx * (lx - 42)}
          y={-8}
          textAnchor="middle"
          className="scrble-corner-badge"
          style={{ pointerEvents: 'none' }}
        >
          {state.squareVariant === '45' ? '45°' : '30°'}
        </text>
        <text
          x={sx * 24}
          y={-(ly - 34)}
          textAnchor="middle"
          className="scrble-corner-badge"
          style={{ pointerEvents: 'none' }}
        >
          {state.squareVariant === '45' ? '45°' : '60°'}
        </text>

        <g
          transform={`translate(${dialLocal.x} ${dialLocal.y})`}
          className="scrble-dial-group"
        >
          <circle
            cx={0}
            cy={0}
            r={25}
            className="scrble-rotate-ring"
            onPointerDown={(e: ReactPointerEvent<SVGCircleElement>) =>
              beginRotate(e, dialLocal)
            }
          >
            <title>Kéo vòng ngoài hoặc lăn chuột để xoay ê-ke</title>
          </circle>
          <circle
            cx={0}
            cy={0}
            r={17}
            className="scrble-dial-core"
            onPointerDown={beginMove}
            onDoubleClick={(e: ReactMouseEvent<SVGCircleElement>) => {
              e.stopPropagation();
              onChange((prev: GeometryToolState) => ({ ...prev, angle: 0 }));
            }}
          >
            <title>Kéo để di chuyển ê-ke · Nhấp đúp để đặt lại góc 0°</title>
          </circle>
          <text
            x={0}
            y={4}
            textAnchor="middle"
            className="scrble-dial-text"
            style={{ pointerEvents: 'none' }}
          >
            {Math.round(state.angle)}°
          </text>
        </g>

        <g
          transform={`translate(${sx * (lx - 18)} -16)`}
          className="scrble-resize-handle"
          onPointerDown={(e: ReactPointerEvent<SVGGElement>) => {
            e.preventDefault();
            e.stopPropagation();
            gestureRef.current = { mode: 'resize-square' };
            svgRef.current?.setPointerCapture(e.pointerId);
          }}
        >
          <title>Kéo để đổi kích thước ê-ke ({state.squareCm} cm)</title>
          <circle cx={0} cy={0} r={9} />
          <text x={0} y={3} textAnchor="middle" fontSize="9" fill="#0f172a">
            ↔
          </text>
        </g>
      </g>
    );
  };

  const renderProtractor = () => {
    const r = state.protractorRadius;
    const innerR1 = r * 0.28;
    const innerR2 = r * 0.62;
    const activeEdge = liveFeedback?.targetId || hoveredSnap;
    const rayRad = (state.protractorRayDeg * Math.PI) / 180;
    const rayX = r * Math.cos(rayRad);
    const rayY = -r * Math.sin(rayRad);

    const outerD = `M ${-r} 12 L ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0 L ${r} 12 Z`;
    const cutoutD = `M ${-innerR2} -10 A ${innerR2} ${innerR2} 0 0 1 ${innerR2} -10 L ${innerR1} -10 A ${innerR1} ${innerR1} 0 0 0 ${-innerR1} -10 Z`;

    return (
      <g
        transform={`translate(${state.x} ${state.y}) rotate(${state.angle})`}
        onWheel={handleWheel}
      >
        {activeEdge === 'protractor-arc' && (
          <path
            d={`M ${-(r + 1.5)} 0 A ${r + 1.5} ${r + 1.5} 0 0 1 ${r + 1.5} 0`}
            fill="none"
            className="scrble-snap-edge-glow"
          />
        )}
        {activeEdge === 'protractor-base' && (
          <line
            x1={-r}
            y1={13.5}
            x2={r}
            y2={13.5}
            className="scrble-snap-edge-glow"
          />
        )}
        {activeEdge === 'protractor-ray' && (
          <line
            x1={0}
            y1={0}
            x2={rayX}
            y2={rayY}
            className="scrble-snap-edge-glow"
          />
        )}

        <path
          d={`${outerD} ${cutoutD}`}
          fillRule="evenodd"
          className="scrble-stencil-body protractor-body"
          style={{ pointerEvents: 'none' }}
        />

        <path
          d={`M ${-(r - 16)} 4 A ${r - 16} ${r - 16} 0 0 1 ${r - 16} 4 L ${
            innerR2 + 6
          } 4 A ${innerR2 + 6} ${innerR2 + 6} 0 0 0 ${-(innerR2 + 6)} 4 Z`}
          fill="transparent"
          className="scrble-grip-zone"
          onPointerDown={beginMove}
        />

        <line
          x1={-r + 6}
          y1={0}
          x2={r - 6}
          y2={0}
          className="scrble-grid-guide center"
        />
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={-r + 6}
          className="scrble-grid-guide center"
        />

        <g style={{ pointerEvents: 'none' }}>
          {Array.from({ length: 181 }, (_: unknown, deg: number) => {
            const a = (deg * Math.PI) / 180;
            const cos = Math.cos(a);
            const sin = Math.sin(a);
            const is10 = deg % 10 === 0;
            const is5 = deg % 5 === 0 && !is10;
            const tickLen = is10 ? 14 : is5 ? 9 : 5;
            const x1 = cos * r;
            const y1 = -sin * r;
            const x2 = cos * (r - tickLen);
            const y2 = -sin * (r - tickLen);
            const outerTextR = r - 21;
            const innerTextR = r - 33;
            const rotDeg = 90 - deg;

            return (
              <g key={deg}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className={
                    is10
                      ? 'scrble-tick major'
                      : is5
                      ? 'scrble-tick medium'
                      : 'scrble-tick minor'
                  }
                />
                {is10 && (
                  <>
                    <text
                      x={cos * outerTextR}
                      y={-sin * outerTextR}
                      transform={`rotate(${rotDeg} ${cos * outerTextR} ${
                        -sin * outerTextR
                      })`}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="scrble-protractor-num outer"
                    >
                      {180 - deg}
                    </text>
                    {deg !== 90 && (
                      <text
                        x={cos * innerTextR}
                        y={-sin * innerTextR}
                        transform={`rotate(${rotDeg} ${cos * innerTextR} ${
                          -sin * innerTextR
                        })`}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="scrble-protractor-num inner"
                      >
                        {deg}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </g>

        <g style={{ pointerEvents: 'none' }}>
          <path
            d={`M 34 0 A 34 34 0 0 0 ${34 * Math.cos(rayRad)} ${
              -34 * Math.sin(rayRad)
            }`}
            fill="none"
            stroke="#0284c7"
            strokeWidth={2}
            strokeDasharray="3 2"
          />
          <line
            x1={0}
            y1={0}
            x2={rayX}
            y2={rayY}
            stroke="#0284c7"
            strokeWidth={2}
            strokeDasharray="5 3"
          />
          <text
            x={48 * Math.cos(rayRad / 2)}
            y={-48 * Math.sin(rayRad / 2)}
            textAnchor="middle"
            dominantBaseline="central"
            className="scrble-ray-label"
          >
            {Math.round(state.protractorRayDeg)}°
          </text>
        </g>

        <g
          transform={`translate(${rayX} ${rayY})`}
          className="scrble-ray-handle"
          onPointerDown={(e: ReactPointerEvent<SVGGElement>) => {
            e.preventDefault();
            e.stopPropagation();
            gestureRef.current = { mode: 'protractor-ray' };
            svgRef.current?.setPointerCapture(e.pointerId);
          }}
        >
          <title>
            Kéo dọc theo vòm thước để đặt góc tia ngắm (
            {Math.round(state.protractorRayDeg)}°)
          </title>
          <circle cx={0} cy={0} r={10} />
          <circle cx={0} cy={0} r={3.5} fill="#fff" />
        </g>

        <g className="scrble-dial-group">
          <circle
            cx={0}
            cy={0}
            r={23}
            className="scrble-rotate-ring"
            onPointerDown={(e: ReactPointerEvent<SVGCircleElement>) =>
              beginRotate(e, { x: 0, y: 0 })
            }
          >
            <title>
              Kéo vòng này hoặc lăn chuột để xoay thước đo góc quanh tâm O
            </title>
          </circle>
          <circle
            cx={0}
            cy={0}
            r={13}
            className="scrble-origin-bullseye"
            onPointerDown={beginMove}
            onDoubleClick={(e: ReactMouseEvent<SVGCircleElement>) => {
              e.stopPropagation();
              onChange((prev: GeometryToolState) => ({ ...prev, angle: 0 }));
            }}
          >
            <title>
              Tâm thước đo góc O · Kéo để đặt đúng vào đỉnh góc cần đo
            </title>
          </circle>
          <line
            x1={-9}
            y1={0}
            x2={9}
            y2={0}
            stroke="#0369a1"
            strokeWidth={1.4}
            style={{ pointerEvents: 'none' }}
          />
          <line
            x1={0}
            y1={-9}
            x2={0}
            y2={9}
            stroke="#0369a1"
            strokeWidth={1.4}
            style={{ pointerEvents: 'none' }}
          />
        </g>

        <g
          transform={`translate(${r - 14} -14)`}
          className="scrble-resize-handle"
          onPointerDown={(e: ReactPointerEvent<SVGGElement>) => {
            e.preventDefault();
            e.stopPropagation();
            gestureRef.current = { mode: 'resize-protractor' };
            svgRef.current?.setPointerCapture(e.pointerId);
          }}
        >
          <title>Kéo để phóng to / thu nhỏ thước đo góc</title>
          <circle cx={0} cy={0} r={9} />
          <text x={0} y={3} textAnchor="middle" fontSize="9" fill="#0f172a">
            ↔
          </text>
        </g>
      </g>
    );
  };

  const renderCompass = () => {
    const r = state.compassRadius;
    const angRad = (state.compassAngle * Math.PI) / 180;
    const tipX = state.x + r * Math.cos(angRad);
    const tipY = state.y + r * Math.sin(angRad);
    const activeEdge = liveFeedback?.targetId || hoveredSnap;

    const midX = (state.x + tipX) / 2;
    const midY = (state.y + tipY) / 2;
    const legHeight = Math.max(95, Math.min(185, 145 - r * 0.08));
    const hingeX = midX;
    const hingeY = midY - legHeight;

    const radiusHandleX = (hingeX + tipX) / 2;
    const radiusHandleY = (hingeY + tipY) / 2;

    let liveArcPath = '';
    let sweepDegrees = 0;
    if (compassSweep) {
      const diff = compassSweep.currentRad - compassSweep.startRad;
      sweepDegrees = Math.min(
        360,
        Math.round(Math.abs((diff * 180) / Math.PI))
      );
      if (Math.abs(diff) >= (354 * Math.PI) / 180) {
        liveArcPath = `M ${state.x - r} ${state.y} A ${r} ${r} 0 1 1 ${
          state.x + r
        } ${state.y} A ${r} ${r} 0 1 1 ${state.x - r} ${state.y}`;
      } else {
        const sx = state.x + r * Math.cos(compassSweep.startRad);
        const sy = state.y + r * Math.sin(compassSweep.startRad);
        const ex = state.x + r * Math.cos(compassSweep.currentRad);
        const ey = state.y + r * Math.sin(compassSweep.currentRad);
        const largeArc = Math.abs(diff) > Math.PI ? 1 : 0;
        const sweepFlag = diff >= 0 ? 1 : 0;
        liveArcPath = `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${ex} ${ey}`;
      }
    }

    return (
      <g onWheel={handleWheel}>
        <circle
          cx={state.x}
          cy={state.y}
          r={r}
          className={
            'scrble-compass-guide-circle ' +
            (activeEdge === 'compass-arc' || compassSweep ? 'active' : '')
          }
          style={{ pointerEvents: 'none' }}
        />

        {liveArcPath && (
          <path
            d={liveArcPath}
            fill="none"
            stroke={penColor}
            strokeWidth={Math.max(1.5, penWidth)}
            strokeOpacity={penOpacity}
            strokeLinecap="round"
            style={{ pointerEvents: 'none' }}
          />
        )}

        <line
          x1={state.x}
          y1={state.y}
          x2={tipX}
          y2={tipY}
          className="scrble-compass-radius-line"
          style={{ pointerEvents: 'none' }}
        />
        <g
          transform={`translate(${(state.x + tipX) / 2} ${
            (state.y + tipY) / 2 - 10
          })`}
          style={{ pointerEvents: 'none' }}
        >
          <rect
            x={-38}
            y={-11}
            width={76}
            height={20}
            rx={10}
            className="scrble-compass-badge"
          />
          <text
            x={0}
            y={3}
            textAnchor="middle"
            className="scrble-compass-badge-text"
          >
            {compassSweep
              ? `${sweepDegrees}° · ${formatCm(r)}`
              : `R = ${formatCm(r)}`}
          </text>
        </g>

        <g style={{ pointerEvents: 'none' }}>
          <path
            d={`M ${state.x} ${state.y} L ${hingeX} ${hingeY} L ${tipX} ${tipY}`}
            fill="none"
            stroke="rgba(15, 23, 42, 0.16)"
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1={hingeX - 4}
            y1={hingeY}
            x2={state.x}
            y2={state.y - 12}
            stroke="#475569"
            strokeWidth={6}
            strokeLinecap="round"
          />
          <line
            x1={state.x}
            y1={state.y - 12}
            x2={state.x}
            y2={state.y}
            stroke="#0f172a"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <line
            x1={hingeX + 4}
            y1={hingeY}
            x2={tipX}
            y2={tipY - 14}
            stroke="#64748b"
            strokeWidth={6}
            strokeLinecap="round"
          />
          <polygon
            points={`${tipX - 4},${tipY - 14} ${tipX + 4},${
              tipY - 14
            } ${tipX},${tipY}`}
            fill={penColor}
            stroke="#1e293b"
            strokeWidth={1}
          />
        </g>

        <g
          transform={`translate(${state.x} ${state.y})`}
          className="scrble-compass-pivot-handle"
          onPointerDown={beginMove}
        >
          <title>
            Tâm Compa O · Kéo để đặt mũi kim vào đúng tâm đường tròn trên giấy
          </title>
          <circle cx={0} cy={0} r={16} className="scrble-origin-bullseye" />
          <circle cx={0} cy={0} r={3} fill="#dc2626" />
          <text
            x={0}
            y={26}
            textAnchor="middle"
            className="scrble-compass-pivot-label"
          >
            Tâm O
          </text>
        </g>

        <g
          transform={`translate(${radiusHandleX} ${radiusHandleY})`}
          className="scrble-resize-handle"
          onPointerDown={(e: ReactPointerEvent<SVGGElement>) => {
            e.preventDefault();
            e.stopPropagation();
            gestureRef.current = { mode: 'compass-radius' };
            svgRef.current?.setPointerCapture(e.pointerId);
          }}
        >
          <title>
            Kéo ngang để mở rộng hoặc thu hẹp bán kính Compa ({formatCm(r)})
          </title>
          <rect x={-18} y={-10} width={36} height={20} rx={10} />
          <text
            x={0}
            y={3.5}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="700"
            fill="#0f172a"
          >
            ↔ R
          </text>
        </g>

        <g
          transform={`translate(${hingeX} ${hingeY})`}
          className="scrble-compass-hinge-handle"
          onPointerDown={beginMove}
        >
          <title>Kéo khớp compa để di chuyển cả compa</title>
          <circle
            cx={0}
            cy={0}
            r={12}
            fill="#334155"
            stroke="#f8fafc"
            strokeWidth={2}
          />
        </g>

        <g
          transform={`translate(${hingeX} ${hingeY - 22})`}
          className="scrble-compass-spinner-handle"
          onPointerDown={(e: ReactPointerEvent<SVGGElement>) => {
            e.preventDefault();
            e.stopPropagation();
            const startRad = (state.compassAngle * Math.PI) / 180;
            gestureRef.current = {
              mode: 'compass-draw',
              startRad,
              lastRad: startRad,
              currentRad: startRad,
            };
            setCompassSweep({ startRad, currentRad: startRad });
            svgRef.current?.setPointerCapture(e.pointerId);
          }}
        >
          <title>
            Nắm núm đỉnh compa kéo xoay quanh tâm O để quay đường tròn / cung
            tròn
          </title>
          <rect
            x={-11}
            y={-14}
            width={22}
            height={26}
            rx={6}
            fill="#f59e0b"
            stroke="#b45309"
            strokeWidth={1.8}
          />
          <text
            x={0}
            y={2}
            textAnchor="middle"
            fontSize="11"
            fontWeight="800"
            fill="#fff"
          >
            ↻
          </text>
        </g>

        <g
          transform={`translate(${tipX} ${tipY})`}
          className="scrble-compass-pencil-handle"
          onPointerDown={(e: ReactPointerEvent<SVGGElement>) => {
            e.preventDefault();
            e.stopPropagation();
            const w = clientToWorld(e.clientX, e.clientY);
            const startRad = Math.atan2(w.y - state.y, w.x - state.x);
            if (e.altKey) {
              gestureRef.current = { mode: 'compass-rotate-idle' };
            } else {
              gestureRef.current = {
                mode: 'compass-draw',
                startRad,
                lastRad: startRad,
                currentRad: startRad,
              };
              setCompassSweep({ startRad, currentRad: startRad });
            }
            svgRef.current?.setPointerCapture(e.pointerId);
          }}
        >
          <title>
            Kéo đầu bút chì quanh tâm O để vẽ cung tròn / đường tròn (Giữ Alt
            khi kéo để đổi góc đặt bút mà không vẽ)
          </title>
          <circle
            cx={0}
            cy={0}
            r={14}
            fill="rgba(2, 132, 199, 0.18)"
            stroke="#0284c7"
            strokeWidth={2}
          />
          <circle
            cx={0}
            cy={0}
            r={4.5}
            fill={penColor}
            stroke="#fff"
            strokeWidth={1.5}
          />
        </g>
      </g>
    );
  };

  return (
    <svg
      ref={svgRef}
      className="scrble-geometry-layer"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-label={`Dụng cụ ${TOOL_NAMES[state.kind]} trực tiếp trên giấy`}
    >
      {state.kind === 'ruler' && renderRuler()}
      {state.kind === 'setSquare' && renderSetSquare()}
      {state.kind === 'protractor' && renderProtractor()}
      {state.kind === 'compass' && renderCompass()}

      {liveFeedback && (
        <g
          className="scrble-live-measure-layer"
          style={{ pointerEvents: 'none' }}
        >
          {liveFeedback.targetId === 'protractor-arc' && (
            <>
              <line
                x1={state.x}
                y1={state.y}
                x2={liveFeedback.worldStart.x}
                y2={liveFeedback.worldStart.y}
                stroke="#0284c7"
                strokeWidth={1.6}
                strokeDasharray="4 3"
              />
              <line
                x1={state.x}
                y1={state.y}
                x2={liveFeedback.worldEnd.x}
                y2={liveFeedback.worldEnd.y}
                stroke="#0284c7"
                strokeWidth={1.8}
              />
            </>
          )}
          <circle
            cx={liveFeedback.worldStart.x}
            cy={liveFeedback.worldStart.y}
            r={4.5}
            fill="#0284c7"
            stroke="#fff"
            strokeWidth={1.5}
          />
          <circle
            cx={liveFeedback.worldEnd.x}
            cy={liveFeedback.worldEnd.y}
            r={5.5}
            fill="#0ea5e9"
            stroke="#fff"
            strokeWidth={1.8}
          />
          <g
            transform={`translate(${liveFeedback.worldEnd.x} ${Math.max(
              34,
              liveFeedback.worldEnd.y - 26
            )})`}
          >
            <rect
              x={-78}
              y={-22}
              width={156}
              height={liveFeedback.subLabel ? 36 : 24}
              rx={8}
              fill="rgba(15, 23, 42, 0.9)"
              stroke="#38bdf8"
              strokeWidth={1.2}
            />
            <text
              x={0}
              y={-7}
              textAnchor="middle"
              fill="#f8fafc"
              fontSize="11.5"
              fontWeight="700"
            >
              {liveFeedback.label}
            </text>
            {liveFeedback.subLabel && (
              <text
                x={0}
                y={8}
                textAnchor="middle"
                fill="#bae6fd"
                fontSize="9.5"
              >
                {liveFeedback.subLabel}
              </text>
            )}
          </g>
        </g>
      )}
    </svg>
  );
}
