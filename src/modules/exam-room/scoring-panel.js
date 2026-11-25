import { element, button } from '../../core/dom.js';
import { suggestScoringConfigForCounts } from '../../../shared/exam-grading.js';

const E = element;

function roundPts(n, digits = 4) {
  const p = 10 ** digits;
  return Math.round((Number(n) || 0) * p) / p;
}

function fmtPts(n) {
  const num = Number(n) || 0;
  return Number.isInteger(num) ? String(num) : String(Math.round(num * 1000) / 1000);
}

/**
 * Reusable Per-Part Scoring Config Panel shared by BOTH Mode 1 (split_omr) and Mode 2 (unified_inline).
 * Synchronizes "Điểm/câu" <-> "Tổng điểm phần" bidirectionally and enforces BGD 2025 Part II progressive scale.
 */
export function createScoringConfigControl({ initialCounts = { I: 12, II: 4, III: 6 } } = {}) {
  let counts = {
    I: Math.max(0, Math.floor(Number(initialCounts.I) || 0)),
    II: Math.max(0, Math.floor(Number(initialCounts.II) || 0)),
    III: Math.max(0, Math.floor(Number(initialCounts.III) || 0))
  };
  let userTouched = false;
  let state = suggestScoringConfigForCounts(counts);

  const wrap = E('section', 'exam-scoring-box');
  const head = E('div', 'exam-scoring-head');
  const titleBlock = E('div', '');
  titleBlock.append(
    E('strong', 'exam-scoring-title', 'Cấu trúc chia điểm từng phần'),
    E('small', 'exam-scoring-sub', 'Phần II (Đúng/Sai 4 ý) luôn chấm lũy tiến chuẩn GDPT 2018: 1 ý = 10% · 2 ý = 25% · 3 ý = 50% · 4 ý = 100%.')
  );
  const totalBadge = E('span', 'exam-scoring-total exu-tabular', 'Tổng: 10,00 điểm');
  head.append(titleBlock, totalBadge);

  const presetRow = E('div', 'exam-preset-pills exam-scoring-presets');
  const presetDefs = [
    { key: 'math_2025', label: 'Toán 2025 (12–4–6)', pq: { I: 0.25, II: 1, III: 0.5 } },
    { key: 'science_2025', label: 'Lý·Hóa·Sinh·Địa (18–4–6)', pq: { I: 0.25, II: 1, III: 0.25 } },
    { key: 'social_it_2025', label: 'Sử·Tin·CN (24–4–0)', pq: { I: 0.25, II: 1, III: 0 } },
    { key: 'equal_10', label: 'Chia đều thang 10', pq: null }
  ];
  const presetBtns = new Map();

  const applyPresetKey = (key, fromUser = true) => {
    if (fromUser) userTouched = true;
    if (key === 'equal_10') {
      const totalQ = counts.I + counts.II + counts.III;
      const each = totalQ > 0 ? roundPts(10 / totalQ, 4) : 0.25;
      state = {
        preset: 'custom',
        perQuestion: { I: each, II: each, III: each },
        partTotals: {
          I: roundPts(counts.I * each, 4),
          II: roundPts(counts.II * each, 4),
          III: roundPts(counts.III * each, 4)
        },
        normalizeTo10: false
      };
    } else {
      const found = presetDefs.find(p => p.key === key);
      if (found?.pq) {
        state = {
          preset: key,
          perQuestion: { ...found.pq },
          partTotals: undefined,
          normalizeTo10: false
        };
      }
    }
    syncInputsFromState();
  };

  for (const p of presetDefs) {
    const b = button(p.label, 'exam-preset-pill', () => applyPresetKey(p.key, true));
    presetBtns.set(p.key, b);
    presetRow.append(b);
  }

  const grid = E('div', 'exam-scoring-grid');
  const rows = {};
  const partMeta = [
    ['I', 'Phần I · Trắc nghiệm A–D', 'Điểm/câu', 'Tổng Phần I'],
    ['II', 'Phần II · Đúng/Sai (4 ý)', 'Điểm tối đa/câu', 'Tổng Phần II'],
    ['III', 'Phần III · Trả lời ngắn', 'Điểm/câu', 'Tổng Phần III']
  ];

  for (const [part, labelText, pqLabel, totLabel] of partMeta) {
    const row = E('div', 'exam-scoring-part-card');
    const rowTop = E('div', 'exam-scoring-part-head');
    const countTag = E('span', 'exam-scoring-count exu-tabular', `${counts[part]} câu`);
    rowTop.append(E('strong', '', labelText), countTag);

    const fields = E('div', 'exam-scoring-inputs');
    const pqWrap = E('label', 'exam-scoring-field');
    pqWrap.append(E('small', '', pqLabel));
    const pqInput = E('input', 'exam-input exu-tabular');
    pqInput.type = 'number';
    pqInput.min = '0';
    pqInput.max = '100';
    pqInput.step = '0.05';

    const totWrap = E('label', 'exam-scoring-field');
    totWrap.append(E('small', '', totLabel));
    const totInput = E('input', 'exam-input exu-tabular');
    totInput.type = 'number';
    totInput.min = '0';
    totInput.max = '100';
    totInput.step = '0.25';

    pqInput.addEventListener('input', () => {
      userTouched = true;
      const val = Math.max(0, Number(pqInput.value) || 0);
      state.preset = 'custom';
      state.perQuestion[part] = val;
      if (state.partTotals) delete state.partTotals;
      totInput.value = fmtPts(roundPts(val * counts[part], 3));
      refreshSummaryOnly();
    });

    totInput.addEventListener('input', () => {
      userTouched = true;
      const totVal = Math.max(0, Number(totInput.value) || 0);
      state.preset = 'custom';
      const nextTotals = {
        I: state.partTotals?.I ?? roundPts(state.perQuestion.I * counts.I, 4),
        II: state.partTotals?.II ?? roundPts(state.perQuestion.II * counts.II, 4),
        III: state.partTotals?.III ?? roundPts(state.perQuestion.III * counts.III, 4),
        [part]: totVal
      };
      state.partTotals = nextTotals;
      const each = counts[part] > 0 ? roundPts(totVal / counts[part], 4) : 0;
      state.perQuestion[part] = each;
      pqInput.value = fmtPts(each);
      refreshSummaryOnly();
    });

    pqWrap.append(pqInput);
    totWrap.append(totInput);
    fields.append(pqWrap, totWrap);

    const partNote = E('small', 'exam-scoring-part-note exu-tabular', '');
    row.append(rowTop, fields, partNote);
    grid.append(row);
    rows[part] = { row, countTag, pqInput, totInput, partNote };
  }

  const footer = E('div', 'exam-scoring-footer');
  const normLabel = E('label', 'exu-check-row');
  const normCheck = document.createElement('input');
  normCheck.type = 'checkbox';
  normCheck.addEventListener('change', () => {
    userTouched = true;
    state.normalizeTo10 = normCheck.checked;
    refreshSummaryOnly();
  });
  normLabel.append(normCheck, document.createTextNode('Tự động quy đổi tỷ lệ về thang 10 khi tổng điểm khác 10'));
  const warnText = E('small', 'exam-scoring-warn', '');
  footer.append(normLabel, warnText);

  wrap.append(head, presetRow, grid, footer);

  function computePartTotal(part) {
    if (counts[part] <= 0) return 0;
    if (state.partTotals && Number.isFinite(state.partTotals[part])) {
      return roundPts(state.partTotals[part], 4);
    }
    return roundPts((Number(state.perQuestion[part]) || 0) * counts[part], 4);
  }

  function refreshSummaryOnly() {
    const tI = computePartTotal('I');
    const tII = computePartTotal('II');
    const tIII = computePartTotal('III');
    const sum = roundPts(tI + tII + tIII, 2);

    totalBadge.textContent = state.normalizeTo10 && Math.abs(sum - 10) > 0.01
      ? `Tổng thô: ${sum.toFixed(2)}đ → Quy thang 10`
      : `Tổng: ${sum.toFixed(2)} điểm`;
    totalBadge.classList.toggle('is-ok', Math.abs(sum - 10) <= 0.01 || state.normalizeTo10);
    totalBadge.classList.toggle('is-warn', Math.abs(sum - 10) > 0.01 && !state.normalizeTo10);

    for (const [k, btn] of presetBtns.entries()) {
      btn.classList.toggle('is-active', state.preset === k);
    }

    const q2Each = counts.II > 0 ? roundPts(computePartTotal('II') / counts.II, 4) : (Number(state.perQuestion.II) || 1);
    rows.I.partNote.textContent = counts.I > 0 ? `${counts.I} câu × ${fmtPts(state.perQuestion.I)}đ = ${tI.toFixed(2)}đ` : 'Không có câu Phần I';
    rows.II.partNote.textContent = counts.II > 0
      ? `1ý: ${roundPts(q2Each * 0.1, 2)} · 2ý: ${roundPts(q2Each * 0.25, 2)} · 3ý: ${roundPts(q2Each * 0.5, 2)} · 4ý: ${roundPts(q2Each, 2)}đ`
      : 'Không có câu Phần II';
    rows.III.partNote.textContent = counts.III > 0 ? `${counts.III} câu × ${fmtPts(state.perQuestion.III)}đ = ${tIII.toFixed(2)}đ` : 'Không có câu Phần III';

    if (counts.I + counts.II + counts.III === 0) {
      warnText.textContent = '';
    } else if (Math.abs(sum - 10) > 0.01 && !state.normalizeTo10) {
      warnText.textContent = `Tổng điểm hiện tại là ${sum.toFixed(2)}đ (khác 10đ). Bạn có thể giữ thang ${sum.toFixed(2)}đ hoặc bật quy đổi thang 10.`;
    } else {
      warnText.textContent = '';
    }
  }

  function syncInputsFromState() {
    for (const part of ['I', 'II', 'III']) {
      const r = rows[part];
      r.countTag.textContent = `${counts[part]} câu`;
      r.row.classList.toggle('is-empty', counts[part] === 0);
      r.pqInput.value = fmtPts(state.perQuestion[part]);
      r.totInput.value = fmtPts(computePartTotal(part));
      r.pqInput.disabled = counts[part] === 0;
      r.totInput.disabled = counts[part] === 0;
    }
    normCheck.checked = Boolean(state.normalizeTo10);
    refreshSummaryOnly();
  }

  syncInputsFromState();

  return {
    el: wrap,
    updateCounts(nextCounts) {
      counts = {
        I: Math.max(0, Math.floor(Number(nextCounts?.I) || 0)),
        II: Math.max(0, Math.floor(Number(nextCounts?.II) || 0)),
        III: Math.max(0, Math.floor(Number(nextCounts?.III) || 0))
      };
      if (!userTouched) {
        state = suggestScoringConfigForCounts(counts);
      }
      syncInputsFromState();
    },
    getConfig() {
      const cfg = {
        preset: state.preset,
        perQuestion: {
          I: roundPts(state.perQuestion.I, 6),
          II: roundPts(state.perQuestion.II, 6),
          III: roundPts(state.perQuestion.III, 6)
        },
        normalizeTo10: Boolean(state.normalizeTo10)
      };
      if (state.partTotals) {
        cfg.partTotals = {
          I: counts.I > 0 ? roundPts(state.partTotals.I, 6) : 0,
          II: counts.II > 0 ? roundPts(state.partTotals.II, 6) : 0,
          III: counts.III > 0 ? roundPts(state.partTotals.III, 6) : 0
        };
      }
      return cfg;
    }
  };
}
