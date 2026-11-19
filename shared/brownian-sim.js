// Pure 3D Brownian motion physics engine (zero DOM dependencies; unit-testable in Node).

export const BROWNIAN_PRESETS = Object.freeze({
  'pollen-water': {
    id: 'pollen-water',
    label: 'Phấn hoa trong nước (Brown 1827)',
    mediumLabel: 'Phân tử nước (H₂O)',
    particleLabel: 'Hạt phấn hoa (Clarkia pulchella)',
    moleculeCount: 210,
    moleculeRadius: 0.022,
    moleculeColor: '#38bdf8',
    particleStyle: 'pollen',
    defaultParticleRadius: 0.125,
    damping: 2.8,
    speedScale: 1.0
  },
  'dust-water': {
    id: 'dust-water',
    label: 'Hạt bụi vô cơ trong nước (Đối chứng)',
    mediumLabel: 'Phân tử nước (H₂O)',
    particleLabel: 'Hạt bụi mịn / muội than vô cơ',
    moleculeCount: 210,
    moleculeRadius: 0.022,
    moleculeColor: '#38bdf8',
    particleStyle: 'dust',
    defaultParticleRadius: 0.115,
    damping: 2.8,
    speedScale: 1.0
  },
  'smoke-air': {
    id: 'smoke-air',
    label: 'Hạt khói trong hộp không khí',
    mediumLabel: 'Phân tử khí (N₂, O₂)',
    particleLabel: 'Hạt khói lơ lửng',
    moleculeCount: 120,
    moleculeRadius: 0.02,
    moleculeColor: '#94a3b8',
    particleStyle: 'smoke',
    defaultParticleRadius: 0.105,
    damping: 1.75,
    speedScale: 1.38
  }
});

const BASE_TEMP_K = 293.15; // 20 °C reference
const CHAMBER_RADIUS = 1.0;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomUnit3(rng) {
  const u = rng() * 2 - 1;
  const theta = rng() * Math.PI * 2;
  const s = Math.sqrt(Math.max(0, 1 - u * u));
  return { x: s * Math.cos(theta), y: s * Math.sin(theta), z: u };
}

export function clampTemperatureC(tempC) {
  const n = Number(tempC);
  if (!Number.isFinite(n)) return 25;
  return Math.max(5, Math.min(95, n));
}

export function clampParticleRadius(r) {
  const n = Number(r);
  if (!Number.isFinite(n)) return 0.125;
  return Math.max(0.075, Math.min(0.2, n));
}

export function thermalSpeedFactor(tempC) {
  const k = clampTemperatureC(tempC) + 273.15;
  // Combine realistic sqrt(T) kinetic scaling with clear pedagogical sensitivity across 5..95°C
  return Math.pow(k / BASE_TEMP_K, 2.2);
}

export function createBrownianState({
  presetId = 'pollen-water',
  temperatureC = 25,
  particleRadius = null,
  markerIntervalSec = 1.1,
  seed = 1827
} = {}) {
  const preset = BROWNIAN_PRESETS[presetId] || BROWNIAN_PRESETS['pollen-water'];
  const tempC = clampTemperatureC(temperatureC);
  const pRad = clampParticleRadius(particleRadius ?? preset.defaultParticleRadius);
  const rng = mulberry32(seed);
  const baseSpeed = 0.85 * preset.speedScale * thermalSpeedFactor(tempC);

  const molecules = [];
  for (let i = 0; i < preset.moleculeCount; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let tries = 0; tries < 24; tries++) {
      const dir = randomUnit3(rng);
      const rad = Math.cbrt(rng()) * (CHAMBER_RADIUS - preset.moleculeRadius - 0.02);
      x = dir.x * rad;
      y = dir.y * rad;
      z = dir.z * rad;
      if (Math.hypot(x, y, z) > pRad + preset.moleculeRadius + 0.04) break;
    }
    const vDir = randomUnit3(rng);
    const spd = baseSpeed * (0.65 + rng() * 0.7);
    molecules.push({
      x,
      y,
      z,
      vx: vDir.x * spd,
      vy: vDir.y * spd,
      vz: vDir.z * spd
    });
  }

  return {
    presetId: preset.id,
    temperatureC: tempC,
    chamberRadius: CHAMBER_RADIUS,
    markerIntervalSec: Math.max(0.3, Number(markerIntervalSec) || 1.1),
    elapsedSec: 0,
    markerTimerSec: 0,
    collisionWindow: [],
    totalCollisions: 0,
    particle: {
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: pRad
    },
    force: { x: 0, y: 0, z: 0 },
    impacts: [],
    trail: [{ x: 0, y: 0, z: 0 }],
    markers: [{ x: 0, y: 0, z: 0, t: 0 }],
    msdSum: 0,
    msdSamples: 0,
    molecules
  };
}

export function clearBrownianTrail(state) {
  const { x, y, z } = state.particle;
  state.trail = [{ x, y, z }];
  state.markers = [{ x, y, z, t: state.elapsedSec }];
  state.markerTimerSec = 0;
  state.msdSum = 0;
  state.msdSamples = 0;
}

export function updateBrownianParams(state, { temperatureC, particleRadius } = {}) {
  if (temperatureC !== undefined) {
    const nextTemp = clampTemperatureC(temperatureC);
    const ratio = thermalSpeedFactor(nextTemp) / thermalSpeedFactor(state.temperatureC);
    state.temperatureC = nextTemp;
    for (const m of state.molecules) {
      m.vx *= ratio;
      m.vy *= ratio;
      m.vz *= ratio;
    }
  }
  if (particleRadius !== undefined) {
    state.particle.radius = clampParticleRadius(particleRadius);
  }
}

export function stepBrownianState(state, dtRaw = 0.016) {
  const dt = Math.max(0.001, Math.min(0.04, Number(dtRaw) || 0.016));
  const preset = BROWNIAN_PRESETS[state.presetId] || BROWNIAN_PRESETS['pollen-water'];
  const p = state.particle;
  const mRad = preset.moleculeRadius;
  const minDist = p.radius + mRad;
  const minDistSq = minDist * minDist;

  // Mass scales with volume r^3: smaller suspended grains kick much harder
  const massRatio = 1 / (26 * Math.pow(p.radius / 0.125, 3));
  const targetSpeed = 0.85 * preset.speedScale * thermalSpeedFactor(state.temperatureC);

  let impX = 0;
  let impY = 0;
  let impZ = 0;
  let stepHits = 0;

  for (const m of state.molecules) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.z += m.vz * dt;

    // Reflect molecule inside spherical droplet/chamber
    const rWall = CHAMBER_RADIUS - mRad;
    const distWallSq = m.x * m.x + m.y * m.y + m.z * m.z;
    if (distWallSq > rWall * rWall) {
      const distWall = Math.sqrt(distWallSq) || 1;
      const nx = m.x / distWall;
      const ny = m.y / distWall;
      const nz = m.z / distWall;
      m.x = nx * rWall;
      m.y = ny * rWall;
      m.z = nz * rWall;
      const vn = m.vx * nx + m.vy * ny + m.vz * nz;
      if (vn > 0) {
        m.vx -= 2 * vn * nx;
        m.vy -= 2 * vn * ny;
        m.vz -= 2 * vn * nz;
      }
    }

    // Check elastic 3D collision with suspended grain
    const dx = m.x - p.x;
    const dy = m.y - p.y;
    const dz = m.z - p.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq < minDistSq && distSq > 1e-9) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;

      // Push molecule outside contact surface
      const overlap = minDist - dist;
      m.x += nx * overlap;
      m.y += ny * overlap;
      m.z += nz * overlap;

      // Relative velocity along contact normal (molecule minus particle)
      const rvx = m.vx - p.vx;
      const rvy = m.vy - p.vy;
      const rvz = m.vz - p.vz;
      const relNormal = rvx * nx + rvy * ny + rvz * nz;

      if (relNormal < 0) {
        const j = -(2 * relNormal) / (1 + massRatio);
        m.vx += j * nx;
        m.vy += j * ny;
        m.vz += j * nz;

        const dvx = -j * massRatio * nx;
        const dvy = -j * massRatio * ny;
        const dvz = -j * massRatio * nz;
        p.vx += dvx;
        p.vy += dvy;
        p.vz += dvz;

        impX += dvx;
        impY += dvy;
        impZ += dvz;
        stepHits++;

        if (state.impacts.length < 18) {
          state.impacts.push({
            x: p.x + nx * p.radius,
            y: p.y + ny * p.radius,
            z: p.z + nz * p.radius,
            life: 1.0
          });
        }
      }
    }

    // Mild thermostat keeps molecular kinetic energy aligned with temperature T
    const spd = Math.hypot(m.vx, m.vy, m.vz);
    if (spd > 1e-4) {
      const nudge = 1 + (targetSpeed / spd - 1) * 0.03;
      m.vx *= nudge;
      m.vy *= nudge;
      m.vz *= nudge;
    }
  }

  // Viscous drag + integrate particle motion
  const damp = Math.exp(-preset.damping * dt);
  p.vx *= damp;
  p.vy *= damp;
  p.vz *= damp;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;

  // Keep grain softly contained inside chamber so it never leaves field of view
  const maxPRad = CHAMBER_RADIUS - p.radius - 0.08;
  const pDist = Math.hypot(p.x, p.y, p.z);
  if (pDist > maxPRad && pDist > 1e-6) {
    const nx = p.x / pDist;
    const ny = p.y / pDist;
    const nz = p.z / pDist;
    p.x = nx * maxPRad;
    p.y = ny * maxPRad;
    p.z = nz * maxPRad;
    const vn = p.vx * nx + p.vy * ny + p.vz * nz;
    if (vn > 0) {
      p.vx -= 1.5 * vn * nx;
      p.vy -= 1.5 * vn * ny;
      p.vz -= 1.5 * vn * nz;
    }
  }

  // Smooth instantaneous resultant force vector F_hl for visual clarity
  const fx = impX / dt;
  const fy = impY / dt;
  const fz = impZ / dt;
  const blend = 0.24;
  state.force.x = state.force.x * (1 - blend) + fx * blend;
  state.force.y = state.force.y * (1 - blend) + fy * blend;
  state.force.z = state.force.z * (1 - blend) + fz * blend;

  // Decay impact flashes
  for (let i = state.impacts.length - 1; i >= 0; i--) {
    state.impacts[i].life -= dt * 3.8;
    if (state.impacts[i].life <= 0) state.impacts.splice(i, 1);
  }

  state.elapsedSec += dt;
  state.totalCollisions += stepHits;
  state.collisionWindow.push({ t: state.elapsedSec, hits: stepHits });
  while (state.collisionWindow.length && state.elapsedSec - state.collisionWindow[0].t > 1.0) {
    state.collisionWindow.shift();
  }

  // Record continuous trail point when moved enough
  const lastTrail = state.trail[state.trail.length - 1];
  if (!lastTrail || Math.hypot(p.x - lastTrail.x, p.y - lastTrail.y, p.z - lastTrail.z) >= 0.008) {
    state.trail.push({ x: p.x, y: p.y, z: p.z });
    if (state.trail.length > 420) state.trail.shift();
  }

  // Record periodic Δt markers for textbook zigzag arrow path
  state.markerTimerSec += dt;
  if (state.markerTimerSec >= state.markerIntervalSec) {
    state.markerTimerSec -= state.markerIntervalSec;
    state.markers.push({ x: p.x, y: p.y, z: p.z, t: state.elapsedSec });
    if (state.markers.length > 36) state.markers.shift();
  }

  const origin = state.markers[0] || { x: 0, y: 0, z: 0 };
  const r2 = (p.x - origin.x) ** 2 + (p.y - origin.y) ** 2 + (p.z - origin.z) ** 2;
  state.msdSum += r2;
  state.msdSamples += 1;

  return state;
}

export function getBrownianMetrics(state) {
  let collisionsPerSec = 0;
  for (const item of state.collisionWindow) collisionsPerSec += item.hits;
  let speedSum = 0;
  for (const m of state.molecules) speedSum += Math.hypot(m.vx, m.vy, m.vz);
  const avgMoleculeSpeed = state.molecules.length ? speedSum / state.molecules.length : 0;
  const origin = state.markers[0] || { x: 0, y: 0, z: 0 };
  const displacement = Math.hypot(
    state.particle.x - origin.x,
    state.particle.y - origin.y,
    state.particle.z - origin.z
  );
  const msd = state.msdSamples ? state.msdSum / state.msdSamples : 0;
  return {
    temperatureC: Math.round(state.temperatureC),
    temperatureK: Math.round((state.temperatureC + 273.15) * 10) / 10,
    collisionsPerSec,
    totalCollisions: state.totalCollisions,
    avgMoleculeSpeed,
    displacement,
    msd,
    markerCount: state.markers.length
  };
}
