import katex from 'katex';
import { element, button } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { EXPERIMENT_SUBJECTS, EXPERIMENTS } from './experiments-data.js';
import { mountBrownian3D } from './brownian-3d.js';

// Safe inline KaTeX text renderer ($...$) without interpolating raw HTML
function appendRichText(parent, text) {
  const parts = String(text || '').split(/(\$[^$]+\$)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      const span = document.createElement('span');
      span.className = 'exp-math';
      try {
        span.innerHTML = katex.renderToString(part.slice(1, -1), { throwOnError: false });
      } catch {
        span.textContent = part.slice(1, -1);
      }
      parent.append(span);
    } else {
      parent.append(document.createTextNode(part));
    }
  }
}

function richParagraph(className, text) {
  const p = element('p', className);
  appendRichText(p, text);
  return p;
}

export function renderExperiments() {
  let activeCleanup = () => {};
  let selectedSubject = 'all';

  const root = element('div', 'exam-root exp-root');
  const hero = element('section', 'hero exam-hero');
  hero.append(
    element('h2', 'hero-title', 'Mô hình thí nghiệm'),
    element('p', 'hero-subtitle', 'Chọn môn học và mô hình thí nghiệm để xem bối cảnh lịch sử, bố trí, tiến trình, giải thích và trực quan hóa bằng mô phỏng 3D tương tác.')
  );
  const body = element('div', 'exp-body');
  root.append(hero, body);

  const clearSim = () => {
    try { activeCleanup(); } catch {}
    activeCleanup = () => {};
  };

  function showCatalog() {
    clearSim();
    hero.hidden = false;

    const subjectTabs = element('div', 'exam-tabs');
    for (const s of EXPERIMENT_SUBJECTS) {
      const count = s.id === 'all'
        ? EXPERIMENTS.length
        : EXPERIMENTS.filter((ex) => ex.subject === s.id).length;
      const b = button(`${s.label} (${count})`, `exam-tab${selectedSubject === s.id ? ' selected' : ''}`, () => {
        selectedSubject = s.id;
        showCatalog();
      });
      subjectTabs.append(b);
    }

    const filtered = selectedSubject === 'all'
      ? EXPERIMENTS
      : EXPERIMENTS.filter((ex) => ex.subject === selectedSubject);

    const grid = element('div', 'exp-catalog-grid');
    if (!filtered.length) {
      const empty = element('section', 'exam-panel');
      const subjObj = EXPERIMENT_SUBJECTS.find((s) => s.id === selectedSubject);
      empty.append(
        element('h3', 'exam-heading', `Môn ${subjObj?.label || ''} chưa có mô hình thí nghiệm`),
        element('p', 'exam-message', 'Bạn có thể chuyển sang môn Vật lý để mở mô hình Thí nghiệm Brown 3D, hoặc yêu cầu bổ sung thêm mô hình cho môn này.')
      );
      body.replaceChildren(subjectTabs, empty);
      return;
    }

    for (const ex of filtered) {
      const card = element('article', 'exp-card');
      const badges = element('div', 'exam-card-badges');
      badges.append(
        element('span', 'exam-card-pill is-doc', ex.subjectLabel),
        element('span', 'exam-card-pill', ex.grade)
      );
      if (ex.has3D) badges.append(element('span', 'exam-card-pill is-done', 'Mô phỏng 3D tương tác'));

      const openBtn = button('Mở mô hình thí nghiệm', 'primary-btn', () => showExperimentDetail(ex));
      openBtn.prepend(icon('flask', 15));

      card.append(
        badges,
        element('h3', 'exp-card-title', ex.title),
        element('p', 'exp-card-desc', ex.shortDesc),
        openBtn
      );
      grid.append(card);
    }

    body.replaceChildren(subjectTabs, grid);
  }

  function showExperimentDetail(ex) {
    clearSim();
    hero.hidden = true;

    const wrap = element('div', 'exp-detail');
    const detailHead = element('div', 'exp-detail-head');
    const titleCol = element('div', '');
    const metaBadges = element('div', 'exam-card-badges');
    metaBadges.append(
      element('span', 'exam-card-pill is-doc', ex.subjectLabel),
      element('span', 'exam-card-pill', ex.grade)
    );
    titleCol.append(metaBadges, element('h2', 'exp-detail-title', ex.title));

    const backBtn = button('← Danh sách mô hình', 'exam-tab', showCatalog);
    detailHead.append(titleCol, backBtn);

    // Quick section jump bar for teachers
    const jumpBar = element('div', 'exam-tabs exp-jump-bar');
    const sections = [
      ['sim', 'Mô phỏng 3D'],
      ['history', '1. Bối cảnh lịch sử'],
      ['setup', '2. Bố trí thí nghiệm'],
      ['procedure', '3. Tiến trình'],
      ['observations', '4. Kết quả quan sát'],
      ['explanation', '5. Giải thích'],
      ['conclusion', '6. Ý nghĩa & Kết luận']
    ];
    for (const [sid, label] of sections) {
      jumpBar.append(button(label, 'exam-tab', () => {
        wrap.querySelector(`#exp-sec-${sid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
    }

    // 3D Interactive Lab Section
    const simHost = element('div', 'exp-sim-host');
    simHost.id = 'exp-sec-sim';
    let simApi = null;
    if (ex.simKind === 'brownian') {
      simApi = mountBrownian3D(simHost);
      activeCleanup = simApi.cleanup;
    }

    // 6 Structured Academic Sections
    const theoryGrid = element('div', 'exp-theory-stack');

    // 1. Bối cảnh lịch sử
    const secHistory = element('section', 'exam-panel exp-section');
    secHistory.id = 'exp-sec-history';
    secHistory.append(
      element('h3', 'exam-heading', `1. ${ex.history.title}`),
      richParagraph('exp-prose', ex.history.summary)
    );
    const msList = element('ul', 'exp-bullet-list');
    for (const m of ex.history.milestones) {
      const li = element('li', '');
      appendRichText(li, m);
      msList.append(li);
    }
    secHistory.append(msList);

    // 2. Bố trí thí nghiệm
    const secSetup = element('section', 'exam-panel exp-section');
    secSetup.id = 'exp-sec-setup';
    secSetup.append(
      element('h3', 'exam-heading', `2. ${ex.setup.title}`),
      richParagraph('exp-prose', ex.setup.intro)
    );
    const setupGrid = element('div', 'exp-item-grid');
    for (const it of ex.setup.items) {
      const box = element('div', 'exp-info-card');
      box.append(element('strong', '', it.name), richParagraph('exp-card-text', it.detail));
      setupGrid.append(box);
    }
    secSetup.append(setupGrid);

    // 3. Tiến trình thí nghiệm (interactive step buttons synced with 3D model)
    const secProc = element('section', 'exam-panel exp-section');
    secProc.id = 'exp-sec-procedure';
    secProc.append(element('h3', 'exam-heading', `3. ${ex.procedure.title}`));
    const stepList = element('div', 'exp-step-list');
    for (const st of ex.procedure.steps) {
      const row = element('article', 'exp-step-card');
      const num = element('span', 'exp-step-num', String(st.step));
      const content = element('div', 'exp-step-body');
      content.append(element('strong', '', st.heading), richParagraph('exp-card-text', st.detail));
      if (st.presetPatch && simApi) {
        const applyBtn = button(st.actionLabel || 'Mô phỏng bước này', 'focus-btn is-sm', () => {
          simApi.applyStepPreset(st.presetPatch);
        });
        content.append(applyBtn);
      }
      row.append(num, content);
      stepList.append(row);
    }
    secProc.append(stepList);

    // 4. Kết quả quan sát
    const secObs = element('section', 'exam-panel exp-section');
    secObs.id = 'exp-sec-observations';
    secObs.append(element('h3', 'exam-heading', `4. ${ex.observations.title}`));
    const obsGrid = element('div', 'exp-item-grid');
    for (const ob of ex.observations.items) {
      const box = element('div', 'exp-info-card');
      box.append(element('strong', '', ob.label), richParagraph('exp-card-text', ob.text));
      obsGrid.append(box);
    }
    secObs.append(obsGrid);

    // 5. Giải thích
    const secExp = element('section', 'exam-panel exp-section');
    secExp.id = 'exp-sec-explanation';
    secExp.append(element('h3', 'exam-heading', `5. ${ex.explanation.title}`));
    const expList = element('ol', 'exp-num-list');
    for (const pt of ex.explanation.points) {
      const li = element('li', '');
      appendRichText(li, pt);
      expList.append(li);
    }
    secExp.append(expList);

    // 6. Ý nghĩa và kết luận
    const secConc = element('section', 'exam-panel exp-section');
    secConc.id = 'exp-sec-conclusion';
    secConc.append(element('h3', 'exam-heading', `6. ${ex.conclusion.title}`));
    const concList = element('ul', 'exp-bullet-list');
    for (const c of ex.conclusion.conclusions) {
      const li = element('li', '');
      appendRichText(li, c);
      concList.append(li);
    }
    const sigBox = element('div', 'exp-callout');
    sigBox.append(element('strong', '', 'Ý nghĩa khoa học'), richParagraph('exp-card-text', ex.conclusion.significance));
    const noteBox = element('div', 'exp-callout is-warning');
    noteBox.append(element('strong', '', 'Lưu ý tránh nhầm lẫn khi làm bài tập'), richParagraph('exp-card-text', ex.conclusion.misconception));
    secConc.append(concList, sigBox, noteBox);

    theoryGrid.append(secHistory, secSetup, secProc, secObs, secExp, secConc);
    wrap.append(detailHead, jumpBar, simHost, theoryGrid);
    body.replaceChildren(wrap);
  }

  const watcher = new MutationObserver(() => {
    if (!root.isConnected) {
      clearSim();
      watcher.disconnect();
    }
  });
  watcher.observe(document.getElementById('main-content') || document.body, { childList: true });

  showCatalog();
  return root;
}
