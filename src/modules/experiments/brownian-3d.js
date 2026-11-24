import { element, button } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import {
  BROWNIAN_PRESETS,
  createBrownianState,
  clearBrownianTrail,
  updateBrownianParams,
  stepBrownianState,
  getBrownianMetrics
} from '../../../shared/brownian-sim.js';

// Precompute 26 evenly spread unit directions for 3D pollen grain spikes
const SPIKE_DIRS = (() => {
  const dirs = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const count = 26;
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    dirs.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return dirs;
})();

export function mountBrownian3D(host) {
  const stageShell = element('section', 'exp-sim-shell');

  // Top bar: view mode + classroom actions
  const topBar = element('div', 'exp-sim-topbar');
  const titleGroup = element('div', 'exp-sim-title-group');
  const modeLabel = element('strong', '', 'Mô phỏng 3D · Phấn hoa trong nước (Brown 1827)');
  const hintLine = element('small', 'exp-sim-hint', 'Kéo chuột hoặc vuốt để xoay 360° · Cuộn chuột để phóng to/thu nhỏ.');
  titleGroup.append(modeLabel, hintLine);

  const topActions = element('div', 'exp-sim-top-actions');
  let viewMode = '3d'; // '3d' | 'microscope'
  const btn3D = button('Không gian 3D', 'exam-tab selected', () => setViewMode('3d'));
  const btnScope = button('Thị trường kính hiển vi', 'exam-tab', () => setViewMode('microscope'));
  const btnFull = button('Toàn màn hình', 'focus-btn is-sm', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await stageShell.requestFullscreen();
    } catch { /* ignore blocked fullscreen */ }
  });
  btnFull.prepend(icon('maximize', 14));
  topActions.append(btn3D, btnScope, btnFull);
  topBar.append(titleGroup, topActions);

  // Main split: 3D Canvas viewport + Teacher Control Panel
  const simGrid = element('div', 'exp-sim-grid');
  const viewportWrap = element('div', 'exp-canvas-wrap');
  const canvas = document.createElement('canvas');
  canvas.className = 'exp-canvas';
  canvas.setAttribute('aria-label', 'Mô hình 3D tương tác thí nghiệm chuyển động Brown');

  // Floating HUD metrics + zoom controls
  const hudBar = element('div', 'exp-hud-bar');
  const hudTemp = element('span', 'exp-hud-pill', 'T = 25°C (298.2 K)');
  const hudHits = element('span', 'exp-hud-pill', 'Va chạm: 0 /s');
  const hudDisp = element('span', 'exp-hud-pill', '|Δr| = 0.00');
  const hudMsd = element('span', 'exp-hud-pill', '⟨r²⟩ = 0.00');
  hudBar.append(hudTemp, hudHits, hudDisp, hudMsd);

  const camOverlay = element('div', 'exp-cam-overlay');
  const btnZoomIn = button('+', 'exp-cam-btn', () => { zoom = Math.min(2.1, zoom * 1.15); });
  btnZoomIn.title = 'Phóng to';
  const btnZoomOut = button('−', 'exp-cam-btn', () => { zoom = Math.max(0.65, zoom / 1.15); });
  btnZoomOut.title = 'Thu nhỏ';
  const btnResetCam = button('Đặt lại góc nhìn', 'exp-cam-btn is-wide', () => {
    yaw = 0.55;
    pitch = 0.34;
    zoom = 1.05;
  });
  camOverlay.append(btnZoomIn, btnZoomOut, btnResetCam);

  viewportWrap.append(canvas, hudBar, camOverlay);

  // Controls panel
  const ctrlPanel = element('aside', 'exp-ctrl-panel');

  // 1) Preset selector
  const presetField = element('label', 'exp-ctrl-field');
  presetField.append(element('span', 'exp-ctrl-label', 'Mẫu vật & môi trường'));
  const presetSel = document.createElement('select');
  presetSel.className = 'exam-input';
  for (const p of Object.values(BROWNIAN_PRESETS)) {
    const o = element('option', '', p.label);
    o.value = p.id;
    presetSel.append(o);
  }
  presetField.append(presetSel);

  // 2) Temperature slider
  const tempField = element('div', 'exp-ctrl-field');
  const tempHead = element('div', 'exp-ctrl-row');
  const tempValEl = element('strong', '', '25 °C');
  tempHead.append(element('span', 'exp-ctrl-label', 'Nhiệt độ môi trường (T)'), tempValEl);
  const tempSlider = document.createElement('input');
  tempSlider.type = 'range';
  tempSlider.min = '5';
  tempSlider.max = '95';
  tempSlider.step = '1';
  tempSlider.value = '25';
  tempSlider.className = 'exp-slider';
  tempField.append(tempHead, tempSlider);

  // 3) Particle size slider
  const sizeField = element('div', 'exp-ctrl-field');
  const sizeHead = element('div', 'exp-ctrl-row');
  const sizeValEl = element('strong', '', 'Trung bình');
  sizeHead.append(element('span', 'exp-ctrl-label', 'Kích thước hạt lơ lửng'), sizeValEl);
  const sizeSlider = document.createElement('input');
  sizeSlider.type = 'range';
  sizeSlider.min = '75';
  sizeSlider.max = '200';
  sizeSlider.step = '5';
  sizeSlider.value = '125';
  sizeSlider.className = 'exp-slider';
  sizeField.append(sizeHead, sizeSlider);

  // 4) Visual layer checkboxes
  const layersBox = element('div', 'exp-ctrl-checks');
  const makeCheck = (text, checked, onChange) => {
    const lbl = element('label', 'exp-check-row');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = checked;
    cb.onchange = () => onChange(cb.checked);
    lbl.append(cb, element('span', '', text));
    return { lbl, cb };
  };

  let showMolecules = true;
  let showTrail = true;
  let showMarkers = true;
  let showForce = true;

  const chkMol = makeCheck('Hiện phân tử môi trường (H₂O / khí)', showMolecules, (v) => { showMolecules = v; });
  const chkTrail = makeCheck('Hiện quỹ đạo liên tục', showTrail, (v) => { showTrail = v; });
  const chkMarkers = makeCheck('Đánh dấu vị trí mỗi Δt (mũi tên ziczac)', showMarkers, (v) => { showMarkers = v; });
  const chkForce = makeCheck('Hiện vector hợp lực tức thời F_hl', showForce, (v) => { showForce = v; });
  layersBox.append(chkMol.lbl, chkTrail.lbl, chkMarkers.lbl, chkForce.lbl);

  // 5) Playback + Speed + Clear
  let playing = true;
  let speedMul = 1.0;

  const speedRow = element('div', 'exp-speed-row');
  const speedBtns = [];
  for (const [val, txt] of [[0.25, '0.25×'], [1, '1×'], [2, '2×']]) {
    const b = button(txt, `exam-tab${val === 1 ? ' selected' : ''}`, () => {
      speedMul = val;
      speedBtns.forEach(([v, el]) => el.classList.toggle('selected', v === val));
    });
    speedBtns.push([val, b]);
    speedRow.append(b);
  }

  const playActions = element('div', 'exp-play-actions');
  const btnPlay = button('Tạm dừng', 'primary-btn', () => {
    playing = !playing;
    btnPlay.textContent = playing ? 'Tạm dừng' : 'Tiếp tục';
  });
  const btnClear = button('Xóa quỹ đạo', 'exam-tab', () => {
    clearBrownianTrail(sim);
  });
  const btnRestart = button('Chạy lại', 'exam-tab', () => {
    resetSimulation(presetSel.value);
  });
  playActions.append(btnPlay, btnClear, btnRestart);

  // Color legend
  const legend = element('div', 'exp-legend');
  legend.append(
    element('span', 'exp-legend-item is-grain', 'Hạt lơ lửng'),
    element('span', 'exp-legend-item is-mol', 'Phân tử môi trường'),
    element('span', 'exp-legend-item is-path', 'Quỹ đạo Δt'),
    element('span', 'exp-legend-item is-force', 'Hợp lực F_hl')
  );

  ctrlPanel.append(
    presetField,
    tempField,
    sizeField,
    layersBox,
    element('span', 'exp-ctrl-label', 'Tốc độ mô phỏng'),
    speedRow,
    playActions,
    legend
  );

  simGrid.append(viewportWrap, ctrlPanel);
  stageShell.append(topBar, simGrid);
  host.replaceChildren(stageShell);

  // Simulation + 3D Camera State
  let sim = createBrownianState({ presetId: 'pollen-water', temperatureC: 25, particleRadius: 0.125 });
  let yaw = 0.55;
  let pitch = 0.34;
  let zoom = 1.05;
  let dragging = false;
  let lastPtrX = 0;
  let lastPtrY = 0;

  function sizeLabelFor(r) {
    if (r <= 0.095) return 'Rất nhỏ (giật mạnh)';
    if (r <= 0.135) return 'Trung bình';
    return 'Lớn (giật yếu)';
  }

  function setViewMode(mode) {
    viewMode = mode === 'microscope' ? 'microscope' : '3d';
    btn3D.classList.toggle('selected', viewMode === '3d');
    btnScope.classList.toggle('selected', viewMode === 'microscope');
    if (viewMode === 'microscope') {
      hintLine.textContent = 'Góc nhìn qua thị kính quang học — đối chiếu quỹ đạo gấp khúc với sách giáo khoa.';
    } else {
      hintLine.textContent = 'Kéo chuột hoặc vuốt để xoay 360° · Cuộn chuột để phóng to/thu nhỏ.';
    }
  }

  function resetSimulation(presetId) {
    const preset = BROWNIAN_PRESETS[presetId] || BROWNIAN_PRESETS['pollen-water'];
    const tempC = Number(tempSlider.value) || 25;
    const pRad = (Number(sizeSlider.value) || 125) / 1000;
    sim = createBrownianState({
      presetId: preset.id,
      temperatureC: tempC,
      particleRadius: pRad,
      seed: Math.floor(Date.now() % 100000) + 1827
    });
    modeLabel.textContent = `Mô phỏng 3D · ${preset.label}`;
  }

  presetSel.onchange = () => {
    const preset = BROWNIAN_PRESETS[presetSel.value] || BROWNIAN_PRESETS['pollen-water'];
    sizeSlider.value = String(Math.round(preset.defaultParticleRadius * 1000));
    sizeValEl.textContent = sizeLabelFor(preset.defaultParticleRadius);
    resetSimulation(preset.id);
  };

  tempSlider.oninput = () => {
    const t = Number(tempSlider.value);
    tempValEl.textContent = `${t} °C`;
    updateBrownianParams(sim, { temperatureC: t });
  };

  sizeSlider.oninput = () => {
    const r = Number(sizeSlider.value) / 1000;
    sizeValEl.textContent = sizeLabelFor(r);
    updateBrownianParams(sim, { particleRadius: r });
  };

  // Pointer orbit + wheel zoom
  const onPointerDown = (e) => {
    if (viewMode === 'microscope') return;
    dragging = true;
    lastPtrX = e.clientX;
    lastPtrY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging || viewMode === 'microscope') return;
    const dx = e.clientX - lastPtrX;
    const dy = e.clientY - lastPtrY;
    lastPtrX = e.clientX;
    lastPtrY = e.clientY;
    yaw += dx * 0.0085;
    pitch = Math.max(-1.25, Math.min(1.25, pitch + dy * 0.0085));
  };
  const onPointerUp = () => { dragging = false; };
  const onWheel = (e) => {
    e.preventDefault();
    zoom = Math.max(0.65, Math.min(2.1, zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // HiDPI canvas sizing
  let cssW = 640;
  let cssH = 440;
  const ctx = canvas.getContext('2d');
  const resizeCanvas = () => {
    const rect = viewportWrap.getBoundingClientRect();
    cssW = Math.max(280, Math.floor(rect.width || 640));
    cssH = Math.max(320, Math.floor(rect.height || 440));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const ro = new ResizeObserver(resizeCanvas);
  ro.observe(viewportWrap);
  resizeCanvas();

  // 3D perspective projection helper
  function project(x, y, z, cx, cy, baseScale) {
    if (viewMode === 'microscope') {
      const s = baseScale * zoom * 0.96;
      return { sx: cx + x * s, sy: cy - y * s, depth: z, scale: s };
    }
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    // Rotate around Y (yaw) then X (pitch)
    const rx = x * cosY + z * sinY;
    const rz1 = -x * sinY + z * cosY;
    const ry = y * cosP - rz1 * sinP;
    const rz = y * sinP + rz1 * cosP;

    const camDist = 3.25;
    const persp = camDist / Math.max(0.6, camDist - rz);
    const s = baseScale * zoom * persp;
    return { sx: cx + rx * s, sy: cy - ry * s, depth: rz, scale: s };
  }

  function drawArrowHead(x1, y1, x2, y2, size, color) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(angle - 0.42), y2 - size * Math.sin(angle - 0.42));
    ctx.lineTo(x2 - size * Math.cos(angle + 0.42), y2 - size * Math.sin(angle + 0.42));
    ctx.closePath();
    ctx.fill();
  }

  function drawChamberWireframe(cx, cy, baseScale, isLight) {
    if (viewMode === 'microscope') {
      const r = baseScale * zoom * 0.98;
      // Optical eyepiece circular field
      const grad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
      grad.addColorStop(0, isLight ? 'rgba(224,242,254,0.85)' : 'rgba(14,34,54,0.75)');
      grad.addColorStop(0.85, isLight ? 'rgba(186,230,253,0.45)' : 'rgba(10,22,38,0.88)');
      grad.addColorStop(1, isLight ? 'rgba(148,163,184,0.45)' : 'rgba(2,6,23,0.95)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isLight ? 'rgba(15,23,42,0.35)' : 'rgba(148,163,184,0.45)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Subtle microscope reticle crosshairs
      ctx.strokeStyle = isLight ? 'rgba(15,23,42,0.09)' : 'rgba(148,163,184,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx, cy + r);
      ctx.stroke();
      return;
    }

    // 3D sphere droplet boundary + subtle latitude/longitude rings
    const rOuter = baseScale * zoom * 1.03;
    const shellGrad = ctx.createRadialGradient(cx - rOuter * 0.28, cy - rOuter * 0.28, rOuter * 0.08, cx, cy, rOuter);
    shellGrad.addColorStop(0, isLight ? 'rgba(56,189,248,0.14)' : 'rgba(56,189,248,0.11)');
    shellGrad.addColorStop(1, isLight ? 'rgba(15,23,42,0.04)' : 'rgba(2,6,23,0.28)');
    ctx.fillStyle = shellGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isLight ? 'rgba(14,116,144,0.28)' : 'rgba(94,234,212,0.24)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Draw 3D equator & prime meridian rings so rotation feels unmistakably 3D
    const drawRing = (fn) => {
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const pt = fn(a);
        const pr = project(pt.x, pt.y, pt.z, cx, cy, baseScale);
        if (i === 0) ctx.moveTo(pr.sx, pr.sy);
        else ctx.lineTo(pr.sx, pr.sy);
      }
      ctx.stroke();
    };
    ctx.strokeStyle = isLight ? 'rgba(15,23,42,0.1)' : 'rgba(148,163,184,0.14)';
    ctx.lineWidth = 1;
    drawRing((a) => ({ x: Math.cos(a), y: 0, z: Math.sin(a) }));
    drawRing((a) => ({ x: Math.cos(a), y: Math.sin(a), z: 0 }));
  }

  function drawGrain3D(p, cx, cy, baseScale, style) {
    const center = project(p.x, p.y, p.z, cx, cy, baseScale);
    const pxR = Math.max(9, p.radius * center.scale);

    // Draw 3D pollen spikes protruding around the sphere
    if (style === 'pollen') {
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = Math.max(1.5, pxR * 0.08);
      for (const dir of SPIKE_DIRS) {
        const tip = project(
          p.x + dir.x * p.radius * 1.24,
          p.y + dir.y * p.radius * 1.24,
          p.z + dir.z * p.radius * 1.24,
          cx,
          cy,
          baseScale
        );
        const base = project(
          p.x + dir.x * p.radius * 0.88,
          p.y + dir.y * p.radius * 0.88,
          p.z + dir.z * p.radius * 0.88,
          cx,
          cy,
          baseScale
        );
        ctx.beginPath();
        ctx.moveTo(base.sx, base.sy);
        ctx.lineTo(tip.sx, tip.sy);
        ctx.stroke();
      }
    }

    // Shaded 3D sphere body
    const g = ctx.createRadialGradient(
      center.sx - pxR * 0.34,
      center.sy - pxR * 0.34,
      pxR * 0.12,
      center.sx,
      center.sy,
      pxR
    );
    if (style === 'pollen') {
      g.addColorStop(0, '#fef08a');
      g.addColorStop(0.55, '#f59e0b');
      g.addColorStop(1, '#92400e');
    } else if (style === 'dust') {
      g.addColorStop(0, '#94a3b8');
      g.addColorStop(0.55, '#475569');
      g.addColorStop(1, '#0f172a');
    } else {
      g.addColorStop(0, '#f8fafc');
      g.addColorStop(0.6, '#cbd5e1');
      g.addColorStop(1, '#475569');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(center.sx, center.sy, pxR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = style === 'pollen' ? 'rgba(180,83,9,0.7)' : 'rgba(148,163,184,0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Render surface impact flashes
    for (const imp of sim.impacts) {
      const ip = project(imp.x, imp.y, imp.z, cx, cy, baseScale);
      const rFlash = Math.max(3, 9 * imp.life);
      ctx.fillStyle = `rgba(250,204,21,${Math.max(0, imp.life * 0.85).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(ip.sx, ip.sy, rFlash, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function renderFrame() {
    const activeTheme = document.documentElement.getAttribute('data-theme');
    const isLight = activeTheme === 'light' || activeTheme === 'clay' || activeTheme === 'pine';
    ctx.clearRect(0, 0, cssW, cssH);

    // Subtle background backdrop matching theme
    ctx.fillStyle = isLight ? '#f8fafc' : '#09111f';
    ctx.fillRect(0, 0, cssW, cssH);

    const cx = cssW / 2;
    const cy = cssH / 2;
    const baseScale = Math.min(cssW, cssH) * 0.42;

    drawChamberWireframe(cx, cy, baseScale, isLight);

    const preset = BROWNIAN_PRESETS[sim.presetId] || BROWNIAN_PRESETS['pollen-water'];

    // Continuous zigzag trail
    if (showTrail && sim.trail.length > 1) {
      ctx.beginPath();
      sim.trail.forEach((pt, idx) => {
        const pr = project(pt.x, pt.y, pt.z, cx, cy, baseScale);
        if (idx === 0) ctx.moveTo(pr.sx, pr.sy);
        else ctx.lineTo(pr.sx, pr.sy);
      });
      ctx.strokeStyle = isLight ? 'rgba(217,119,6,0.45)' : 'rgba(251,191,36,0.42)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Depth-sorted molecules & grain
    const pProj = project(sim.particle.x, sim.particle.y, sim.particle.z, cx, cy, baseScale);
    const drawItems = [];
    if (showMolecules) {
      for (const m of sim.molecules) {
        const mp = project(m.x, m.y, m.z, cx, cy, baseScale);
        drawItems.push({ kind: 'mol', depth: mp.depth, sx: mp.sx, sy: mp.sy, r: Math.max(2.2, preset.moleculeRadius * mp.scale) });
      }
    }
    drawItems.push({ kind: 'grain', depth: pProj.depth });
    drawItems.sort((a, b) => a.depth - b.depth);

    for (const item of drawItems) {
      if (item.kind === 'grain') {
        drawGrain3D(sim.particle, cx, cy, baseScale, preset.particleStyle);
      } else {
        const depthAlpha = Math.max(0.28, Math.min(0.95, 0.62 + item.depth * 0.34));
        ctx.fillStyle = preset.id === 'smoke-air'
          ? `rgba(148,163,184,${(depthAlpha * 0.85).toFixed(2)})`
          : `rgba(56,189,248,${depthAlpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(item.sx, item.sy, item.r, 0, Math.PI * 2);
        ctx.fill();

        // Crisp highlight dot on foreground molecules
        if (item.r >= 3.2) {
          ctx.fillStyle = `rgba(255,255,255,${(depthAlpha * 0.55).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(item.sx - item.r * 0.3, item.sy - item.r * 0.3, item.r * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Periodic Δt zigzag segment markers + directional arrows (matches textbook illustration)
    if (showMarkers && sim.markers.length > 1) {
      const segColor = isLight ? '#0f172a' : '#f8fafc';
      ctx.strokeStyle = segColor;
      ctx.lineWidth = 1.75;
      for (let i = 1; i < sim.markers.length; i++) {
        const a = project(sim.markers[i - 1].x, sim.markers[i - 1].y, sim.markers[i - 1].z, cx, cy, baseScale);
        const b = project(sim.markers[i].x, sim.markers[i].y, sim.markers[i].z, cx, cy, baseScale);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();

        const segLen = Math.hypot(b.sx - a.sx, b.sy - a.sy);
        if (segLen > 14) {
          const midX = a.sx + (b.sx - a.sx) * 0.62;
          const midY = a.sy + (b.sy - a.sy) * 0.62;
          drawArrowHead(a.sx, a.sy, midX, midY, 6.5, segColor);
        }
      }
      for (let i = 0; i < sim.markers.length; i++) {
        const pt = project(sim.markers[i].x, sim.markers[i].y, sim.markers[i].z, cx, cy, baseScale);
        ctx.fillStyle = i === 0 ? '#10b981' : segColor;
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, i === 0 ? 4 : 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Instantaneous resultant force vector F_hl
    if (showForce) {
      const fMag = Math.hypot(sim.force.x, sim.force.y, sim.force.z);
      if (fMag > 0.08) {
        const capped = Math.min(0.42, 0.14 + fMag * 0.045);
        const fx = (sim.force.x / fMag) * capped;
        const fy = (sim.force.y / fMag) * capped;
        const fz = (sim.force.z / fMag) * capped;
        const tip = project(sim.particle.x + fx, sim.particle.y + fy, sim.particle.z + fz, cx, cy, baseScale);
        const fColor = '#ef4444';
        ctx.strokeStyle = fColor;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(pProj.sx, pProj.sy);
        ctx.lineTo(tip.sx, tip.sy);
        ctx.stroke();
        drawArrowHead(pProj.sx, pProj.sy, tip.sx, tip.sy, 9.5, fColor);

        ctx.font = '700 12px "Be Vietnam Pro", system-ui, sans-serif';
        ctx.fillStyle = fColor;
        ctx.fillText('F_hl', tip.sx + 6, tip.sy - 4);
      }
    }
  }

  let alive = true;
  let rafId = 0;
  let lastFrameMs = performance.now();
  let lastHudMs = 0;

  function loop(nowMs) {
    if (!alive) return;
    const rawDt = Math.min(0.04, Math.max(0.001, (nowMs - lastFrameMs) / 1000));
    lastFrameMs = nowMs;

    if (playing) {
      const simDt = rawDt * speedMul;
      const steps = simDt > 0.025 ? 2 : 1;
      for (let s = 0; s < steps; s++) {
        stepBrownianState(sim, simDt / steps);
      }
    }

    renderFrame();

    if (nowMs - lastHudMs >= 200) {
      lastHudMs = nowMs;
      const m = getBrownianMetrics(sim);
      hudTemp.textContent = `T = ${m.temperatureC}°C (${m.temperatureK} K)`;
      hudHits.textContent = `Va chạm: ${m.collisionsPerSec} /s`;
      hudDisp.textContent = `|Δr| = ${m.displacement.toFixed(2)}`;
      hudMsd.textContent = `⟨r²⟩ = ${m.msd.toFixed(3)}`;
    }
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  // Public helper for interactive lesson step buttons
  function applyStepPreset(patch = {}) {
    if (patch.presetId && BROWNIAN_PRESETS[patch.presetId]) {
      presetSel.value = patch.presetId;
      resetSimulation(patch.presetId);
    }
    if (patch.temperatureC !== undefined) {
      tempSlider.value = String(patch.temperatureC);
      tempValEl.textContent = `${patch.temperatureC} °C`;
      updateBrownianParams(sim, { temperatureC: patch.temperatureC });
    }
    if (patch.particleRadius !== undefined) {
      sizeSlider.value = String(Math.round(patch.particleRadius * 1000));
      sizeValEl.textContent = sizeLabelFor(patch.particleRadius);
      updateBrownianParams(sim, { particleRadius: patch.particleRadius });
    }
    if (patch.viewMode) setViewMode(patch.viewMode);
    if (typeof patch.showMolecules === 'boolean') { showMolecules = patch.showMolecules; chkMol.cb.checked = showMolecules; }
    if (typeof patch.showTrail === 'boolean') { showTrail = patch.showTrail; chkTrail.cb.checked = showTrail; }
    if (typeof patch.showMarkers === 'boolean') { showMarkers = patch.showMarkers; chkMarkers.cb.checked = showMarkers; }
    if (typeof patch.showForce === 'boolean') { showForce = patch.showForce; chkForce.cb.checked = showForce; }
    if (patch.clearTrail) clearBrownianTrail(sim);
    if (!playing) {
      playing = true;
      btnPlay.textContent = 'Tạm dừng';
    }
    stageShell.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cleanup() {
    alive = false;
    cancelAnimationFrame(rafId);
    ro.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
  }

  return { applyStepPreset, cleanup };
}
