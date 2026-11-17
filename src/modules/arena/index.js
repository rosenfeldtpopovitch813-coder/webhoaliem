import { element, button } from '../../core/dom.js';
import { auth } from '../../core/firebase.js';
import { ARENA_SUBJECTS } from '../../../shared/arena-core.js';
import { STARTER_DECKS } from './decks-data.js';
import { renderEnglishStudio } from './english-studio.js';
import { renderMillionaire } from './millionaire.js';
import { renderBattleMode } from './battle.js';
import { renderHundredArena } from './hundred.js';

async function apiCall(action, payload = {}, method = 'POST') {
  if (!auth?.currentUser) throw Error('Đăng nhập Google để sử dụng chế độ Online & lưu đề lên máy chủ.');
  const token = await auth.currentUser.getIdToken();
  const url = method === 'GET' ? `/api/arena?${new URLSearchParams({ action, ...payload })}` : '/api/arena';
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {})
    },
    body: method === 'POST' ? JSON.stringify({ action, ...payload }) : undefined,
    cache: 'no-store'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || `HTTP ${response.status}`);
  return data;
}

const LOCAL_DECKS_KEY = 'htvvm-arena-local-decks-v1';
function loadLocalDecks() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_DECKS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
function saveLocalDecks(list) {
  try { localStorage.setItem(LOCAL_DECKS_KEY, JSON.stringify(list)); } catch {}
}

export function renderArena() {
  let activeCleanup = () => {};
  const root = element('div', 'exam-root arena-root');
  const hero = element('section', 'hero exam-hero');
  hero.append(
    element('h2', 'hero-title', 'Đấu trường học tập đa môn'),
    element('p', 'hero-subtitle', 'Lựa chọn chế độ Đối kháng, ôn luyện Tiếng Anh, Ai là Triệu Phú hoặc Đấu trường 100 theo bộ đề môn học.')
  );
  const body = element('div', 'arena-body');
  root.append(hero, body);

  let serverDecks = [];
  const allDecks = () => [...serverDecks, ...loadLocalDecks(), ...STARTER_DECKS];

  async function refreshDecks(onLoaded) {
    if (!auth?.currentUser) {
      serverDecks = [];
      onLoaded?.();
      return;
    }
    try {
      const res = await apiCall('deck-list', {}, 'GET');
      serverDecks = Array.isArray(res.decks) ? res.decks : [];
    } catch {
      serverDecks = [];
    }
    if (root.isConnected) onLoaded?.();
  }

  function clearActiveMode() {
    try { activeCleanup(); } catch {}
    activeCleanup = () => {};
  }

  function openMode(mode, { code = '', deckId = '' } = {}) {
    clearActiveMode();
    hero.hidden = true;
    const decks = deckId
      ? [
          ...allDecks().filter((d) => d.id === deckId),
          ...allDecks().filter((d) => d.id !== deckId)
        ]
      : allDecks();

    if (mode === 'english') {
      renderEnglishStudio(body, { onBack: showHub });
      return;
    }
    if (mode === 'millionaire') {
      activeCleanup = renderMillionaire(body, { availableDecks: decks, onBack: showHub });
      return;
    }
    if (mode === 'battle') {
      activeCleanup = renderBattleMode(body, { apiCall, availableDecks: decks, initialCode: code, onBack: showHub });
      return;
    }
    if (mode === 'hundred') {
      activeCleanup = renderHundredArena(body, { apiCall, availableDecks: decks, initialCode: code, onBack: showHub });
      return;
    }
    showHub();
  }

  function showHub() {
    clearActiveMode();
    hero.hidden = false;

    const filterBar = element('div', 'arena-hub-filters');
    let connFilter = 'all'; // 'all' | 'online' | 'offline'
    const btnAll = button('Tất cả', 'exam-tab selected', () => setFilter('all'));
    const btnOnline = button('Chơi trực tuyến', 'exam-tab', () => setFilter('online'));
    const btnOffline = button('Tự luyện', 'exam-tab', () => setFilter('offline'));
    filterBar.append(btnAll, btnOnline, btnOffline);

    const gamesGrid = element('div', 'arena-games-grid');
    const gameCards = [
      {
        id: 'battle', tag: 'Trực tuyến & tự luyện', tags: ['online', 'offline'], accent: 'is-emerald',
        title: 'Đối kháng',
        desc: 'Trả lời nhanh theo vòng cùng bạn bè qua mã phòng hoặc tự luyện với máy theo bộ đề môn học.',
        cta: 'Vào Đối kháng'
      },
      {
        id: 'english', tag: 'Từ vựng & ngữ pháp', tags: ['offline'], accent: 'is-indigo',
        title: 'Tiếng Anh',
        desc: 'Ôn từ vựng qua thẻ ghi nhớ, phát âm, sổ từ cá nhân, trắc nghiệm, viết lại câu và chuyên đề ngữ pháp.',
        cta: 'Vào Tiếng Anh'
      },
      {
        id: 'millionaire', tag: '15 câu hỏi', tags: ['offline', 'online'], accent: 'is-amber',
        title: 'Ai là Triệu Phú',
        desc: 'Trả lời lần lượt 15 câu trắc nghiệm theo độ khó tăng dần với 3 quyền trợ giúp và 3 mốc an toàn.',
        cta: 'Vào Ai là Triệu Phú'
      },
      {
        id: 'hundred', tag: 'Nhiều người chơi · QR', tags: ['online'], accent: 'is-rose',
        title: 'Đấu trường 100',
        desc: 'Mở phòng bằng mã QR cho nhiều người cùng tham gia; trả lời sai sẽ bị loại cho tới khi còn người thắng cuối cùng.',
        cta: 'Vào Đấu trường 100'
      }
    ];

    const drawGames = () => {
      gamesGrid.replaceChildren();
      btnAll.classList.toggle('selected', connFilter === 'all');
      btnOnline.classList.toggle('selected', connFilter === 'online');
      btnOffline.classList.toggle('selected', connFilter === 'offline');
      const visible = gameCards.filter((g) => connFilter === 'all' || g.tags.includes(connFilter));
      for (const g of visible) {
        const card = element('article', `arena-game-card ${g.accent}`);
        card.append(
          element('span', 'arena-game-tag', g.tag),
          element('h3', 'arena-game-title', g.title),
          element('p', 'arena-game-desc', g.desc),
          button(g.cta, 'primary-btn', () => openMode(g.id))
        );
        gamesGrid.append(card);
      }
    };
    function setFilter(next) { connFilter = next; drawGames(); }
    drawGames();

    // Teacher Quick-Quiz Multi-Subject Section
    const decksPanel = element('section', 'exam-panel arena-decks-panel');
    const decksHead = element('div', 'arena-decks-head');
    const headTitle = element('div', '');
    headTitle.append(
      element('h3', 'exam-heading', 'Bộ đề câu hỏi theo môn'),
      element('p', 'exam-message', 'Tạo hoặc chọn bộ câu hỏi nhiều môn để mở phòng Đối kháng, Ai là Triệu Phú hoặc Đấu trường 100.')
    );
    let subjectFilter = 'Tất cả';
    const creatorWrap = element('div', 'arena-deck-creator');
    creatorWrap.hidden = true;
    const toggleCreateBtn = button('+ Tạo bộ đề', 'primary-btn', () => {
      creatorWrap.hidden = !creatorWrap.hidden;
    });
    decksHead.append(headTitle, toggleCreateBtn);

    // Quick deck builder form
    const deckTitleIn = Object.assign(document.createElement('input'), { className: 'exam-input', placeholder: 'Tên bộ đề (vd: Ôn nhanh Hóa học 12 - Chương Ester)' });
    const deckSubjSel = document.createElement('select');
    deckSubjSel.className = 'exam-input';
    for (const s of ARENA_SUBJECTS) {
      const o = element('option', '', s);
      o.value = s;
      deckSubjSel.append(o);
    }
    const qDrafts = [
      { kind: 'mcq', prompt: '', options: ['', '', '', ''], answer: 'A' },
      { kind: 'mcq', prompt: '', options: ['', '', '', ''], answer: 'A' }
    ];
    const qDraftList = element('div', 'exam-editor');
    const drawDrafts = () => {
      qDraftList.replaceChildren();
      qDrafts.forEach((q, idx) => {
        const qCard = element('div', 'exam-question');
        const qTop = element('div', 'arena-q-head');
        const kSel = document.createElement('select');
        kSel.className = 'exam-input';
        for (const [kv, kl] of [['mcq', 'Trắc nghiệm 4 lựa chọn'], ['short', 'Nhập đáp án ngắn']]) {
          const o = element('option', '', kl);
          o.value = kv;
          kSel.append(o);
        }
        kSel.value = q.kind;
        kSel.onchange = () => { q.kind = kSel.value; q.answer = q.kind === 'short' ? '' : 'A'; drawDrafts(); };
        qTop.append(element('strong', '', `Câu ${idx + 1}`), kSel, button('Xóa', 'exam-tab', () => { qDrafts.splice(idx, 1); drawDrafts(); }));
        qCard.append(qTop);

        const pIn = Object.assign(document.createElement('input'), { className: 'exam-input', placeholder: 'Nhập câu hỏi…', value: q.prompt });
        pIn.oninput = () => { q.prompt = pIn.value; };
        qCard.append(pIn);

        if (q.kind === 'short') {
          const aIn = Object.assign(document.createElement('input'), { className: 'exam-input', placeholder: 'Đáp án đúng (hỗ trợ Đấu trường 100)', value: q.answer });
          aIn.oninput = () => { q.answer = aIn.value; };
          qCard.append(aIn);
        } else {
          for (let j = 0; j < 4; j++) {
            const oIn = Object.assign(document.createElement('input'), { className: 'exam-input', placeholder: `Phương án ${'ABCD'[j]}`, value: q.options[j] || '' });
            oIn.oninput = () => { q.options[j] = oIn.value; };
            qCard.append(oIn);
          }
          const aSel = document.createElement('select');
          aSel.className = 'exam-input';
          for (const l of 'ABCD') {
            const o = element('option', '', `Đáp án đúng: ${l}`);
            o.value = l;
            aSel.append(o);
          }
          aSel.value = 'ABCD'.includes(q.answer) ? q.answer : 'A';
          aSel.onchange = () => { q.answer = aSel.value; };
          qCard.append(aSel);
        }
        qDraftList.append(qCard);
      });
    };
    drawDrafts();

    const deckMsg = element('p', 'exam-message', '');
    const deckActions = element('div', 'exam-tabs');
    deckActions.append(
      button('+ Thêm câu Trắc nghiệm', 'exam-tab', () => { qDrafts.push({ kind: 'mcq', prompt: '', options: ['', '', '', ''], answer: 'A' }); drawDrafts(); }),
      button('+ Thêm câu Nhập đáp án', 'exam-tab', () => { qDrafts.push({ kind: 'short', prompt: '', options: [], answer: '' }); drawDrafts(); }),
      button('Lưu trực tuyến', 'primary-btn', async () => {
        deckMsg.textContent = 'Đang lưu bộ đề lên hệ thống…';
        try {
          await apiCall('deck-create', { title: deckTitleIn.value, subject: deckSubjSel.value, questions: qDrafts });
          deckMsg.textContent = 'Đã lưu bộ đề lên hệ thống.';
          await refreshDecks(drawDeckGrid);
        } catch (e) { deckMsg.textContent = e.message; }
      }),
      button('Lưu trên máy', 'focus-btn', () => {
        const title = deckTitleIn.value.trim();
        if (!title || qDrafts.length < 1) { deckMsg.textContent = 'Nhập tên đề và ít nhất 1 câu hỏi.'; return; }
        const local = loadLocalDecks();
        local.unshift({
          id: `local-${Date.now()}`,
          title,
          subject: deckSubjSel.value,
          ownerName: 'Lưu trên máy',
          isLocal: true,
          questions: qDrafts.map((q) => ({ ...q, options: [...(q.options || [])] }))
        });
        saveLocalDecks(local);
        deckMsg.textContent = 'Đã lưu bộ đề trên trình duyệt.';
        drawDeckGrid();
      })
    );
    creatorWrap.append(deckTitleIn, deckSubjSel, qDraftList, deckActions, deckMsg);

    const subjBar = element('div', 'eng-theme-pills');
    const decksGrid = element('div', 'arena-decks-grid');
    const drawDeckGrid = () => {
      subjBar.replaceChildren();
      for (const s of ['Tất cả', ...ARENA_SUBJECTS]) {
        subjBar.append(button(s, `exam-tab${subjectFilter === s ? ' selected' : ''}`, () => { subjectFilter = s; drawDeckGrid(); }));
      }
      decksGrid.replaceChildren();
      const filtered = allDecks().filter((d) => subjectFilter === 'Tất cả' || d.subject === subjectFilter);
      if (!filtered.length) {
        decksGrid.append(element('p', 'exam-message', 'Chưa có bộ đề cho môn này — bấm "+ Tạo bộ đề" ở trên để thêm mới.'));
        return;
      }
      for (const d of filtered) {
        const card = element('article', 'arena-deck-card');
        const badges = element('div', 'exam-card-badges');
        badges.append(
          element('span', 'exam-card-pill is-doc', d.subject || 'Tổng hợp'),
          element('span', 'exam-card-pill', `${(d.questions || []).length} câu`)
        );
        if (d.isLocal) badges.append(element('span', 'exam-card-pill', 'Offline'));
        else if (d.ownerName) badges.append(element('span', 'exam-card-pill is-done', d.ownerName));

        const launchRow = element('div', 'arena-deck-actions');
        const hasMcq = (d.questions || []).some((q) => q.kind !== 'short');
        if (hasMcq) {
          launchRow.append(
            button('Triệu Phú', 'exam-tab', () => openMode('millionaire', { deckId: d.id })),
            button('Đối kháng', 'exam-tab', () => openMode('battle', { deckId: d.id }))
          );
        }
        launchRow.append(button('Đấu trường 100', 'primary-btn', () => openMode('hundred', { deckId: d.id })));

        if (d.isOwner || d.isLocal) {
          launchRow.append(button('Xóa', 'exam-card-delete-btn', async () => {
            if (d.isLocal) {
              saveLocalDecks(loadLocalDecks().filter((x) => x.id !== d.id));
              drawDeckGrid();
            } else {
              await apiCall('deck-delete', { deckId: d.id }).catch(() => {});
              await refreshDecks(drawDeckGrid);
            }
          }));
        }
        card.append(badges, element('strong', '', d.title), launchRow);
        decksGrid.append(card);
      }
    };

    decksPanel.append(decksHead, creatorWrap, subjBar, decksGrid);
    body.replaceChildren(filterBar, gamesGrid, decksPanel);
    drawDeckGrid();
    void refreshDecks(drawDeckGrid);
  }

  // Deep link support for QR scans (?mode=battle&code=... / ?mode=hundred&code=... / ?mode=english)
  const params = new URLSearchParams(window.location.search);
  const qMode = params.get('mode');
  const qCode = (params.get('code') || '').trim().toUpperCase();
  if (qMode && ['battle', 'hundred', 'english', 'millionaire'].includes(qMode)) {
    openMode(qMode, { code: qCode });
  } else {
    showHub();
  }

  const watcher = new MutationObserver(() => {
    if (!root.isConnected) {
      clearActiveMode();
      watcher.disconnect();
    }
  });
  watcher.observe(document.getElementById('main-content') || document.body, { childList: true });

  return root;
}
