import { element, button } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { checkSentenceRewrite, filterVocabItems, computeEnglishStats } from '../../../shared/english-core.js';
import { ENGLISH_THEMES, BASE_VOCAB, GRAMMAR_TOPICS, ENGLISH_QUIZ_BANK, REWRITE_EXERCISES } from './english-data.js';

const STORAGE_KEY = 'htvvm-english-studio-v1';

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      vocabStatus: raw.vocabStatus && typeof raw.vocabStatus === 'object' ? raw.vocabStatus : {},
      grammarStatus: raw.grammarStatus && typeof raw.grammarStatus === 'object' ? raw.grammarStatus : {},
      grammarNotes: raw.grammarNotes && typeof raw.grammarNotes === 'object' ? raw.grammarNotes : {},
      starred: raw.starred && typeof raw.starred === 'object' ? raw.starred : {},
      customWords: Array.isArray(raw.customWords) ? raw.customWords : [],
      quizHistory: Array.isArray(raw.quizHistory) ? raw.quizHistory : []
    };
  } catch {
    return { vocabStatus: {}, grammarStatus: {}, grammarNotes: {}, starred: {}, customWords: [], quizHistory: [] };
  }
}

function saveProgress(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function speakWord(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const clean = String(text || '').replace(/\([^)]*\)/g, '').trim();
    if (!clean) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'en-US';
    utter.rate = 0.92;
    window.speechSynthesis.speak(utter);
  } catch { /* ignore unsupported TTS */ }
}

export function renderEnglishStudio(rootHost, { onBack = null } = {}) {
  const progress = loadProgress();
  const allVocab = () => [...progress.customWords, ...BASE_VOCAB];
  let activeSubTab = 'flashcards';
  let activeGrammarId = GRAMMAR_TOPICS[0].id;
  let cleanupMode = () => {};

  const wrap = element('div', 'eng-studio');

  // Header + Global Stats Pill + Controls
  const hero = element('section', 'eng-hero');
  const heroTop = element('div', 'eng-hero-top');
  const titleGroup = element('div', 'eng-title-group');
  titleGroup.append(
    element('span', 'arena-eyebrow', 'ARENA · TIẾNG ANH STUDIO (QUIZLET STYLE)'),
    element('h2', 'eng-title', 'Từ vựng, Flashcard 3D, Viết lại câu & Ngữ pháp')
  );
  const heroActions = element('div', 'eng-hero-actions');
  const masteryPill = element('span', 'eng-mastery-pill', '');
  const addWordBtn = button('+ Thêm từ mới', 'focus-btn', () => openAddWordModal());
  heroActions.append(masteryPill, addWordBtn);
  if (onBack) heroActions.append(button('← Hub Arena', 'exam-tab', () => { cleanupMode(); onBack(); }));
  heroTop.append(titleGroup, heroActions);

  // Global search row
  const searchRow = element('div', 'eng-search-row');
  const globalSearch = document.createElement('input');
  globalSearch.type = 'search';
  globalSearch.className = 'exam-input eng-search-input';
  globalSearch.placeholder = 'Tìm nhanh từ vựng, nghĩa hoặc cấu trúc ngữ pháp…';
  const searchDropdown = element('div', 'eng-search-results');
  searchDropdown.hidden = true;
  searchRow.append(globalSearch, searchDropdown);

  hero.append(heroTop, searchRow);

  const tabsRow = element('div', 'eng-subtabs');
  const subTabs = [
    ['flashcards', 'Flashcard 3D'],
    ['vocab', 'Sổ từ vựng'],
    ['grammar', 'Cấu trúc ngữ pháp'],
    ['quiz', 'Trắc nghiệm'],
    ['rewrite', 'Viết lại câu']
  ];
  const tabBtns = new Map();
  for (const [id, label] of subTabs) {
    const b = button(label, `exam-tab${id === activeSubTab ? ' selected' : ''}`, () => switchSubTab(id));
    tabBtns.set(id, b);
    tabsRow.append(b);
  }

  const stage = element('div', 'eng-stage');
  wrap.append(hero, tabsRow, stage);
  rootHost.replaceChildren(wrap);

  function refreshMastery() {
    const st = computeEnglishStats(allVocab(), GRAMMAR_TOPICS, progress);
    masteryPill.textContent = `Thành thạo: ${st.vocabMastered}/${st.vocabTotal} từ · ${st.grammarMastered}/${st.grammarTotal} ngữ pháp`;
  }
  refreshMastery();

  function switchSubTab(id, preset = {}) {
    cleanupMode();
    cleanupMode = () => {};
    activeSubTab = id;
    for (const [k, btn] of tabBtns.entries()) btn.classList.toggle('selected', k === id);
    searchDropdown.hidden = true;
    if (id === 'flashcards') renderFlashcards(preset);
    else if (id === 'vocab') renderVocabList(preset);
    else if (id === 'grammar') renderGrammarAtlas();
    else if (id === 'quiz') renderQuizRunner();
    else if (id === 'rewrite') renderRewriteTrainer();
  }

  globalSearch.addEventListener('input', () => {
    const q = globalSearch.value.trim().toLowerCase();
    if (!q) { searchDropdown.hidden = true; return; }
    const gMatches = GRAMMAR_TOPICS.filter((g) => `${g.title} ${g.formula}`.toLowerCase().includes(q)).slice(0, 4);
    const vMatches = allVocab().filter((v) => `${v.word} ${v.meaning} ${v.themeLabel}`.toLowerCase().includes(q)).slice(0, 8);
    searchDropdown.replaceChildren();
    if (!gMatches.length && !vMatches.length) {
      searchDropdown.append(element('p', 'exam-message', 'Không tìm thấy mục phù hợp.'));
    } else {
      for (const g of gMatches) {
        const b = button(`Ngữ pháp · ${g.title}`, 'eng-search-hit', () => {
          activeGrammarId = g.id;
          switchSubTab('grammar');
        });
        searchDropdown.append(b);
      }
      for (const v of vMatches) {
        const b = button(`${v.word} (${v.pos}) — ${v.meaning}`, 'eng-search-hit', () => {
          switchSubTab('vocab', { query: v.word });
        });
        searchDropdown.append(b);
      }
    }
    searchDropdown.hidden = false;
  });

  // =========================================================
  // MODAL: + THÊM TỪ MỚI
  // =========================================================
  function openAddWordModal() {
    const backdrop = element('div', 'eng-modal-backdrop');
    const dialog = element('section', 'eng-modal-card');
    const head = element('div', 'eng-modal-head');
    head.append(element('h3', '', 'Thêm từ vựng vào Sổ tay'), button('×', 'exam-card-icon-btn', () => backdrop.remove()));

    const wordIn = Object.assign(document.createElement('input'), { className: 'exam-input', placeholder: 'Từ / cụm tiếng Anh (vd: hypothesis)' });
    const ipaIn = Object.assign(document.createElement('input'), { className: 'exam-input', placeholder: 'Phiên âm IPA (tùy chọn, vd: /haɪˈpɒθəsɪs/)' });
    const posIn = Object.assign(document.createElement('input'), { className: 'exam-input', placeholder: 'Từ loại (n, v, adj, adv, phr.v…)', value: 'n' });
    const themeSel = document.createElement('select');
    themeSel.className = 'exam-input';
    for (const t of ENGLISH_THEMES.filter((x) => x.id !== 'all')) {
      const opt = element('option', '', t.label);
      opt.value = t.id;
      themeSel.append(opt);
    }
    const meanIn = Object.assign(document.createElement('input'), { className: 'exam-input', placeholder: 'Nghĩa tiếng Việt ngắn gọn' });
    const exIn = Object.assign(document.createElement('textarea'), { className: 'exam-input', rows: 2, placeholder: 'Câu ví dụ minh họa (tùy chọn)' });
    const msg = element('p', 'exam-message', '');

    const saveBtn = button('Lưu vào Sổ & Flashcard', 'primary-btn', () => {
      const word = wordIn.value.trim();
      const meaning = meanIn.value.trim();
      if (!word || !meaning) { msg.textContent = 'Hãy nhập ít nhất Từ tiếng Anh và Nghĩa tiếng Việt.'; return; }
      const themeObj = ENGLISH_THEMES.find((t) => t.id === themeSel.value) || ENGLISH_THEMES[1];
      progress.customWords.unshift({
        id: `custom-${Date.now()}`,
        theme: themeObj.id,
        themeLabel: themeObj.label,
        level: 'Tự thêm',
        word: word.slice(0, 80),
        ipa: ipaIn.value.trim().slice(0, 80),
        pos: (posIn.value.trim() || 'n').slice(0, 16),
        meaning: meaning.slice(0, 160),
        example: exIn.value.trim().slice(0, 260) || `Remember to use "${word}" in context.`
      });
      saveProgress(progress);
      refreshMastery();
      backdrop.remove();
      switchSubTab(activeSubTab);
    });

    dialog.append(head, wordIn, ipaIn, posIn, themeSel, meanIn, exIn, msg, saveBtn);
    backdrop.append(dialog);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
    wrap.append(backdrop);
    wordIn.focus();
  }

  // =========================================================
  // TAB 1: FLASHCARD 3D + QUIZLET REVIEW
  // =========================================================
  function renderFlashcards(preset = {}) {
    let theme = preset.theme || 'all';
    let filterMode = preset.filter || 'all'; // 'all' | 'unmastered' | 'starred' | 'mastered'
    let deck = [];
    let idx = 0;
    let flipped = false;

    const toolbar = element('div', 'eng-fc-toolbar');
    const themeSelect = document.createElement('select');
    themeSelect.className = 'exam-input';
    for (const t of ENGLISH_THEMES) {
      const o = element('option', '', t.label);
      o.value = t.id;
      themeSelect.append(o);
    }
    themeSelect.value = theme;

    const statusSelect = document.createElement('select');
    statusSelect.className = 'exam-input';
    for (const [val, lbl] of [['all', 'Tất cả thẻ'], ['unmastered', 'Chưa thành thạo'], ['starred', 'Đánh dấu sao'], ['mastered', 'Đã thuộc']]) {
      const o = element('option', '', lbl);
      o.value = val;
      statusSelect.append(o);
    }
    statusSelect.value = filterMode;

    const rebuildDeck = (shuffle = false) => {
      deck = filterVocabItems(allVocab(), { theme, status: filterMode, starredOnly: filterMode === 'starred' }, progress);
      if (shuffle) {
        for (let i = deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [deck[i], deck[j]] = [deck[j], deck[i]];
        }
      }
      idx = 0;
      flipped = false;
      paintCard();
    };

    themeSelect.onchange = () => { theme = themeSelect.value; rebuildDeck(false); };
    statusSelect.onchange = () => { filterMode = statusSelect.value; rebuildDeck(false); };
    toolbar.append(themeSelect, statusSelect, button('Trộn thẻ', 'exam-tab', () => rebuildDeck(true)));

    const progressLine = element('div', 'eng-fc-progress');
    const counterLabel = element('span', '', '');
    const pTrack = element('div', 'eng-fc-track');
    const pFill = element('div', 'eng-fc-fill');
    pTrack.append(pFill);
    progressLine.append(counterLabel, pTrack);

    const cardStage = element('div', 'eng-fc-stage');
    const actionRow = element('div', 'eng-fc-actions');
    const hintBar = element('p', 'exam-message', 'Phím tắt: Space lật thẻ · S phát âm · 1 Mới · 2 Đang học · 3 Đã thuộc · ←/→ chuyển thẻ.');

    stage.replaceChildren(toolbar, progressLine, cardStage, actionRow, hintBar);

    const paintCard = () => {
      cardStage.replaceChildren();
      actionRow.replaceChildren();
      if (!deck.length) {
        counterLabel.textContent = '0 / 0 thẻ';
        pFill.style.width = '0%';
        cardStage.append(element('p', 'exam-message', 'Không có thẻ nào khớp bộ lọc hiện tại.'));
        return;
      }
      if (idx >= deck.length) idx = 0;
      if (idx < 0) idx = deck.length - 1;
      const card = deck[idx];
      const st = progress.vocabStatus[card.id] || 'new';
      const isStar = Boolean(progress.starred[card.id]);
      counterLabel.textContent = `Thẻ ${idx + 1} / ${deck.length} · ${card.themeLabel}`;
      pFill.style.width = `${((idx + 1) / deck.length) * 100}%`;

      const scene = element('div', 'eng-fc-scene');
      const cardInner = element('div', `eng-fc-inner${flipped ? ' is-flipped' : ''}`);
      cardInner.tabIndex = 0;

      // Front face
      const front = element('div', 'eng-fc-face is-front');
      const fTop = element('div', 'eng-fc-face-top');
      fTop.append(element('span', 'exam-card-pill', `${card.pos || ''} · ${card.level || ''}`));
      const fTools = element('div', 'eng-fc-tools');
      const speakBtn = button('', 'exam-card-icon-btn', (e) => { e.stopPropagation(); speakWord(card.word); });
      speakBtn.title = 'Nghe phát âm';
      speakBtn.append(icon('volume', 15));
      const starBtn = button(isStar ? '★' : '☆', `exam-card-icon-btn${isStar ? ' is-starred' : ''}`, (e) => {
        e.stopPropagation();
        progress.starred[card.id] = !isStar;
        saveProgress(progress);
        paintCard();
      });
      starBtn.title = 'Đánh dấu sao';
      fTools.append(speakBtn, starBtn);
      fTop.append(fTools);

      const frontBody = element('div', 'eng-fc-body');
      frontBody.append(
        element('h3', 'eng-fc-word', card.word),
        element('p', 'eng-fc-ipa', card.ipa || 'Nhấn vào thẻ để xem nghĩa'),
        element('span', `eng-status-chip is-${st}`, st === 'mastered' ? 'Đã thuộc' : st === 'learning' ? 'Đang học' : 'Thẻ mới')
      );
      front.append(fTop, frontBody, element('small', 'eng-fc-tap-tip', 'Bấm thẻ hoặc nhấn Space để lật'));

      // Back face
      const back = element('div', 'eng-fc-face is-back');
      const bTop = element('div', 'eng-fc-face-top');
      bTop.append(element('span', 'exam-card-pill is-doc', card.word));
      const bSpeak = button('Nghe lại', 'exam-tab', (e) => { e.stopPropagation(); speakWord(card.word); });
      bTop.append(bSpeak);
      const backBody = element('div', 'eng-fc-body');
      backBody.append(
        element('h3', 'eng-fc-meaning', card.meaning),
        element('p', 'eng-fc-example', card.example || '')
      );
      back.append(bTop, backBody, element('small', 'eng-fc-tap-tip', 'Chọn mức độ ghi nhớ bên dưới'));

      cardInner.append(front, back);
      cardInner.addEventListener('click', () => {
        flipped = !flipped;
        cardInner.classList.toggle('is-flipped', flipped);
      });
      scene.append(cardInner);
      cardStage.append(scene);

      const rate = (nextStatus) => {
        progress.vocabStatus[card.id] = nextStatus;
        saveProgress(progress);
        refreshMastery();
        flipped = false;
        idx = (idx + 1) % deck.length;
        paintCard();
      };
      actionRow.append(
        button('← Trước', 'exam-tab', () => { flipped = false; idx = (idx - 1 + deck.length) % deck.length; paintCard(); }),
        button('1. Chưa thuộc', 'exam-tab', () => rate('new')),
        button('2. Đang học', 'exam-tab', () => rate('learning')),
        button('3. Đã thuộc ✓', 'primary-btn', () => rate('mastered')),
        button('Sau →', 'exam-tab', () => { flipped = false; idx = (idx + 1) % deck.length; paintCard(); })
      );
    };

    const onKeyDown = (e) => {
      if (!wrap.isConnected || activeSubTab !== 'flashcards') return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); flipped = !flipped; stage.querySelector('.eng-fc-inner')?.classList.toggle('is-flipped', flipped); }
      else if (e.key.toLowerCase() === 's' && deck[idx]) speakWord(deck[idx].word);
      else if (e.key === '1' && deck[idx]) { progress.vocabStatus[deck[idx].id] = 'new'; saveProgress(progress); refreshMastery(); idx = (idx + 1) % deck.length; flipped = false; paintCard(); }
      else if (e.key === '2' && deck[idx]) { progress.vocabStatus[deck[idx].id] = 'learning'; saveProgress(progress); refreshMastery(); idx = (idx + 1) % deck.length; flipped = false; paintCard(); }
      else if (e.key === '3' && deck[idx]) { progress.vocabStatus[deck[idx].id] = 'mastered'; saveProgress(progress); refreshMastery(); idx = (idx + 1) % deck.length; flipped = false; paintCard(); }
      else if (e.key === 'ArrowRight' && deck.length) { flipped = false; idx = (idx + 1) % deck.length; paintCard(); }
      else if (e.key === 'ArrowLeft' && deck.length) { flipped = false; idx = (idx - 1 + deck.length) % deck.length; paintCard(); }
    };
    window.addEventListener('keydown', onKeyDown);
    cleanupMode = () => window.removeEventListener('keydown', onKeyDown);
    rebuildDeck(false);
  }

  // =========================================================
  // TAB 2: SỔ TỪ VỰNG
  // =========================================================
  function renderVocabList(preset = {}) {
    let theme = preset.theme || 'all';
    let status = 'all';
    let query = preset.query || '';

    const themeBar = element('div', 'eng-theme-pills');
    const filterRow = element('div', 'eng-vocab-filters');
    const qInput = Object.assign(document.createElement('input'), {
      type: 'search',
      className: 'exam-input',
      placeholder: 'Lọc trong sổ từ…',
      value: query
    });
    const statusSel = document.createElement('select');
    statusSel.className = 'exam-input';
    for (const [v, l] of [['all', 'Tất cả trạng thái'], ['new', 'Mới'], ['learning', 'Đang học'], ['mastered', 'Đã thuộc'], ['starred', 'Đánh sao']]) {
      const o = element('option', '', l);
      o.value = v;
      statusSel.append(o);
    }
    const launchFcBtn = button('Ôn nhóm này bằng Flashcard →', 'primary-btn', () => switchSubTab('flashcards', { theme }));
    filterRow.append(qInput, statusSel, launchFcBtn);

    const grid = element('div', 'eng-vocab-grid');
    stage.replaceChildren(themeBar, filterRow, grid);

    const drawThemes = () => {
      themeBar.replaceChildren();
      const full = allVocab();
      for (const t of ENGLISH_THEMES) {
        const count = t.id === 'all' ? full.length : full.filter((x) => x.theme === t.id).length;
        const b = button(`${t.label} (${count})`, `exam-tab${theme === t.id ? ' selected' : ''}`, () => {
          theme = t.id;
          drawThemes();
          drawCards();
        });
        themeBar.append(b);
      }
    };

    const drawCards = () => {
      grid.replaceChildren();
      const filtered = filterVocabItems(allVocab(), {
        theme,
        status: status === 'starred' ? 'all' : status,
        starredOnly: status === 'starred',
        query
      }, progress);
      if (!filtered.length) {
        grid.append(element('p', 'exam-message', 'Chưa có từ vựng khớp bộ lọc.'));
        return;
      }
      for (const item of filtered) {
        const st = progress.vocabStatus[item.id] || 'new';
        const starred = Boolean(progress.starred[item.id]);
        const card = element('article', `eng-vocab-card is-${st}`);
        const top = element('div', 'eng-vocab-top');
        top.append(element('span', 'exam-card-pill', `${item.themeLabel} · ${item.level || ''}`));
        const topTools = element('div', 'eng-fc-tools');
        const speakBtn = button('', 'exam-card-icon-btn', () => speakWord(item.word));
        speakBtn.append(icon('volume', 14));
        const starBtn = button(starred ? '★' : '☆', `exam-card-icon-btn${starred ? ' is-starred' : ''}`, () => {
          progress.starred[item.id] = !starred;
          saveProgress(progress);
          drawCards();
        });
        topTools.append(speakBtn, starBtn);
        top.append(topTools);

        const body = element('div', 'eng-vocab-body');
        body.append(
          element('strong', 'eng-vocab-word', `${item.word} (${item.pos})`),
          element('small', 'eng-vocab-ipa', item.ipa || ''),
          element('p', 'eng-vocab-meaning', item.meaning),
          element('p', 'eng-vocab-ex', item.example || '')
        );

        const footer = element('div', 'eng-vocab-footer');
        for (const [sVal, sLbl] of [['new', 'Mới'], ['learning', 'Đang học'], ['mastered', 'Thuộc']]) {
          const btn = button(sLbl, `eng-mini-state${st === sVal ? ' is-active' : ''}`, () => {
            progress.vocabStatus[item.id] = sVal;
            saveProgress(progress);
            refreshMastery();
            drawCards();
          });
          footer.append(btn);
        }
        card.append(top, body, footer);
        grid.append(card);
      }
    };

    qInput.oninput = () => { query = qInput.value; drawCards(); };
    statusSel.onchange = () => { status = statusSel.value; drawCards(); };
    drawThemes();
    drawCards();
  }

  // =========================================================
  // TAB 3: CẤU TRÚC NGỮ PHÁP (2-COL ATLAS + MINI-QUIZ + GHI CHÚ)
  // =========================================================
  function renderGrammarAtlas() {
    const layout = element('div', 'eng-grammar-layout');
    const sidebar = element('aside', 'eng-grammar-list');
    const detail = element('article', 'eng-grammar-detail');
    layout.append(sidebar, detail);
    stage.replaceChildren(layout);

    const drawSidebar = () => {
      sidebar.replaceChildren();
      for (const topic of GRAMMAR_TOPICS) {
        const st = progress.grammarStatus[topic.id] || 'new';
        const btn = button('', `eng-grammar-item${topic.id === activeGrammarId ? ' is-active' : ''}`, () => {
          activeGrammarId = topic.id;
          drawSidebar();
          drawDetail();
        });
        btn.append(
          element('span', '', topic.title),
          element('small', `eng-status-dot is-${st}`, st === 'mastered' ? '✓' : st === 'learning' ? '•' : '')
        );
        sidebar.append(btn);
      }
    };

    const drawDetail = () => {
      const idx = Math.max(0, GRAMMAR_TOPICS.findIndex((g) => g.id === activeGrammarId));
      const g = GRAMMAR_TOPICS[idx];
      const st = progress.grammarStatus[g.id] || 'new';
      detail.replaceChildren();

      const head = element('div', 'eng-grammar-head');
      head.append(element('h3', '', g.title), element('span', 'exam-card-pill', g.frequency));
      const stateSeg = element('div', 'eng-vocab-footer');
      for (const [val, lbl] of [['new', 'Chưa ôn'], ['learning', 'Đang ôn'], ['mastered', 'Thành thạo']]) {
        stateSeg.append(button(lbl, `eng-mini-state${st === val ? ' is-active' : ''}`, () => {
          progress.grammarStatus[g.id] = val;
          saveProgress(progress);
          refreshMastery();
          drawSidebar();
          drawDetail();
        }));
      }
      detail.append(head, stateSeg);

      const formulaBox = document.createElement('pre');
      formulaBox.className = 'eng-formula-box';
      formulaBox.textContent = g.formula;
      detail.append(formulaBox);

      const ruleList = element('ul', 'eng-rule-list');
      for (const r of g.rules) ruleList.append(element('li', '', r));
      detail.append(ruleList);

      const calloutGrid = element('div', 'eng-callout-grid');
      const sigCard = element('div', 'eng-callout is-signals');
      sigCard.append(element('strong', '', 'Dấu hiệu nhận biết'), element('p', '', g.signals.join('  ·  ')));
      const trapCard = element('div', 'eng-callout is-traps');
      trapCard.append(element('strong', '', 'Lỗi bẫy hay gặp'), element('p', '', g.traps));
      calloutGrid.append(sigCard, trapCard);
      detail.append(calloutGrid);

      const exBox = element('div', 'eng-examples');
      exBox.append(element('strong', '', 'Ví dụ minh họa'));
      for (const ex of g.examples) {
        const row = element('div', 'eng-example-row');
        const txt = element('div', '');
        txt.append(element('p', 'eng-ex-en', ex.en), element('p', 'eng-ex-vi', ex.vi));
        const sp = button('', 'exam-card-icon-btn', () => speakWord(ex.en));
        sp.append(icon('volume', 14));
        row.append(txt, sp);
        exBox.append(row);
      }
      detail.append(exBox);

      // Inline Mini-Quiz
      if (g.miniQuiz) {
        const mq = element('div', 'eng-miniquiz');
        mq.append(element('strong', '', 'Kiểm tra nhanh 1 câu'), element('p', '', g.miniQuiz.prompt));
        const opts = element('div', 'eng-miniquiz-opts');
        const explain = element('p', 'exam-message', '');
        explain.hidden = true;
        g.miniQuiz.options.forEach((optText, i) => {
          const letter = 'ABCD'[i];
          const ob = button(`${letter}. ${optText}`, 'exam-option', () => {
            for (const c of opts.children) c.disabled = true;
            ob.classList.add(letter === g.miniQuiz.answer ? 'is-correct' : 'is-wrong');
            explain.hidden = false;
            explain.textContent = `${letter === g.miniQuiz.answer ? '✓ Chính xác!' : `✗ Đáp án đúng là ${g.miniQuiz.answer}.`} ${g.miniQuiz.explain}`;
          });
          opts.append(ob);
        });
        mq.append(opts, explain);
        detail.append(mq);
      }

      // Personal Notes
      const noteWrap = element('div', 'eng-note-box');
      const noteHead = element('div', 'eng-note-head');
      const noteSaved = element('small', '', '');
      noteHead.append(element('strong', '', 'Ghi chú cá nhân'), noteSaved);
      const noteTa = document.createElement('textarea');
      noteTa.className = 'exam-input';
      noteTa.rows = 2;
      noteTa.placeholder = 'Ghi chú mẹo nhớ riêng của bạn (tự động lưu trên máy)…';
      noteTa.value = progress.grammarNotes[g.id] || '';
      noteTa.oninput = () => {
        progress.grammarNotes[g.id] = noteTa.value;
        saveProgress(progress);
        noteSaved.textContent = 'Đã lưu ✓';
      };
      noteWrap.append(noteHead, noteTa);
      detail.append(noteWrap);

      const navRow = element('div', 'exam-tabs');
      if (idx > 0) navRow.append(button('← Chuyên đề trước', 'exam-tab', () => { activeGrammarId = GRAMMAR_TOPICS[idx - 1].id; drawSidebar(); drawDetail(); }));
      if (idx < GRAMMAR_TOPICS.length - 1) navRow.append(button('Chuyên đề tiếp →', 'primary-btn', () => { activeGrammarId = GRAMMAR_TOPICS[idx + 1].id; drawSidebar(); drawDetail(); }));
      detail.append(navRow);
    };

    drawSidebar();
    drawDetail();
  }

  // =========================================================
  // TAB 4: TRẮC NGHIỆM (MIXED / VOCAB / GRAMMAR + TIMER)
  // =========================================================
  function renderQuizRunner() {
    let scope = 'mixed';
    let count = 10;
    let instantCheck = true;
    let quizTimer = null;

    const cfgRow = element('div', 'eng-vocab-filters');
    const scopeSel = document.createElement('select');
    scopeSel.className = 'exam-input';
    for (const [val, lbl] of [['mixed', 'Hỗn hợp (Từ vựng + Ngữ pháp)'], ['vocab', 'Từ vựng đã chọn'], ['grammar', 'Ngữ pháp & Cấu trúc'], ['starred', 'Từ đánh dấu sao']]) {
      const o = element('option', '', lbl);
      o.value = val;
      scopeSel.append(o);
    }
    const countSel = document.createElement('select');
    countSel.className = 'exam-input';
    for (const n of [8, 12, 16]) {
      const o = element('option', '', `${n} câu · ${n} phút`);
      o.value = String(n);
      countSel.append(o);
    }
    const instantLabel = element('label', 'focus-share');
    const instantInput = document.createElement('input');
    instantInput.type = 'checkbox';
    instantInput.checked = instantCheck;
    instantInput.onchange = () => { instantCheck = instantInput.checked; };
    instantLabel.append(instantInput, document.createTextNode(' Hiện giải thích ngay'));

    const body = element('div', 'eng-quiz-body');
    const startBtn = button('Bắt đầu bài luyện', 'primary-btn', startNewQuiz);
    cfgRow.append(scopeSel, countSel, instantLabel, startBtn);
    stage.replaceChildren(cfgRow, body);

    function buildVocabMcqs() {
      const pool = scope === 'starred'
        ? allVocab().filter((v) => progress.starred[v.id])
        : allVocab();
      const source = pool.length >= 4 ? pool : BASE_VOCAB;
      return source.map((v) => {
        const distractors = BASE_VOCAB
          .filter((d) => d.id !== v.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((d) => d.meaning);
        const options = [...distractors, v.meaning].sort(() => Math.random() - 0.5);
        const ansLetter = 'ABCD'[options.indexOf(v.meaning)];
        return {
          prompt: `Nghĩa đúng nhất của "${v.word}" (${v.pos}) là gì?`,
          topic: v.themeLabel,
          options,
          answer: ansLetter,
          explain: `${v.word} (${v.ipa || v.pos}) = ${v.meaning}. Ví dụ: ${v.example || ''}`
        };
      });
    }

    function startNewQuiz() {
      if (quizTimer) clearInterval(quizTimer);
      scope = scopeSel.value;
      count = Number(countSel.value) || 8;
      let pool = [];
      if (scope === 'vocab' || scope === 'starred') pool = buildVocabMcqs();
      else if (scope === 'grammar') pool = [...ENGLISH_QUIZ_BANK];
      else pool = [...ENGLISH_QUIZ_BANK, ...buildVocabMcqs()];

      const picked = pool.sort(() => Math.random() - 0.5).slice(0, count);
      const userAns = {};
      let submitted = false;
      let remainSec = picked.length * 60;

      const topInfo = element('div', 'eng-quiz-top');
      const timerPill = element('strong', 'exam-run-clock', '');
      const statusText = element('span', 'exam-message', `0/${picked.length} câu đã chọn`);
      const submitBtn = button('Nộp & Chấm điểm', 'primary-btn', () => finishQuiz());
      topInfo.append(statusText, timerPill, submitBtn);

      const list = element('div', 'eng-quiz-list');
      const explainMap = new Map();
      const cardBtnMap = new Map();

      picked.forEach((q, i) => {
        const card = element('article', 'exam-question');
        card.append(element('h4', '', `Câu ${i + 1} · ${q.topic || 'English'}`), element('p', '', q.prompt));
        const opts = element('div', 'exam-options');
        const exLine = element('p', 'exam-message', '');
        exLine.hidden = true;
        explainMap.set(i, exLine);

        const btns = [];
        q.options.forEach((optText, j) => {
          const letter = 'ABCD'[j];
          const b = button(`${letter}. ${optText}`, 'exam-option', () => {
            if (submitted) return;
            userAns[i] = letter;
            btns.forEach((btn, idxBtn) => {
              const l = 'ABCD'[idxBtn];
              btn.classList.toggle('selected', l === letter);
              if (instantCheck) {
                btn.classList.remove('is-correct', 'is-wrong');
                if (l === q.answer) btn.classList.add('is-correct');
                else if (l === letter) btn.classList.add('is-wrong');
              }
            });
            if (instantCheck) {
              exLine.hidden = false;
              exLine.textContent = `${letter === q.answer ? '✓ Đúng!' : `✗ Đáp án đúng: ${q.answer}.`} ${q.explain || ''}`;
            }
            statusText.textContent = `${Object.keys(userAns).length}/${picked.length} câu đã chọn`;
          });
          btns.push(b);
          opts.append(b);
        });
        cardBtnMap.set(i, btns);
        card.append(opts, exLine);
        list.append(card);
      });

      const banner = element('div', 'exam-auto-banner');
      banner.hidden = true;
      body.replaceChildren(topInfo, banner, list);

      const fmtClock = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
      timerPill.textContent = fmtClock(remainSec);
      quizTimer = setInterval(() => {
        if (!wrap.isConnected) { clearInterval(quizTimer); quizTimer = null; return; }
        remainSec--;
        timerPill.textContent = fmtClock(Math.max(0, remainSec));
        if (remainSec <= 0) finishQuiz();
      }, 1000);

      function finishQuiz() {
        if (submitted) return;
        submitted = true;
        if (quizTimer) clearInterval(quizTimer);
        quizTimer = null;
        let correct = 0;
        picked.forEach((q, i) => {
          const chosen = userAns[i];
          if (chosen === q.answer) correct++;
          const btns = cardBtnMap.get(i) || [];
          btns.forEach((btn, j) => {
            const l = 'ABCD'[j];
            btn.disabled = true;
            btn.classList.remove('selected');
            if (l === q.answer) btn.classList.add('is-correct');
            else if (l === chosen) btn.classList.add('is-wrong');
          });
          const exLine = explainMap.get(i);
          if (exLine) {
            exLine.hidden = false;
            exLine.textContent = `${chosen === q.answer ? '✓ Đúng!' : `✗ Đáp án đúng là ${q.answer}.`} ${q.explain || ''}`;
          }
        });
        const score = ((correct / Math.max(1, picked.length)) * 10).toFixed(2);
        banner.hidden = false;
        banner.textContent = `Hoàn thành: đúng ${correct}/${picked.length} câu (${score}/10 điểm).`;
        submitBtn.disabled = true;
      }
      cleanupMode = () => { if (quizTimer) clearInterval(quizTimer); quizTimer = null; };
    }
    startNewQuiz();
  }

  // =========================================================
  // TAB 5: VIẾT LẠI CÂU (TỰ NHẬP CÂU + CHỌN ĐỒNG NGHĨA)
  // =========================================================
  function renderRewriteTrainer() {
    let mode = 'type'; // 'type' | 'mcq'
    const header = element('div', 'eng-vocab-filters');
    const typeBtn = button('Tự viết lại câu', 'exam-tab selected', () => { mode = 'type'; paint(); });
    const mcqBtn = button('Chọn câu đồng nghĩa (A/B/C/D)', 'exam-tab', () => { mode = 'mcq'; paint(); });
    header.append(typeBtn, mcqBtn);
    const list = element('div', 'eng-quiz-list');
    stage.replaceChildren(header, list);

    function paint() {
      typeBtn.classList.toggle('selected', mode === 'type');
      mcqBtn.classList.toggle('selected', mode === 'mcq');
      list.replaceChildren();
      REWRITE_EXERCISES.forEach((ex, i) => {
        const card = element('article', 'exam-question');
        card.append(
          element('span', 'exam-card-pill', ex.grammarPoint),
          element('h4', '', `Câu ${i + 1}: "${ex.original}"`),
          element('p', 'exam-message', ex.promptHint)
        );
        const feedback = element('p', 'exam-message', '');
        feedback.hidden = true;

        if (mode === 'type') {
          const input = Object.assign(document.createElement('input'), {
            type: 'text',
            className: 'exam-input',
            placeholder: 'Nhập câu tiếng Anh viết lại hoàn chỉnh…'
          });
          const row = element('div', 'exam-tabs');
          const checkBtn = button('Kiểm tra', 'primary-btn', () => {
            const res = checkSentenceRewrite(input.value, ex.accepted);
            feedback.hidden = false;
            feedback.className = `exam-message ${res.correct ? 'is-ok' : 'exam-error'}`;
            feedback.textContent = res.correct
              ? `✓ Chính xác! ${ex.explain}`
              : `Chưa trùng đáp án chuẩn. Tham khảo: "${ex.accepted[0]}." — ${ex.explain}`;
          });
          const showKeyBtn = button('Xem đáp án', 'exam-tab', () => {
            feedback.hidden = false;
            feedback.className = 'exam-message';
            feedback.textContent = `Đáp án gợi ý: "${ex.accepted[0]}." — ${ex.explain}`;
          });
          row.append(checkBtn, showKeyBtn);
          card.append(input, row, feedback);
        } else {
          const opts = element('div', 'exam-options');
          ex.mcqOptions.forEach((optText, j) => {
            const letter = 'ABCD'[j];
            const b = button(`${letter}. ${optText}`, 'exam-option', () => {
              for (const c of opts.children) c.disabled = true;
              b.classList.add(letter === ex.mcqAnswer ? 'is-correct' : 'is-wrong');
              feedback.hidden = false;
              feedback.className = `exam-message ${letter === ex.mcqAnswer ? 'is-ok' : 'exam-error'}`;
              feedback.textContent = `${letter === ex.mcqAnswer ? '✓ Chính xác!' : `✗ Đáp án đúng: ${ex.mcqAnswer}.`} ${ex.explain}`;
            });
            opts.append(b);
          });
          card.append(opts, feedback);
        }
        list.append(card);
      });
    }
    paint();
  }

  switchSubTab(activeSubTab);
}
